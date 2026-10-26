import { NextResponse } from "next/server";
import { transcribe } from "@/lib/meta";
import { structured } from "@/lib/meta";

export const runtime = "nodejs";
export const maxDuration = 120;

const KEYWORDS = [
  "capecitabine", "Xeloda", "5-FU", "fluorouracil", "FOLFOX", "FOLFIRI", "XELOX", "irinotecan", "oxaliplatin", "mercaptopurine",
  "azathioprine", "thioguanine", "tamoxifen", "ondansetron", "pantoprazole", "omeprazole", "clopidogrel", "voriconazole", "tramadol", "codeine",
];

export type ConsultExtract = {
  medications: { name: string; dose: string; context: string }[];
  diagnosis: string;
  plannedRegimen: string;
  notes: string;
};

const schema = {
  type: "object", additionalProperties: false,
  required: ["medications", "diagnosis", "plannedRegimen", "notes"],
  properties: {
    medications: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["name", "dose", "context"],
        properties: { name: { type: "string" }, dose: { type: "string" }, context: { type: "string" } } },
    },
    diagnosis: { type: "string" }, plannedRegimen: { type: "string" }, notes: { type: "string" },
  },
};

/** POST multipart: audio (wav) -> Muse Voice transcript (diarized, ML/EN code-switch) -> Muse Spark med extraction. */
export async function POST(req: Request) {
  const fd = await req.formData();
  const audio = fd.get("audio");
  if (!(audio instanceof Blob)) return NextResponse.json({ error: "audio required" }, { status: 400 });
  if (audio.size > 30 * 1024 * 1024) return NextResponse.json({ error: "audio too large" }, { status: 413 });
  try {
    const t = await transcribe(audio, { diarize: true, languages: ["English", "Malayalam"], keywords: KEYWORDS });
    const text = t.turns.length ? t.turns.map((x) => `${x.speaker ?? "?"}: ${x.transcript}`).join("\n") : t.transcript;
    const extract = await structured<ConsultExtract>({
      name: "ConsultExtract", schema, reasoning: "low",
      system: `You read a diarized oncology consult transcript (English/Malayalam code-switched). Extract every medication mentioned as current, planned, or proposed, with generic name in English (map brands: Xeloda->capecitabine; 5-FU->fluorouracil; 6-MP->mercaptopurine). dose: as spoken or "". context: current|planned|stopped|considered. diagnosis and plannedRegimen in English. notes: anything relevant to drug safety (prior toxicity, organ function). Do not invent medications.`,
      user: text,
    });
    return NextResponse.json({ transcript: text, durationMs: t.audioDurationMs, extract });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 600) }, { status: 502 });
  }
}
