# Pathya — Meta Global AI Developer Hackathon plan

**Deadline:** Nov 4 2026, 9:00 PM ET (= Nov 5, 07:30 IST). Submit via the Cerebral Valley portal: public repo, three-minute demo video, live product.
**Track:** Startup. **Theme:** Build for Your World.
**What it is:** a research-data tool. Pharmacogenomic lab reports (PDF, WhatsApp photo, dictation, VCF) become verified, de-identified records and cohort carrier frequencies. It makes no dose, drug or test recommendation and has no patient-facing output.

## Judging rubric → what we build

Weights are from the Official Rules (participant guide, section 8).

| Criterion | What we put in front of it |
|---|---|
| **Impact 30%** | India's DPYD evidence rests on two studies of ~3,600 people, and the variants that matter here (HapB3, c.85T>C) are not the ones European panels are built around. Labs already run these tests daily; the results stay in PDFs. Pathya turns reports that already exist into countable data. |
| **Use of Meta AI tooling 25%** | `muse-spark-1.3` through the responses API: PDF and photo as native model input, strict JSON schema, `web_search` with citations. `muse-voice-transcribe-1.0` for results read aloud, code-switched Malayalam and English, keyword-biased to gene names. `muse-spark-open-1026` on Baseten doing real work, not sitting as a dead fallback. |
| **Demo 25%** | Three minutes, hard limit. The live product, not slides. Script in [DEMO.md](DEMO.md). Opens with the "built during the event" disclosure. |
| **Technical depth 20%** | PharmCAT 3.4 in-process, two reproducible benchmarks with released ground truth, deterministic quality and coverage rules, de-identification checked by eval, Wilson intervals, append-only audit log, single container on AWS. |

Bonus prize in reach: **Best Build on Meta Open Weight Models ($10K)** — Muse Spark Open served through Baseten, a listed inference partner. It has to be doing visible work for this to be credible.

## Architecture

- Next.js 16 app, Node runtime routes, single container on the official `pgkb/pharmcat` image.
- `src/lib/meta.ts` — the only place Meta models are called. OpenAI SDK against `api.meta.ai/v1`; `structured()` picks a provider and falls through to the other.
- `src/lib/pdf-extract.ts` — report in (PDF, image, transcript), `LabExtract` out, every call quoted.
- `src/lib/pharmcat.ts` — PharmCAT run and `*.report.json` parsed to `PgxProfile`.
- `src/lib/quality.ts` — coverage against the India panel, three-state (tested / not in panel / panel not documented), de-identification.
- `src/lib/cohort.ts` — carrier frequencies, Wilson intervals, both denominator conventions.
- `src/app/api/analyze` — the whole pipeline, NDJSON step events with `?stream=1`.
- Storage: filesystem JSON under `DATA_DIR`. <!-- ponytail: swap for Postgres when multi-tenant -->

## History: two pivots

Kept because the rules ask judges to see what was built during the event, and because the second pivot is the reason the project is shaped the way it is.

- **Oct 26–29, original build.** Genotype plus medication list in, CPIC-grounded toxicity report for the oncologist out, with a patient explanation in Malayalam. PharmCAT for calling, Muse Spark for the write-up, Muse Voice for dictated consults.
- **Oct 30, first pivot.** A mock judging pass found the tool only helped patients already tested, and in India the test is rarely ordered in time (₹7,000–17,000, no government cover, 7–10 day turnaround). Added a pre-test check.
- **Oct 30, second pivot — the one that matters.** The anti-project list bans "any project using AI to generate and give medical advice". Any reading of that covers a tool that tells a clinician what to do about a dose, citations and confirm gate notwithstanding. Pathya stopped producing recommendations entirely and became a research-data tool: read, standardise, check coverage, de-identify, count. Removed: dose checks, pre-test check, test requests, medication mapping, all patient-facing text. Added: quality and coverage rules, de-identification, `/cohort` with Wilson intervals, curator review, literature search, dictated results, and the two released benchmark datasets.
- **Oct 31.** Eligibility question posted in Discord #questions on Oct 30; no organizer ruling yet, only a bot reply saying the organizers will answer in the thread. We are proceeding on our own reading of the anti-project wording, which the published list supports.

## Status, 2026-10-31

Built and verified: both ingestion paths, cohort statistics, curator review, two benchmarks (IndiPGx-Read v0.1 reading, IndiPGx-Pop v0.1 pooling), selftest, production eval 5/5, live at https://pathya.anukritiai.com.

**Blocking, in order:**

1. **Make the repo public.** Required by the rules; nothing else counts until it is done.
2. **Record the demo video.** 25% of the score, currently zero. Script and capture are ready.
3. Fill the SUBMISSION.md placeholders: team members, video URL, repo URL, judge access code.
4. One researcher quote or one real lab report template ([LAB-CALLS.md](LAB-CALLS.md)) — the weakest point in Impact.
5. Optional: X post for Most Viral; flag the open-weights bonus prize on the submission.

## Risks

- **Eligibility.** No organizer ruling yet. Mitigation: the product generates no advice of any kind, the disclaimer is on every page and in the video, and the submission quotes the anti-project wording and says why it does not apply.
- **"Simple image analyzer."** A judge skimming could file a photo-reading tool under that anti-project. Mitigation: the model read is one step of six, and the demo shows PharmCAT standardisation, the coverage rules and the cohort, not just a photo going in.
- **Single point of failure on api.meta.ai.** The hosted responses API is the only path that accepts a PDF natively. Mitigation: Spark Open on Baseten covers photo and text reading; see `src/lib/meta.ts`.
- **All data synthetic.** Permitted explicitly ("synthetic demo inputs with real model inference are fine"), but it caps how far the Impact claim can be pushed. Mitigation: label it everywhere, release the generators and the ground truth.
