import type { PgxProfile } from "./pharmcat";

/**
 * Population-aware notes layered on top of CPIC/DPWG/FDA. Deterministic, cited.
 * Rationale: CPIC's DPYD tier-1 set (*2A, *13, c.2846A>T, HapB3) is European-derived; Indian cohorts show *2A ~0.05-0.5%,
 * c.2846A>T near-absent, HapB3 ~3.3% and c.85T>C (*9A) ~25% with toxicity association in South India. See docs/EVIDENCE.md.
 */
export type LensNote = { level: "warn" | "info"; gene: string; title: string; body: string; sources: string[] };

const SRC = {
  wes1612: "PMID 40810747 (WES of 1,612 Indians: HapB3 3.28%, ~5-6% carry a decreased/no-function DPYD variant)",
  naushad: "PMID 33105068 (Naushad 2021, n=2,000 Indians: DPYD c.85T>C 24.9%)",
  bjc: "PMC11300675 (Br J Cancer 2024: c.85T>C toxicity association replicated in South India + Tunisia)",
  cpicDpyd: "PMID 29152729 (CPIC DPYD 2017 update)",
  nudt: "PMID 29470173; BMC Gastroenterol 2021 (NUDT15 risk allele ~7-11% in Indians vs TPMT ~3-4%)",
  cpicTpmt: "PMID 41618934 (CPIC TPMT/NUDT15 2025 update)",
  amp: "PMID 39032821 (AMP/CAP/ACMG/CPIC DPYD genotyping tier set)",
};

export function indiaLens(profile: PgxProfile, opts: { panelNotes?: string; meds: string[] } = { meds: [] }): LensNote[] {
  const notes: LensNote[] = [];
  const g = (s: string) => profile.genes.find((x) => x.gene === s);
  const onFluoropyrimidine = opts.meds.some((m) => /capecitabine|xeloda|fluorouracil|5-?fu|tegafur|folfox|folfiri|xelox|capox/i.test(m));
  const onThiopurine = opts.meds.some((m) => /mercaptopurine|6-?mp|azathioprine|thioguanine/i.test(m));

  const dpyd = g("DPYD");
  if (dpyd?.called) {
    const has85 = dpyd.alleles.some((a) => /c\.85T>C/.test(a)) || /c\.85T>C/.test(dpyd.diplotype);
    if (has85) {
      notes.push({
        level: "warn", gene: "DPYD",
        title: "c.85T>C (*9A) carrier: CPIC assigns normal function, but South Indian cohorts link it to fluoropyrimidine toxicity",
        body: "No dose change is mandated by CPIC. Consider closer early-cycle monitoring (hand-foot syndrome, diarrhoea) and discuss with the patient. Flagged because this variant is ~25% in Indians and is the only DPYD variant with replicated toxicity association in Indian prospective cohorts.",
        sources: [SRC.naushad, SRC.bjc, SRC.cpicDpyd],
      });
    }
    if (onFluoropyrimidine && /Normal Metabolizer/.test(dpyd.phenotype) && dpyd.source === "OUTSIDE") {
      notes.push({
        level: "info", gene: "DPYD",
        title: "Lab-reported normal DPYD: check which variants the panel actually tested",
        body: `A European tier-1 panel (*2A, *13, c.2846A>T, HapB3) detects few Indian carriers; HapB3 is the most common Indian decreased-function variant and c.85T>C is not in that set. ${opts.panelNotes ? `Panel notes: ${opts.panelNotes}` : "Panel coverage was not stated on the report."}`,
        sources: [SRC.wes1612, SRC.amp],
      });
    }
  } else if (onFluoropyrimidine) {
    notes.push({
      level: "warn", gene: "DPYD",
      title: "DPYD not tested but a fluoropyrimidine is planned",
      body: "EMA recommends and FDA labels (capecitabine Oct 2025, 5-FU Feb 2026) advise testing for DPD deficiency before treatment. ~5-6% of Indians carry a decreased/no-function DPYD variant.",
      sources: [SRC.wes1612, SRC.cpicDpyd],
    });
  }

  const nudt = g("NUDT15"), tpmt = g("TPMT");
  if (onThiopurine) {
    if (!nudt?.called) {
      notes.push({
        level: "warn", gene: "NUDT15",
        title: "NUDT15 not tested: in Indian patients it matters more than TPMT",
        body: "NUDT15 risk-allele frequency is ~7-11% in Indian cohorts versus ~3-4% for TPMT. CPIC recommends testing both before thiopurines.",
        sources: [SRC.nudt, SRC.cpicTpmt],
      });
    } else if (nudt.called && tpmt?.called && /Normal/.test(tpmt.phenotype) && !/Normal/.test(nudt.phenotype)) {
      notes.push({
        level: "info", gene: "NUDT15",
        title: "Thiopurine risk here is driven by NUDT15, not TPMT",
        body: "Expected pattern in South Asian patients. Follow the NUDT15 phenotype for dosing.",
        sources: [SRC.nudt, SRC.cpicTpmt],
      });
    }
  }
  return notes;
}
