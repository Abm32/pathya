// End-to-end eval against a running server: npx tsx scripts/eval.mts [baseUrl]  (set ACCESS_CODE for a deployed instance)
// Each case builds a record and checks the standardised calls, the quality checks, and that nothing clinical is stored.
import assert from "node:assert/strict";
const base = process.argv[2] ?? "http://localhost:3077";
const headers: Record<string, string> = {};
if (process.env.ACCESS_CODE) { // deployed instance behind the access gate
  const r = await fetch(`${base}/api/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: process.env.ACCESS_CODE }) });
  assert.ok(r.ok, `login ${r.status}`); headers.cookie = r.headers.get("set-cookie")?.split(";")[0] ?? "";
}
type Rec = { genes: { gene: string; phenotype: string; diplotype: string; called: boolean }[]; drugs: unknown[]; extract: { patientRef: string; readBy?: string } | null; quality: { coverage: { gene: string; variant: string; stated: boolean }[] } | null };
async function run(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ cohort: "eval", ...fields })) fd.set(k, v);
  const r = await fetch(`${base}/api/analyze`, { method: "POST", body: fd, headers }); const j = await r.json();
  assert.ok(r.ok, `analyze: ${JSON.stringify(j)}`);
  const rec = await (await fetch(`${base}/api/report/${j.id}`, { headers })).json();
  return { id: j.id as string, genes: rec.profile.genes, drugs: rec.profile.drugs, extract: rec.extract, quality: rec.quality } as Rec & { id: string };
}
const pheno = (r: Rec, g: string) => r.genes.find((x) => x.gene === g && x.called)?.phenotype;
const dip = (r: Rec, g: string) => r.genes.find((x) => x.gene === g && x.called)?.diplotype ?? "";
const research = (r: Rec) => assert.equal(r.drugs.length, 0, "no guideline or drug text may be stored in a research record");

function labCheck(r: Rec) {
  research(r);
  assert.equal(pheno(r, "DPYD"), "Intermediate Metabolizer");
  assert.match(dip(r, "DPYD"), /HapB3/); assert.match(dip(r, "DPYD"), /c\.85T>C/);
  assert.equal(pheno(r, "NUDT15"), "Intermediate Metabolizer");
  assert.equal(r.extract?.patientRef ?? "", "", "identifier must not be stored");
  assert.ok(r.quality?.coverage.some((c) => c.gene === "DPYD" && c.variant === "HapB3" && c.stated), "panel names HapB3");
}
const cases: { name: string; fields: Record<string, string>; check: (r: Rec) => void }[] = [
  { name: "A (VCF)", fields: { sample: "A" }, check: (r) => { research(r); assert.equal(pheno(r, "DPYD"), "Intermediate Metabolizer"); assert.equal(pheno(r, "UGT1A1"), "Poor Metabolizer"); } },
  { name: "B (VCF)", fields: { sample: "B" }, check: (r) => { research(r); assert.equal(pheno(r, "DPYD"), "Poor Metabolizer"); } },
  { name: "lab PDF", fields: { sample: "lab" }, check: labCheck },
  { name: "phone photo", fields: { sample: "photo" }, check: labCheck },
  // The open-weights path has to survive the same checks, or the self-host story is only a claim.
  { name: "phone photo, open weights", fields: { sample: "photo", provider: "baseten" }, check: (r) => {
      labCheck(r);
      assert.match(String(r.extract?.readBy ?? ""), /muse-spark-open/, "record should say it was read by the open-weights model");
  } },
  { name: "dictated", fields: { transcript: "DPYD: c.1236G>A heterozygous, that is HapB3, other variants not detected. NUDT15: star one slash star three. UGT1A1: TA6 slash TA7." }, check: (r) => {
      research(r);
      assert.equal(pheno(r, "DPYD"), "Intermediate Metabolizer");
      assert.equal(dip(r, "NUDT15"), "*1/*3");
      assert.equal(dip(r, "UGT1A1"), "*1/*28");
  } },
];
let fail = 0;
for (const c of cases) {
  const t = Date.now();
  try { const r = await run(c.fields); c.check(r); console.log(`PASS ${c.name} ${r.id} ${Date.now() - t}ms`, r.genes.filter((g) => g.called).map((g) => `${g.gene}:${g.diplotype}`).join(" ")); }
  catch (e) { fail++; console.log(`FAIL ${c.name}: ${String(e).split("\n")[0]}`); }
}
process.exit(fail ? 1 : 0);
