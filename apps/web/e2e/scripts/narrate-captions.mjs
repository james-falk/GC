// Caption overlay via SRT subtitles. Reads Playwright JSON results,
// writes one SRT file per spec, then ffmpeg-burns the subtitles onto
// the silent webm recording. No audio; just on-screen text that
// validates the narration coverage + pacing.
//
// Why SRT instead of drawtext: drawtext's escape rules around commas
// inside step titles ("Lena, the project manager...") were breaking
// the filter chain silently — captions just didn't render. SRT is
// designed for exactly this case and handles all the escaping itself.
//
// Output: e2e/test-results/narrated/<spec-slug>-captioned.mp4 per spec.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const E2E_ROOT = resolve(__dirname, '..');
const RESULTS_JSON = resolve(E2E_ROOT, 'test-results/results.json');
const ARTIFACTS_DIR = resolve(E2E_ROOT, 'test-results/artifacts');
const NARRATED_DIR = resolve(E2E_ROOT, 'test-results/narrated');
const SRT_DIR = resolve(E2E_ROOT, 'test-results/srt');
// ffmpeg's `subtitles` filter chokes on Windows paths with drive colons +
// spaces (OneDrive\Desktop\...). Write SRT to a short tmp path before
// running ffmpeg.
const SRT_TMP_DIR = resolve(tmpdir(), 'pw-captions');

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function checkFfmpeg() {
  const result = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (result.status !== 0) fail('ffmpeg not found on PATH.');
}

function flattenSpecs(report) {
  const out = [];
  function walk(node) {
    if (Array.isArray(node?.suites)) for (const s of node.suites) walk(s);
    if (Array.isArray(node?.specs)) {
      for (const spec of node.specs) {
        for (const t of spec.tests ?? []) {
          const run = t.results?.[0];
          if (!run) continue;
          // Playwright JSON only carries `duration` on steps, not start
          // time. Compute starts cumulatively from the duration sequence.
          let cursor = 0;
          const steps = (run.steps ?? []).map((s) => {
            const start = cursor;
            const duration = Number(s.duration) || 0;
            cursor += duration;
            return {
              title: s.title,
              startMs: start,
              endMs: start + duration,
            };
          });
          const videoAttachment = (run.attachments ?? []).find(
            (a) => a.contentType?.startsWith('video/') && a.path,
          );
          out.push({
            file: spec.file,
            title: spec.title,
            durationMs: Number(run.duration) || 0,
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

// SRT timestamp format: HH:MM:SS,mmm
function srtTimestamp(seconds) {
  const total = Math.max(0, Math.round(seconds * 1000));
  const ms = total % 1000;
  const totalSec = Math.floor(total / 1000);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function main() {
  checkFfmpeg();

  if (!existsSync(RESULTS_JSON)) {
    fail(`${RESULTS_JSON} not found — run \`pnpm test:e2e\` first.`);
  }

  const report = JSON.parse(readFileSync(RESULTS_JSON, 'utf8'));
  const specs = flattenSpecs(report);
  if (specs.length === 0) fail('No test results found in results.json.');

  mkdirSync(NARRATED_DIR, { recursive: true });
  mkdirSync(SRT_DIR, { recursive: true });

  for (const spec of specs) {
    const specSlug = slug(spec.file);
    console.log(`\n=== ${specSlug} (${spec.steps.length} steps) ===`);

    // Locate the video file. Playwright sometimes writes a relative
    // path; fall back to scanning the artifacts dir for any .webm.
    let videoPath = spec.videoPath;
    if (!videoPath || !existsSync(videoPath)) {
      try {
        const entries = readdirSync(ARTIFACTS_DIR, {
          withFileTypes: true,
          recursive: true,
        });
        const found = entries.find(
          (f) => f.isFile?.() && String(f.name).endsWith('.webm'),
        );
        if (found) {
          videoPath = resolve(found.parentPath ?? ARTIFACTS_DIR, found.name);
        }
      } catch {
        // recursive readdirSync may fail on older Node; ignore.
      }
    }
    if (!videoPath || !existsSync(videoPath)) {
      console.warn(`  ⚠  no video file found for ${specSlug} — skipping`);
      continue;
    }

    // Strip Playwright's auto-wrapped outer step (matches the test title).
    const visibleSteps = spec.steps.filter(
      (s) => s.title !== spec.title && s.title !== 'Worker Cleanup' && s.title?.trim(),
    );
    if (visibleSteps.length === 0) {
      console.warn(`  ⚠  no narration steps for ${specSlug} — skipping`);
      continue;
    }

    // Step start/end times come from cumulative durations (Playwright's
    // JSON reporter only emits per-step duration, not start). Each
    // caption stays on screen for that step's duration; the last caption
    // extends to the end of the recording.
    const captions = visibleSteps.map((s, idx) => {
      const start = (s.startMs ?? 0) / 1000;
      const isLast = idx === visibleSteps.length - 1;
      const end = isLast
        ? Math.max(start + 1, (spec.durationMs ?? 0) / 1000)
        : (s.endMs ?? 0) / 1000;
      return {
        text: s.title,
        start: Math.max(0, start),
        end: Math.max(start + 1, end),
      };
    });

    // Write SRT files to BOTH the repo dir (so they're inspectable +
    // checkable into git) and a short tmp path (so ffmpeg's subtitles
    // filter can actually open them — the filter graph parser chokes on
    // OneDrive\Desktop\... paths with spaces and drive colons).
    const srtPath = resolve(SRT_DIR, `${specSlug}.srt`);
    const srtTmpPath = resolve(SRT_TMP_DIR, `${specSlug}.srt`);
    const srtBody = captions
      .map(
        (c, i) =>
          `${i + 1}\n${srtTimestamp(c.start)} --> ${srtTimestamp(c.end)}\n${c.text}\n`,
      )
      .join('\n');
    writeFileSync(srtPath, srtBody, 'utf8');
    mkdirSync(SRT_TMP_DIR, { recursive: true });
    writeFileSync(srtTmpPath, srtBody, 'utf8');

    // Style: bold, big, white on black-translucent box at the bottom.
    // FontName is a safe fallback; libass picks closest available.
    const styleOverride =
      "FontName=Arial,FontSize=18,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,BackColour=&H80000000,BorderStyle=4,Outline=2,Shadow=0,Alignment=2,MarginV=40,Bold=1";

    const outputPath = resolve(NARRATED_DIR, `${specSlug}-captioned.mp4`);
    // Run ffmpeg from the tmp dir and pass the SRT as a bare basename.
    // Avoids the entire filter-path-escape rabbit hole.
    const filter = `subtitles='${specSlug}.srt':force_style='${styleOverride}'`;

    console.log(`  → ${outputPath}`);
    const result = spawnSync(
      'ffmpeg',
      [
        '-i',
        videoPath,
        '-vf',
        filter,
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-preset',
        'fast',
        '-crf',
        '23',
        '-an',
        '-y',
        outputPath,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'], cwd: SRT_TMP_DIR },
    );
    if (result.status !== 0) {
      const err = result.stderr?.toString() ?? '';
      const tail = err.split('\n').slice(-20).join('\n');
      console.error(`  ✗ ffmpeg failed:\n${tail}`);
      continue;
    }
    console.log(`  ✓ ${captions.length} captions burned`);
  }

  console.log(`\nDone. Captioned previews in: ${NARRATED_DIR}`);
}

main();
