import { NextResponse } from "next/server";
import { transcribe } from "@/lib/meta";
import { signedIn } from "@/lib/access";
import { overBudget, BUSY } from "@/lib/limit";

export const runtime = "nodejs";
export const maxDuration = 120;

// Bias Muse Voice toward what a lab report read aloud sounds like.
const KEYWORDS = ["DPYD", "HapB3", "UGT1A1", "NUDT15", "TPMT", "CYP2C19", "CYP2D6", "heterozygous", "homozygous", "wild type", "star", "rs number", "metabolizer", "c.85T>C", "c.1236G>A"];

/** POST multipart audio (wav): Muse Voice transcript of results read aloud (Malayalam and English). The analyze route turns it into a record. */
export async function POST(req: Request) {
  if (!(await signedIn()) && overBudget(req, "transcribe", 12)) return NextResponse.json(BUSY, { status: 429 });
  const fd = await req.formData();
  const audio = fd.get("audio");
  if (!(audio instanceof Blob)) return NextResponse.json({ error: "audio required" }, { status: 400 });
  if (audio.size > 30 * 1024 * 1024) return NextResponse.json({ error: "audio too large" }, { status: 413 });
  try {
    const t = await transcribe(audio, { diarize: false, languages: ["English", "Malayalam"], keywords: KEYWORDS });
    return NextResponse.json({ transcript: t.transcript, durationMs: t.audioDurationMs });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 600) }, { status: 502 });
  }
}
