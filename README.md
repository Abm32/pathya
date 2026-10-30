# Pathya (പഥ്യം)

**India's pharmacogenomic results are stuck in PDFs and WhatsApp photos. Pathya turns them into verified, de-identified research data.**

**Live: https://pathya.anukritiai.com** (the story, the [demo cohort](https://pathya.anukritiai.com/cohort) and a [sample record](https://pathya.anukritiai.com/sample) open without a code).

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
| `meta-models/muse-spark-open-1026` (Muse Spark Open, open weights, via Baseten) | Same reader and schema; automatic fallback, or primary with `MUSE_PROVIDER=baseten`. 177/177 on the held-out benchmark. Open weights let a biobank keep genomic data in-house |

Not used on purpose: Muse Image and SAM 3.1 (no image to generate or segment).

## Why it holds up

- **The model only reads.** It extracts and quotes; PharmCAT names; tested rules check; statistics are plain code. No advice is generated anywhere, and the eval fails if guideline or drug text, or an identifier, is stored.
- **Extraction benchmark (held out).** 36 synthetic Indian lab reports in four layouts (star table, rsID table, narrative, variant checklist), each as a clean PDF, a phone photo and a harsh skewed photo: Muse Spark 1.3 and Muse Spark Open each read 177/177 gene calls exactly, against 58/59, 26/59 and 0/59 for an OCR + rules baseline. The development run caught two pipeline bugs, fixed before the held-out run. The reports, truth and harness are released as IndiPGx-Read v0.1. Method, limits and misses: [docs/BENCHMARK.md](docs/BENCHMARK.md).
- **Self-test.** `npx tsx scripts/selftest.mts` checks DPYD normalisation, coverage rules, de-identification, Wilson intervals and cohort counting offline.
- **End-to-end eval.** `npx tsx scripts/eval.mts <url>` runs 5 cases (two VCFs, a lab PDF, the same report as a phone photo, results read aloud) through a live server: 5/5 on production, 2026-10-30.
- **Live cohort check.** `npx tsx scripts/verify-cohort.mts <url>`: all 106 gene calls in the 24 public demo records match the benchmark ground truth, with no identifiers or drug text stored.
- **Two inference paths, one wire format.** Hosted Muse Spark 1.3 (strict JSON schema, PDF input, web search) and open-weights Muse Spark Open on Baseten (schema in prompt, JSON extracted and validated).
- **Single container.** Node app on the official `pgkb/pharmcat` image.
- **Access.** The demo cohort and its records are public read-only (`src/lib/access.ts`); anything that calls a model or writes data needs the code. Records are labelled, never named.

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
