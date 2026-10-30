// Check the live simulated cohort against the simulation it was drawn from.
//   ACCESS_CODE=... npx tsx scripts/verify-pop.mts https://pathya.anukritiai.com [cohort]
//
// Two questions, both answerable because the truth is known:
//   1. Reading. Did the pipeline recover the genotype each report actually prints?
//   2. Pooling. Does the coverage-aware estimate cover the frequency the people were drawn from,
//      and does counting untested panels as non-carriers pull the estimate below it?
import { promises as fs } from "node:fs";
import assert from "node:assert/strict";
import { wilson, SIM_ALLELE_FREQ } from "../src/lib/cohort";
import { INDIA_PANEL } from "../src/lib/quality";

const base = process.argv[2] ?? "http://localhost:3077";
const cohort = process.argv[3] ?? "india-sim";
const headers: Record<string, string> = {};
if (process.env.ACCESS_CODE) {
  const r = await fetch(`${base}/api/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: process.env.ACCESS_CODE }) });
  assert.ok(r.ok, `login ${r.status}`);
  headers.cookie = r.headers.get("set-cookie")?.split(";")[0] ?? "";
}

type Case = { id: string; panel: string; tested: Record<string, string[]>; true_genes: Record<string, string>; genes: Record<string, string> };
const truth = JSON.parse(await fs.readFile("fixtures/pop/truth.json", "utf8")) as { allele_freq: Record<string, Record<string, number>>; freq_source: Record<string, string>; cases: Case[] };
const byLabel = new Map(truth.cases.map((c) => [`IndiPGx-Pop ${c.id.split("-")[0]}`, c]));

const list = await (await fetch(`${base}/api/cohort/${cohort}`, { headers })).json();
assert.ok(list.stats, `cohort fetch: ${JSON.stringify(list).slice(0, 200)}`);

// --- 1. reading accuracy, per gene call, against what the report prints -------------------------
const csv = await (await fetch(`${base}/api/cohort/${cohort}?f=csv`, { headers })).text();
const rows = csv.trim().split("\n").map((l) => l.match(/("([^"]|"")*"|[^,]*)/g)!.filter((_, i) => i % 2 === 0).map((c) => c.replace(/^"|"$/g, "").replace(/""/g, '"')));
const head = rows[0];
const labelCol = head.indexOf("record_id");
type Rec = { label: string; genes: { gene: string; diplotype: string; called: boolean }[] };
const queue = rows.slice(1).map((r) => r[labelCol]);
const records: Rec[] = [];
await Promise.all(Array.from({ length: 6 }, async () => {        // a few at a time: 180 at once trips the proxy
  for (let id = queue.shift(); id; id = queue.shift()) {
    const rec = await (await fetch(`${base}/api/report/${id}`, { headers })).json();
    records.push({ label: rec.case?.label as string, genes: rec.profile.genes });
  }
}));

const norm = (s: string) => s.split("/").map((a) => a.trim()).sort().join("/");
let calls = 0, wrong = 0, missing = 0, matched = 0;
for (const rec of records) {
  const t = byLabel.get(rec.label);
  if (!t) continue;
  matched++;
  for (const [gene, expect] of Object.entries(t.genes)) {
    calls++;
    const got = rec.genes.find((g) => g.gene === gene && g.called)?.diplotype;
    if (!got) { missing++; console.log(`MISSING ${rec.label} ${gene} expected ${expect}`); continue; }
    if (norm(got) !== norm(expect)) { wrong++; console.log(`WRONG   ${rec.label} ${gene}: ${got} != ${expect}`); }
  }
}
console.log(`\nreading: ${matched}/${truth.cases.length} records matched, ${calls - wrong - missing}/${calls} gene calls equal to what the report prints`);

// --- 2. pooling: the complete-panel answer is known, so both estimators can be scored ----------
//
// Gold standard: among the simulated people whose report covered a gene at all, how many truly carry
// the variant. That is the number a panel testing everything would have returned. The question is which
// way of pooling partially-covering panels gets closer to it.
const carrierFreq = (p: number) => 1 - (1 - p) ** 2;
type Stat = { gene: string; variant: string; carriers: number; n: number; notStated: number; freq: number; lo: number; hi: number; naive: number };
const out: Record<string, unknown>[] = [];
let covered = 0, comparable = 0, naiveBelow = 0, gaps = 0, errCov = 0, errNaive = 0, closer = 0, excluded = 0, undoc = 0;
for (const s of list.stats as Stat[]) {
  const key = `${s.gene} ${s.variant}`;
  const v = INDIA_PANEL.find((x) => x.gene === s.gene && x.variant === s.variant);
  if (!v || !s.n) continue;
  // the complete-panel truth, straight from the generator
  const people = truth.cases.filter((c) => c.true_genes[s.gene] !== undefined);
  const trueCarriers = people.filter((c) => c.true_genes[s.gene].split("/").some((a) => v.re.test(a))).length;
  const trueFreq = people.length ? trueCarriers / people.length : 0;
  const inCi = trueFreq >= s.lo && trueFreq <= s.hi;
  comparable++;
  if (inCi) covered++;
  const eCov = Math.abs(s.freq - trueFreq), eNaive = Math.abs(s.naive - trueFreq);
  errCov += eCov; errNaive += eNaive;
  if (eCov <= eNaive) closer++;
  const [nlo, nhi] = wilson(s.carriers, s.n + s.notStated);
  if (s.notStated) { gaps++; if (s.naive < s.freq) naiveBelow++; }
  excluded += s.notStated; undoc += (s as Stat & { undocumented: number }).undocumented ?? 0;
  out.push({ variant: key, completePanelTruth: trueFreq, truthDenominator: people.length, coverageAware: s.freq, ci: [s.lo, s.hi], covers: inCi, naive: s.naive, naiveCi: [nlo, nhi], n: s.n, notStated: s.notStated, drawnFrom: SIM_ALLELE_FREQ[key] === undefined ? null : carrierFreq(SIM_ALLELE_FREQ[key]), source: truth.freq_source[key] });
  console.log(`${key.padEnd(24)} truth ${(trueFreq * 100).toFixed(1).padStart(5)}%  cov-aware ${(s.freq * 100).toFixed(1).padStart(5)}% [${(s.lo * 100).toFixed(1)}-${(s.hi * 100).toFixed(1)}] ${inCi ? "covers" : "MISSES"}  naive ${(s.naive * 100).toFixed(1).padStart(5)}%  n=${s.n} notStated=${s.notStated}`);
}
const maeCov = errCov / comparable, maeNaive = errNaive / comparable;
console.log(`\npooling, against the complete-panel truth over ${comparable} variants:`);
console.log(`  coverage-aware  mean absolute error ${(maeCov * 100).toFixed(1)} points, 95% interval covers the truth for ${covered}/${comparable}`);
console.log(`  naive           mean absolute error ${(maeNaive * 100).toFixed(1)} points`);
console.log(`  coverage-aware is at least as close for ${closer}/${comparable} variants; naive sits below the coverage-aware estimate for ${naiveBelow}/${gaps} variants with a coverage gap`);
console.log(`  of ${excluded} record-variant exclusions, ${undoc} (${((undoc / excluded) * 100).toFixed(0)}%) are reports that never state which variants they tested`);
const worst = out.reduce((a, b) => (Math.abs((b.naive as number) - (b.completePanelTruth as number)) > Math.abs((a.naive as number) - (a.completePanelTruth as number)) ? b : a));
console.log(`  the variant naive pooling gets most wrong: ${worst.variant}, truth ${((worst.completePanelTruth as number) * 100).toFixed(1)}%, naive ${((worst.naive as number) * 100).toFixed(1)}%, coverage-aware ${((worst.coverageAware as number) * 100).toFixed(1)}%`);

await fs.writeFile("docs/pooling-results.json", JSON.stringify({
  cohort, records: list.records, generatedAt: new Date().toISOString(),
  reading: { records: matched, calls, correct: calls - wrong - missing, wrong, missing },
  pooling: { covered, comparable, naiveBelow, gaps, maeCoverageAware: maeCov, maeNaive, closer, exclusions: excluded, undocumented: undoc },
  variants: out,
}, null, 1) + "\n");
console.log("\nwrote docs/pooling-results.json");
process.exit(wrong + missing === 0 && maeCov <= maeNaive ? 0 : 1);
