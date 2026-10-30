# Submission text: Pathya

Meta Global AI Developer Hackathon 2026 · Startup track · Build for Your World
Fill the bracketed fields before submitting. The video must open with one line on what existed before the event (nothing: the repo was created during the event) and must say "research tool, not medical advice".

---

## Project name

Pathya (പഥ്യം)

## Tagline (one line)

India's pharmacogenomic results are stuck in PDFs and WhatsApp photos. Pathya turns them into verified, de-identified research data.

## Short description (≈50 words)

Pathya reads Indian pharmacogenomic lab reports (PDFs, phone photos, results read aloud) with Muse Spark and Muse Voice, quotes every gene call from the page, standardises it with PharmCAT, removes identifiers, checks which India-relevant variants the panel tested, and adds the record to a cohort with confidence intervals. Research tool, not medical advice.

## The problem

India's evidence on the gene variants that change how people handle common drugs is thin, and the variants that matter here differ from Europe's:

- The most common Indian decreased-function DPYD variant is HapB3, not the *2A that European-derived panels are built around (PMID 40810747).
- DPYD c.85T>C is carried by about 25% of Indians. CPIC classes it as normal function, while South Indian prospective cohorts report a toxicity association (PMC11300675). It is an open research question.
- NUDT15 risk alleles are more common in Indians than TPMT's (PMID 29470173).
- India's DPYD frequency data rests on two studies of about 2,000 and 1,612 people (PMID 33105068, PMID 40810747), and there is no ICMR guideline on DPYD testing.

Meanwhile, labs across India already run these tests every day. The results go to hospitals as PDFs and WhatsApp photos, in a dozen layouts, and stay there. None of them reach a registry, so the evidence never grows.

## What it does

1. **Ingest.** A lab report as a PDF or a phone photo (how results actually travel, over WhatsApp), results read aloud, or a GRCh38 VCF.
2. **Read.** Muse Spark extracts every gene call under a strict JSON schema and quotes the line it came from. It also records which variants the report says were tested. Results read aloud go through Muse Voice Transcribe (English and Malayalam, keyword-biased to gene and variant names), and Muse Spark reads the transcript into the same record.
3. **Standardise.** PharmCAT, CPIC's reference engine, normalises the calls to PharmVar allele names and CPIC phenotype terms. Only the calls are kept; no guideline or drug text is stored.
4. **Check quality.** Deterministic rules flag which India-relevant variants (HapB3, c.85T>C, *2A, *13, c.2846A>T, NUDT15 *3, UGT1A1 *28 and *6, TPMT *3C, CYP2C19 *2 and *17) the panel did not name, record unreadable calls, and remove any patient or lab reference before storage.
5. **Record.** Each result becomes a de-identified record with the original document beside the quotes, exportable as JSON, PharmCAT outside-call TSV or CSV. A curator verifies each call against the source, and the decision goes to an append-only audit log.
6. **Cohort.** Records aggregate into carrier frequencies per variant with Wilson 95% intervals. A panel that never named a variant is left out of that variant's denominator instead of being counted as a non-carrier, the most common error when pooling targeted-panel results.
7. **Literature.** Muse Spark web search finds published Indian frequency data for each variant in a record, with linked sources.

Pathya makes no dose, drug or test recommendation and produces no patient-facing output. It is a research and data tool.

## Who uses it, and who pays

- **Users.** Pharmacogenomics research groups, hospital research units and biobanks that want to pool the results already being produced; labs that want their reports to be machine-readable.
- **First customer.** A research group or hospital research unit in Kerala pooling de-identified DPYD and NUDT15 results into a registry, under its own ethics approval.
- **Who pays.** Research groups and biobanks pay per curated record or per cohort; labs pay to have their own report format read reliably and exported in standard form.
- **Data stays inside.** The reader runs on Muse Spark Open, open weights, with identical results on our benchmark. A biobank can keep genomic data in its own network.
- **Why now.** Fluoropyrimidine DPYD testing entered FDA labels in 2025–2026 and NCCN colon guidance in 2025, so more Indian reports are being issued every month, and each one is a data point.

## How we used Meta's models

