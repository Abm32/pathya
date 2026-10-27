# Pathya (പഥ്യം)

**Pharmacogenomic result in. Oncologist-ready toxicity report out. In the patient's language.**

*Pathya* is the Ayurvedic word for the regimen that suits a particular patient. Built by [Anukriti AI](https://anukritiai.com), Kochi, for the Meta Global AI Developer Hackathon 2026 (Startup track, "Build for Your World").

## The problem

Fluoropyrimidines (5-FU, capecitabine) are the backbone of colorectal, gastric and breast chemotherapy. 0.1–1% of treated patients die of toxicity. Carriers of DPYD decreased-function variants are ~4% of patients but ~48% of toxicity deaths (Sharma 2021, [10.1002/onco.13967](https://theoncologist.onlinelibrary.wiley.com/doi/full/10.1002/onco.13967)). The FDA added DPD-deficiency testing language to the capecitabine label in Oct 2025 and 5-FU in Feb 2026; EMA has recommended testing since 2020.

In India the gap is wider:

- ~5–6% of Indians carry a decreased/no-function DPYD variant, but the dominant one is HapB3, not *2A. CPIC's European tier-1 panel detects few Indian carriers ([PMID 40810747](https://pubmed.ncbi.nlm.nih.gov/40810747/)).
- DPYD c.85T>C (*9A) runs at ~25% in Indians and is the only variant with replicated toxicity association in South Indian prospective cohorts ([PMC11300675](https://pmc.ncbi.nlm.nih.gov/articles/PMC11300675/)). CPIC calls it normal function.
- NUDT15 risk alleles are ~7–11% in Indians, more important than TPMT (~3–4%) for thiopurines ([PMID 29470173](https://pubmed.ncbi.nlm.nih.gov/29470173/)).
- No ICMR/NCG guidance exists on DPYD or UGT1A1 testing. ~75% of prescribers say they lack confidence interpreting PGx reports ([PMC9696651](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9696651/)).

Lab reports arrive as PDFs with rsIDs and star alleles. The oncologist has a clinic full of patients and no pharmacogenomics training. Interpretation is the bottleneck, not the assay.

Full evidence brief with sources: [docs/EVIDENCE.md](docs/EVIDENCE.md).

## What it does

1. **Ingest** a lab PGx report (PDF or phone photo) or a genotype VCF (GRCh38).
2. **Call** diplotypes and phenotypes deterministically with [PharmCAT](https://pharmcat.clinpgx.org) (CPIC's reference implementation), which also attaches the matching CPIC, DPWG and FDA-label recommendations.
3. **Layer** an India lens: deterministic, cited rules for HapB3, c.85T>C, NUDT15-over-TPMT, and panel-coverage warnings.
4. **Reason** with Muse Spark: map the medication list (brands, abbreviations, Malayalam-English dictation) to guideline drugs, rank risk (avoid / adjust / caution / standard / unknown), write the clinician summary with PMIDs copied only from the profile, and write the patient explanation in English and Malayalam.
5. **Dictate**: the oncologist records the consult; Muse Voice Transcribe (diarized, code-switched Malayalam/English, keyword-biased to drug names) feeds Muse Spark, which extracts current and planned medications and re-runs the check.
6. **Audit**: every case has an append-only log of uploads, model calls and outputs. Clinician confirmation is required before any action.

## Meta models used

| Model | Where |
|---|---|
| `muse-spark-1.3` | Lab-report reading (PDF/image input, strict JSON schema), medication mapping and risk reasoning (strict JSON schema), bilingual patient explanation |
| `muse-voice-transcribe-1.0` | Consult dictation: diarization mode, `languageBias` English + Malayalam, `keywords` biased to oncology drug names |
| `meta-models/muse-spark-open-1026` (Muse Spark Open, open weights, via Baseten) | Second inference path for the same medication-mapping and patient-explanation step. Automatic fallback when api.meta.ai fails; `MUSE_PROVIDER=baseten` makes it primary. Open weights are what a hospital would self-host so genomic reports never leave the building |
| Meta Model API / Baseten | Both OpenAI-SDK compatible: `https://api.meta.ai/v1`, `https://inference.baseten.co/v1` |

Not used on purpose: Muse Image (no clinical value here), SAM 3.1 (no imaging task).

## Why it holds up

- **No dose comes from the LLM.** Every recommendation is PharmCAT's CPIC/DPWG/FDA text. Muse Spark ranks, maps and explains; it cannot invent a diplotype, dose or citation (schema-constrained, profile-only citations, verbatim quotes from the lab report).
- **Deterministic eval.** `pnpm tsx scripts/eval.mts` runs three synthetic patients end to end and asserts phenotypes and risk calls (DPYD IM → capecitabine adjust; DPYD PM → 5-FU avoid; lab PDF with HapB3 + c.85T>C → called IM, India lens fires).
- **Two inference paths, one wire format.** Hosted Muse Spark 1.3 (strict JSON schema, PDF input, web search) and open-weights Muse Spark Open on Baseten (schema in prompt, JSON extracted and validated). Either can be primary; the other is the fallback. Open weights give the data-residency answer every Indian hospital IT team asks first.
- **Single container.** Node app on top of the official `pgkb/pharmcat` image; no docker-in-docker, no external PGx service.
- **Access gate, rate-limited login, audit log, no PHI fields.** Cases are labelled, not named.

## Run it

```bash
cp .env.example .env            # add MODEL_API_KEY (+ BASETEN_API_KEY for the open-weights path)
docker pull pgkb/pharmcat       # dev mode runs PharmCAT via docker
pnpm install && pnpm dev        # http://localhost:3000, click "Lab PDF (Indian panel)"
pnpm tsx scripts/eval.mts http://localhost:3000
```

Production: `docker build -t anukriti-pgx . && docker run -p 3000:3000 --env-file .env -v pgx-data:/data anukriti-pgx`.

## Fixtures

- `fixtures/oncology-patient-A.vcf`: DPYD *2A het, TPMT *1/*3A, UGT1A1 *28/*28, CYP2C19 *2/*2, NUDT15 *1/*3.
- `fixtures/oncology-patient-B.vcf`: DPYD *2A/*2A, TPMT *3A/*3A.
- `fixtures/lab-report-demo.pdf`: synthetic Indian-panel lab report (HapB3 + c.85T>C heterozygous, UGT1A1 *1/*28, NUDT15 *1/*3, CYP2D6 *1/*4, CYP2C19 *2/*2). Not a real laboratory.

## Limitations

Decision support only; the treating clinician confirms. CYP2D6 and HLA need separate testing. Non-genetic factors (renal/hepatic function, interactions) are not assessed. Indian lab price/turnaround data in the evidence brief is unverified; clinician pilot feedback will be added before submission.
