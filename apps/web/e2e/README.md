# constructor — e2e tests + narrated demo videos

Six Playwright specs that walk the demo flow end-to-end. Each spec produces
a silent webm via Playwright's built-in video recording, which the
narration pipeline then overlays with ElevenLabs TTS to produce a
narrated MP4 per scenario.

## One-time setup

```bash
# Install browser binaries (~200 MB, takes a minute)
pnpm --filter @constructor/web exec playwright install chromium

# Capture an authenticated session — opens a real browser, you sign in
# manually, the script saves the storage-state for subsequent runs.
pnpm --filter @constructor/web test:e2e:auth-setup

# Optional: env vars for ElevenLabs narration
echo 'ELEVENLABS_API_KEY=...' >> apps/web/.env.local
echo 'ELEVENLABS_VOICE_ID=...' >> apps/web/.env.local
```

`ffmpeg` must be on PATH for narration. On Windows: `winget install ffmpeg`.

## Running

```bash
# Headless run — fast, no browser window. Use for CI + quick smoke.
pnpm --filter @constructor/web test:e2e

# Headed — opens a real browser at human pace. Use for visual debug.
pnpm --filter @constructor/web test:e2e:headed

# Headless run + ElevenLabs narration overlay → narrated MP4 per spec
pnpm --filter @constructor/web test:e2e:narrate
```

## Output structure

After a `test:e2e:narrate` run:

```
apps/web/e2e/test-results/
├── results.json                    # raw Playwright JSON reporter output
├── artifacts/
│   └── 01-project-setup-chromium/
│       └── video.webm              # silent recording from Playwright
├── audio/
│   └── 01-step-1.mp3               # ElevenLabs TTS clip per step
├── narrated/
│   ├── 01-project-setup.mp4        # full-test narrated video
│   └── 02-co-magic-link.mp4        # ...
└── playwright-report/              # HTML report (open index.html)
```

Zip the per-spec MP4s and send. They're the demo deliverable.

## Spec narration philosophy

Each `test.step('Lena clicks Approve and the contractor's queue updates.')`
is BOTH a Playwright assertion boundary AND a narration line. The step
title is read aloud verbatim — write them as you'd want them spoken.
Avoid jargon, avoid passive voice, name the actor.

Narrator persona (default): **Lena Torres, project manager at Spartan
Construction.** Replace per-spec if a different role is acting.
