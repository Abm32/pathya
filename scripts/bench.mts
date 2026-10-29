// Extraction benchmark: how accurately does each reader turn a lab report into PharmCAT gene calls?
//   python3 scripts/bench/gen.py                      # once: 36 synthetic reports with ground truth
//   npx tsx --env-file=.env scripts/bench.mts [muse,open,rules]
// Readers: Muse Spark 1.3 (production path), Muse Spark Open on Baseten (same prompt + schema),
// and a rules baseline (pdftotext / tesseract OCR + regex). Score = exact diplotype per gene, after the
// same normalisation the app applies before PharmCAT. Writes docs/bench-results.json.
import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import { EXTRACT_SCHEMA, EXTRACT_SYSTEM, dpydFromText, extractLabReport, normaliseDiplotype, toOutsideCalls, type LabExtract } from "../src/lib/pdf-extract";
import { structured } from "../src/lib/meta";

const run = promisify(execFile);
const DIR = process.env.BENCH_DIR ?? "fixtures/bench";
type Case = { id: string; file: string; layout: string; render: string; genes: Record<string, string>; text: string };
type Calls = Record<string, string>;
type Row = { id: string; reader: string; layout: string; render: string; ms: number; error?: string; calls: Calls; quotes: string[] };

const cases: Case[] = JSON.parse(await fs.readFile(`${DIR}/truth.json`, "utf8"));
const readers = (process.argv[2] ?? "rules,muse,open").split(",");

/** Same path the app takes: extract -> toOutsideCalls (DPYD composition, allele renaming). */
function callsFromExtract(x: LabExtract): Calls {
  const out: Calls = {};
  for (const line of toOutsideCalls(structuredClone(x)).trim().split("\n")) {
    const [gene, dip] = line.split("\t");
    if (gene && dip) out[gene] = dip;
  }
  return out;
}

const mimeOf = (f: string) => (f.endsWith(".pdf") ? "application/pdf" : "image/jpeg");

async function muse(c: Case) {
  const x = await extractLabReport(await fs.readFile(`${DIR}/${c.file}`), mimeOf(c.file), c.file);
  return { calls: callsFromExtract(x), quotes: x.genes.map((g) => g.verbatim) };
}

/** Spark Open has no PDF input, so PDFs go in as a 150 dpi page image. */
async function pageImage(file: string) {
  if (!file.endsWith(".pdf")) return { b64: (await fs.readFile(`${DIR}/${file}`)).toString("base64"), mime: "image/jpeg" };
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "bench-"));
  await run("pdftoppm", ["-r", "150", "-png", "-singlefile", "-f", "1", "-l", "1", `${DIR}/${file}`, `${tmp}/p`]);
  return { b64: (await fs.readFile(`${tmp}/p.png`)).toString("base64"), mime: "image/png" };
}

async function open(c: Case) {
  const img = await pageImage(c.file);
  const x = await structured<LabExtract>({
    provider: "baseten", name: "LabExtract", schema: EXTRACT_SCHEMA, system: EXTRACT_SYSTEM,
    user: [{ type: "text", text: "Extract the pharmacogenomic results from this report." }, { type: "image_url", image_url: { url: `data:${img.mime};base64,${img.b64}` } }],
  });
  return { calls: callsFromExtract(x), quotes: x.genes.map((g) => g.verbatim) };
}

// ---- Rules baseline. Written knowing all four layouts, so it is the best case for a regex reader. ----
const GENES = ["DPYD", "UGT1A1", "TPMT", "NUDT15", "CYP2D6", "CYP2C19"];
const RS: Record<string, [string, string]> = {
  rs75017182: ["DPYD", "HapB3"], rs56038477: ["DPYD", "HapB3"], rs1801265: ["DPYD", "c.85T>C"], rs3918290: ["DPYD", "*2A"], rs55886062: ["DPYD", "*13"], rs67376798: ["DPYD", "c.2846A>T"],
  rs3064744: ["UGT1A1", "*28"], rs4148323: ["UGT1A1", "*6"], rs1142345: ["TPMT", "*3C"], rs1800460: ["TPMT", "*3B"], rs116855232: ["NUDT15", "*3"],
  rs4244285: ["CYP2C19", "*2"], rs4986893: ["CYP2C19", "*3"], rs12248560: ["CYP2C19", "*17"],
};
const two = (alleles: string[], ref: string) => [...alleles, ref, ref].slice(0, 2).join("/");

