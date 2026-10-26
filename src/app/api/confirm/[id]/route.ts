import { NextResponse } from "next/server";
import { audit, readJson, writeJson } from "@/lib/store";

/** Clinician acknowledgement gate. Records who confirmed (free-text initials) and the decision per drug. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { clinician?: string; decisions?: Record<string, string>; note?: string };
  const clinician = String(body.clinician ?? "").slice(0, 60);
  if (!clinician) return NextResponse.json({ error: "clinician initials required" }, { status: 400 });
  const c = await readJson<Record<string, unknown>>(id, "case.json").catch(() => null);
  if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
  const confirmation = { clinician, decisions: body.decisions ?? {}, note: String(body.note ?? "").slice(0, 2000), at: new Date().toISOString() };
  await writeJson(id, "confirmation.json", confirmation);
  await writeJson(id, "case.json", { ...c, status: "confirmed" });
  await audit(id, "clinician.confirm", confirmation);
  return NextResponse.json({ ok: true });
}
