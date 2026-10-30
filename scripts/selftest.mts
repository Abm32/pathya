// Fast offline checks for the deterministic parts. No network, no Docker: npx tsx scripts/selftest.mts
import assert from "node:assert/strict";
import { dpydFromText, normaliseDiplotype, type LabExtract } from "../src/lib/pdf-extract";
import { deidentify, quality } from "../src/lib/quality";
import { cohortCsv, cohortStats, wilson, type CohortRecord } from "../src/lib/cohort";
import type { PgxProfile } from "../src/lib/pharmcat";

// DPYD names the model may write, and checklist wording (bugs found by the benchmark)
assert.equal(normaliseDiplotype("DPYD", "c.1236G>A (HapB3)/c.85T>C (*9A)"), "c.1129-5923C>G, c.1236G>A (HapB3)/c.85T>C (*9A)");
assert.equal(normaliseDiplotype("DPYD", "*1/*2A"), "Reference/c.1905+1G>A (*2A)");
assert.equal(dpydFromText("c.1236G>A (HapB3) Detected (homozygous)"), "c.1129-5923C>G, c.1236G>A (HapB3)/c.1129-5923C>G, c.1236G>A (HapB3)");
assert.equal(dpydFromText("No tested variant detected"), "Reference/Reference");

// Wilson interval: bounded, sensible at 0 and n
assert.deepEqual(wilson(0, 0), [0, 0]);
const [lo0, hi0] = wilson(0, 30); assert.equal(lo0, 0); assert.ok(hi0 > 0.1 && hi0 < 0.12, `0/30 upper ${hi0}`);
const [lo, hi] = wilson(5, 50); assert.ok(lo < 0.1 && hi > 0.1 && lo > 0.04 && hi < 0.22);

// Quality: coverage is per gene, identifiers are flagged and stripped
const ex: LabExtract = {
  labName: "Test lab", reportDate: "", patientRef: "MRN 12345",
  genes: [
    { gene: "DPYD", diplotype: "c.1236G>A/Reference", phenotype: "", activityScore: "", verbatim: "c.1236G>A (HapB3) heterozygous" },
    { gene: "NUDT15", diplotype: "*1/*1", phenotype: "", activityScore: "", verbatim: "not detected" },
    { gene: "CYP2C19", diplotype: "*1/*1", phenotype: "", activityScore: "", verbatim: "*2, *3, *17 not detected" },
  ],
  methodNotes: "DPYD panel: HapB3, *2A, *13; CYP2C19 *2, *3, *17", warnings: [],
  testedVariants: [{ gene: "UGT1A1", variant: "*6" }, { gene: "CYP2C19", variant: "*3" }],
};
const prof = (genes: [string, string][]): PgxProfile => ({ pharmcatVersion: "3.4.0", dataVersion: "x", genes: genes.map(([gene, diplotype]) => ({ gene, diplotype, phenotype: "", called: true, source: "OUTSIDE", relatedDrugs: [], alleles: [] })), drugs: [] }) as unknown as PgxProfile;
const q = quality(ex, prof([["DPYD", "c.1129-5923C>G, c.1236G>A (HapB3)/Reference"], ["NUDT15", "*1/*1"], ["CYP2C19", "*1/*1"]]));
const cov = (g: string, v: string) => q.coverage.find((c) => c.gene === g && c.variant === v)?.stated;
assert.equal(cov("DPYD", "HapB3"), true);
assert.equal(cov("DPYD", "c.85T>C (*9A)"), false, "panel did not name c.85T>C");
assert.equal(cov("NUDT15", "*3"), false, "CYP2C19's *3 must not count for NUDT15");
assert.equal(cov("UGT1A1", "*6"), undefined, "UGT1A1 is not on this report, so no coverage row");
assert.equal(q.identifierRemoved, true);
// a variant named only in the "variants tested" column counts as covered
assert.equal(quality({ ...ex, testedVariants: [{ gene: "DPYD", variant: "rs67376798 (c.2846A>T)" }] }, prof([["DPYD", "Reference/Reference"]])).coverage.find((c) => c.variant === "c.2846A>T")?.stated, true);
assert.equal(deidentify(ex).patientRef, "");

// Cohort: a panel that never named a variant is left out of its denominator, not counted as a non-carrier
const rec = (id: string, dpyd: string, stated85: boolean): CohortRecord => ({
  meta: { id, label: "", cohort: "t", source: "report", createdAt: id },
  profile: prof([["DPYD", dpyd]]),
  quality: { identifierRemoved: false, unread: [], warnings: [], coverage: [{ gene: "DPYD", variant: "c.85T>C (*9A)", stated: stated85, documented: true, why: "" }, { gene: "DPYD", variant: "HapB3", stated: true, documented: true, why: "" }] },
  review: null,
});
const stats = cohortStats([
  rec("a", "c.85T>C (*9A)/Reference", true),
  rec("b", "c.85T>C (*9A)/c.85T>C (*9A)", true),
  rec("c", "Reference/Reference", true),
  rec("d", "Reference/Reference", false),
  rec("e", "c.1129-5923C>G, c.1236G>A (HapB3)/Reference", false),
]);
const s85 = stats.find((s) => s.variant === "c.85T>C (*9A)")!;
assert.deepEqual([s85.carriers, s85.homozygous, s85.n, s85.notStated], [2, 1, 3, 2]);
// the same records, pooled as if "not tested" meant "not a carrier", understate the frequency
assert.equal(s85.freq, 2 / 3);
assert.equal(s85.naive, 2 / 5);
assert.deepEqual([s85.notTested, s85.undocumented], [2, 0]);
const hap = stats.find((s) => s.variant === "HapB3")!;
assert.deepEqual([hap.carriers, hap.n, hap.notStated], [1, 5, 0]);
// HapB3's PharmCAT name contains a comma, so the CSV must quote it
assert.match(cohortCsv([rec("e", "c.1129-5923C>G, c.1236G>A (HapB3)/Reference", true)]), /^e,report,e,"c\.1129-5923C>G, c\.1236G>A \(HapB3\)\/Reference",/m);

console.log("selftest ok");
