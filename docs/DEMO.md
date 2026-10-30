# Demo video storyboard (target 3:10, record Nov 3)

Judging (Official Rules): Impact 30, Use of Meta AI tooling 25, Technical depth 20, Demo 25. Judges watch the video, read the code and try the live product. Name the Meta model on screen in every scene.

Required by the rules: the video opens with one line on what existed before the event (nothing: the repository was created during it), and it must show what was built, not slides.

| t | Scene | On screen | Voice-over |
|---|---|---|---|
| 0:00 | Disclosure + hook | Title card: "Built during the event. Research tool, not medical advice." Then the WhatsApp photo, full screen | Everything here was built this week. This is a pharmacogenomic lab report from India, the way it really travels: a photo on WhatsApp. |
| 0:12 | The gap | Home, chapter 01: the four tiles (48%, ~25%, 3,612, 0) | India's evidence on these gene variants rests on two studies of about 3,600 people. Thousands of reports like this one are issued every year, and none of them reach a dataset. |
| 0:30 | Read | Hero: "Read a WhatsApp photo"; the live pipeline lights step by step, timer visible | Muse Spark reads the photo under a strict schema and quotes every gene call from the page, along with the variants the lab says it tested. |
| 0:55 | Standardise + quality | Record page: calls table with quotes beside the photo; coverage cards | PharmCAT, CPIC's reference engine, standardises the names. Rules check which India-relevant variants this panel never tested, and the patient reference is removed before anything is stored. |
| 1:20 | Voice | "Read it aloud" mode: dictate in Malayalam and English; transcript appears; build record | Muse Voice takes the results read aloud, Malayalam and English mixed; Muse Spark reads the transcript into the same record. |
| 1:40 | Curator + literature | Curator review chips; "Find Indian frequency data" with linked sources | A curator checks each call against the source. Muse Spark web search finds what has been published for India, with sources. |
| 1:55 | Cohort | /cohort: carrier frequencies with confidence intervals, "panel did not name it" column, Download CSV | Every record joins a cohort. A panel that never tested a variant is left out of its denominator instead of being counted as a non-carrier. One CSV, ready for a study. |
| 2:15 | Proof | Chapter 04: harsh-photo bars fill to 100% while OCR stays at 0; open-weights card | On 36 held-out reports, including skewed, shadowed photos, Muse Spark and open-weights Spark Open read all 177 gene calls. OCR read none of the harsh ones. Open weights mean a biobank can run this inside its own network. |
| 2:30 | The harder half | /cohort?c=india-sim: the c.85T>C row, both estimate columns side by side | Reading is the easy half. We simulated 120 Indian people and gave each a report from a lab that tests only part of the panel. Counting a panel that never tested c.85T>C as a non-carrier puts it at 15%. Leaving those panels out puts it at 31. The truth was 25. The same run found a hole in our own rule: most of what we were excluding was reports that never say what they tested. Both numbers are on the page now, because only one of them is a question about the lab. |
| 2:40 | Close | Logo, "India's gene data, out of WhatsApp photos.", live URL | Pathya. Research data from the reports India already has. |

Recording notes:
- Capture at 1440p and zoom to 125%. Pre-run one record so you can cut the wait, then show the real timer once (about 30 s).
- Add subtitles for the Malayalam segment.
- Keep the access code off screen; the cohort and the `/sample` record are public.
- Never show a drug, dose or patient advice: the product no longer has any, and the video must not imply it.
