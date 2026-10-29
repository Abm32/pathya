# Benchmark: reading Indian PGx lab reports and prescriptions

Two questions decide whether Pathya is safe to put in front of an oncologist:

1. Does it read the lab report correctly, including from a bad phone photo?
2. Does it map prescriptions as they are actually written (brands, abbreviations, dictation) to the right guideline drug?

Everything here is reproducible from the repository. All documents are synthetic.

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

The median time per report was 23 s for Muse Spark 1.3 and 17 s for Spark Open. The OCR baseline took 3 s.

### What the development run caught

The first run on the development set scored 96.5% (Muse Spark 1.3) and 97.9% (Spark Open). Every miss traced to the pipeline, not to reading:

1. **rsID-only reports for TPMT and NUDT15.** Muse Spark returned the raw genotype (`C/T`) because the schema only spelled out rsID conversions for DPYD and UGT1A1. The schema now lists the TPMT, NUDT15, CYP2C19 and UGT1A1*6 mappings and forbids raw nucleotide genotypes as diplotypes.
2. **DPYD allele names.** Spark Open wrote `c.1236G>A (HapB3)`, which `normaliseDiplotype` did not recognise, so PharmCAT would have received an unknown allele. The normaliser now falls back to the DPYD variant table for any allele text that names a known variant.
3. **Shared rules bugs, found while building the baseline:**
   - `dpydFromText` now reads "Detected (homozygous)" as two copies.
   - It now treats "No tested variant detected" as reference.

After the fixes the development set scored 141/141 on both models, and the held-out set above was run once.

### Limits

- The layouts are four families written by us. Real Indian lab reports vary more (logos, multi-page reports, handwritten notes, regional language headers). The next test is anonymised real reports in the clinician pilot.
- Synthetic photos approximate phone capture. They do not reproduce glare, fingers or folds.
- 36 reports is small. The point is the gap to the baseline and the failure modes, not a third significant figure.

## 2. Medication mapping

- **Setup:** `scripts/bench-meds.mts` runs the production report call (`generateReport`) on a real PharmCAT profile (CYP2C19 *2/*2, CYP2D6 *1/*4, DPYD HapB3/c.85T>C, NUDT15 *1/*3, UGT1A1 *1/*28) with 26 medication inputs as Indian oncologists write them:
  - Indian and global brands: Xeloda, Campto, Imuran, Purinethol, Nolvadex, Emeset, Zofran, Clopilet, Plavix, Pan 40, Nexpro, Ultracet, Contramal;
  - abbreviations: 5FU, CPT-11, 6MP;
  - a typo: capecitabin;
  - Malayalam-English dictation: "Xeloda tablet randu neram";
  - six drugs with no gene guideline, which must stay unmapped: Dolo 650, Dexona, oxaliplatin, leucovorin, Glycomet, Emend.
- **Score:** the input maps to the expected guideline drug, or lands in `unmappedMedications` when no guideline applies. 3 runs per model, each model pinned with no fallback.

| | Correct (3 runs) |
|---|---|
| **Muse Spark 1.3** | **26, 26, 26 of 26** |
| **Muse Spark Open** | **26, 26, 26 of 26** |
| Generic-name lookup | 8 of 26 (2 of the 20 names that map to a guideline; the other 6 are the no-guideline drugs) |

## Reproduce

```bash
python3 scripts/bench/gen.py                              # development set -> fixtures/bench
python3 scripts/bench/gen.py 7 fixtures/bench-heldout     # held-out set
npx tsx --env-file=.env scripts/bench.mts rules,muse,open
BENCH_DIR=fixtures/bench-heldout npx tsx --env-file=.env scripts/bench.mts rules,muse,open
npx tsx --env-file=.env scripts/bench-meds.mts 3
```

Raw results: `docs/bench-results.json` (development set and medications) and `docs/bench-results-heldout.json` (held-out set). Each includes every miss.
