# Demo video storyboard (hard limit 3:00, record Nov 3)

Judging (Official Rules, section 8): Impact 30%, Use of Meta AI tooling 25%, Demo 25%, Technical depth 20%. Judges watch the video, read the code and try the live product. Name the Meta model on screen in every scene.

Required by the rules: the video opens with one line on what existed before the event (nothing: the repository was created during it), shows only what this team built, and runs no longer than three minutes. Target 2:52 so a slow cut does not push it over.

| t | Scene | On screen | Voice-over |
|---|---|---|---|
| 0:00 | Disclosure + hook | Title card: "Built during the event. Research tool, not medical advice." Then the WhatsApp photo, full screen | Everything here was built this week. This is a pharmacogenomic lab report from India, the way it really travels: a photo on WhatsApp. |
| 0:10 | The gap | Home, chapter 01: the four tiles | India's evidence on these gene variants rests on two studies of about 3,600 people. Thousands of reports like this are issued every year, and none of them reach a dataset. |
| 0:25 | Read | Hero: "Read a WhatsApp photo"; pipeline lights step by step, timer visible | Muse Spark reads the photo under a strict schema, quotes every gene call from the page, and records which variants the lab says it tested. |
| 0:50 | Standardise + quality | Record page: calls table with quotes beside the photo. Then `/report/ec1531ccb77c`, a targeted DPYD panel, whose coverage cards read "not in this panel" | PharmCAT, CPIC's reference engine, standardises the names. Our rules check which India-relevant variants this panel never tested, and the patient reference is removed before anything is stored. |
| 1:10 | Open weights | Click "read the same photo on open weights"; the record header reads `read by meta-models/muse-spark-open-1026` and the calls section is badged Muse Spark Open (pre-run: `/report/73ee62927c10`) | The same report, read again by Muse Spark Open. Open weights mean a biobank can run this inside its own network — which is the only version of this that could ever touch a real patient's report. |
| 1:25 | Voice | "Read it aloud": dictate in Malayalam and English; transcript appears; record builds | Muse Voice takes results read aloud, Malayalam and English mixed, and Muse Spark reads the transcript into the same record. |
| 1:45 | Curator + literature | Curator review chips; "Find Indian frequency data" with linked sources | A curator checks each call against the source. Muse Spark web search finds what has been published for India, with sources. |
| 2:00 | Cohort | `/cohort`: carrier frequencies with intervals, the denominator columns, Download CSV | Every record joins a cohort. One CSV, ready for a study. |
| 2:12 | Proof | Chapter 04: harsh-photo bars fill to 100% while OCR stays at 0 | On 36 held-out reports, including skewed, shadowed photos, Muse Spark and Spark Open each read all 177 gene calls exactly. OCR read none of the harsh ones. |
| 2:28 | The harder half | `/cohort?c=india-sim`: the c.85T>C row, both estimate columns | Reading is the easy half. We simulated 120 Indian people, each with a report from a lab that tests only part of the panel. Counting a panel that never tested c.85T>C as a non-carrier puts it at 15%. The truth was 25. That ten-point error is downward, on the variant a quarter of Indians carry. Our own run also found a hole in our rule, and both numbers are on the page because of it. |
| 2:48 | Close | Logo, "India's gene data, out of WhatsApp photos.", live URL | Pathya. Research data from the reports India already has. |

Recording notes:
- Capture at 1440p, zoom to 125%. Pre-run one record so the wait can be cut, but show the real timer once (about 30 s).
- Subtitles for the Malayalam segment.
- Everything in the video is reachable without a code; say so once, because a judge will try it. Pre-run records: `/sample` (6 genes, 6 coverage gaps), `/report/ec1531ccb77c` (targeted panel), `/report/73ee62927c10` (read on open weights).
- Sign in as a curator only for the review scene at 1:45; keep the code off screen.
- Never show a drug, dose or patient advice. The product has none, and the video must not imply otherwise.
- Say "research tool, not medical advice" out loud once, in the first fifteen seconds.
