// Checks the live public cohort against the benchmark ground truth: every gene call, and that no identifier or drug text is stored.
//   npx tsx scripts/verify-cohort.mts https://pathya.anukritiai.com
import { promises as fs } from "node:fs";
import { normaliseDiplotype } from "../src/lib/pdf-extract";
const H = process.argv[2] ?? "http://localhost:3077";
const truth: Record<string, { id: string; genes: Record<string, string> }[]> = {
  D: JSON.parse(await fs.readFile("fixtures/bench/truth.json", "utf8")),
  H: JSON.parse(await fs.readFile("fixtures/bench-heldout/truth.json", "utf8")),
};
const ids = (await (await fetch(`${H}/api/cohort/demo?f=csv`)).text()).trim().split("\n").slice(1).map((l) => l.split(",")[0]);
const norm = (g: string, d: string) => normaliseDiplotype(g, d).split("/").map((a) => a.trim().replace(/^\*1$/, g === "DPYD" ? "Reference" : "*1")).sort().join("|");
let right = 0, total = 0; const misses: string[] = [];
for (const id of ids) {
  const r = await (await fetch(`${H}/api/report/${id}`)).json();
  const [, set, rep] = r.case.label.match(/IndiPGx-Read ([DH])-(r\d\d)/) ?? [];
  const t = truth[set].find((x) => x.id.startsWith(rep) && x.id.endsWith("-photo"))!;
  for (const [g, d] of Object.entries(t.genes)) {
    total++;
    const got = r.profile.genes.find((x: { gene: string; called: boolean }) => x.gene === g && x.called)?.diplotype ?? "";
    if (got && norm(g, got) === norm(g, d)) right++; else misses.push(`${r.case.label} ${g}: truth ${d} got ${got || "(none)"}`);
  }
  if (r.extract?.patientRef) misses.push(`${r.case.label}: identifier stored!`);
  if (r.profile.drugs.length) misses.push(`${r.case.label}: drug text stored!`);
}
console.log(`${ids.length} live records: ${right}/${total} gene calls match ground truth`);
misses.forEach((m) => console.log("  MISS", m));
