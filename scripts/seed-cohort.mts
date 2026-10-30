// Seed the public "demo" cohort with synthetic benchmark reports, through the real pipeline.
//   ACCESS_CODE=... npx tsx scripts/seed-cohort.mts https://pathya.anukritiai.com
// One phone photo per synthetic person (24 people across the two benchmark sets), so nobody is counted twice.
import { promises as fs } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3077";
const cohort = process.argv[3] ?? "demo";
const headers: Record<string, string> = {};
if (process.env.ACCESS_CODE) {
  const r = await fetch(`${base}/api/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: process.env.ACCESS_CODE }) });
  if (!r.ok) throw new Error(`login ${r.status}`);
  headers.cookie = r.headers.get("set-cookie")?.split(";")[0] ?? "";
}
const files = (await Promise.all(["fixtures/bench", "fixtures/bench-heldout"].map(async (d) => (await fs.readdir(d)).filter((f) => f.endsWith("-photo.jpg")).map((f) => `${d}/${f}`)))).flat();
const q = [...files];
let ok = 0;
await Promise.all(Array.from({ length: 3 }, async () => {
  for (let f = q.shift(); f; f = q.shift()) {
    const fd = new FormData();
    fd.set("report", new File([await fs.readFile(f)], f.split("/").pop()!, { type: "image/jpeg" }));
    fd.set("cohort", cohort);
    fd.set("label", `IndiPGx-Read ${f.includes("heldout") ? "H" : "D"}-${f.split("/").pop()!.slice(0, 3)}`);
    const r = await fetch(`${base}/api/analyze`, { method: "POST", body: fd, headers });
    const j = await r.json().catch(() => ({}));
    if (r.ok) ok++;
    console.log(r.ok ? "ok  " : "FAIL", f, j.id ?? j.detail ?? j.error);
  }
}));
console.log(`${ok}/${files.length} records added to cohort "${cohort}"`);
