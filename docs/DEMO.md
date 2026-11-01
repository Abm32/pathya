# Demo video

**Built. `video/out/pathya-demo.mp4`, 2:53 against a 3:00 limit, 1080p30, 35 MB, captions burned in, with `pathya-demo.srt`.**
Rebuild or re-cut it from [`video/`](../video/README.md). The one step left is the upload.

Judging (Official Rules, section 8): Impact 30%, Use of Meta AI tooling 25%, Demo 25%, Technical depth 20%.
Judges watch the video, read the code and try the live product.

Rules the film satisfies: it opens by saying everything was built during the event, it shows only what
this team built, it names a Meta model on screen in every scene (the product's own header badges carry
`MUSE SPARK 1.3`, `MUSE VOICE` and `SPARK OPEN` through all the app footage), it says "a research tool,
not medical advice" aloud inside the first fifteen seconds, and it runs under three minutes.

## The cut

| t | scene | on screen |
|---|---|---|
| 0:00 | hook | Title, then the WhatsApp photograph full frame, pushing in slowly |
| 0:14 | gap | Two studies, ~3,600 people, 0 reports reaching a dataset; then the home page |
| 0:26 | read | `/sample` — the calls table, each one quoted from the page |
| 0:36 | standardise | `/report/ec1531ccb77c`, a targeted panel, coverage cards reading "not in this panel" |
| 0:52 | open | `/report/73ee62927c10`, header reads `read by meta-models/muse-spark-open-1026` |
| 1:04 | voice | Muse Voice, Malayalam and English mixed |
| 1:15 | curate | Curator review, each call against its quoted source |
| 1:24 | cohort | `/cohort` — frequencies, Wilson intervals, denominators, Download CSV |
| 1:35 | **getrm** | 208 real reference DNAs, 622/646, 96.3%, then the per-gene table from [GETRM.md](GETRM.md) |
| 2:01 | gap-found | The four SLCO1B1 samples the consensus panel never typed, all African-ancestry |
| 2:17 | harder | 15% vs 25% on c.85T>C, then `/cohort?c=india-sim` |
| 2:41 | close | Pathya · പഥ്യം · pathya.anukritiai.com |

The proof scene leads with GeT-RM rather than our own held-out set: real public reference materials and
real 30× genomes beat our fixtures on every axis a judge weighs. The scene after it is the benchmark
producing the project's own coverage-gap argument without being asked to, which is the strongest thing
in the film and is not a claim — it is a table.

## Still to do by hand

1. ~~Upload the film.~~ Done — https://youtu.be/21679gHAEqc, unlisted, "not made for kids".
   No YouTube caption track was added: the captions are burned into the picture, and a second track
   would draw a duplicate line of text over them whenever a viewer turns CC on. `pathya-demo.srt`
   is kept for any platform that wants captions as a separate file.
2. ~~Put the URL in SUBMISSION.md.~~ Done.
3. ~~Make the repository public.~~ Done — https://github.com/Abm32/pathya, verified reachable logged out.

## Notes on the build

Narration is ElevenLabs `eleven_v4`, voiced by Esha, Indian English, at 0.95 speed — an Indian narrator
for a film about India's data gap. It is still synthetic, and re-recording the same script in a human
voice needs no code change: drop twelve wavs into `video/out/vo/` named `<scene-id>.wav`, run `npm run cut`,
and every caption re-times itself to the new audio.

The narration is written to a hard 3:00 limit and currently lands at 2:53. Esha reads slower than the
local voice this replaced, which cost 24 seconds the first time; the words were cut rather than the
voice sped up. Numbers already printed on a card were the cheapest thing to cut.

There is no music bed. Three ElevenLabs sound cues sit at −24 to −26 dB under the voice: a transition
whoosh, a low swell under the GeT-RM card and a soft resolve at the end. An unlicensed music track is a
risk a submission does not need.
