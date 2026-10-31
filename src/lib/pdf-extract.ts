import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { meta, MUSE_MODEL, structured, structuredWith, hasProvider, providerModel, type Provider } from "./meta";

export type LabExtract = {
  labName: string;
  reportDate: string;
  patientRef: string; // lab's own id if printed, else ""
  genes: { gene: string; diplotype: string; phenotype: string; activityScore: string; verbatim: string }[];
  methodNotes: string; // e.g. "targeted genotyping of 4 DPYD variants" — matters for coverage claims
  testedVariants: { gene: string; variant: string }[]; // every variant the report says was assayed, detected or not
  warnings: string[];
  readBy?: string; // which Meta model read it; set after extraction, not part of the model's schema
};

export const EXTRACT_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["labName", "reportDate", "patientRef", "genes", "methodNotes", "testedVariants", "warnings"],
  properties: {
    labName: { type: "string" }, reportDate: { type: "string" }, patientRef: { type: "string" },
    genes: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["gene", "diplotype", "phenotype", "activityScore", "verbatim"],
        properties: {
          gene: { type: "string", description: "HGNC symbol, e.g. DPYD, UGT1A1, TPMT, NUDT15, CYP2D6, CYP2C19, HLA-B" },
          diplotype: { type: "string", description: "ALWAYS two alleles separated by /. For DPYD compose from the detected variants, one per chromosome: none detected -> Reference/Reference; one heterozygous variant -> <variant>/Reference; two different heterozygous variants -> <variant1>/<variant2>; homozygous -> <variant>/<variant>. Use names like c.1905+1G>A, c.1679T>G, c.2846A>T, HapB3, c.85T>C. For rsID-only reports, convert known variants (heterozygous = one copy, homozygous = two, wild type = none; fill the other chromosome with *1, or Reference for DPYD): DPYD rs3918290 het -> *1/*2A; rs67376798 -> c.2846A>T; rs55886062 -> *13; rs75017182 -> HapB3; rs1801265 -> c.85T>C. UGT1A1 TA6/TA7 -> *1/*28, TA7/TA7 -> *28/*28, TA6/TA6 -> *1/*1; rs4148323 -> *6. TPMT rs1142345 alone -> *3C; rs1800460 alone -> *3B; both heterozygous -> *1/*3A. NUDT15 rs116855232 -> *3. CYP2C19 rs4244285 -> *2; rs4986893 -> *3; rs12248560 -> *17. Never return raw nucleotide genotypes like C/T as the diplotype" },
          phenotype: { type: "string", description: "as printed, e.g. Intermediate Metabolizer, or ''" },
          activityScore: { type: "string", description: "e.g. 1.0, or ''" },
          verbatim: { type: "string", description: "exact text copied from the report supporting this call" },
        },
      },
    },
    methodNotes: { type: "string" },
    testedVariants: {
      type: "array",
      description: "Every variant or allele the report states was tested, per gene, as printed (rsID, HGVS or star name), including ones reported as not detected. Read the 'variants tested' column, panel list or method text. [] if not stated.",
      items: { type: "object", additionalProperties: false, required: ["gene", "variant"], properties: { gene: { type: "string" }, variant: { type: "string" } } },
    },
    warnings: { type: "array", items: { type: "string" } },
  },
};

export const EXTRACT_SYSTEM = "You are a pharmacogenomics lab-report reader. Extract ONLY what is printed. If a gene is reported as 'not detected' or 'wild type' for a targeted panel, record diplotype *1/*1 and put the panel coverage in methodNotes and a warning that untested variants cannot be excluded. If the report gives genotypes by rsID only, convert using the mapping in the schema and quote the rsID text in verbatim. Never invent a gene that is not on the report.";

/** Hosted path: Muse Spark on api.meta.ai, which takes a PDF natively and enforces the schema. */
async function readOnSpark(file: Buffer, mime: string, filename: string): Promise<LabExtract> {
  const part =
    mime === "application/pdf"
      ? ({ type: "input_file" as const, filename, file_data: `data:application/pdf;base64,${file.toString("base64")}` } as const)
      : ({ type: "input_image" as const, image_url: `data:${mime};base64,${file.toString("base64")}`, detail: "high" as const } as const);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r: any = await meta().responses.create({
    model: MUSE_MODEL,
    input: [
      { role: "system", content: EXTRACT_SYSTEM },
      { type: "message", role: "user", content: [{ type: "input_text", text: "Extract the pharmacogenomic results from this report." }, part] },
    ],
    text: { format: { type: "json_schema", name: "LabExtract", strict: true, schema: EXTRACT_SCHEMA } },
  });
  return { ...(JSON.parse(r.output_text) as LabExtract), readBy: MUSE_MODEL };
}

const run = promisify(execFile);

/**
 * Render page 1 of a PDF to PNG. The open-weights path has no responses API and so cannot take a PDF
 * directly; a page image is the same report in a form it can read.
 */
