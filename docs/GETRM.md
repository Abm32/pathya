# Real-data validation: GeT-RM reference materials

Everything on the site is synthetic. This page is not. It is the one place where Pathya is checked
against real human sequence and real laboratory consensus genotypes, both of them public.

| | |
|---|---|
| **Truth** | [CDC GeT-RM](https://www.cdc.gov/lab-quality/php/get-rm/reference-materials.html) consolidated PGx/HLA table — consensus pharmacogenetic genotypes for Coriell reference DNA, agreed across multiple clinical laboratories |
| **Sequence** | [1000 Genomes](https://www.internationalgenome.org/) 30x high-coverage phased panel, GRCh38, sliced at the gene regions PharmCAT reads |
| **Overlap** | 208 GeT-RM samples have 1000 Genomes sequence; 24 of them carry the richest ground truth and are the benchmark set (`fixtures/getrm/selected.json`) |
| **Pipeline** | PharmCAT 3.4.0, run by the same `src/lib/pharmcat.ts` the product runs |

Reproduce:

```bash
python3 scripts/getrm/fetch.py        # truth table + per-sample VCFs, from the two sources above
python3 scripts/getrm/score.py        # PharmCAT, then score against the consensus
npx tsx --env-file=.env scripts/getrm-read.mts 8            # the reading path, hosted Muse Spark
npx tsx --env-file=.env scripts/getrm-read.mts 8 baseten    # the same, on open weights
```

## 1. Sequence → gene calls: 161 of 164 (98.2%)

| gene | match | mismatch | unscored | concordance |
|---|---|---|---|---|
| DPYD | 22 | 0 | 2 | 100% |
| CYP2C19 | 24 | 0 | 0 | 100% |
| CYP2C9 | 23 | 0 | 1 | 100% |
| TPMT | 24 | 0 | 0 | 100% |
| NUDT15 | 2 | 0 | 0 | 100% |
| UGT1A1 | 24 | 0 | 0 | 100% |
| SLCO1B1 | 18 | 3 | 3 | 86% |
| VKORC1 | 24 | 0 | 0 | 100% |
| **total** | **161** | **3** | **6** | **98.2%** |

All three mismatches are SLCO1B1, all three in African-ancestry samples, and all three are the same
thing: the sequence carries a decreased-function allele (`*31`, `*41`) that the consensus genotype's
typing panel never looked for, so the panel called the sample normal and PharmCAT did not.

```
NA18484  GeT-RM *1A/*1B   PharmCAT *37/*41 = Decreased Function
NA19207  GeT-RM *1A/*1B   PharmCAT *37/*41 = Decreased Function
NA19226  GeT-RM *1/*1     PharmCAT *31/*37 = Decreased Function
```

That is the project's own argument arriving uninvited in its benchmark: a panel built elsewhere
calls a carrier a non-carrier, and the cohort number is wrong in the safe-looking direction.

Scoring rules, stated because two genes cannot be compared on allele names:

- **SLCO1B1** is scored on transporter function, not star names. The consensus tables use the legacy
  nomenclature (`*1A`, `*1B`, `*17`); PharmCAT uses PharmVar's (`*1`, `*37`, `*15`); the two sets are
  not a renaming of each other.
- **DPYD** is scored as *every variant GeT-RM reports must be among the alleles PharmCAT calls*.
  GeT-RM reports only the variants its laboratories typed; PharmCAT names every allele it finds,
  including benign ones such as `c.1627A>G (*5)`.
- **CYP2C19 `*38`** is PharmVar's name for the reference allele and is read as `*1`.
- 6 calls are unscored: the consensus table gives loose variant text rather than a diplotype, or an
  SLCO1B1 legacy name with no PharmVar equivalent (`*21`).

## 2. Dictated report → gene calls: 48 of 50 phenotypes agree with the sequence

Each sample's real consensus genotypes are read aloud the way a laboratory would read them, put
through Muse Spark and the app's normalisation, and run through PharmCAT. The result is compared
with that same person's calls from their 30x sequence.

| reader | phenotype agreement |
|---|---|
| `muse-spark-1.3` (hosted) | 48/50 |
| `meta-models/muse-spark-open-1026` (open weights, Baseten) | 48/50, allele for allele identical |

The two disagreements:

- `NA12813 SLCO1B1` — the report says `*1/*21`, a legacy name with no PharmVar equivalent. The app
  passes it through unchanged and PharmCAT leaves the gene uncalled. Guessing an equivalent would be
  worse than an uncalled gene.
- `NA18484 SLCO1B1` — the report is right about what the laboratory tested; the sequence carries
  `*41`, which it did not test. Same coverage gap as above.

## 3. Two defects this found, both now fixed

Real reports write allele names that PharmCAT does not accept, and the failure was silent — the gene
came back uncalled rather than wrong, which is harder to notice.

- **DPYD `*9` and `*2`.** `src/lib/pdf-extract.ts` mapped `*9A` and `*2A` to their HGVS names but not
  the bare `*9` / `*2` that GeT-RM and Indian laboratory reports actually print. `*9` is
  `c.85T>C` — the variant the whole project is about — so this dropped exactly the call that matters.
- **UGT1A1 `*60` and legacy SLCO1B1 names.** A report that says `(*28 + *60)/*60` or `*1A/*1B` was
  handed to PharmCAT verbatim and came back with no phenotype. `*60` and `*80` are linkage markers
  PharmCAT folds into its own haplotypes; they are now dropped, and `*1A`/`*1B`/`*17` are mapped to
  `*1`/`*37`/`*15`. Fixing this took the reading path from 38/50 to 48/50.

Both are covered by assertions in `scripts/selftest.mts`.

## What this does not show

- **CYP2D6 is excluded.** Its calls need copy number and this panel cannot give it, so the gene is in
  the truth table and out of the benchmark.
- **The sequence is not complete at every position PharmCAT wants.** The 1000 Genomes panel is
  filtered, so per sample roughly 76 CYP2C9, 52 DPYD, 38 TPMT, 19 CYP2C19 and 15 each of SLCO1B1 and
  NUDT15 positions arrive missing rather than reference. Concordance is measured in spite of that.
- **No photograph of a real report was read.** The reading path is tested here on the real genotypes,
  not on a real laboratory's layout. That gap is tracked in [LAB-CALLS.md](LAB-CALLS.md).
- **No patient data of any kind.** Coriell reference materials are consented, published cell lines.
