// pnpm tsx scripts/smoke-pharmcat.mts fixtures/oncology-patient-A.vcf
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { runPharmcat, loadProfile } from "../src/lib/pharmcat";

const vcf = process.argv[2] ?? "fixtures/oncology-patient-A.vcf";
const dir = await fs.mkdtemp(path.join(os.tmpdir(), "pgx-"));
const name = path.basename(vcf);
await fs.copyFile(vcf, path.join(dir, name));
const report = await runPharmcat(dir, { vcf: name });
const p = await loadProfile(report);
const g = (s: string) => p.genes.find((x) => x.gene === s)!;
console.table(p.genes.filter((x) => x.called).map(({ gene, diplotype, phenotype, activityScore }) => ({ gene, diplotype, phenotype, activityScore })));
const risky = p.drugs.filter((d) => d.source === "CPIC" && !d.noChange && d.recommendation);
console.log("CPIC actionable:", risky.map((d) => `${d.drug} [${d.classification}] ${d.recommendation?.slice(0, 80)}`));
if (name.includes("patient-A")) {
  assert.equal(g("DPYD").phenotype, "Intermediate Metabolizer");
  assert.equal(g("CYP2C19").phenotype, "Poor Metabolizer");
  assert.ok(risky.some((d) => d.drug === "capecitabine"), "capecitabine must be actionable");
  console.log("PASS patient-A");
}
