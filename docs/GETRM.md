# Real-data validation: GeT-RM reference materials

Everything on the site is synthetic. This page is not. It is the one place where Pathya is checked
against real human sequence and real laboratory consensus genotypes, both of them public.

| | |
|---|---|
| **Truth** | [CDC GeT-RM](https://www.cdc.gov/lab-quality/php/get-rm/reference-materials.html) consolidated PGx/HLA table — consensus pharmacogenetic genotypes for Coriell reference DNA, agreed across multiple clinical laboratories |
| **Sequence** | [1000 Genomes](https://www.internationalgenome.org/) 30x high-coverage phased panel, GRCh38, sliced at the gene regions PharmCAT reads |
| **Set** | all 208 GeT-RM samples that 1000 Genomes also sequenced; 671 gene calls, 646 of them scorable |
| **Pipeline** | PharmCAT 3.4.0, run by the same `src/lib/pharmcat.ts` the product runs |

Reproduce:

```bash
python3 scripts/getrm/fetch.py --all   # truth table + 208 per-sample VCFs, from the two sources above
python3 scripts/getrm/score.py --all   # PharmCAT, then score against the consensus
npx tsx --env-file=.env scripts/getrm-read.mts all          # the reading path, hosted Muse Spark
npx tsx --env-file=.env scripts/getrm-read.mts all baseten  # the same, on open weights
```

## 1. Sequence → gene calls: 622 of 646 (96.3%)

| gene | match | mismatch | unscored | concordance |
|---|---|---|---|---|
| DPYD | 95 | 9 | 14 | 91% |
| CYP2C19 | 101 | 0 | 0 | 100% |
| CYP2C9 | 100 | 0 | 1 | 100% |
| TPMT | 95 | 3 | 0 | 97% |
| NUDT15 | 8 | 3 | 0 | 73% |
| UGT1A1 | 62 | 3 | 0 | 95% |
| SLCO1B1 | 72 | 6 | 10 | 92% |
| VKORC1 | 89 | 0 | 0 | 100% |
| **total** | **622** | **24** | **25** | **96.3%** |

CYP2C19, CYP2C9 and VKORC1 are exact across every sample that has a consensus genotype.

### What the 24 mismatches are

Each one was looked at. None is a case of the pipeline inventing a call; all are a variant that could
not be seen, or a name that means something different on each side.

**12 — the variant is not in this sequence panel** (9 DPYD, 3 TPMT). The 1000 Genomes release is
filtered, so per sample roughly 52 DPYD and 36 TPMT positions arrive missing rather than reference.
For the three TPMT cases PharmCAT says so itself: `*40`, `*12` and `*6` are listed in its own
`uncalledHaplotypes`. Worked example on the DPYD side: HG03770's consensus genotype is `c.2657G>A`,
whose rs1801267 is one of that sample's 52 no-call positions, so PharmCAT reports Reference.

**6 — SLCO1B1 nomenclature and panel scope.** The consensus tables use the legacy star names, which
are not a renaming of PharmVar's, and the sequence carries decreased-function alleles (`*31`, `*41`,
`*39`) that the legacy typing panel never looked for:

```
NA18484  GeT-RM *1A/*1B   PharmCAT *37/*41 = Decreased Function
NA19207  GeT-RM *1A/*1B   PharmCAT *37/*41 = Decreased Function
NA19226  GeT-RM *1/*1     PharmCAT *31/*37 = Decreased Function
NA19700  GeT-RM *1/*1     PharmCAT *37/*41 = Decreased Function
```

All four are African-ancestry samples, and all four are a panel built elsewhere calling a carrier a
non-carrier. That is the project's own argument arriving uninvited in its own benchmark.

**3 — NUDT15 `*2` vs `*3`, same phenotype.** The two alleles differ by one indel, `c.36_37insGGAGTC`,
which this panel does not represent in a form PharmCAT reads. Both are no-function: all three samples
come back Poor Metabolizer either way, so the disagreement is in the allele name only.

**3 — UGT1A1.** `*7` (HG00589) and `*27` (HG00436) are outside PharmCAT's UGT1A1 allele definitions
altogether — it reads four positions in that gene — so they are a definition-scope difference, not a
missed call. NA20509 is the one genuine disagreement in the whole run: the consensus table gives
`(*28)/(*28 + *60)` in parentheses, meaning inferred; the sequence reads `rs3064744 = CAT|CATAT`,
TA6/TA7, which is `*1/*28` heterozygous. Here the sequence supports PharmCAT.

### Scoring rules, stated because two genes cannot be compared on allele names

- **SLCO1B1** is scored on transporter function, not star names (two decreased-function alleles are a
  Poor Function diplotype, not Decreased).
- **DPYD** is scored as *every variant GeT-RM reports must be among the alleles PharmCAT calls*.
  GeT-RM reports only the variants its laboratories typed; PharmCAT names every allele it finds,
  benign ones such as `c.1627A>G (*5)` included.
- **CYP2C19 `*38`** is PharmVar's name for the reference allele and is read as `*1`.
- "no variants detected" written as one side of a diplotype is the reference allele.
- Where the consensus table offers two possibilities (`*8/*33 or *1/*46`), either is a match.
- 25 calls are unscored: structural variants (exon deletions, hemizygosity) that need copy number,
  loose variant text where the table gives no diplotype, and SLCO1B1 legacy names with no PharmVar
  equivalent such as `*21`.

## 2. Dictated report → gene calls: 545 of 580 phenotypes agree with the sequence

Each sample's real consensus genotypes are read aloud the way a laboratory would read them, put
through Muse Spark and the app's normalisation, and run through PharmCAT. The result is compared
with that same person's calls from their 30x sequence, for all 208 samples.

| reader | phenotype agreement | calls differing from the other reader |
|---|---|---|
| `muse-spark-1.3` (hosted) | 545/580 (94.0%) | 6 of 580 |
| `meta-models/muse-spark-open-1026` (open weights, Baseten) | 544/580 (93.8%) | 6 of 580 |

Open weights are within one call of the hosted model over 580 comparisons. That is the claim the
open-weights story rests on, and this is the evidence for it.

Where the two sides disagree, the reading is usually not what is wrong:

- **17** are gene calls where the sequence already disagreed with the consensus in section 1, for the
  reasons catalogued there. The report agrees with the consensus; the sequence does not.
- **15** are calls the consensus table leaves unscorable, 16 on the open weights (structural variants,
  loose variant text).
- **3** are reader-side, and all three are the same coverage gap: the consensus text says `*1/*1`
  (NA07048, NA07055) or `*1/*9` (NA18873), the reader reads exactly that, and the sequence carries a
  decreased-function variant the laboratory never typed (`c.2846A>T`, `c.557A>G`).

No reading defect remains in the set. The reader is wrong nowhere that the report was right.

### What the phenotype metric was hiding

The headline moved by one call, and that number understates the defect it closed. Five samples had a
chromosome written as a list of variants; both models quoted the list correctly into `verbatim` and
then called the gene `Reference/Reference`. Only **one** of the five changed phenotype when fixed:

```
HG00537, HG00538, HG00613   Reference/Reference  ->  Reference/c.1627A>G (*5)   Normal either way
HG03115                     Reference/Reference  ->  Reference/c.85T>C (*9A)    Normal either way
HG02772                     Reference/Reference  ->  Reference/c.868A>G         Normal -> Intermediate
```

Four of the five scored as agreement while naming the wrong alleles, because a wrong allele whose
function is normal lands on the same phenotype. A benchmark scored on phenotypes cannot see that, and
`c.85T>C` — the variant this project exists for — was among the alleles being dropped in silence.
The number to trust here is five calls corrected, not one call gained.

## 3. Six defects this found, all now fixed

Real reports write allele names that PharmCAT does not accept, and every one of these failed
silently — the gene came back uncalled or Indeterminate rather than wrong, which is harder to notice.

- **DPYD `*9` and `*2`.** `src/lib/pdf-extract.ts` mapped `*9A` and `*2A` to their HGVS names but not
  the bare `*9` / `*2` that GeT-RM and Indian laboratory reports actually print. `*9` is
  `c.85T>C` — the variant the whole project is about — so this dropped exactly the call that matters.
- **UGT1A1 `*60` and legacy SLCO1B1 names.** A report that says `(*28 + *60)/*60` or `*1A/*1B` was
  handed to PharmCAT verbatim and came back with no phenotype. `*60` and `*80` are linkage markers
  PharmCAT folds into its own haplotypes; they are now dropped, and `*1A`/`*1B`/`*17` are mapped to
  `*1`/`*37`/`*15`.
- **DPYD HGVS without the star number.** PharmCAT's DPYD allele names carry it (`c.1601G>A (*4)`);
  reports and consensus tables print the HGVS alone. The names are now indexed by their bare HGVS too.
- **A DPYD chromosome carrying several variants.** `c.85T>C, c.868A>G, c.1218G>A` was passed through
  as a comma string and left the gene Indeterminate. It now resolves to the lowest-function variant
  the chromosome carries, because dropping the decreased-function allele is the dangerous direction
  to err in.
- **Parenthesised alleles.** A lab writes `(*4)` or `(*15)` to mark an allele inferred rather than
  directly typed. The brackets were being sent to PharmCAT as part of the name.
- **A quoted variant discarded by its own call.** On five samples both models copied a multi-variant
  chromosome into `verbatim` exactly as printed and then returned `Reference/Reference`, throwing away
  what they had just quoted. The quote is the report's own words, so it now wins: when a DPYD call
  comes back all-reference and its quote carries HGVS, the quote is re-read. `no variants detected`
  written as one side of a diplotype is also read as the reference allele now, in every gene, because
  that is how laboratories print an empty chromosome.

Every one is covered by an assertion in `scripts/selftest.mts`, the last of them with a negative case
so the guard cannot invent a variant out of an empty report. Together they took the reading path from
38/50 on the first small run to 545/580 over all 208 samples.

## What this does not show

- **CYP2D6 is excluded.** Its calls need copy number and this panel cannot give it, so the gene is in
  the truth table and out of the benchmark.
- **The sequence is not complete at every position PharmCAT wants.** Per sample roughly 76 CYP2C9,
  52 DPYD, 36 TPMT, 19 CYP2C19 and 15 each of SLCO1B1 and NUDT15 positions arrive missing rather than
  reference, which is where half the mismatches come from. Concordance is measured in spite of that.
- **The spoken report is generated from the consensus genotypes, not transcribed from a recording.**
  It tests reading and normalisation, not speech.
- **No photograph of a real report was read.** The reading path is tested here on the real genotypes,
  not on a real laboratory's layout. That gap is tracked in [LAB-CALLS.md](LAB-CALLS.md).
- **No patient data of any kind.** Coriell reference materials are consented, published cell lines.
