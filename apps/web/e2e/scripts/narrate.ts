import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ElevenLabs narration pipeline. Reads Playwright's JSON results,
// extracts every `test.step(title, ...)` boundary with its start/end
// timestamps, generates an MP3 per step via ElevenLabs TTS, and
// overlays them onto the silent test video at the right offsets via
// ffmpeg.
//
// Output: one narrated MP4 per spec at
//   apps/web/e2e/test-results/narrated/<spec-slug>.mp4
//
// Requires: ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID env vars, ffmpeg on PATH.
//
// Run after a Playwright run:
//   pnpm test:e2e:narrate   (does both in sequence)

const __dirname = dirname(fileURLToPath(import.meta.url));
const E2E_ROOT = resolve(__dirname, '..');
const RESULTS_JSON = resolve(E2E_ROOT, 'test-results/results.json');
const ARTIFACTS_DIR = resolve(E2E_ROOT, 'test-results/artifacts');
const AUDIO_DIR = resolve(E2E_ROOT, 'test-results/audio');
const NARRATED_DIR = resolve(E2E_ROOT, 'test-results/narrated');

const ELEVEN_API = 'https://api.elevenlabs.io/v1/text-to-speech';
const DEFAULT_MODEL = 'eleven_turbo_v2_5';

type Step = {
  title: string;
  startTime: string; // ISO
  duration: number; // ms
};

type SpecResult = {
  file: string; // basename of spec, e.g. "01-project-setup.spec.ts"
  title: string;
  startTime: string;
  duration: number;
  steps: Step[];
  videoPath: string | null;
};

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function loadEnv() {
  const envPath = resolve(E2E_ROOT, '..', '.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(trimmed);
    if (m && !process.env[m[1]!]) {
      process.env[m[1]!] = m[2]!.replace(/^"(.*)"$/, '$1');
    }
  }
}

function checkFfmpeg() {
  const result = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (result.status !== 0) {
    fail(
      'ffmpeg not found on PATH. Install it (Windows: winget install ffmpeg) and retry.',
    );
  }
}

async function tts(text: string, voiceId: string, apiKey: string): Promise<Buffer> {
  const url = `${ELEVEN_API}/${voiceId}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: DEFAULT_MODEL,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true,
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ElevenLabs ${res.status}: ${body}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// Playwright's JSON reporter nests results under `suites`. We flatten to
// the leaf test specs we care about.
function flattenSpecs(report: any): SpecResult[] {
  const out: SpecResult[] = [];
  function walk(node: any) {
    if (Array.isArray(node?.suites)) for (const s of node.suites) walk(s);
    if (Array.isArray(node?.specs)) {
      for (const spec of node.specs) {
        for (const t of spec.tests ?? []) {
          const run = t.results?.[0];
          if (!run) continue;
          const steps = (run.steps ?? []).map((s: any) => ({
            title: s.title,
            startTime: s.startTime,
            duration: s.duration,
          }));
          const videoAttachment = (run.attachments ?? []).find(
            (a: any) => a.contentType?.startsWith('video/') && a.path,
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

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/\.spec\.ts$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function main() {
  loadEnv();
  checkFfmpeg();

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) {
    fail(
      'ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID must be set in apps/web/.env.local',
    );
  }

  if (!existsSync(RESULTS_JSON)) {
    fail(
      `${RESULTS_JSON} not found — run \`pnpm test:e2e\` first to generate results.`,
    );
  }

  const report = JSON.parse(readFileSync(RESULTS_JSON, 'utf8'));
  const specs = flattenSpecs(report);
  if (specs.length === 0) fail('No test results found in results.json.');

  mkdirSync(AUDIO_DIR, { recursive: true });
  mkdirSync(NARRATED_DIR, { recursive: true });

  for (const spec of specs) {
    const specSlug = slug(spec.file);
    console.log(`\n=== ${specSlug} (${spec.steps.length} steps) ===`);

    if (!spec.videoPath) {
      console.warn(`  ⚠  no video attachment — skipping`);
      continue;
    }
    if (!existsSync(spec.videoPath)) {
      // Playwright sometimes writes paths relative to outputDir; try resolving.
      const fallback = readdirSync(ARTIFACTS_DIR, { recursive: true }).find((f) =>
        String(f).endsWith('.webm'),
      );
      if (!fallback) {
        console.warn(`  ⚠  video file missing: ${spec.videoPath}`);
        continue;
      }
      spec.videoPath = resolve(ARTIFACTS_DIR, String(fallback));
    }

    // Generate one MP3 per step.
    const audioFiles: { path: string; offsetMs: number }[] = [];
    const specStart = new Date(spec.startTime).getTime();
    for (let i = 0; i < spec.steps.length; i++) {
      const step = spec.steps[i]!;
      // Skip auto-generated outer step (Playwright wraps the test body).
      if (step.title === spec.title || step.title === 'Worker Cleanup') continue;

      const audioPath = resolve(AUDIO_DIR, `${specSlug}-${i + 1}.mp3`);
      const offsetMs = new Date(step.startTime).getTime() - specStart;

      if (!existsSync(audioPath)) {
        process.stdout.write(`  [${i + 1}/${spec.steps.length}] ${step.title}\n`);
        try {
          const mp3 = await tts(step.title, voiceId, apiKey);
          writeFileSync(audioPath, mp3);
        } catch (err) {
          console.error(
            `    ✗ TTS failed: ${err instanceof Error ? err.message : err}`,
          );
          continue;
        }
      } else {
        process.stdout.write(`  [${i + 1}] (cached) ${step.title}\n`);
      }

      audioFiles.push({ path: audioPath, offsetMs: Math.max(0, offsetMs) });
    }

    if (audioFiles.length === 0) {
      console.warn(`  ⚠  no audio clips for ${specSlug} — skipping ffmpeg`);
      continue;
    }

    // Build an ffmpeg filter that delays each audio clip to its step's
    // offset and mixes them with the video. We use adelay (ms) per stream
    // then amix to combine.
    const inputs = [
      '-i',
      spec.videoPath!,
      ...audioFiles.flatMap((a) => ['-i', a.path]),
    ];

    const filterParts = audioFiles.map(
      (a, idx) => `[${idx + 1}:a]adelay=${a.offsetMs}|${a.offsetMs}[a${idx}]`,
    );
    const amixInputs = audioFiles.map((_, idx) => `[a${idx}]`).join('');
    const filter = [
      ...filterParts,
      `${amixInputs}amix=inputs=${audioFiles.length}:dropout_transition=0[aout]`,
    ].join(';');

    const outputPath = resolve(NARRATED_DIR, `${specSlug}.mp4`);
    const ffmpegArgs = [
      ...inputs,
      '-filter_complex',
      filter,
      '-map',
      '0:v',
      '-map',
      '[aout]',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-shortest',
      '-y',
      outputPath,
    ];

    console.log(`  → mixing → ${outputPath}`);
    const result = spawnSync('ffmpeg', ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.status !== 0) {
      console.error(`  ✗ ffmpeg failed:\n${result.stderr?.toString()}`);
      continue;
    }
    console.log(`  ✓ ${outputPath}`);
  }

  console.log('\nDone. Narrated MP4s in:', NARRATED_DIR);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