| Model | What it does in Pathya |
|---|---|
| `muse-spark-1.3` | Reads lab reports from PDF and phone-photo input under a strict JSON schema, quoting each call and listing the variants tested; reads dictated transcripts into the same schema; web search with linked sources for published Indian allele frequencies |
| `muse-voice-transcribe-1.0` | Transcribes results read aloud, English and Malayalam, keyword-biased to gene and variant names |
| Muse Spark Open (`meta-models/muse-spark-open-1026`, open weights, on Baseten) | Same reader, same schema (in the prompt, validated). Read all 177 gene calls on the held-out benchmark exactly like the hosted model, and is the automatic fallback. Open weights are what lets a biobank keep genomic data in-house. |

We left out Muse Image and SAM 3.1 on purpose: nothing here needs an image generated or segmented.

## How we built it

- Next.js 16 on Node, one Docker container on the official `pgkb/pharmcat` image (PharmCAT 3.4.0, Java, the preprocessor's Python and bcftools stack).
- Reports and dictation go through Muse Spark extraction to PharmCAT "outside calls", so naming stays in PharmCAT even when the input is a photo.
- Quality rules and cohort statistics (Wilson intervals, coverage-aware denominators) are plain, tested code.
- Streaming endpoint (NDJSON step events) drives the live pipeline view.
- Access-code gate with rate-limited login; the demo cohort and its records are public read-only; anything that calls a model or writes data needs the code. Per-record audit log; no identifiers stored.
- A benchmark harness (`scripts/bench.mts`, `scripts/bench/gen.py`) that generates synthetic reports with ground truth and scores every reader with the app's own normalisation; an offline self-test; a 5-case end-to-end eval.
- Deployed on AWS EC2 in Mumbai behind Caddy with automatic TLS.

## Does it hold up?

- **Held-out extraction benchmark.** 36 synthetic Indian lab reports in four layouts Indian labs use (star-allele table, rsID-only table, narrative, variant checklist), each as a clean PDF, a phone photo and a harsh skewed, shadowed photo. Muse Spark 1.3 and open-weights Muse Spark Open each read all 177 gene calls exactly, invented no genes, and every quote was found on the page. A best-case OCR + rules baseline gets 98% on clean PDFs, 44% on phone photos and 0% on harsh photos. The development run caught two real pipeline bugs, fixed before the held-out set was generated. Method and limits: `docs/BENCHMARK.md`.
- **Open dataset.** The 72 synthetic reports, their ground truth and the scoring harness are in the repository as IndiPGx-Read v0.1.
- **End-to-end eval.** 5 cases through the deployed system (two VCFs, a lab PDF, the same report as a phone photo, and results read aloud): phenotypes, allele names and coverage are checked, and the eval fails if any guideline or drug text, or an identifier, is stored.
- **Demo cohort, verified.** 24 synthetic people, one phone photo each, run through the live production pipeline into the public cohort. All 106 gene calls in those live records match the ground truth (`scripts/verify-cohort.mts`), and none stores an identifier or any guideline or drug text.
- **Speed.** About 15–30 seconds from photo to record, most of it Muse Spark reading the image.

## Challenges

- **Staying a data tool.** Pharmacogenomics pulls towards advice. We drew a hard line: the product stores calls, quotes, coverage and statistics, never guideline text, doses or patient explanations, and the eval enforces it.
- **Missing is not negative.** A targeted panel that never tested c.85T>C says nothing about it. Counting such reports as non-carriers would understate frequencies; Pathya keeps them out of the denominator and shows how many there were.
- **Real reports are photos.** Skewed, compressed WhatsApp images are the normal input, so the photo path is a first-class benchmark condition, not an afterthought.
- **Two providers, one contract.** The open model does not enforce JSON schemas, so the same schema works as a constraint and as an instruction, with validation either way.

## What's next

- De-identified real report formats from a partner lab, under its consent and ethics approval, to measure accuracy on formats we did not write.
- A self-hosted Muse Spark Open deployment inside a hospital or biobank network.
- FHIR Genomics export alongside JSON, TSV and CSV.
- More genes and Indian-relevant variants as the cohort grows, each with its source.

## Built by

Anukriti AI, Kochi, Kerala. [Team member names and roles]

## Links

- Live demo: https://pathya.anukritiai.com. The story, the demo cohort (https://pathya.anukritiai.com/cohort) and a finished sample record (https://pathya.anukritiai.com/sample) open without a code. Live runs, uploads and dictation need the judge access code: [give judges a code]
- Demo video: [URL]
- Repository: [URL; must be public]
- Benchmark and dataset: `docs/BENCHMARK.md`

## Disclaimer

Pathya is a research and data tool. It is not medical advice and makes no dose, drug or test recommendation. All reports used are synthetic; no real patient data was used.
