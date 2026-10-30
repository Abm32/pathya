import { NextResponse } from "next/server";
import { audit, readJson, writeJson } from "@/lib/store";

const STATUS = new Set(["verified", "corrected", "unreadable"]);

/** Curator review: a person checks each extracted call against the source document. Data quality, not clinical sign-off. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { curator?: string; decisions?: Record<string, string>; corrections?: Record<string, string>; note?: string };
  const curator = String(body.curator ?? "").slice(0, 60);
  if (!curator) return NextResponse.json({ error: "curator initials required" }, { status: 400 });
  const c = await readJson<Record<string, unknown>>(id, "case.json").catch(() => null);
  if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
  const decisions = Object.fromEntries(Object.entries(body.decisions ?? {}).filter(([g, s]) => /^[A-Z0-9-]{2,12}$/.test(g) && STATUS.has(s)));
  const corrections = Object.fromEntries(Object.entries(body.corrections ?? {}).filter(([g]) => g in decisions).map(([g, v]) => [g, String(v).slice(0, 120)]));
  const review = { curator, decisions, corrections, note: String(body.note ?? "").slice(0, 2000), at: new Date().toISOString() };
  await writeJson(id, "review.json", review);
  await audit(id, "curator.review", review);
  return NextResponse.json({ ok: true });
}
