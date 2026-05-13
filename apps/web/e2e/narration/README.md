# Demo narration scripts — Path C, manual record

Six scenario scripts plus an intro. Total recorded length: ~9–10 minutes.

Each script is structured as:
1. **Stage direction** in square brackets — what to show on screen
2. **Narration line** as a blockquote — what to feed ElevenLabs

The blockquote text is the only thing you paste. Each blockquote is
one "beat" — a short clip you generate, save, and overlay onto the
corresponding screen-recording segment.

## Files

| File | Length | Purpose |
|---|---|---|
| [00-intro.md](00-intro.md) | ~25s | Title card stitching the six scenarios into one demo |
| [01-project-setup.md](01-project-setup.md) | ~90s | Lincoln Elementary stood up end-to-end |
| [02-co-magic-link.md](02-co-magic-link.md) | ~110s | **The wedge.** CO chain + atomic propagation |
| [03-pay-cycle.md](03-pay-cycle.md) | ~120s | Full monthly cycle, sub → GC → owner → paid |
| [04-drift-detection.md](04-drift-detection.md) | ~45s | The safety net |
| [05-sworn-statement.md](05-sworn-statement.md) | ~70s | Compliance chain |
| [06-soft-delete.md](06-soft-delete.md) | ~50s | Recoverability |

## Suggested workflow

1. **Set up the data once** — walk scenario 1 in the real app so you
   have Lincoln Elementary with the seed data. Subsequent scenarios
   build on this state.
2. **Record one scenario at a time** with OBS / Loom. No need to
   narrate live — the audio comes later.
3. **For each beat in the script:**
   - Paste the blockquote text into ElevenLabs
   - Generate the clip (typically Rachel or another professional voice)
   - Save as `<scenario>-<beat-number>.mp3`
4. **In your video editor** (Descript, CapCut, Premiere, iMovie):
   - Drop the silent screen recording on the timeline
   - Layer each MP3 over the matching beat
   - Adjust timing if a clip runs long — easiest fix is a brief pause
     in the recording at scene transitions
5. **Export** at 1080p, .mp4, send to Spartan

## Voice recommendations

ElevenLabs voices that work well for product demos (calm, confident,
mid-pitch, neutral US accent):

- **Rachel** (free tier) — most common, slightly warm
- **Adam** — masculine equivalent
- **Charlotte** — slightly warmer, more conversational
- **Antoni** — closer to the "tech demo" voice you hear in YC pitches

Use `eleven_turbo_v2_5` for cost (~$0.30 per 1,000 chars) unless
multilingual_v2 sounds notably better — usually it doesn't for English-only.

Voice settings: stability 0.5, similarity_boost 0.75, style 0.0,
speaker boost on. These match the defaults in the narrate.ts script
so when we later switch to auto-generation, you won't hear a change.

## Estimated cost

Total narration text across all scripts: ~3,500 characters. At Turbo v2.5
pricing that's about $1.10 of API spend. Re-generations are cheap.

## After Spartan

Once you've shipped these manual videos, we polish the Playwright
specs (e2e/specs/01-06) and the narrate.ts pipeline so future code
changes auto-regenerate the same videos via `pnpm test:e2e:narrate`.
Same step titles, same voice, same overlay logic — just no human
in the loop.
