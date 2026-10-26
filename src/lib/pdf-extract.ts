import { meta, MUSE_MODEL } from "./meta";

export type LabExtract = {
  labName: string;
  reportDate: string;
  patientRef: string; // lab's own id if printed, else ""
  genes: { gene: string; diplotype: string; phenotype: string; activityScore: string; verbatim: string }[];
  methodNotes: string; // e.g. "targeted genotyping of 4 DPYD variants" — matters for coverage claims
  warnings: string[];
};

const schema = {
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
          diplotype: { type: "string", description: "star-allele diplotype like *1/*2A, or '' if only a phenotype is given. For rsID-only reports, convert known variants: DPYD rs3918290 het -> *1/*2A; rs67376798 -> c.2846A>T; rs55886062 -> *13; rs75017182 -> HapB3. UGT1A1 TA6/TA7 -> *1/*28, TA7/TA7 -> *28/*28, TA6/TA6 -> *1/*1" },
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

/** Read a lab PGx report (PDF or image) with Muse Spark and extract gene calls. Nothing is inferred beyond what is printed. */
export async function extractLabReport(file: Buffer, mime: string, filename: string): Promise<LabExtract> {
  const part =
    mime === "application/pdf"
      ? { type: "input_file", filename, file_data: `data:application/pdf;base64,${file.toString("base64")}` }
      : { type: "input_image", image_url: `data:${mime};base64,${file.toString("base64")}` };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r: any = await meta().responses.create({
    model: MUSE_MODEL,
    input: [
      { role: "system", content: "You are a pharmacogenomics lab-report reader. Extract ONLY what is printed. If a gene is reported as 'not detected' or 'wild type' for a targeted panel, record diplotype *1/*1 and put the panel coverage in methodNotes and a warning that untested variants cannot be excluded. If the report gives genotypes by rsID only, convert using the mapping in the schema and quote the rsID text in verbatim. Never invent a gene that is not on the report." },
      { type: "message", role: "user", content: [{ type: "input_text", text: "Extract the pharmacogenomic results from this report." }, part] },
    ],
    text: { format: { type: "json_schema", name: "LabExtract", strict: true, schema } },
  });
  return JSON.parse(r.output_text) as LabExtract;
}

/** PharmCAT outside-call TSV: gene \t diplotype \t phenotype \t activity score */
export function toOutsideCalls(x: LabExtract) {
  return x.genes
    .filter((g) => g.gene && (g.diplotype || g.phenotype || g.activityScore))
    .map((g) => [g.gene.trim().toUpperCase(), g.diplotype.trim(), g.diplotype ? "" : g.phenotype.trim(), g.diplotype || g.phenotype ? "" : g.activityScore.trim()].join("\t"))
    .join("\n") + "\n";
}
