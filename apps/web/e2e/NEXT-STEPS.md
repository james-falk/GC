# Next steps — Playwright + ElevenLabs demo recording

Everything that doesn't require your input is done. Here's the exact
path to demo videos.

## Step 1 — You: capture a Clerk session (30 seconds, one-time)

```powershell
pnpm --filter @constructor/web test:e2e:auth-setup
```

A Chromium window opens at `http://localhost:3001`. Sign in normally
(Clerk modal, your usual credentials). Navigate to `/dashboard`. Come
back to the terminal and press **ENTER**.

Output: `apps/web/e2e/.auth/storage-state.json` saved. Every spec from
here on will auto-authenticate.

**Pre-requisite**: the dev server must be running first.
```powershell
pnpm --filter @constructor/web dev
```
Leave that running in one terminal; do the auth-setup in another.

## Step 2 — Me: drive the suite, produce captioned MP4s

Once `storage-state.json` exists, tell me and I run:

```powershell
pnpm --filter @constructor/web test:e2e:captions
```

This:
1. Boots Chromium (visible, slowMo 1.2s/action so captions have breathing room)
2. Walks all 7 specs (smoke + 6 scenarios) end-to-end against the dev server
3. Records video per spec (silent webm)
4. Overlays each `test.step('...')` title as an on-screen subtitle at the bottom of the frame, on screen from when the step starts until the next step starts
5. Produces 6 captioned MP4s in `apps/web/e2e/test-results/narrated/<spec>-captioned.mp4`

Expected debug load: ~1-2 sessions of fixing selector mismatches before
all 6 scenarios run green. I'll iterate.

## Step 3 — You: review the captioned MP4s

Open the MP4s and validate:
- Does the screen recording show the right thing?
- Does the caption text land at the right moment?
- Is the pacing comfortable?
- Anything missing from the demo?

This is where you decide on:
- Which scenarios make the cut for Spartan
- Voice / pacing tweaks
- Whether to re-record with adjustments

## Step 4 — You: pick a voice + add ElevenLabs key

Once captions look right:

1. Sign in at <https://elevenlabs.io>
2. **Voices** in the left nav. Browse, click a voice to preview, copy
   its **Voice ID** (looks like `21m00Tcm4TlvDq8ikWAM`).
   - Default recommendation: **Rachel** — `21m00Tcm4TlvDq8ikWAM`
   - Alternatives: **Adam** (`pNInz6obpgDQGcFmaJgB`),
     **Charlotte** (`XB0fDUnXU5powFXDhCwa`),
     **Antoni** (`ErXwobaYiN019PkySvjV`)
3. **API Keys** in the left nav → create a key (starts with `sk_...`)
4. Append to `apps/web/.env.local`:
   ```
   ELEVENLABS_API_KEY=sk_...
   ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
   ```
5. Tell me, and I run:
   ```powershell
   pnpm --filter @constructor/web test:e2e:narrate
   ```
   Same suite, but `narrate.ts` generates one TTS MP3 per step and
   ffmpeg-overlays them on the video at the right offsets. Output:
   `apps/web/e2e/test-results/narrated/<spec>.mp4` per scenario.

## Cost estimate

- Captioned (Step 2): free, all local ffmpeg.
- Narrated (Step 4): ~$1.10 of ElevenLabs Turbo v2.5 spend per full run.
  Free tier (10k chars/mo) covers ~3 runs before billing kicks in.

## State of the scaffolding

| File | What it does | Tested? |
|---|---|---|
| `playwright.config.ts` | slowMo 1.2s, video on, JSON reporter, storageState load | Config syntax verified |
| `e2e/setup/auth.setup.ts` | One-time interactive Clerk sign-in capture | Not yet — first run |
| `e2e/specs/00-smoke.spec.ts` | Verifies auth + dashboard renders | Not yet |
| `e2e/specs/01-06-*.spec.ts` | 6 narrated demo scenarios | **Not yet — selectors are my best guess, expect 1-2 sessions of fixes** |
| `e2e/scripts/narrate-captions.mjs` | Caption-overlay (no audio) | Not yet — first run |
| `e2e/scripts/narrate.ts` | ElevenLabs + ffmpeg audio overlay | Not yet — first run |

## What's already installed

- ✅ Playwright Chromium binary (~111 MB, downloaded)
- ✅ `@playwright/test`, `@clerk/testing`, `tsx` in apps/web devDeps
- ✅ ffmpeg 8.0.1 with libfreetype on PATH (for drawtext caption overlay)
- ❌ ElevenLabs key + voice ID — deliberately deferred until you preview captions
