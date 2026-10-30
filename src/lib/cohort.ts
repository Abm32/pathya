import { promises as fs } from "node:fs";
import path from "node:path";
import { DATA_DIR, readJson } from "./store";
import { INDIA_PANEL, quality, type Quality } from "./quality";
import type { LabExtract } from "./pdf-extract";
import type { PgxProfile } from "./pharmcat";

/**
 * Group-level statistics over a cohort of de-identified records: how often each India-relevant variant is carried,
 * with a Wilson 95% interval, and how often a panel did not state it as tested. Research output only.
 */
export type CaseMeta = { id: string; label: string; cohort?: string; source: string; createdAt: string };
export type Review = { curator: string; decisions: Record<string, "verified" | "corrected" | "unreadable">; at: string };
export type VariantStat = {
  gene: string; variant: string; carriers: number; homozygous: number; n: number; notStated: number;
  freq: number; lo: number; hi: number;
  /** Of notStated: the report listed its panel and this variant was not in it. */
  notTested: number;
  /** Of notStated: the report never says which variants it tested, so coverage is unknowable. */
  undocumented: number;
  /** What the same records give if a panel that never tested the variant is counted as a non-carrier. */
  naive: number;
  published?: string;
  /** For a simulated cohort: the carrier frequency the reports were drawn from. */
  simulated?: number;
};

// Published Indian figures to compare against, as the papers report them.
export const PUBLISHED: Record<string, string> = {
  "DPYD HapB3": "3.3% in a WES study of 1,612 Indians (PMID 40810747)",
  "DPYD c.85T>C (*9A)": "24.9% in 2,000 Indians (PMID 33105068)",
  "DPYD *2A": "0.05–0.5% in Indian cohorts (PMID 40810747)",
  "NUDT15 *3": "risk allele 7–11% in Indian cohorts (PMID 29470173)",
};

/**
 * Per-chromosome allele frequencies the simulated cohort was drawn from, mirroring ALLELE_FREQ in
 * scripts/bench/gen.py. Sources and assumptions: fixtures/pop/truth.json and docs/BENCHMARK.md.
 * These are simulation inputs, not measurements.
 */
export const SIM_ALLELE_FREQ: Record<string, number> = {
  "DPYD HapB3": 0.017, "DPYD c.85T>C (*9A)": 0.13, "DPYD *2A": 0.001, "DPYD *13": 0.001, "DPYD c.2846A>T": 0.002,
  "NUDT15 *3": 0.09, "UGT1A1 *28": 0.35, "UGT1A1 *6": 0.02, "TPMT *3C": 0.014, "CYP2C19 *2": 0.35, "CYP2C19 *17": 0.15,
};
/** The cohort whose records were simulated, so the page can show the frequency they were drawn from. */
export const SIM_COHORT = "india-sim";
const carrierFreq = (allele: number) => 1 - (1 - allele) ** 2;

/** Wilson score interval: honest at small n and at 0 or n, unlike the normal approximation. */
export function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (!n) return [0, 0];
  const p = k / n, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d, h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

export type CohortRecord = { meta: CaseMeta; profile: PgxProfile; quality: Quality | null; review: Review | null };

export async function loadCohort(name: string): Promise<CohortRecord[]> {
  const ids = await fs.readdir(path.join(DATA_DIR, "cases")).catch(() => [] as string[]);
  const out: CohortRecord[] = [];
  for (const id of ids) {
    if (!/^[a-f0-9]{12}$/.test(id)) continue;
    const meta = await readJson<CaseMeta>(id, "case.json");
    if (!meta || (meta.cohort ?? "") !== name) continue;
    const profile = await readJson<PgxProfile>(id, "profile.json");
    if (!profile) continue;
    const extract = await readJson<LabExtract>(id, "extract.json");
    // the stored quality.json is the audit record; statistics recompute from the extract so that a
    // corrected rule applies to records ingested before it
    const q = extract ? quality(extract, profile) : await readJson<Quality>(id, "quality.json");
    out.push({ meta, profile, quality: q, review: await readJson<Review>(id, "review.json") });
  }
  return out.sort((a, b) => a.meta.createdAt.localeCompare(b.meta.createdAt));
}

export function cohortStats(records: CohortRecord[], cohortName?: string): VariantStat[] {
  return INDIA_PANEL.map((v) => {
    let carriers = 0, homozygous = 0, n = 0, notStated = 0, notTested = 0, undocumented = 0;
    for (const r of records) {
      const g = r.profile.genes.find((x) => x.gene === v.gene && x.called);
      if (!g || r.review?.decisions[v.gene] === "unreadable") continue;
      // a lab panel that never named this variant cannot tell us the patient lacks it
      const cov = r.quality?.coverage.find((c) => c.gene === v.gene && c.variant === v.variant);
      if (cov?.stated === false) { notStated++; if (cov.documented) notTested++; else undocumented++; continue; }
      n++;
      const hits = g.diplotype.split("/").filter((a) => v.re.test(a)).length;
      if (hits) carriers++;
      if (hits === 2) homozygous++;
    }
    const [lo, hi] = wilson(carriers, n);
    const key = `${v.gene} ${v.variant}`;
    const allele = cohortName === SIM_COHORT ? SIM_ALLELE_FREQ[key] : undefined;
    return {
      gene: v.gene, variant: v.variant, carriers, homozygous, n, notStated, notTested, undocumented,
      freq: n ? carriers / n : 0, lo, hi,
      naive: n + notStated ? carriers / (n + notStated) : 0,
      published: PUBLISHED[key],
      simulated: allele === undefined ? undefined : carrierFreq(allele),
    };
  });
}

/** One row per record, one column per gene: the shape a registry or a statistics package wants. */
export function cohortCsv(records: CohortRecord[]): string {
  const genes = [...new Set(INDIA_PANEL.map((v) => v.gene).concat("CYP2D6"))];
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const head = ["record_id", "source", "created_at", ...genes.flatMap((g) => [`${g}_diplotype`, `${g}_phenotype`]), "curator_reviewed"];
  const rows = records.map((r) => [r.meta.id, r.meta.source, r.meta.createdAt, ...genes.flatMap((g) => {
    const x = r.profile.genes.find((y) => y.gene === g && y.called);
    return [x?.diplotype ?? "", x?.phenotype ?? ""];
  }), r.review ? "yes" : "no"].map((c) => esc(String(c))).join(","));
  return [head.join(","), ...rows].join("\n") + "\n";
}