async function firstPageAsPng(pdf: Buffer): Promise<Buffer> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "pathya-"));
  try {
    const src = path.join(dir, "in.pdf");
    await fs.writeFile(src, pdf);
    await run("pdftoppm", ["-png", "-r", "150", "-f", "1", "-l", "1", "-singlefile", src, path.join(dir, "page")]);
    return await fs.readFile(path.join(dir, "page.png"));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

/** Open-weights path: Muse Spark Open, chat completions with the page as an image and the schema in the prompt. */
async function readOnSparkOpen(file: Buffer, mime: string): Promise<LabExtract> {
  const img = mime === "application/pdf" ? await firstPageAsPng(file) : file;
  const type = mime === "application/pdf" ? "image/png" : mime;
  const out = await structured<LabExtract>({
    name: "LabExtract", schema: EXTRACT_SCHEMA, system: EXTRACT_SYSTEM, provider: "baseten",
    user: [
      { type: "text", text: "Extract the pharmacogenomic results from this report." },
      { type: "image_url", image_url: { url: `data:${type};base64,${img.toString("base64")}` } },
    ],
  });
  return { ...out, readBy: providerModel("baseten") };
}

/**
 * Read a lab PGx report (PDF or image) and extract gene calls. Nothing is inferred beyond what is printed.
 * Hosted Muse Spark first; if api.meta.ai is unreachable or refuses, the same report is read by the
 * open-weights model on Baseten, so one provider being down does not take the pipeline with it.
 */
export async function extractLabReport(file: Buffer, mime: string, filename: string, provider?: Provider): Promise<LabExtract> {
  if (provider === "baseten") return readOnSparkOpen(file, mime);
  try {
    return await readOnSpark(file, mime, filename);
  } catch (e) {
    if (!hasProvider("baseten")) throw e;
    console.warn(`[muse] spark failed (${String(e).slice(0, 120)}), reading on open weights`);
    return readOnSparkOpen(file, mime);
  }
}

/** Same contract for results read aloud (Muse Voice transcript) or typed: text in, the same LabExtract out. */
export async function extractFromText(text: string, provider?: Provider): Promise<LabExtract> {
  const { value, provider: readBy } = await structuredWith<LabExtract>({
    name: "LabExtract", schema: EXTRACT_SCHEMA, reasoning: "low", provider,
    system: `${EXTRACT_SYSTEM} The input is a transcript of someone reading a pharmacogenomic lab report aloud, possibly in mixed Malayalam and English. "verbatim" is the exact transcript words for each call.`,
    user: text.slice(0, 8000),
  });
  return { ...value, readBy: providerModel(readBy) };
}

const DPYD_NAMES: Record<string, string> = {
  "*1": "Reference", "reference": "Reference", "wildtype": "Reference", "wt": "Reference", "normal": "Reference",
  "*2": "c.1905+1G>A (*2A)", "*2a": "c.1905+1G>A (*2A)", "c.1905+1g>a": "c.1905+1G>A (*2A)", "rs3918290": "c.1905+1G>A (*2A)", "ivs14+1g>a": "c.1905+1G>A (*2A)",
  "*13": "c.1679T>G (*13)", "c.1679t>g": "c.1679T>G (*13)", "rs55886062": "c.1679T>G (*13)",
  "c.2846a>t": "c.2846A>T", "rs67376798": "c.2846A>T", "d949v": "c.2846A>T",
  "hapb3": "c.1129-5923C>G, c.1236G>A (HapB3)", "c.1236g>a": "c.1129-5923C>G, c.1236G>A (HapB3)", "rs56038477": "c.1129-5923C>G, c.1236G>A (HapB3)", "rs75017182": "c.1129-5923C>G, c.1236G>A (HapB3)", "c.1129-5923c>g": "c.1129-5923C>G, c.1236G>A (HapB3)",
  "*9": "c.85T>C (*9A)", "*9a": "c.85T>C (*9A)", "c.85t>c": "c.85T>C (*9A)", "rs1801265": "c.85T>C (*9A)", "c29r": "c.85T>C (*9A)",
  "*3": "c.1898delC (*3)", "*4": "c.1601G>A (*4)", "*5": "c.1627A>G (*5)", "*6": "c.2194G>A (*6)", "*7": "c.295_298delTCAT (*7)", "*8": "c.703C>T (*8)",
  "*9b": "c.2657G>A (*9B)", "*10": "c.2983G>T (*10)", "*11": "c.1003G>T (*11)", "*12": "c.1156G>T (*12)",
};

/**
 * Legacy SLCO1B1 star names, still printed by labs and by the GeT-RM consensus tables, mapped to the
 * PharmVar names PharmCAT knows. *1B was renamed *37; *17 is *15 plus a promoter variant and carries the
 * same decreased function. Anything else is passed through: a wrong guess is worse than an uncalled gene.
 */
const SLCO1B1_LEGACY: Record<string, string> = { "*1a": "*1", "*1b": "*37", "*17": "*15" };

/** Drop the linkage markers PharmCAT folds into its own haplotypes, so "(*28 + *60)" is the lab's way of writing *28. */
function ugt1a1Allele(p: string) {
  const parts = p.replace(/[()]/g, "").split("+").map((x) => x.trim()).filter((x) => x && !/^\*(60|80)$/.test(x));
  return parts.join("+") || "*1";
}

/**
 * PharmCAT's DPYD allele names carry the star number, "c.1601G>A (*4)". Reports and consensus tables
 * routinely print the HGVS name alone, so index the names by their bare HGVS prefix too.
 */
const DPYD_BY_HGVS: Record<string, string> = Object.fromEntries(
  Object.values(DPYD_NAMES).map((name) => [name.replace(/\s*\(.*\)$/, "").toLowerCase().replace(/\s+/g, ""), name]),
);

/** Normalise a diplotype to PharmCAT allele names (DPYD uses HGVS names; other genes keep star alleles). */
export function normaliseDiplotype(gene: string, dip: string) {
  const parts = dip.split("/").map((p) => p.trim()).filter(Boolean);
  if (parts.length !== 2) return dip.trim();
  const g = gene.toUpperCase();
  if (g === "UGT1A1") return parts.map(ugt1a1Allele).join("/");
  // Parentheses around an allele are a lab's way of marking it inferred rather than directly typed.
  if (g === "SLCO1B1") return parts.map((p) => p.replace(/[()]/g, "").trim()).map((p) => SLCO1B1_LEGACY[p.toLowerCase()] ?? p).join("/");
  if (g !== "DPYD") return parts.join("/");
  // exact alias first; otherwise any known DPYD variant named inside the text, e.g. "c.1236G>A (HapB3)"
  return parts
    .map((p) => {
      const key = p.toLowerCase().replace(/\s+/g, "");
      // "(*4)" is a lab marking the allele inferred; the parentheses are not part of the name.
      const bare = key.replace(/^\((.*)\)$/, "$1");
      return DPYD_NAMES[key] ?? DPYD_NAMES[bare] ?? DPYD_BY_HGVS[key] ?? DPYD_BY_HGVS[bare] ?? DPYD_TOKENS.find(([re]) => re.test(p))?.[1] ?? p;
    })
    .join("/");
}

/** PharmCAT outside-call TSV: gene \t diplotype \t phenotype \t activity score */
const DPYD_TOKENS: [RegExp, string][] = [
  [/c\.1905\+1G>A|\*2A|rs3918290|IVS14\+1G>A/i, "c.1905+1G>A (*2A)"],
  [/c\.1679T>G|\*13|rs55886062/i, "c.1679T>G (*13)"],
  [/c\.2846A>T|rs67376798|D949V/i, "c.2846A>T"],
  [/HapB3|c\.1236G>A|rs56038477|rs75017182|c\.1129-5923C>G/i, "c.1129-5923C>G, c.1236G>A (HapB3)"],
  // Decreased function, and they outrank the normal-function names below: a chromosome carrying several
  // variants is the lowest-function one it carries, and dropping that is the dangerous direction to err in.
  [/c\.557A>G/i, "c.557A>G"],
  [/c\.868A>G/i, "c.868A>G"],
  [/c\.85T>C|\*9A|rs1801265|C29R/i, "c.85T>C (*9A)"],
  [/c\.1627A>G|\*5\b|rs1801159/i, "c.1627A>G (*5)"],
];

/** Compose a DPYD diplotype from free text like "c.1236G>A heterozygous; c.85T>C heterozygous; others not detected". */
export function dpydFromText(text: string) {
  const found: string[] = [];
  for (const [re, name] of DPYD_TOKENS) {
    const m = text.match(new RegExp(`(${re.source})[^;,.]{0,40}?(heterozygous|homozygous|detected|positive|present|carrier)`, "i"));
    if (!m) continue;
    const state = m[2].toLowerCase();
    if (/not detected|absent|negative/i.test(text.slice(m.index!, m.index! + m[0].length + 15))) continue;
    found.push(name);
    // checklist reports print "Detected (homozygous)": the zygosity follows the matched word
    if (state === "homozygous" || /^\s*\(?\s*homozygous/i.test(text.slice(m.index! + m[0].length))) found.push(name);
  }
  if (found.length === 0) return /not detected|wild ?type|no (tested )?variants?|reference/i.test(text) ? "Reference/Reference" : "";
  if (found.length === 1) return `${found[0]}/Reference`;
  return `${found[0]}/${found[1]}`;
}

export function toOutsideCalls(x: LabExtract) {
  for (const g of x.genes) {
    if (g.gene.toUpperCase() === "DPYD" && !g.diplotype.includes("/")) g.diplotype = dpydFromText(`${g.diplotype} ${g.verbatim}`);
  }
  return x.genes
    .filter((g) => g.gene && (g.diplotype || g.phenotype || g.activityScore))
    .map((g) => [g.gene.trim().toUpperCase(), normaliseDiplotype(g.gene, g.diplotype), g.diplotype ? "" : g.phenotype.trim(), g.diplotype || g.phenotype ? "" : g.activityScore.trim()].join("\t"))
    .join("\n") + "\n";
}
