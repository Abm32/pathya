# Evidence brief — Pathya (compiled 2026-10-26)

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
- **Implication: a CPIC-only 4-variant panel detects almost nothing in Indians.**
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

## 3. Users and workflow (weakest, needs calls)
- Indian lab prices/TAT/report PDFs: UNVERIFIED. Found: UGT1A1 TA-repeat ₹7,500, 7 working days (DNA Labs India); consumer PGx panel ₹12,999, 6–8 weeks (Helixline).
- Result-to-chemo latency: median 9 days (IQR 5–19), some start before results (PMC10818131). Product wedge: interpretation speed.
- TODO: call MedGenome, Strand, Neuberg, 4baseCare for DPYD panel content, price, TAT, sample report.

## 4. What clinicians want
- Separate short clinician report: how result changes care + what to do next (Jones 2018, 10.1111/cts.12534).
- ~75% of community prescribers lack confidence using PGx results; report comprehension is the barrier (PMC9696651). Interpretation complexity, time, training (Front Pharmacol 2025 10.3389/fphar.2025.1689300).
- Simplified lay language improves patient comprehension (PMC12194072); counsellors scarce (PMID 42150426).
- No study on PGx reports in Indian regional languages. Malayalam output is unprecedented.

## 5. Competitors
- PharmCAT (free; no LLM, no patient output, no local language). Sequence2Script (free, needs genotypes supplied). ClinPGx/PharmGKB (substrate). OneOme RightMed, Genomind, YouScript (closed, US-priced, psychiatry-weighted). No India-specific tool found.
- Gap: oncology-first, lab-PDF ingest, Indian variant coverage beyond CPIC set, bilingual patient explanation, cited LLM reasoning.

## 6. Pitch numbers
- India 2025 projected new cancer cases 1,569,793 (763,575 M / 806,218 F), breast 232,832 (ICMR-NCRP, IJMR). Colorectal/gastric counts: pull from IJMR table before quoting.
- Cost-effectiveness: no India/LMIC DPYD study. Netherlands cost-saving ~€51/patient while test <€49 (PMID 30544060). US ICER ~$20.5k/QALY (PMID 35668003). Iran: variant prevalence is dominant ICER driver. Argument: economics hinge on local prevalence; nobody has run it on Indian frequencies.

## Build implications
- Rules layer must carry HapB3 and c.85T>C explicitly; surface c.85T>C as "population-specific toxicity evidence, no CPIC activity-score change" rather than forcing CPIC phenotype.
- Never derive doses from LLM recall; all actions from PharmCAT/CPIC/DPWG/FDA text.
- NUDT15 before TPMT in thiopurine messaging for Indian patients.
