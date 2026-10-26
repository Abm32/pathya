import { NextResponse } from "next/server";
import { readJson } from "@/lib/store";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const [c, profile, ai] = await Promise.all([readJson(id, "case.json"), readJson(id, "profile.json"), readJson(id, "ai.json")]);
    if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ case: c, profile, ai });
  } catch {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
}
