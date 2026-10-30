import type { LabExtract } from "./pdf-extract";
import type { PgxProfile } from "./pharmcat";

/**
 * Data-quality checks for a research record. Deterministic, and deliberately not clinical:
 * which India-relevant variants the panel did not state as tested, whether an identifier was removed,
 * and which calls could not be read. No dose, drug or test advice.
 */
export type Quality = {
  identifierRemoved: boolean;
  unread: string[]; // genes printed on the report whose result could not be read
  /**
   * Per India-relevant variant: whether the report names it as tested, and whether the report
   * documents that gene's panel at all. A report that lists its panel and omits a variant tells us
   * the variant was not assayed; a report that never lists a panel tells us nothing either way.
   */
  coverage: { gene: string; variant: string; stated: boolean; documented: boolean; why: string }[];
  warnings: string[];
};

// Variants that matter for Indian cohorts, and the text that shows a panel tested them (name, HGVS or rsID).
export const INDIA_PANEL: { gene: string; variant: string; re: RegExp; why: string }[] = [
  { gene: "DPYD", variant: "HapB3", re: /HapB3|c\.1236G>A|c\.1129-5923C>G|rs56038477|rs75017182/i, why: "Most common Indian decreased-function DPYD variant (~3.3%, PMID 40810747)" },
  { gene: "DPYD", variant: "c.85T>C (*9A)", re: /c\.85T>C|\*9A|rs1801265/i, why: "~25% in Indians; toxicity signal in South Indian cohorts (PMC11300675)" },
  { gene: "DPYD", variant: "*2A", re: /\*2A|c\.1905\+1G>A|IVS14\+1G>A|rs3918290/i, why: "European tier-1 variant; rare in Indians (PMID 40810747)" },
  { gene: "DPYD", variant: "*13", re: /\*13|c\.1679T>G|rs55886062/i, why: "Tier-1 no-function variant (PMID 39032821)" },
  { gene: "DPYD", variant: "c.2846A>T", re: /c\.2846A>T|D949V|rs67376798/i, why: "Tier-1 variant; near-absent in Indians (PMID 40810747)" },
  { gene: "NUDT15", variant: "*3", re: /\*3\b|c\.415C>T|R139C|rs116855232/i, why: "Main NUDT15 risk allele, ~7-11% in Indians (PMID 29470173)" },
  { gene: "UGT1A1", variant: "*28", re: /\*28|TA ?7|\(TA\) ?7|rs3064744|rs8175347/i, why: "TA-repeat allele, common in South Asians" },
  { gene: "UGT1A1", variant: "*6", re: /\*6\b|c\.211G>A|rs4148323/i, why: "East Asian allele; reported at low frequency in India" },
  { gene: "TPMT", variant: "*3C", re: /\*3C|\*3A|rs1142345/i, why: "Most common TPMT variant in South Asians" },
  { gene: "CYP2C19", variant: "*2", re: /\*2\b|rs4244285/i, why: "Common no-function allele in South Asians" },
  { gene: "CYP2C19", variant: "*17", re: /\*17|rs12248560/i, why: "Increased-function allele" },
];

export function quality(extract: LabExtract | null, profile: PgxProfile): Quality {
  if (!extract) return { identifierRemoved: false, unread: [], coverage: [], warnings: [] };
  // Only this gene's own text counts: "*3" in a CYP2C19 list must not mark NUDT15 *3 as tested.
  const clauses = extract.methodNotes.split(/;|\n|\.\s/);
  const geneText = (gene: string) => [
    ...extract.genes.filter((g) => g.gene.toUpperCase() === gene).flatMap((g) => [g.diplotype, g.verbatim]),
    ...profile.genes.filter((g) => g.gene === gene && g.called).map((g) => g.diplotype),
    ...clauses.filter((c) => c.toUpperCase().includes(gene)),
    ...(extract.testedVariants ?? []).filter((t) => t.gene.toUpperCase() === gene).map((t) => t.variant),
  ].join(" \n ");
  const reported = new Set(extract.genes.map((g) => g.gene.toUpperCase()));
  // A gene's panel counts as documented when the report lists variants for it: an explicit tested list,
  // or method text naming star alleles, rsIDs or HGVS changes for that gene.
  const documents = (gene: string) =>
    (extract.testedVariants ?? []).some((t) => t.gene.toUpperCase() === gene) ||
    clauses.filter((c) => c.toUpperCase().includes(gene)).some((c) => /\*\d|rs\d{3}|c\.\d/.test(c));
  const coverage = INDIA_PANEL.filter((v) => reported.has(v.gene)).map((v) => ({
    gene: v.gene, variant: v.variant, stated: v.re.test(geneText(v.gene)), documented: documents(v.gene), why: v.why,
  }));
  const unread = extract.genes.filter((g) => !g.diplotype && !g.phenotype && !g.activityScore).map((g) => g.gene);
  return { identifierRemoved: Boolean(extract.patientRef?.trim()), unread, coverage, warnings: extract.warnings };
}

/** Research records keep no patient identifier: the lab's own reference is dropped before anything is stored. */
export function deidentify(extract: LabExtract): LabExtract {
  return { ...extract, patientRef: "" };
}
