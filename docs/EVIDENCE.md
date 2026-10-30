# Evidence brief — Pathya (compiled 2026-10-26, reframed 2026-10-30)

Pathya is a research and data tool: it reads pharmacogenomic lab reports into verified, de-identified
records and pools them into cohort statistics. It makes no dose, drug or test recommendation. This brief
is the background reading behind which variants the quality rules track and which published figures the
cohort page cites; it is not clinical guidance and nothing here reaches a user of the product.

Every claim links to its source. Items marked UNVERIFIED need a primary check before use in pitch/README.

## Premise corrections
- FDA DPYD label changes: capecitabine **Oct 2025**, fluorouracil **Feb 2026** (not 2024). https://ascopost.com/news/february-2026/fda-provides-safety-labeling-update-for-capecitabine-and-fluorouracil-on-risks-associated-with-dpd-deficiency/
- **No CPIC guideline for UGT1A1 + irinotecan.** CPIC UGT1A1 covers atazanavir only (PMID 26417955). Irinotecan actions come from DPWG + FDA label (PharmCAT carries both).
- DPYD is reported in HGVS (c.1905+1G>A), not star alleles; PharmVar excludes DPYD from star nomenclature (PMC12141247). Ingest must parse HGVS strings.

## 1. Problem evidence
- Fluoropyrimidine toxicity deaths: 0.1–1.0% of treated patients (range across reviews).
- Sharma 2021 meta-analysis: deaths 14/13,363 non-carriers (0.1%) vs 13/566 DPYD carriers (2.3%); carriers ~4% of patients, ~48% of deaths. https://theoncologist.onlinelibrary.wiley.com/doi/full/10.1002/onco.13967
- Carrier OR for treatment-related mortality 34.86 (13.96–87.05). https://link.springer.com/article/10.1186/s12885-024-12981-5
- Grade ≥3 toxicity under genotype-guided dosing: 21% wild-type, 44% *2A, 38% c.2846A>T, 19% HapB3. https://onlinelibrary.wiley.com/doi/full/10.1002/ijc.70005
- **India DPYD:** WES of 1,612 Indians: ~5.3–5.9% carry ≥1 decreased/no-function variant; dominant is c.1236G>A (HapB3) 3.28%. PMID 40810747. *2A ≈ 0.05–0.5%, c.2846A>T near-absent. c.85T>C (*9A) ~25% (Naushad 2021, n=2,000, PMID 33105068: C29R 24.91%, I543V 9.05%, M166V 8.99%, V732I 8.44%).
- c.85T>C is the only variant linked to toxicity in >1 independent prospective cohort (South India + Tunisia; South India ORs 2.3 hand-foot, 2.7 diarrhoea). Br J Cancer 2024 PMC11300675; PMID 42921530.
- **Implication: a CPIC-only 4-variant panel detects almost nothing in Indians, so a cohort pooled from such panels cannot see the variants that matter here. This is what the coverage rules and the IndiPGx-Pop benchmark measure.**
- AIIMS D-TORCH (n=76 capecitabine): 3.9% IM, 0 PM, first NGS-based Indian DPYD report. PMID 41800094. 479 Indian breast-cancer WES found c.1679T>G and c.1905+1G>A. PMID 41327099.
- **NUDT15 in India:** risk-allele ~7–11%, exceeds TPMT: 7.2% (Shah 2017, TPMT absent) https://onlinelibrary.wiley.com/doi/10.1111/jgh.13494; 10.7% allele / 19.4% carrier vs TPMT 3.5% (PMID 29470173); 10.9% vs 4.2% (BMC Gastroenterol 2021). Small single-centre cohorts.
- **UGT1A1:** *28 30–45% in White/African/Indian vs 10–20% East Asian; Malaysian Indians ~8.8% *28/*28 (IJMR). *6 Indian frequency UNVERIFIED. North Indian SCLC: *6 linked to GI toxicity, *28 to OS (Oncologist 2021 10.1002/onco.13757).
- Cost of Indian toxicity admission: WEAK. South India FN drug-cost ₹16.4k/episode drugs only, median LOS 10 d (PMC12949949). Singapore proxy US$4,193 mean per FN episode (PMC4263105).

## 2. Guidelines / regulatory
| Gene/drug | Guideline | PMID |
|---|---|---|
| DPYD / fluoropyrimidines | CPIC 2017 update | 29152729 |
| TPMT/NUDT15 / thiopurines | CPIC 2025 update | 41618934 (+ correction 42050374) |
| CYP2D6 / tamoxifen | CPIC 2018 | 29385237 |
| CYP2D6 / ondansetron | CPIC 2026 update | 41979467 |
| CYP2C19 / clopidogrel | CPIC 2022 | 35034351 |
| CYP2C19 / PPIs | CPIC 2021 | 32770672 |
| CYP2C19 / voriconazole | CPIC 2017 | 27981572 |
| UGT1A1 / irinotecan | none (DPWG + FDA label) | — |
- AMP/CAP/ACMG/CPIC joint DPYD genotyping tier set: PMID 39032821.
- EMA: pre-treatment DPD testing (uracil or genotype) before 5-FU/capecitabine/tegafur/flucytosine. https://www.ema.europa.eu/en/news/ema-recommendations-dpd-testing-prior-treatment-fluorouracil-capecitabine-tegafur-and-flucytosine (2020 date UNVERIFIED on page).
- NCCN Colon v3.2025: "consider testing" before fluoropyrimidines; no mandate. https://www.pharmacytimes.com/view/nccn-flash-update-changes-to-colon-cancer-guidelines-version-3-2025 (verify footnote).
- ESMO: UNVERIFIED. **Indian guidance (ICMR NEDL 2025, NCG): none found on DPYD/UGT1A1.** White space.
- PharmCAT = reference implementation (PMID 36350094), part of ClinPGx.

## 3. Where the data sits today (weakest, needs calls)
- Indian lab prices/TAT/report PDFs: UNVERIFIED. Found: UGT1A1 TA-repeat ₹7,500, 7 working days (DNA Labs India); consumer PGx panel ₹12,999, 6–8 weeks (Helixline).
- Result-to-chemo latency: median 9 days (IQR 5–19), some start before results (PMC10818131). Relevant only as evidence that these results are produced routinely and then go nowhere.
- TODO: call MedGenome, Strand, Neuberg, 4baseCare for DPYD panel content and a blank or synthetic sample report (see LAB-CALLS.md). Panel content is the input the coverage rules need; report layout is what the reader is tested against.

## 4. Why reports do not become data
- Report comprehension and interpretation complexity are documented barriers to PGx results being used at all (PMC9696651; Front Pharmacol 2025 10.3389/fphar.2025.1689300). Pathya does not address interpretation; it addresses the fact that the underlying calls are never captured in a standard form.
- PGx results in India travel as PDFs and phone photos between hospitals. No Indian registry pools them, so each result is used once and then lost.
- Our own IndiPGx-Pop run found that 59% of coverage exclusions were reports that never state which variants they tested: panel documentation, not panel breadth, is the first data-quality problem (docs/BENCHMARK.md).

## 5. Competitors
- PharmCAT (free; takes genotypes, not reports; we use it as the naming authority rather than competing with it). Sequence2Script (needs genotypes supplied). ClinPGx/PharmGKB (substrate we cite). OneOme RightMed, Genomind, YouScript are closed clinical-interpretation products, a different thing from a research record.
- Gap we occupy: getting the calls out of the report at all, in Indian layouts including phone photos, with coverage recorded per variant and pooled with a defensible denominator. No India-specific tool found for this.

## 6. Pitch numbers
- India 2025 projected new cancer cases 1,569,793 (763,575 M / 806,218 F), breast 232,832 (ICMR-NCRP, IJMR). Colorectal/gastric counts: pull from IJMR table before quoting.
- Cost-effectiveness: no India/LMIC DPYD study. Netherlands cost-saving ~€51/patient while test <€49 (PMID 30544060). US ICER ~$20.5k/QALY (PMID 35668003). Iran: variant prevalence is dominant ICER driver. Argument for the dataset, not for a product claim: these analyses hinge on local prevalence, and nobody has prevalence estimates for India beyond two studies.

## Build implications
- Coverage rules must carry HapB3 and c.85T>C explicitly: they are the variants Indian cohorts turn on and the ones European-derived panels skip.
- Record what the report says was tested, separately from what it reports as found, and separately again from whether it documents its panel at all.
- Never derive a dose, drug or test recommendation, from a model or from anything else. Allele names and phenotype terms come from PharmCAT; everything downstream of that is the researcher's call, not the product's.
- Published frequencies are shown only as a reference column with their PMID, never as a claim about a cohort's own records.
