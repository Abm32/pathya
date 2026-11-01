# Pathya (പഥ്യം)

**India's pharmacogenomic results are stuck in PDFs and WhatsApp photos. Pathya turns them into verified, de-identified research data.**

**Live: https://pathya.anukritiai.com — no sign-up, no code.** Read a WhatsApp photo, dictate results, browse the [demo cohort](https://pathya.anukritiai.com/cohort), the [simulated-population cohort](https://pathya.anukritiai.com/cohort?c=india-sim) or a [sample record](https://pathya.anukritiai.com/sample). Live runs carry a small per-visitor hourly budget because each one spends model credits.

> **Research tool, not medical advice.** Pathya reads and standardises pharmacogenomic results and aggregates them into cohort statistics. It makes no dose, drug or test recommendation and has no patient-facing output. All data in this repository is synthetic.

*Pathya* is the Ayurvedic word for the regimen that suits a particular person. Built by [Anukriti AI](https://anukritiai.com), Kochi, for the Meta Global AI Developer Hackathon 2026 (Startup track, "Build for Your World"). The repository was created during the event; nothing pre-existing is included.

## The problem

India's evidence on drug-relevant gene variants is thin, and the variants that matter here differ from Europe's:

- The most common Indian decreased-function DPYD variant is HapB3, not *2A ([PMID 40810747](https://pubmed.ncbi.nlm.nih.gov/40810747/)).
- DPYD c.85T>C (*9A) is carried by ~25% of Indians. CPIC calls it normal function; South Indian prospective cohorts report a toxicity association ([PMC11300675](https://pmc.ncbi.nlm.nih.gov/articles/PMC11300675/)). It is an open research question.
- NUDT15 risk alleles (~7–11%) are more common in Indians than TPMT's (~3–4%) ([PMID 29470173](https://pubmed.ncbi.nlm.nih.gov/29470173/)).
- India's DPYD frequency data rests on two studies of about 2,000 and 1,612 people ([PMID 33105068](https://pubmed.ncbi.nlm.nih.gov/33105068/), PMID 40810747). There is no ICMR guideline on DPYD testing.

Labs already run these tests. The results travel to hospitals as PDFs and WhatsApp photos, in many layouts, and stay there. None reach a dataset. Evidence brief with sources: [docs/EVIDENCE.md](docs/EVIDENCE.md).

## What it does

1. **Ingest** a lab report (PDF or phone photo), results read aloud, or a GRCh38 VCF.
2. **Read** with Muse Spark under a strict JSON schema: every gene call with the line it came from, plus the variants the report says it tested. Dictation goes through Muse Voice Transcribe (English and Malayalam) and Muse Spark reads the transcript into the same schema.
3. **Standardise** with [PharmCAT](https://pharmcat.clinpgx.org) to PharmVar allele names and CPIC phenotype terms. Guideline and drug text is discarded, never stored.
4. **Check quality** with deterministic rules (`src/lib/quality.ts`): which India-relevant variants the panel did not name, unreadable calls, and removal of any patient or lab reference.
5. **Record**: de-identified, exportable as JSON, PharmCAT outside-call TSV or CSV, with the source document beside the quotes. A curator verifies each call; every step goes to an append-only audit log.
6. **Cohort** (`/cohort`, `src/lib/cohort.ts`): carrier frequency per variant with Wilson 95% intervals. Panels that never named a variant are left out of its denominator, not counted as non-carriers.
7. **Literature**: Muse Spark web search for published Indian frequency data per variant, with linked sources.

## Meta models used

| Model | Where |
|---|---|
| `muse-spark-1.3` | Report reading (PDF and image input, strict JSON schema), dictated-transcript reading, web search for published frequencies |
| `muse-voice-transcribe-1.0` | Results read aloud: `languageBias` English + Malayalam, `keywords` biased to gene and variant names |
| `meta-models/muse-spark-open-1026` (Muse Spark Open, **open weights**) | The same reader, on a second inference path. Served through [Baseten](https://baseten.co); runs equally on your own GPU, which is the point. 177/177 on the held-out benchmark |

Not used on purpose: Muse Image and SAM 3.1 (no image to generate or segment).

**Where the open-weights model runs.** `meta-models/muse-spark-open-1026` is served through Baseten's inference API (`BASETEN_BASE_URL`), called with the same OpenAI wire format as the hosted path, from the same container on AWS Mumbai. Nothing about the call is Baseten-specific: point `BASETEN_BASE_URL` at a vLLM server on your own hardware and the pipeline is unchanged. Three ways it does real work, not demo work:

- **On demand.** "Read the same photo on open weights" on the home page, or `provider=baseten` on `POST /api/analyze`. The record then says `read by meta-models/muse-spark-open-1026`, and the calls section is badged Muse Spark Open.
- **As the failover for every ingest path.** If api.meta.ai refuses or times out, the report is re-read on open weights. A PDF is rendered to a page image first (`pdftoppm`), because the open path has no responses API and cannot take a PDF natively.
- **As the whole pipeline.** `MUSE_PROVIDER=baseten` makes it primary; the end-to-end eval passes with no hosted call at all.

Why it matters here: Meta's credit terms allow API content to be used to improve Meta models. A biobank holding real genomic data cannot accept that, so the self-hostable path is the only version of Pathya that could ever touch a real patient's report.

## What we built during the event

The repository was created on 26 October 2026 and every commit is from the event window. Pathya is not a wrapper around one model call; what follows is ours, written here:

- The whole application: ingestion for four input kinds, the extraction schema and prompts, the streaming pipeline, the record and cohort pages, access control, the audit log.
- `src/lib/quality.ts` — the India-relevant variant panel, the three-state coverage model (tested / not in this panel / panel not documented) and de-identification.
- `src/lib/cohort.ts` — carrier frequencies, Wilson intervals, and both denominator conventions side by side.
- `scripts/bench/gen.py` — the synthetic report generator, both benchmark datasets and their ground truth, and the harnesses that score them.
- `src/lib/pdf-extract.ts` — DPYD normalisation from rsID, HGVS and star names, and the two-provider reader.

Third-party, and labelled as such wherever it appears: [PharmCAT 3.4](https://pharmcat.clinpgx.org) (CPIC's reference engine) does allele standardisation and phenotype naming; Meta's Muse models do the reading and transcription; Next.js, Tailwind and the OpenAI SDK are dependencies. The judgement calls about coverage, denominators and what a research record may contain are the parts we wrote.

## Why it holds up

- **The model only reads.** It extracts and quotes; PharmCAT names; tested rules check; statistics are plain code. No advice is generated anywhere, and the eval fails if guideline or drug text, or an identifier, is stored.
- **Extraction benchmark (held out).** 36 synthetic Indian lab reports in four layouts (star table, rsID table, narrative, variant checklist), each as a clean PDF, a phone photo and a harsh skewed photo: Muse Spark 1.3 and Muse Spark Open each read 177/177 gene calls exactly, against 58/59, 26/59 and 0/59 for an OCR + rules baseline. The development run caught two pipeline bugs, fixed before the held-out run. The reports, truth and harness are released as IndiPGx-Read v0.1. Method, limits and misses: [docs/BENCHMARK.md](docs/BENCHMARK.md).
- **Real reference materials, not our own fixtures.** All 208 Coriell DNA samples that both the CDC's GeT-RM programme (consensus genotypes agreed across clinical laboratories) and 1000 Genomes (30x GRCh38 sequence) have characterised: PharmCAT through our runner agrees with the laboratory consensus on 622 of 646 gene calls (96.3%), exactly on every CYP2C19, CYP2C9 and VKORC1 call. Reading those same results aloud, for all 208, reproduces the sequence phenotype in 545 of 580 gene calls (94.0%); open-weights Muse Spark Open scores 544/580 and differs from the hosted model on 6 calls out of 580. Every one of the 24 mismatches was traced: 12 are variants the filtered sequence panel does not carry, 6 are SLCO1B1 decreased-function alleles the consensus panel never typed (the project's own argument, arriving in its own benchmark), 3 are an allele name with an identical phenotype, 2 are outside PharmCAT's allele definitions, and 1 is a real disagreement the sequence settles in PharmCAT's favour. The two runs also found six silent defects in our allele normalisation - a gene coming back uncalled rather than wrong, or, in the last one, both models quoting a multi-variant chromosome correctly and then discarding it, which a phenotype-scored benchmark could not see on four of its five samples - all fixed and asserted in the self-test. Method, scoring rules and limits: [docs/GETRM.md](docs/GETRM.md).
- **Self-test.** `npx tsx scripts/selftest.mts` checks DPYD normalisation, coverage rules, de-identification, Wilson intervals and cohort counting offline.
- **End-to-end eval.** `npx tsx scripts/eval.mts <url>` runs 6 cases (two VCFs, a lab PDF, the same report as a phone photo, that photo again forced onto the open-weights model, and results read aloud) through a live server: 6/6 on production, 2026-10-31.
- **Live cohort check.** `npx tsx scripts/verify-cohort.mts <url>`: all 106 gene calls in the 24 public demo records match the benchmark ground truth, with no identifiers or drug text stored.
- **Two inference paths, one wire format.** Hosted Muse Spark 1.3 (strict JSON schema, PDF input, web search) and open-weights Muse Spark Open on Baseten (schema in prompt, JSON extracted and validated).
- **Single container.** Node app on the official `pgkb/pharmcat` image.
- **Access.** Open to everyone: reading, running a report and dictating need no account. The endpoints that spend model credits carry a per-IP hourly budget (`src/lib/limit.ts`), and a visitor's run is filed in the `visitors` cohort so it cannot disturb statistics a script verifies. The one credentialled action is curator review, because that asserts a human checked the page (`src/lib/access.ts`). Records are labelled, never named.

## Run it

```bash
cp .env.example .env            # add MODEL_API_KEY (+ BASETEN_API_KEY for the open-weights path)
docker pull pgkb/pharmcat       # dev mode runs PharmCAT via docker
pnpm install && pnpm dev        # http://localhost:3000
```

Then on the home page:
- **Read a WhatsApp photo** reads the sample photo end to end (about 30 s) and opens the record.
- **Open the research cohort** shows the cohort statistics. Seed a local cohort with `npx tsx scripts/seed-cohort.mts http://localhost:3000`.

Checks:

```bash
npx tsx scripts/selftest.mts                                   # offline, <1 s: normalisation, coverage, de-identification, statistics
npx tsx scripts/eval.mts http://localhost:3000                 # 5 end-to-end cases (ACCESS_CODE=... for a gated host)
npx tsx --env-file=.env scripts/bench.mts rules,muse,open      # extraction benchmark, see docs/BENCHMARK.md
python3 scripts/getrm/fetch.py --all && python3 scripts/getrm/score.py --all   # real reference materials, see docs/GETRM.md
npx tsx --env-file=.env scripts/getrm-read.mts all [baseten]   # the same real genotypes through the reader
```

Production: `docker compose up -d --build` with the env in `.env`. EC2 steps, the access gate and the public sample report are in [docs/DEPLOY.md](docs/DEPLOY.md).

## Fixtures

- `fixtures/oncology-patient-A.vcf`: DPYD *2A het, TPMT *1/*3A, UGT1A1 *28/*28, CYP2C19 *2/*2, NUDT15 *1/*3.
- `fixtures/oncology-patient-B.vcf`: DPYD *2A/*2A, TPMT *3A/*3A.
- `fixtures/lab-report-demo.pdf`: synthetic Indian-panel lab report (HapB3 + c.85T>C heterozygous, UGT1A1 *1/*28, NUDT15 *1/*3, CYP2D6 *1/*4, CYP2C19 *2/*2). Not a real laboratory.
- `fixtures/lab-report-photo.jpg`: the same report as a skewed, noisy phone photo (how reports actually arrive on WhatsApp). Muse Spark vision reads it to the same six calls as the PDF. A copy is served at `/sample-photo.jpg` for the hero.
- `fixtures/bench/` and `fixtures/bench-heldout/`: 36 synthetic reports each (4 layouts × 3 renders) with `truth.json`, generated by `scripts/bench/gen.py` (seeds 20261030 and 7).

All fixtures are synthetic. None is a real patient or laboratory.

## Limitations

- **Research tool only.** No dose, drug or test recommendation; no patient-facing output. Users bring their own consent and ethics approval for any real data.
- **Synthetic data.** Every report here is synthetic and written by us. Real lab formats will be harder (see docs/BENCHMARK.md). Meta's credit terms say API content may be used to improve Meta models, so real reports belong on a self-hosted Muse Spark Open deployment.
- **Coverage rules.** The India-relevant variant list is hand-kept with its sources (`src/lib/quality.ts`); CYP2D6 copy number and HLA are not assessed.
- **Cohort statistics.** Carrier frequencies from pooled clinical reports are not population frequencies: who gets tested is not random. The demo cohort reflects the benchmark generator, not India.
