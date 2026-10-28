# Submission text: Pathya

Meta Global AI Developer Hackathon 2026 · Startup track · Build for Your World
Fill the bracketed fields before submitting. Do not submit with a `[PILOT]` placeholder still in it: either fill it with a real quote or delete the sentence.

---

## Project name

Pathya (പഥ്യം)

## Tagline (one line)

Pharmacogenomic lab report in, oncologist-ready chemotherapy toxicity check out, in the patient's own language.

## Short description (≈50 words)

Pathya reads an Indian pharmacogenomic lab report, from a PDF or a phone photo, and tells the oncologist which chemotherapy drugs need a dose change before the first cycle. Genotype calls are deterministic (PharmCAT, CPIC's reference engine). Muse Spark reads, ranks and explains in English and Malayalam. Muse Voice takes the dictated consult.

## The problem

Fluoropyrimidines (5-FU, capecitabine) are the backbone of colorectal, gastric and breast cancer treatment, and they kill 0.1 to 1% of the patients who take them. Carriers of DPYD decreased-function variants are about 4% of patients but about 48% of those deaths (Sharma 2021). A cheap gene test prevents most of it. The FDA added DPD-deficiency language to the capecitabine label in October 2025 and to 5-FU in February 2026.

In India the test is the easy part. Interpretation is the bottleneck:

- The dominant Indian risk variant is HapB3, not the *2A that European-derived panels are built around (PMID 40810747).
- DPYD c.85T>C runs at about 25% in Indians. CPIC calls it normal function, yet it is the only variant with replicated toxicity association in South Indian prospective cohorts (PMC11300675).
- NUDT15 matters more than TPMT for thiopurines in Indians (PMID 29470173).
- There is no ICMR or national guidance on DPYD testing, and about 75% of prescribers say they are not confident reading a PGx report (PMC9696651).

The result is a PDF of rsIDs and star alleles landing on the desk of an oncologist with 40 patients that day and no pharmacogenomics training.

## What it does

1. **Ingest.** Upload the lab report as a PDF or a phone photo (how reports actually arrive, over WhatsApp), or a GRCh38 VCF.
2. **Read.** Muse Spark extracts every gene call and quotes the line it came from, verbatim. Nothing is inferred beyond what is printed.
3. **Call.** PharmCAT assigns diplotypes and phenotypes and attaches the matching CPIC, DPWG and FDA-label recommendations. No dose ever comes from the language model.
4. **India lens.** Deterministic rules, each with its PMID, flag what CPIC misses for this population: HapB3, c.85T>C, NUDT15 over TPMT, and targeted-panel coverage gaps.
5. **Reason and explain.** Muse Spark maps the medication list (brand names, abbreviations, Malayalam-English dictation) to guideline drugs, ranks each as avoid / adjust / caution / standard / unknown, writes the clinician summary with citations taken only from the guideline profile, and writes the patient explanation in English and Malayalam.
6. **Dictate.** The oncologist records the consult. Muse Voice Transcribe (diarized, code-switched Malayalam and English, keyword-biased to oncology drug names) produces the transcript, Muse Spark extracts current and planned medications, and the check re-runs.
7. **Check what is new.** One click runs Muse Spark web search against drug labels and guidelines newer than the bundled CPIC data, with linked citations.
8. **Confirm.** Nothing is advice until the clinician accepts, modifies or rejects each flagged drug. Every upload, model call, output and decision goes to an append-only audit log.

The screen shows the work as it happens: a live run panel streams each step from the server as it completes (Muse Spark's quoted calls, PharmCAT's phenotypes, the India rules that fired, the risk for each drug), and the finished report carries a run trace with timings plus the original document beside the quotes.

## How we used Meta's models

| Model | What it does in Pathya |
|---|---|
| `muse-spark-1.3` | Reads lab reports from PDF and phone-photo input under a strict JSON schema with verbatim quotes; maps and ranks medications under a strict schema; writes the clinician summary and the English and Malayalam patient text; web search with URL citations for post-guideline label changes |
| `muse-voice-transcribe-1.0` | Consult dictation with diarization, English + Malayalam language bias, and keyword biasing to oncology drug names |
| Muse Spark Open (`meta-models/muse-spark-open-1026`, open weights, served on Baseten) | Second inference path for the same mapping and explanation step. Automatic fallback when the hosted API fails, or primary with one environment variable. Open weights are the answer to the first question every Indian hospital IT team asks: can genomic data stay inside our building? |

Both paths speak the same OpenAI-compatible wire format. The hosted model enforces the JSON schema; for the open model the schema goes in the prompt and the JSON is extracted and validated.

We left out Muse Image and SAM 3.1 on purpose. Nothing in this workflow needs an image generated or segmented, and adding them would be decoration.

## How we built it

- Next.js 16 on Node, one Docker container built on the official `pgkb/pharmcat` image (PharmCAT 3.4.0, Java, the preprocessor's Python and bcftools stack). No docker-in-docker and no external PGx service.
- Lab-report path: Muse Spark extraction to PharmCAT "outside calls", so genotype logic stays in PharmCAT even when the input is a photo.
- India lens as plain, cited rules, not prompts.
- Streaming analysis endpoint (NDJSON step events) driving the live run panel; the same endpoint returns plain JSON for scripts.
- Access-code gate with rate-limited login, per-case audit log, case labels instead of patient names, no PHI fields.
- Deployed on AWS EC2 in Mumbai (ap-south-1) behind Caddy with automatic TLS.

## Does it hold up?

- **Deterministic end-to-end eval.** `scripts/eval.mts` runs four synthetic cases through the deployed system and asserts phenotypes and risk calls: DPYD intermediate metabolizer leads to capecitabine "adjust"; DPYD poor metabolizer leads to 5-FU "avoid"; the Indian-panel lab PDF (HapB3 + c.85T>C) is called intermediate and the India lens fires; the same report photographed on a phone gives identical calls.
- **Results.** 4/4 against the live deployment. 3/3 on hosted Muse Spark 1.3 and 3/3 on open-weights Muse Spark Open with no fallback triggered: same genotype calls, same risk ranking, same PMIDs, different prose.
- **Speed.** About 45 to 60 seconds from upload to finished bilingual report, most of it the two Muse Spark calls.
- **Clinician pilot.** [PILOT: "Two Kochi oncologists ran N anonymised past cases; mean score X/5 on 'would this have changed what I did'." plus one quote with permission. Delete this bullet if the pilot is not done.]

## Challenges

- **CPIC is not enough for India.** The guideline-correct answer for c.85T>C is "normal function", and the local evidence disagrees. We kept CPIC's text untouched and put the population evidence beside it as a separate, cited, rule-based layer, so the clinician sees both and the model never overrides a guideline.
- **Keeping the LLM away from doses.** Muse Spark only reads, maps, ranks and explains. Doses are PharmCAT's guideline text, citations must come from the guideline profile, and lab calls must be quoted verbatim from the source.
- **Real lab reports are photos.** Reports arrive as skewed, noisy WhatsApp images. We made the photo path a first-class test case rather than an afterthought.
- **Two providers, one contract.** The open model does not enforce JSON schemas, so the same schema had to work both as a constraint and as an instruction, with validation either way.

## What's next

- Pilot with Kochi oncology day-care units and the hospital pharmacy that dispenses capecitabine.
- Self-hosted Muse Spark Open inside a hospital network, so no genomic data leaves the premises.
- Direct report intake from Indian labs, and EMR / HL7 delivery instead of print.
- More population rules (UGT1A1 *6, CYP2C19 for supportive-care drugs) as Indian evidence matures, each reviewed by a clinical pharmacologist.

## Built by

Anukriti AI, Kochi, Kerala. [Team member names and roles]

## Links

- Live demo: https://16.4.131.103.sslip.io (access code: [give judges a code])
- Demo video: [URL]
- Repository: [URL; make public or add judges as collaborators]
- Evidence brief with every source: `docs/EVIDENCE.md` in the repository

## Disclaimer

Pathya is clinical decision support for qualified clinicians. It is not medical advice. All fixtures are synthetic; no real patient data was used.
