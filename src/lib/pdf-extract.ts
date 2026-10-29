import { meta, MUSE_MODEL } from "./meta";

export type LabExtract = {
  labName: string;
  reportDate: string;
  patientRef: string; // lab's own id if printed, else ""
  genes: { gene: string; diplotype: string; phenotype: string; activityScore: string; verbatim: string }[];
  methodNotes: string; // e.g. "targeted genotyping of 4 DPYD variants" — matters for coverage claims
  warnings: string[];
};

export const EXTRACT_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["labName", "reportDate", "patientRef", "genes", "methodNotes", "warnings"],
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
    warnings: { type: "array", items: { type: "string" } },
  },
};

export const EXTRACT_SYSTEM = "You are a pharmacogenomics lab-report reader. Extract ONLY what is printed. If a gene is reported as 'not detected' or 'wild type' for a targeted panel, record diplotype *1/*1 and put the panel coverage in methodNotes and a warning that untested variants cannot be excluded. If the report gives genotypes by rsID only, convert using the mapping in the schema and quote the rsID text in verbatim. Never invent a gene that is not on the report.";

/** Read a lab PGx report (PDF or image) with Muse Spark and extract gene calls. Nothing is inferred beyond what is printed. */
export async function extractLabReport(file: Buffer, mime: string, filename: string): Promise<LabExtract> {
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
  return JSON.parse(r.output_text) as LabExtract;
}

const DPYD_NAMES: Record<string, string> = {
  "*1": "Reference", "reference": "Reference", "wildtype": "Reference", "wt": "Reference", "normal": "Reference",
  "*2a": "c.1905+1G>A (*2A)", "c.1905+1g>a": "c.1905+1G>A (*2A)", "rs3918290": "c.1905+1G>A (*2A)", "ivs14+1g>a": "c.1905+1G>A (*2A)",
  "*13": "c.1679T>G (*13)", "c.1679t>g": "c.1679T>G (*13)", "rs55886062": "c.1679T>G (*13)",
  "c.2846a>t": "c.2846A>T", "rs67376798": "c.2846A>T", "d949v": "c.2846A>T",
  "hapb3": "c.1129-5923C>G, c.1236G>A (HapB3)", "c.1236g>a": "c.1129-5923C>G, c.1236G>A (HapB3)", "rs56038477": "c.1129-5923C>G, c.1236G>A (HapB3)", "rs75017182": "c.1129-5923C>G, c.1236G>A (HapB3)", "c.1129-5923c>g": "c.1129-5923C>G, c.1236G>A (HapB3)",
  "*9a": "c.85T>C (*9A)", "c.85t>c": "c.85T>C (*9A)", "rs1801265": "c.85T>C (*9A)", "c29r": "c.85T>C (*9A)",
  "*3": "c.1898delC (*3)", "*4": "c.1601G>A (*4)", "*5": "c.1627A>G (*5)", "*6": "c.2194G>A (*6)", "*7": "c.295_298delTCAT (*7)", "*8": "c.703C>T (*8)",
  "*9b": "c.2657G>A (*9B)", "*10": "c.2983G>T (*10)", "*11": "c.1003G>T (*11)", "*12": "c.1156G>T (*12)",
};

/** Normalise a diplotype to PharmCAT allele names (DPYD uses HGVS names; other genes keep star alleles). */
export function normaliseDiplotype(gene: string, dip: string) {
  const parts = dip.split("/").map((p) => p.trim()).filter(Boolean);
  if (parts.length !== 2) return dip.trim();
  if (gene.toUpperCase() !== "DPYD") return parts.join("/");
  // exact alias first; otherwise any known DPYD variant named inside the text, e.g. "c.1236G>A (HapB3)"
  return parts.map((p) => DPYD_NAMES[p.toLowerCase().replace(/\s+/g, "")] ?? DPYD_TOKENS.find(([re]) => re.test(p))?.[1] ?? p).join("/");
}

/** PharmCAT outside-call TSV: gene \t diplotype \t phenotype \t activity score */
const DPYD_TOKENS: [RegExp, string][] = [
  [/c\.1905\+1G>A|\*2A|rs3918290|IVS14\+1G>A/i, "c.1905+1G>A (*2A)"],
  [/c\.1679T>G|\*13|rs55886062/i, "c.1679T>G (*13)"],
  [/c\.2846A>T|rs67376798|D949V/i, "c.2846A>T"],
  [/HapB3|c\.1236G>A|rs56038477|rs75017182|c\.1129-5923C>G/i, "c.1129-5923C>G, c.1236G>A (HapB3)"],
  [/c\.85T>C|\*9A|rs1801265|C29R/i, "c.85T>C (*9A)"],
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