export function rulesParse(text: string): Calls {
  const seg: Record<string, string[]> = {};
  let cur = "";
  for (const raw of text.split("\n")) {
    // OCR repair a careful engineer would add: stray glyphs for "*" before allele numbers
    const line = raw.replace(/[°"'‘’“”`]\s?(?=\d)/g, "*").replace(/\s+/g, " ").trim();
    const g = GENES.find((x) => new RegExp(`\\b${x}\\b`, "i").test(line)) ?? (/^(drugs|method|genotypes are)/i.test(line) ? "" : cur);
    cur = g;
    if (g) (seg[g] ??= []).push(line);
  }
  const out: Calls = {};
  for (const [gene, lines] of Object.entries(seg)) {
    const s = lines.join(" ");
    const hits: string[] = [];
    for (const m of s.matchAll(/(rs\d+)\s+\S+\s+(heterozygous|homozygous)/gi)) {
      const r = RS[m[1].toLowerCase()];
      if (r && r[0] === gene) hits.push(r[1], ...(m[2].toLowerCase() === "homozygous" ? [r[1]] : []));
    }
    if (gene === "TPMT" && hits.includes("*3B") && hits.includes("*3C") && hits.length === 2) hits.splice(0, 2, "*3A");
    const star = s.match(/(\*\d+[A-Z]?)\s*\/\s*(\*\d+[A-Z]?)/);
    const ta = s.match(/\(?TA\)?\s?([67])\s*\/\s*\(?TA\)?\s?([67])/i);
    const listed = [...s.matchAll(/(\*\d+[A-Z]?)\s+detected\s*\((heterozygous|homozygous)\)/gi)].flatMap((m) => (m[2].toLowerCase() === "homozygous" ? [m[1], m[1]] : [m[1]]));
    let dip = "";
    const rsTable = /rs\d+\s+\S+\s+(wild type|heterozygous|homozygous)/i.test(s);
    if (gene === "DPYD") dip = hits.length ? two(hits, "Reference") : rsTable ? "Reference/Reference" : dpydFromText(s);
    else if (star) dip = `${star[1]}/${star[2]}`;
    else if (ta && gene === "UGT1A1") dip = `${ta[1] === "7" ? "*28" : "*1"}/${ta[2] === "7" ? "*28" : "*1"}`.split("/").sort().join("/");
    else if (hits.length) dip = two(hits, "*1");
    else if (listed.length) dip = two(listed, "*1");
    else if (/not detected|wild type/i.test(s)) dip = "*1/*1";
    if (dip) out[gene] = normaliseDiplotype(gene, dip);
  }
  return out;
}

async function rules(c: Case) {
  const f = `${DIR}/${c.file}`;
  if (c.file.endsWith(".pdf")) return { calls: rulesParse((await run("pdftotext", ["-layout", f, "-"])).stdout), quotes: [] as string[] };
  // OCR prep: greyscale + 2x upscale scored best of the standard options tried (normalize, adaptive threshold, median, deskew)
  const tmp = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "ocr-")), "p.png");
  await run("magick", [f, "-colorspace", "Gray", "-resize", "200%", tmp]);
  const { stdout } = await run("tesseract", [tmp, "-", "--psm", "6"]);
  return { calls: rulesParse(stdout), quotes: [] as string[] };
}

// ---- Scoring ----
const alleles = (gene: string, dip: string) => normaliseDiplotype(gene, dip).split("/").map((a) => a.trim().replace(/^\*1$/, gene === "DPYD" ? "Reference" : "*1")).sort().join("|");
const words = (t: string) => t.toLowerCase().match(/[a-z0-9]+/g) ?? [];

