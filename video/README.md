# Demo video

The three-minute submission film, built from the live site rather than from mockups. Everything in it
is a real page at https://pathya.anukritiai.com, shot headless at 1080p.

```bash
cd video && npm install && npx playwright install chromium
npm run all        # narration, then the shoot, then the cut
```

| step | what it does |
|---|---|
| `npm run vo` | Narration for every scene in `script.json`, local neural TTS (`piper`), no API key. Measures each line and writes `out/timing.json`. |
| `npm run shoot` | Drives the live site headless and records one clip per scene, each cut to the length of its own line. |
| `npm run cut` | Trims or frame-pads every clip to its line, muxes the narration, normalises to −14 LUFS, writes `out/pathya-demo.mp4` and a matching `.srt`. |

The audio is the master. Narration is recorded first and the picture is edited to it, so re-wording a
line re-times its scene and nothing downstream drifts.

`script.json` holds the whole film: scene order, card copy, which shot to take, and the exact words.
Change it and run `npm run vo -- --force` to re-voice, then `npm run shoot -- <scene> --force`.

Cards are `cards.html`, built from the product's own CSS tokens so the titles and the app footage read
as one piece. Clips, narration and the rendered film are gitignored: they rebuild from this directory.

Not in here: the upload. The film has to go to YouTube or Vimeo by hand, and its URL into
`docs/SUBMISSION.md`.
