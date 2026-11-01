# Demo video

**Built. `video/out/pathya-demo.mp4`, 2:46 against a 3:00 limit, 1080p30, 35 MB, with `pathya-demo.srt`.**
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

1. **Upload** `video/out/pathya-demo.mp4` to YouTube (unlisted is fine) or Vimeo, with `pathya-demo.srt`
   as the caption track.
2. Put the URL in [SUBMISSION.md](SUBMISSION.md) where the video placeholder is.
3. **Make the repository public.** Nothing above counts while it is private.

## Notes on the build

Narration is local neural TTS, so it costs nothing and re-renders in seconds, but it is synthetic and
sounds it. Re-recording the same script in a human voice is a real upgrade and needs no code change:
drop twelve wav files into `video/out/vo/` under the same names and run `npm run cut`.

There is no music bed. The narration carries it, and an unlicensed track is a risk a submission does
not need.
