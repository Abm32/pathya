import { NextResponse } from "next/server";
import { structured } from "@/lib/meta";
import { unmatched } from "@/lib/pretest";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = {
  type: "object", additionalProperties: false, required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["input", "generics"],
        properties: {
          input: { type: "string", description: "the line exactly as given" },
          generics: { type: "array", items: { type: "string" }, description: "lowercase INN generic names of every drug the line contains; [] if not a drug or unsure" },
        },
      },
    },
  },
};

const SYSTEM = `You name drugs. For each line of an Indian oncology prescription, return the generic (INN) name of every drug it contains.
- Brand names (Indian or global), abbreviations, misspellings, dose text and Malayalam-English mixed words are common. "Tab. Capegard 500 bd" -> ["capecitabine"].
- Regimen acronyms expand to all component drugs: "FOLFOX" -> ["fluorouracil", "leucovorin", "oxaliplatin"].
- Fixed-dose combinations list each component.
- If a line is not a drug, or you are not sure, return []. Never guess. You only name drugs; you do not judge risk or tests.`;

/** POST { regimen } -> { mapped: { line: generics[] } } for the lines the deterministic table could not match. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const regimen = typeof body?.regimen === "string" ? body.regimen.slice(0, 2000) : "";
  const lines = unmatched(regimen).map((l) => l.slice(0, 120)).slice(0, 20);
  if (!lines.length) return NextResponse.json({ mapped: {} });
  try {
    const r = await structured<{ items: { input: string; generics: string[] }[] }>({
      name: "DrugNames", schema, system: SYSTEM, reasoning: "low",
      user: `Lines:\n${lines.map((l) => `- ${l}`).join("\n")}`,
    });
    // keep only lines we actually sent, so the model cannot add its own
    const mapped: Record<string, string[]> = {};
    for (const it of r.items) if (lines.includes(it.input)) mapped[it.input] = it.generics.map((g) => g.toLowerCase().trim()).filter(Boolean).slice(0, 6);
    return NextResponse.json({ mapped });
  } catch (e) {
    return NextResponse.json({ error: "Muse Spark could not name these drugs. Try again.", detail: String(e).slice(0, 200) }, { status: 502 });
  }
}
