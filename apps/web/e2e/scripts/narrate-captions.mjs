// Caption-only overlay. Same input shape as narrate.ts (Playwright JSON
// results + recorded webms) but no audio — just renders each step's
// title as a styled subtitle band at the bottom of the video, on screen
// from when the step starts until the next step starts.
//
// Purpose: the user previews the videos + narration content BEFORE
// committing to ElevenLabs API spend / voice selection. If the captions
// look right, swapping in TTS is a one-script switch (narrate.ts).
//
// Output: e2e/test-results/narrated/<spec-slug>-captioned.mp4 per spec.
//
// Run after `pnpm test:e2e`:
//   node e2e/scripts/narrate-captions.mjs

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const E2E_ROOT = resolve(__dirname, '..');
const RESULTS_JSON = resolve(E2E_ROOT, 'test-results/results.json');
const ARTIFACTS_DIR = resolve(E2E_ROOT, 'test-results/artifacts');
const NARRATED_DIR = resolve(E2E_ROOT, 'test-results/narrated');

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function checkFfmpeg() {
  const result = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (result.status !== 0) {
    fail('ffmpeg not found on PATH.');
  }
}

// Playwright's JSON reporter nests results under suites recursively.
// Flatten to the leaves we care about.
function flattenSpecs(report) {
  const out = [];
  function walk(node) {
    if (Array.isArray(node?.suites)) for (const s of node.suites) walk(s);
    if (Array.isArray(node?.specs)) {
      for (const spec of node.specs) {
        for (const t of spec.tests ?? []) {
          const run = t.results?.[0];
          if (!run) continue;
          const steps = (run.steps ?? []).map((s) => ({
            title: s.title,
            startTime: s.startTime,
            duration: s.duration,
          }));
          const videoAttachment = (run.attachments ?? []).find(
            (a) => a.contentType?.startsWith('video/') && a.path,
          );
          out.push({
            file: spec.file,
            title: spec.title,
            startTime: run.startTime,
            duration: run.duration,
            steps,
            videoPath: videoAttachment?.path ?? null,
          });
        }
      }
    }
  }
  walk(report);
  return out;
}

function slug(s) {
  return s
    .replace(/\.spec\.ts$/, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

// Escape text for ffmpeg drawtext filter. drawtext is finicky — quotes,
// colons, backslashes, percent signs, commas all need escaping in
// filter-graph syntax.
function escapeDrawtext(text) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "’") // smart-quote to dodge filter quote handling
    .replace(/:/g, '\\:')
    .replace(/%/g, '\\%')
    .replace(/,/g, '\\,');
}

function main() {
  checkFfmpeg();

  if (!existsSync(RESULTS_JSON)) {
    fail(
      `${RESULTS_JSON} not found — run \`pnpm test:e2e\` first to generate results.`,
    );
  }

  const report = JSON.parse(readFileSync(RESULTS_JSON, 'utf8'));
  const specs = flattenSpecs(report);
  if (specs.length === 0) fail('No test results found in results.json.');

  mkdirSync(NARRATED_DIR, { recursive: true });

  for (const spec of specs) {
    const specSlug = slug(spec.file);
    console.log(`\n=== ${specSlug} (${spec.steps.length} steps) ===`);

    // Locate the video file. Playwright sometimes writes a relative
    // path; fall back to scanning the artifacts dir for a matching .webm.
    let videoPath = spec.videoPath;
    if (!videoPath || !existsSync(videoPath)) {
      const dirCandidates = readdirSync(ARTIFACTS_DIR, {
        withFileTypes: true,
        recursive: true,
      });
      const found = dirCandidates.find(
        (f) => f.isFile?.() && String(f.name).endsWith('.webm'),
      );
      if (!found) {
        console.warn(`  ⚠  no video file found for ${specSlug} — skipping`);
        continue;
      }
      // @ts-ignore — readdirSync recursive entries carry parentPath in Node 20+
      videoPath = resolve(found.parentPath ?? found.path ?? ARTIFACTS_DIR, found.name);
    }

    // Strip the Playwright auto-wrapped outer step (matches the test title).
    const visibleSteps = spec.steps.filter(
      (s) => s.title !== spec.title && s.title !== 'Worker Cleanup' && s.title?.trim(),
    );
    if (visibleSteps.length === 0) {
      console.warn(`  ⚠  no narration steps for ${specSlug} — skipping`);
      continue;
    }

    // Compute per-step on-screen window: [stepStart, nextStepStart).
    const specStart = new Date(spec.startTime).getTime();
    const captions = visibleSteps.map((s, idx) => {
      const start = (new Date(s.startTime).getTime() - specStart) / 1000;
      const nextStart =
        idx + 1 < visibleSteps.length
          ? (new Date(visibleSteps[idx + 1].startTime).getTime() - specStart) / 1000
          : (spec.duration ?? 0) / 1000;
      return { text: s.title, start: Math.max(0, start), end: Math.max(start + 1, nextStart) };
    });

    // Build a chain of drawtext filters, one per step. Each enable
    // expression activates only during that step's time window.
    const drawtextFilters = captions
      .map((c) => {
        const txt = escapeDrawtext(c.text);
        return [
          `drawtext=text='${txt}'`,
          // Bottom band, white text on translucent dark box, large enough
          // to read at 1080p. fontfile fall-back via fontconfig.
          `fontcolor=white`,
          `fontsize=28`,
          `box=1`,
          `boxcolor=black@0.6`,
          `boxborderw=20`,
          `x=(w-text_w)/2`,
          `y=h-160`,
          `enable='between(t,${c.start.toFixed(2)},${c.end.toFixed(2)})'`,
        ].join(':');
      })
      .join(',');

    const outputPath = resolve(NARRATED_DIR, `${specSlug}-captioned.mp4`);
    const ffmpegArgs = [
      '-i',
      videoPath,
      '-vf',
      drawtextFilters,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-an', // no audio
      '-y',
      outputPath,
    ];

    console.log(`  → ${outputPath}`);
    const result = spawnSync('ffmpeg', ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.status !== 0) {
      const err = result.stderr?.toString() ?? '';
      // Surface the LAST ffmpeg error block; the full output is enormous.
      const lastError = err.split('\n').slice(-30).join('\n');
      console.error(`  ✗ ffmpeg failed:\n${lastError}`);
      continue;
    }
    console.log(`  ✓ ${captions.length} captions overlaid`);
  }

  console.log(`\nDone. Captioned previews in: ${NARRATED_DIR}`);
  console.log(
    '\nReview the MP4s. If pacing + coverage look right, add ELEVENLABS_API_KEY +',
  );
  console.log(
    'ELEVENLABS_VOICE_ID to .env.local and run `pnpm test:e2e:narrate` for audio.',
  );
}

main();
