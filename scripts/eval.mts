// End-to-end eval against a running dev server: pnpm tsx scripts/eval.mts [baseUrl]
import assert from "node:assert/strict";
const base = process.argv[2] ?? "http://localhost:3077";
type Med = { drug: string; risk: string };
async function run(sample: string, meds: string) {
  const fd = new FormData(); fd.set("sample", sample); fd.set("meds", meds); fd.set("label", `eval-${sample}`);
  const r = await fetch(`${base}/api/analyze`, { method: "POST", body: fd }); const j = await r.json();
  assert.ok(r.ok, `analyze ${sample}: ${JSON.stringify(j)}`);
  const rep = await (await fetch(`${base}/api/report/${j.id}`)).json();
  return { id: j.id as string, genes: rep.profile.genes as { gene: string; phenotype: string; called: boolean }[], meds: (rep.ai?.medications ?? []) as Med[], lens: rep.lens ?? [] };
}
const risk = (m: Med[], d: string) => m.find((x) => x.drug.toLowerCase() === d)?.risk;
const pheno = (g: { gene: string; phenotype: string }[], s: string) => g.find((x) => x.gene === s)?.phenotype;
const cases = [
  { s: "A", meds: "Xeloda\nirinotecan\nclopidogrel\nmetformin", check: (r: Awaited<ReturnType<typeof run>>) => {
      assert.equal(pheno(r.genes, "DPYD"), "Intermediate Metabolizer");
      assert.equal(pheno(r.genes, "UGT1A1"), "Poor Metabolizer");
      assert.ok(["adjust", "avoid"].includes(risk(r.meds, "capecitabine")!), "capecitabine must be adjust/avoid");
      assert.equal(risk(r.meds, "clopidogrel"), "avoid");
      assert.ok(["unknown", "standard"].includes(risk(r.meds, "metformin") ?? "unknown"));
  } },
  { s: "B", meds: "5-FU\nmercaptopurine", check: (r: Awaited<ReturnType<typeof run>>) => {
      assert.equal(pheno(r.genes, "DPYD"), "Poor Metabolizer");
      assert.equal(risk(r.meds, "fluorouracil"), "avoid");
      assert.ok(["adjust", "avoid"].includes(risk(r.meds, "mercaptopurine")!));
  } },
  { s: "lab", meds: "capecitabine\nazathioprine\ntamoxifen", check: (r: Awaited<ReturnType<typeof run>>) => {
      assert.ok(r.genes.find((g) => g.gene === "DPYD")?.called, "DPYD must be called from lab report");
      assert.equal(pheno(r.genes, "DPYD"), "Intermediate Metabolizer");
      assert.ok(["adjust", "caution"].includes(risk(r.meds, "capecitabine")!));
      assert.equal(risk(r.meds, "azathioprine"), "adjust");
      assert.ok(r.lens.some((n: { gene: string }) => n.gene === "DPYD"), "India lens must flag c.85T>C");
  } },
];
let fail = 0;
for (const c of cases) {
  const t = Date.now();
  try { const r = await run(c.s, c.meds); c.check(r); console.log(`PASS ${c.s} ${r.id} ${Date.now() - t}ms`, r.meds.map((m) => `${m.drug}:${m.risk}`).join(" ")); }
  catch (e) { fail++; console.log(`FAIL ${c.s}: ${String(e).split("\n")[0]}`); }
}
process.exit(fail ? 1 : 0);
