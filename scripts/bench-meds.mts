// Medication-mapping benchmark: do prescriptions as Indian oncologists write them reach the right guideline drug?
//   npx tsx --env-file=.env scripts/bench-meds.mts [runs=3]
// Runs the production report call (generateReport) on a real PharmCAT profile with 26 inputs: Indian and
// global brand names, abbreviations, typos, Malayalam-English dictation, and drugs with no PGx guideline.
// Baseline: exact generic-name lookup. Each run is scored on Muse Spark 1.3 and on Muse Spark Open.
import { promises as fs } from "node:fs";
import { generateReport } from "../src/lib/report-ai";
import type { PgxProfile } from "../src/lib/pharmcat";

// input as written -> expected guideline drug ("" = no PGx guideline, should land in unmappedMedications)
const CASES: [string, string][] = [
  ["Xeloda 500 mg", "capecitabine"], ["capecitabin", "capecitabine"], ["Xeloda tablet randu neram", "capecitabine"],
  ["5FU", "fluorouracil"], ["5-fluorouracil bolus", "fluorouracil"],
  ["Campto", "irinotecan"], ["CPT-11", "irinotecan"], ["irinotecan drip", "irinotecan"],
  ["Imuran", "azathioprine"], ["6MP", "mercaptopurine"], ["Purinethol", "mercaptopurine"],
  ["Nolvadex", "tamoxifen"], ["Emeset 8", "ondansetron"], ["Zofran", "ondansetron"],
  ["Clopilet 75", "clopidogrel"], ["Plavix", "clopidogrel"], ["Pan 40", "pantoprazole"], ["Nexpro 40", "esomeprazole"],
  ["Ultracet", "tramadol"], ["Contramal", "tramadol"],
  ["Dolo 650", ""], ["Dexona 8 mg", ""], ["oxaliplatin", ""], ["leucovorin", ""], ["Glycomet 500", ""], ["Emend", ""],
];

const runs = Number(process.argv[2] ?? 3);
const profile: PgxProfile = JSON.parse(await fs.readFile("data/cases/095c00a78211/profile.json", "utf8"));
const guidelineDrugs = [...new Set(profile.drugs.filter((d) => d.recommendation).map((d) => d.drug))];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Baseline: the input contains a guideline drug's generic name. */
const baseline = (input: string) => guidelineDrugs.find((d) => norm(input).includes(norm(d))) ?? "";

type Out = { input: string; expected: string; got: string; ok: boolean };
async function scoreRun(provider: "meta" | "baseten"): Promise<Out[]> {
  const ai = await generateReport(profile, CASES.map(([i]) => i), [], provider);
  return CASES.map(([input, expected]) => {
    const hit = ai.medications.find((m) => m.matchedInput && norm(m.matchedInput) === norm(input))
      ?? ai.medications.find((m) => m.matchedInput && (norm(input).includes(norm(m.matchedInput)) || norm(m.matchedInput).includes(norm(input))));
    const got = hit ? hit.drug.toLowerCase() : "";
    const unmapped = ai.unmappedMedications.some((u) => norm(u).includes(norm(input)) || norm(input).includes(norm(u)));
    const ok = expected ? got.includes(expected) : !hit && unmapped;
    return { input, expected, got: got || (unmapped ? "(unmapped)" : "(missing)"), ok };
  });
}

const base = CASES.map(([input, expected]) => ({ input, expected, got: baseline(input), ok: baseline(input) === expected }));
const result: Record<string, unknown> = { generatedAt: new Date().toISOString(), inputs: CASES.length, runs, baseline: { correct: base.filter((b) => b.ok).length, misses: base.filter((b) => !b.ok) } };
for (const provider of ["meta", "baseten"] as const) {
  const all: Out[][] = [];
  for (let r = 0; r < runs; r++) {
    try { all.push(await scoreRun(provider)); } catch (e) { console.log(provider, "run failed", String(e).slice(0, 160)); }
  }
  const correct = all.map((o) => o.filter((x) => x.ok).length);
  const misses = all.flat().filter((x) => !x.ok);
  result[provider] = { correctPerRun: correct, misses };
  console.log(provider, "correct per run:", correct.join(", "), `of ${CASES.length}`);
  for (const m of misses) console.log("  miss", m.input, "->", m.got, `(want ${m.expected || "unmapped"})`);
}
console.log("baseline:", base.filter((b) => b.ok).length, `of ${CASES.length}`);
const outFile = "docs/bench-results.json";
const prev = JSON.parse(await fs.readFile(outFile, "utf8").catch(() => "{}"));
await fs.writeFile(outFile, JSON.stringify({ ...prev, meds: result }, null, 1));
