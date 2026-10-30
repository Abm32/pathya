// Fast offline checks for the deterministic parts. No network, no Docker: npx tsx scripts/selftest.mts
import assert from "node:assert/strict";
import { pretest } from "../src/lib/pretest";
import { dpydFromText, normaliseDiplotype } from "../src/lib/pdf-extract";

// Pre-test: CAPOX + supportive care as an Indian oncologist writes it
const r = pretest("Xeloda 500 mg\noxaliplatin\nEmeset 8\nDexona 8 mg\nPan 40\nFasturtec");
const genes = r.tests.map((t) => t.gene);
assert.deepEqual(genes.slice(0, 2).sort(), ["DPYD", "G6PD"], "urgent tests first");
assert.ok(genes.includes("CYP2D6") && genes.includes("CYP2C19"));
assert.deepEqual(r.noGuideline, ["oxaliplatin", "Dexona 8 mg"]);
assert.equal(pretest("5-FU bolus").tests[0].gene, "DPYD");
assert.equal(pretest("6-MP").tests[0].gene, "TPMT + NUDT15");
assert.equal(pretest("Glycomet 500").tests.length, 0, "metformin has no guideline");
assert.equal(pretest("paneer").tests.length, 0, "short alias 'pan' must be a whole word");
// Regimens as oncologists write them: acronyms must expand to every component drug
for (const reg of ["FOLFOX", "mFOLFOX6", "CAPOX", "XELOX", "Capeox", "FLOT", "S-1", "SOX", "DCF", "de Gramont"]) assert.ok(pretest(reg).tests.some((t) => t.gene === "DPYD"), `${reg} must flag DPYD`);
for (const reg of ["FOLFIRI", "mFOLFIRINOX", "XELIRI"]) assert.deepEqual(pretest(reg).tests.map((t) => t.gene).sort(), ["DPYD", "UGT1A1"], `${reg} needs DPYD and UGT1A1`);
assert.equal(pretest("6 MP 50 mg").tests[0].gene, "TPMT + NUDT15");
assert.equal(pretest("CPT 11").tests[0].gene, "UGT1A1");
assert.equal(pretest("Gemcitabine").tests.length, 0);

// DPYD names the model may write, and checklist wording (both bugs found by the benchmark)
assert.equal(normaliseDiplotype("DPYD", "c.1236G>A (HapB3)/c.85T>C (*9A)"), "c.1129-5923C>G, c.1236G>A (HapB3)/c.85T>C (*9A)");
assert.equal(normaliseDiplotype("DPYD", "*1/*2A"), "Reference/c.1905+1G>A (*2A)");
assert.equal(dpydFromText("c.1236G>A (HapB3) Detected (homozygous)"), "c.1129-5923C>G, c.1236G>A (HapB3)/c.1129-5923C>G, c.1236G>A (HapB3)");
assert.equal(dpydFromText("No tested variant detected"), "Reference/Reference");

console.log("selftest ok");
