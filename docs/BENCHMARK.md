# Benchmark and dataset: IndiPGx-Read v0.1

Can Meta's models read Indian pharmacogenomic lab reports, including bad phone photos, accurately enough to build research data from them? This is the evaluation behind Pathya's reader, and the dataset is released with it.

**IndiPGx-Read v0.1**: 72 synthetic Indian PGx lab reports (36 development, 36 held out; 12 genotype profiles × 3 renders per set) with ground truth in `truth.json`, plus the scoring harness. Everything is reproducible from the repository and synthetic: no real patient or laboratory.

## 1. Lab-report extraction

### Setup

- **Reports.** `scripts/bench/gen.py` writes synthetic Indian PGx reports with known genotypes for DPYD (8 genotypes, including HapB3, c.85T>C, *2A/*13 and HapB3 homozygous), UGT1A1, TPMT, NUDT15, CYP2D6 and CYP2C19.
- **Four layouts Indian labs use:** star-allele table, rsID-only table (forward-strand genotypes, star assignment left to the clinician), narrative paragraphs, and variant checklist ("*28: Detected (heterozygous)"). Every report carries distractors: tested-variant lists, a drug list, method text.
- **Three renders of each report:** clean PDF; phone photo (rotated, blurred, tinted, JPEG 72); harsh photo (perspective skew, uneven shadow, more blur and noise, 95 dpi, JPEG 55), the kind that arrives forwarded on WhatsApp.
- **Readers:**
  - **Muse Spark 1.3** (hosted): the production path, `extractLabReport` with PDF or image input and a strict JSON schema.
  - **Muse Spark Open** on Baseten (open weights): same prompt and schema. PDFs are sent as a 150 dpi page image because there is no file input.
  - **OCR + rules:** `pdftotext` for PDFs; for photos, ImageMagick cleanup (greyscale, 2× upscale) then `tesseract`, then regex parsing. It was written knowing all four layouts and repairs common OCR glyph errors, so it is the best case for a rules reader.
- **Score:** exact diplotype per gene after the same normalisation the app applies before PharmCAT (`toOutsideCalls`). An allele set must match exactly, so `*1/*3C` vs `*3B/*3C` is wrong. Also counted: genes reported that are not on the page, and whether each verbatim quote is actually on the page.

### Results: held-out set (seed 7, 36 reports, 177 gene calls)

The two pipeline fixes below were made on a development set (seed 20261030). This set was generated afterwards and run once.

| | Clean PDF | Phone photo | Harsh photo | DPYD calls | Perfect reports | Invented genes | Quotes found on page |
|---|---|---|---|---|---|---|---|
| **Muse Spark 1.3** | **59/59** | **59/59** | **59/59** | **36/36** | **36/36** | 0 | 100% |
| **Muse Spark Open** | **59/59** | **59/59** | **59/59** | **36/36** | **36/36** | 0 | 100% |
| OCR + rules | 58/59 | 26/59 | 0/59 | 19/36 | 13/36 | 0 | n/a |

The median time per report was 16 s for Muse Spark 1.3 and 15 s for Spark Open. The OCR baseline took 3 s. These figures are from a rerun on 2026-10-30 after the extraction schema gained `testedVariants` (the list of variants a report says it tested); gene-call results were unchanged at 177/177 for both models.

### Live cohort check

The public demo cohort is built by running one phone photo per synthetic person (24 people from both sets) through the production pipeline. `scripts/verify-cohort.mts` compares every live record with the ground truth: **106/106 gene calls match**, and no record stores a patient identifier or any guideline or drug text.

### What the development run caught

The first run on the development set scored 96.5% (Muse Spark 1.3) and 97.9% (Spark Open). Every miss traced to the pipeline, not to reading:

1. **rsID-only reports for TPMT and NUDT15.** Muse Spark returned the raw genotype (`C/T`) because the schema only spelled out rsID conversions for DPYD and UGT1A1. The schema now lists the TPMT, NUDT15, CYP2C19 and UGT1A1*6 mappings and forbids raw nucleotide genotypes as diplotypes.
2. **DPYD allele names.** Spark Open wrote `c.1236G>A (HapB3)`, which `normaliseDiplotype` did not recognise, so PharmCAT would have received an unknown allele. The normaliser now falls back to the DPYD variant table for any allele text that names a known variant.
3. **Shared rules bugs, found while building the baseline:**
   - `dpydFromText` now reads "Detected (homozygous)" as two copies.
   - It now treats "No tested variant detected" as reference.

After the fixes the development set scored 141/141 on both models, and the held-out set above was run once.

### Limits

- The layouts are four families written by us. Real Indian lab reports vary more (logos, multi-page reports, handwritten notes, regional language headers). The next test is de-identified real report formats from a partner lab, under its consent and ethics approval.
- Synthetic photos approximate phone capture. They do not reproduce glare, fingers or folds.
- 36 reports is small. The point is the gap to the baseline and the failure modes, not a third significant figure.

## Reproduce

```bash
python3 scripts/bench/gen.py                              # development set -> fixtures/bench
python3 scripts/bench/gen.py 7 fixtures/bench-heldout     # held-out set
npx tsx --env-file=.env scripts/bench.mts rules,muse,open
BENCH_DIR=fixtures/bench-heldout npx tsx --env-file=.env scripts/bench.mts rules,muse,open
```

Raw results: `docs/bench-results.json` (development set) and `docs/bench-results-heldout.json` (held-out set). Each includes every miss. `docs/bench-results.json` also holds a medication-mapping run from before the pivot; that feature and its harness were removed.
