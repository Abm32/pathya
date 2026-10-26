import { structured } from "./meta";
import type { PgxProfile } from "./pharmcat";
import type { LensNote } from "./india-lens";

export type MedAssessment = {
  drug: string;
  matchedInput: string; // the user-entered medication this maps to ("" if from profile only)
  risk: "avoid" | "adjust" | "caution" | "standard" | "unknown";
  genes: string[];
  headline: string; // one line for the clinician
  action: string; // concrete dosing/alternative action, quoting guideline
  evidence: string; // ONE short line: source + classification, e.g. "CPIC Strong · DPWG concurs · FDA label". No PMIDs here.
  citations: string[]; // PMIDs or URLs taken ONLY from the provided profile
};

export type AiReport = {
  clinicianSummary: string;
  medications: MedAssessment[];
  unmappedMedications: string[]; // input meds with no PGx guideline relevance
  genesOfConcern: { gene: string; diplotype: string; phenotype: string; whyItMatters: string }[];
  patient: { en: string; ml: string }; // plain-language explanation, English + Malayalam
  limitations: string[];
};

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["clinicianSummary", "medications", "unmappedMedications", "genesOfConcern", "patient", "limitations"],
  properties: {
    clinicianSummary: { type: "string" },
    medications: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["drug", "matchedInput", "risk", "genes", "headline", "action", "evidence", "citations"],
        properties: {
          drug: { type: "string" },
          matchedInput: { type: "string" },
          risk: { type: "string", enum: ["avoid", "adjust", "caution", "standard", "unknown"] },
          genes: { type: "array", items: { type: "string" } },
          headline: { type: "string" },
          action: { type: "string" },
          evidence: { type: "string" },
          citations: { type: "array", items: { type: "string" } },
        },
      },
    },
    unmappedMedications: { type: "array", items: { type: "string" } },
    genesOfConcern: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["gene", "diplotype", "phenotype", "whyItMatters"],
        properties: {
          gene: { type: "string" },
          diplotype: { type: "string" },
          phenotype: { type: "string" },
          whyItMatters: { type: "string" },
        },
      },
    },
    patient: {
      type: "object",
      additionalProperties: false,
      required: ["en", "ml"],
      properties: { en: { type: "string" }, ml: { type: "string" } },
    },
    limitations: { type: "array", items: { type: "string" } },
  },
};

const SYSTEM = `You are a clinical pharmacogenomics decision-support assistant for oncologists in India.
You are given (1) a PharmCAT profile: deterministic gene diplotypes/phenotypes and the guideline annotations (CPIC, DPWG, FDA) that matched this patient, and (2) the patient's medication list.
Rules:
- Ground every statement in the provided annotations. Never invent a diplotype, phenotype, dose, or citation. Citations must be PMIDs or URLs copied from the profile.
- Map each input medication to guideline drugs (brand/generic/salt/typo tolerant, e.g. "xeloda"->capecitabine, "5-FU"->fluorouracil, "6-MP"->mercaptopurine). Also surface guideline drugs that are NOT on the list but are standard in this patient's apparent regimen only if they are in the profile with actionable recommendations, flag them as matchedInput "".
- risk: "avoid" when guideline says avoid/contraindicated; "adjust" when dose change or alternative recommended; "caution" when monitoring or uncertain; "standard" when no change; "unknown" when the relevant gene is not called.
- Prefer CPIC; when CPIC absent use DPWG then FDA. evidence is ONE short line naming source(s) and classification only (e.g. "CPIC Strong · DPWG concurs"); all PMIDs/URLs go in citations, max 4, most specific first.
- clinicianSummary: <= 4 sentences, the actionable findings first.
- patient.en: warm, plain English at 8th-grade level, no gene jargon without a one-phrase explanation, explain what the doctor may change and why, 120-180 words. patient.ml: the same content in natural Malayalam (not transliterated English), using common Malayalam medical terms.
- If POPULATION NOTES are present, reflect them in the relevant medication headline/action with risk at least "caution", and in the patient text, citing their sources.
- limitations: list uncalled relevant genes (e.g., CYP2D6, HLA-B need separate testing), that this is decision support requiring clinician confirmation, and that non-genetic factors (renal/hepatic function, interactions) are not assessed.`;

export async function generateReport(profile: PgxProfile, meds: string[], lens: LensNote[] = []) {
  const compact = {
    genes: profile.genes.filter((g) => g.called).map(({ gene, diplotype, phenotype, activityScore }) => ({ gene, diplotype, phenotype, activityScore })),
    uncalled: profile.genes.filter((g) => !g.called).map((g) => g.gene),
    annotations: profile.drugs
      .filter((d) => d.recommendation)
      .map(({ drug, source, genes, classification, recommendation, implications, url, citations, noChange }) => ({
        drug, source, genes, classification, noChange, recommendation, implications, url,
        citations: citations.map((c) => (c.pmid ? `PMID:${c.pmid}` : c.url ?? c.title)),
      })),
  };
  return structured<AiReport>({
    name: "PgxReport",
    schema,
    system: SYSTEM,
    user: `MEDICATION LIST:\n${meds.map((m) => `- ${m}`).join("\n") || "(none provided)"}\n\nPHARMCAT PROFILE (JSON):\n${JSON.stringify(compact)}\n\nPOPULATION NOTES (India lens, deterministic; cite their sources verbatim when used):\n${JSON.stringify(lens)}`,
    reasoning: "medium",
  });
}