function score(c: Case, r: Row) {
  const truth = Object.entries(c.genes);
  const right = truth.filter(([g, d]) => r.calls[g] && alleles(g, r.calls[g]) === alleles(g, d)).length;
  const extra = Object.keys(r.calls).filter((g) => !(g in c.genes)).length;
  const src = new Set(words(c.text));
  const grounded = r.quotes.filter((q) => { const w = words(q); return w.length > 0 && w.filter((x) => src.has(x)).length / w.length >= 0.85; }).length;
  const dpyd = !!r.calls.DPYD && alleles("DPYD", r.calls.DPYD) === alleles("DPYD", c.genes.DPYD);
  return { calls: truth.length, right, extra, dpyd, perfect: right === truth.length && extra === 0, quotes: r.quotes.length, grounded };
}

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  const q = [...items];
  await Promise.all(Array.from({ length: n }, async () => { for (let x = q.shift(); x; x = q.shift()) await fn(x); }));
}

const FNS = { muse, open, rules } as const;
const rows: Row[] = [];
for (const reader of readers) {
  const fn = FNS[reader as keyof typeof FNS];
  await pool(cases, reader === "rules" ? 6 : 4, async (c) => {
    const t = Date.now();
    let res: { calls: Calls; quotes: string[] } = { calls: {}, quotes: [] }, error: string | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      try { res = await fn(c); error = undefined; break; } catch (e) { error = String(e).slice(0, 200); }
    }
    const row = { id: c.id, reader, layout: c.layout, render: c.render, ms: Date.now() - t, error, ...res };
    rows.push(row);
    const s = score(c, row);
    process.stdout.write(`${reader.padEnd(5)} ${c.id.padEnd(22)} ${s.right}/${s.calls}${s.extra ? ` +${s.extra} extra` : ""}${error ? ` ERR ${error.slice(0, 80)}` : ""}\n`);
  });
}

// ---- Summary ----
const byId = new Map(cases.map((c) => [c.id, c]));
const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : "-");
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
function summary(rs: Row[]) {
  const sc = rs.map((r) => score(byId.get(r.id)!, r));
  const sum = (k: "calls" | "right" | "extra" | "quotes" | "grounded") => sc.reduce((a, s) => a + s[k], 0);
  return {
    geneCalls: pct(sum("right"), sum("calls")), right: sum("right"), calls: sum("calls"),
    dpyd: pct(sc.filter((s) => s.dpyd).length, sc.length), perfectReports: `${sc.filter((s) => s.perfect).length}/${sc.length}`,
    extraGenes: sum("extra"), quotesGrounded: sum("quotes") ? pct(sum("grounded"), sum("quotes")) : "n/a", errors: rs.filter((r) => r.error).length,
    medianSec: +(median(rs.map((r) => r.ms)) / 1000).toFixed(1),
  };
}
const result: Record<string, unknown> = { generatedAt: new Date().toISOString(), cases: cases.length, readers: {} };
for (const reader of readers) {
  const rs = rows.filter((r) => r.reader === reader);
  (result.readers as Record<string, unknown>)[reader] = {
    all: summary(rs),
    byRender: Object.fromEntries(["pdf", "photo", "harsh"].map((k) => [k, summary(rs.filter((r) => r.render === k))])),
    byLayout: Object.fromEntries(["star", "rsid", "narrative", "checklist"].map((k) => [k, summary(rs.filter((r) => r.layout === k))])),
    misses: rs.flatMap((r) => Object.entries(byId.get(r.id)!.genes).filter(([g, d]) => !r.calls[g] || alleles(g, r.calls[g]) !== alleles(g, d)).map(([g, d]) => ({ id: r.id, gene: g, truth: d, got: r.calls[g] ?? "(missing)" }))),
  };
}
const outFile = DIR.endsWith("heldout") ? "docs/bench-results-heldout.json" : "docs/bench-results.json";
const prev = JSON.parse(await fs.readFile(outFile, "utf8").catch(() => "{}"));
await fs.writeFile(outFile, JSON.stringify({ ...prev, ...result, readers: { ...(prev.readers ?? {}), ...(result.readers as object) } }, null, 1));
for (const reader of readers) console.log(reader, JSON.stringify((result.readers as Record<string, { all: unknown }>)[reader].all));
