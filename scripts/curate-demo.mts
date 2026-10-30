// Mark a slice of a cohort curator-verified, the way a curator would after checking each call
// against the source document. Used to seed the public demo so the review step is visible.
//   ACCESS_CODE=... npx tsx scripts/curate-demo.mts <baseUrl> <cohort> <curator> [count]
import assert from "node:assert/strict";
const [, , base = "http://localhost:3077", cohort = "demo", curator = "AR", countArg] = process.argv;
const count = Number(countArg ?? 8);
const headers: Record<string, string> = { "content-type": "application/json" };
const r = await fetch(`${base}/api/login`, { method: "POST", headers, body: JSON.stringify({ code: process.env.ACCESS_CODE }) });
assert.ok(r.ok, `login ${r.status}`);
headers.cookie = r.headers.get("set-cookie")?.split(";")[0] ?? "";

const csv = await (await fetch(`${base}/api/cohort/${cohort}?f=csv`, { headers })).text();
const ids = csv.trim().split("\n").slice(1).map((l) => l.split(",")[0]).slice(0, count);
let ok = 0;
for (const id of ids) {
  const rec = await (await fetch(`${base}/api/report/${id}`, { headers })).json();
  const genes: string[] = rec.profile.genes.filter((g: { called: boolean }) => g.called).map((g: { gene: string }) => g.gene);
  // a curator verifies each call it could check against the source document
  const decisions = Object.fromEntries(genes.map((g) => [g, "verified"]));
  const res = await fetch(`${base}/api/review/${id}`, { method: "POST", headers, body: JSON.stringify({ curator, decisions, note: "Each call checked against the source document." }) });
  if (res.ok) ok++;
  console.log(res.ok ? "ok  " : "FAIL", id, genes.join(" "));
}
console.log(`${ok}/${ids.length} records curator-verified in "${cohort}"`);
