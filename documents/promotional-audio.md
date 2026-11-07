# Narrated social versions

Approved scripts are retained verbatim in `narration-scripts.json`. Existing silent videos are preserved; the landing loop remains silent.

- General: `dist/sellers-notebook-social-narrated.mp4`
- Expenses and suppliers: `dist/sellers-notebook-expenses-suppliers-narrated.mp4`

Both are vertical 1080×1920, 15 seconds / 450 frames, H.264 video with 48 kHz stereo AAC audio and faststart. Companion `.srt` files contain timed narration captions. Visual feature shots are retimed to the spoken phrases using the original Playwright footage and Remotion.

The expenses/suppliers opening reads **“The little costs count too.”** with no comma before “too,” in both narration and the main on-screen headline. Its scene cuts follow the stored speech word timings. To rebuild only that corrected version, pass `--operations-only` to `generate-narration.py`, `mix-audio.cjs`, and `render-narrated.cjs`; the other four approved exports are preserved.

Voice: synthetic English narration generated using `en-US-JennyNeural` through Microsoft Edge's online speech service via edge-tts. General narration uses the generated pace; the operations read uses pitch-preserving 1.10× timing to finish comfortably before the end. Both start 150 ms into the edit. No real person's voice was cloned.

Music: **A Fresh Page**, an original 95 BPM acoustic-style cue made for these edits. Synthesized plucked nylon-style strings, soft piano, light percussion, and small room reflections. The composition and every sound are generated locally by `compose-music.py`; no external song, recording, or sample was used. Provenance is recorded in `audio/music-provenance.json`. Paper and pencil effects are synthesized and aligned to transitions.

Mix: voice is foregrounded, music is quieter and sidechain-ducked while narration speaks. High-pass voice filtering, peak limiting, loudness normalization and an ending fade prepare the mix for social playback. Actual measurements are saved in `audio/*-loudness.txt`.

Rebuild from the repository root:

```powershell
.\promo\audio-env\Scripts\python.exe promo/generate-narration.py
.\promo\audio-env\Scripts\python.exe promo/compose-music.py
node promo/mix-audio.cjs
node promo/render-narrated.cjs
```

The temporary Python environment was removed during cleanup. Recreate `promo/audio-env` using a standard Python installation and install `promo/audio-requirements.txt` before regenerating audio. Narration generation requires internet access; music synthesis and mixing are local. Existing narration, stems and mixes remain available. Export verification checks 15 seconds, 450 frames, dimensions, AAC stereo audio, a file size below 5 MB, MP4 faststart, complete error-free decoding, and unchanged SHA-256 hashes for the three existing videos.

Tool reference: [edge-tts](https://github.com/rany2/edge-tts).
