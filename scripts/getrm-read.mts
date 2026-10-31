// Real-data check of the reading path: does the same person get the same answer from a dictated report
// as from their sequence?
//   python3 scripts/getrm/fetch.py && python3 scripts/getrm/score.py   # once: VCF calls to compare against
//   npx tsx --env-file=.env scripts/getrm-read.mts [count|all] [meta|baseten]
//
// For each GeT-RM reference sample we read its real consensus genotypes aloud the way a lab would,
// put that text through Muse Spark and the app's own normalisation, and run PharmCAT on the result.
// Then we compare phenotype by phenotype with the PharmCAT run over the sample's 30x sequence.
// Disagreement means either the reader lost a call or the lab's panel never tested the variant.
import { promises as fs } from "node:fs";
import path from "node:path";
import { extractFromText, toOutsideCalls } from "../src/lib/pdf-extract";
import type { Provider } from "../src/lib/meta";
import { runPharmcat, loadProfile, parseReport } from "../src/lib/pharmcat";

const GENES = ["DPYD", "CYP2C19", "CYP2C9", "TPMT", "NUDT15", "UGT1A1", "SLCO1B1"];
const DATA = "data/getrm";
const truth = JSON.parse(await fs.readFile("fixtures/getrm/truth.json", "utf8")) as Record<string, Record<string, string | null>>;
const provider = (process.argv[3] as Provider | undefined) ?? undefined;
const count = process.argv[2] ?? "8";
const picked = count === "all"
  ? Object.keys(truth).sort()
  : (JSON.parse(await fs.readFile("fixtures/getrm/selected.json", "utf8")) as string[]).slice(0, Number(count));

type Row = { sample: string; gene: string; report: string; vcf: string; agree: boolean };
const rows: Row[] = [];

async function one(sample: string) {
  const t = truth[sample];
  const spoken = `Pharmacogenomic panel report. Reading out the genotype results. ${GENES.filter((g) => t[g]).map((g) => `${g}: ${t[g]}`).join(". ")}. End of results.`;
  const dir = path.join(DATA, provider === "baseten" ? "read-open" : "read", sample);
  await fs.mkdir(dir, { recursive: true });
  // The model's answer is cached, so re-scoring a normalisation change costs no model calls.
  const cached = await fs.readFile(path.join(dir, "extract.json"), "utf8").catch(() => null);
  const extract = cached ? JSON.parse(cached) : await extractFromText(spoken, provider);
  if (!cached) await fs.writeFile(path.join(dir, "extract.json"), JSON.stringify(extract, null, 1));
  await fs.writeFile(path.join(dir, "outside.tsv"), toOutsideCalls(structuredClone(extract)));
  const fromReport = await loadProfile(await runPharmcat(dir, { outsideCalls: "outside.tsv" }));
  const fromVcf = parseReport(JSON.parse(await fs.readFile(path.join(DATA, "run", `${sample}.report.json`), "utf8")));
  for (const gene of GENES) {
    const a = fromReport.genes.find((g) => g.gene === gene);
    const b = fromVcf.genes.find((g) => g.gene === gene);
    if (!a?.called || !b?.called) continue;
    rows.push({ sample, gene, report: `${a.diplotype} = ${a.phenotype}`, vcf: `${b.diplotype} = ${b.phenotype}`, agree: a.phenotype === b.phenotype });
  }
  console.log(`${sample} read by ${extract.readBy}`);
}

// Four at a time: a model call and a PharmCAT container per sample, and 208 of them sequentially is an hour.
for (let i = 0; i < picked.length; i += 4) {
  const batch = picked.slice(i, i + 4);
  const settled = await Promise.allSettled(batch.map(one));
  settled.forEach((r, j) => r.status === "rejected" && console.log(`FAILED ${batch[j]}: ${r.reason}`));
}

const disagree = rows.filter((r) => !r.agree);
await fs.writeFile(`docs/getrm-read-results${provider === "baseten" ? "-open" : ""}.json`, JSON.stringify({ samples: picked.length, compared: rows.length, agree: rows.length - disagree.length, rows }, null, 1));
console.log(`\nphenotype agreement, dictated report vs 30x sequence: ${rows.length - disagree.length}/${rows.length}`);
for (const r of disagree) console.log(`  ${r.sample} ${r.gene} | report: ${r.report} | sequence: ${r.vcf}`);
