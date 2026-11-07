# Seller’s Notebook video library

Promotional source files remain in `promo/`. Paths such as `dist/` and `audio/` below refer to that directory.

Five approved, 15-second exports are retained in `promo/dist/`:

| File                                               | Use                                                            |
| -------------------------------------------------- | -------------------------------------------------------------- |
| `sellers-notebook-landing-loop.mp4`                | Silent 1920×1080 homepage loop covering all six main features  |
| `sellers-notebook-social-vertical.mp4`             | Silent 1080×1920 general social promo                          |
| `sellers-notebook-expenses-suppliers-vertical.mp4` | Silent 1080×1920 expenses and suppliers promo                  |
| `sellers-notebook-social-narrated.mp4`             | General social promo with narration, music and effects         |
| `sellers-notebook-expenses-suppliers-narrated.mp4` | Expenses and suppliers promo with narration, music and effects |

All use H.264 and MP4 faststart and are under 5 MB each. Covers, the landing poster, narration subtitles and final export verification records are retained alongside the videos. See `promotional-audio.md` for voice and music details, and `promotional-storyboard.md` for the approved storyboards.

The homepage serves its loop and poster from `../public/media/` through `components/landing-preview.tsx`. Playback is muted and inline, loops automatically, includes native controls and a poster, and respects reduced-motion preferences.

## Source and rebuild

`public/` contains the eight real Playwright feature clips recorded at 1920×1080 with fictional sample data. `src/index.jsx` defines the current Remotion compositions. `audio/` keeps the narration, word timings, original music, sound-effect stems and mixes needed to reproduce the audio versions. Capture helpers require a separately authorized session at the ignored `session.private.json`; no session or credentials are retained.

From the repository root, install the isolated video dependencies when needed:

```powershell
npm ci --prefix promo
node promo/render-variants.cjs
node promo/render-variants.cjs --operations
node promo/render-narrated.cjs
```

The first render command builds the landing loop and silent general social promo. The second builds the landing loop and silent expenses/suppliers promo. The third builds the two narrated promos. Microsoft Edge and FFmpeg/FFprobe must be installed. Root website dependencies are separate.

To regenerate audio, create a standard Python virtual environment at `promo/audio-env`, install `audio-requirements.txt` into it, and follow `promotional-audio.md`. Existing audio sources allow video re-export without calling the speech service again.

Raw browser recordings, inspection screenshots and scripts, the superseded first draft, render masters, encoder logs, temporary dependencies and the old standalone embed example were removed after approval. Rebuild tools recreate intermediates as needed. The approved exports were checked by SHA-256 before and after cleanup.
