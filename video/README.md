# Demo video

The three-minute submission film, built from the live site rather than from mockups. Everything in it
is a real page at https://pathya.anukritiai.com, shot headless at 1080p.

```bash
cd video && npm install && npx playwright install chromium
npm run all        # narration, then the shoot, then the cut
```

| step | what it does |
|---|---|
| `npm run vo` | Narration for every scene in `script.json`, ElevenLabs (`eleven_v4`, voice set in `script.json`). One request per sentence with `previous_text`/`next_text` so prosody carries across the joins, each take measured, cached by a hash of what is actually said. Writes `out/timing.json`. |
| `npm run sfx` | Three sound cues from ElevenLabs text-to-sound: a transition whoosh, a low swell under the GeT-RM card, a soft resolve on the last card. Cached. |
| `npm run shoot` | Drives the live site headless and records one clip per scene, each cut to the length of its own line. |
| `npm run cut` | Trims or frame-pads every clip to its line, muxes narration and sound cues, EQs and compresses the voice, burns one-line captions, normalises to −14 LUFS, writes `out/pathya-demo.mp4` with `.srt` and `.ass`. |

The audio is the master. Narration is recorded first and the picture is edited to it, so re-wording a
line re-times its scene and nothing downstream drifts.

`script.json` holds the whole film: scene order, card copy, which shot to take, and the exact words.
Change it and run `npm run vo -- --force` to re-voice, then `npm run shoot -- <scene> --force`.

Cards are `cards.html`, built from the product's own CSS tokens so the titles and the app footage read
as one piece. Clips, narration and the rendered film are gitignored: they rebuild from this directory.

`speakable.mjs` rewrites the narration for the mouth and not the eye: `c.85T>C` is spoken "c dot eighty-five
T to C", `DPYD` letter by letter, `PharmCAT` as "farm cat". Captions use the written form, so what is on
screen stays correct while what is said stays sayable. Numbers already printed on a card are left out of
the narration entirely — saying "six hundred and forty-six" aloud costs four seconds and tells no one
anything the card has not already shown.

Sound sits at −24 to −26 dB. Narration is the signal; anything that competes with a spoken gene name is
working against the film.

Not in here: the upload. The film has to go to YouTube or Vimeo by hand, and its URL into
`docs/SUBMISSION.md`.
