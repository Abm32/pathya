import { NextResponse } from "next/server";
import { readJson } from "@/lib/store";
import { canRead } from "@/lib/access";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    if (!(await canRead(id))) return NextResponse.json({ error: "This record is not public. Sign in as a curator at /login to open it." }, { status: 401 });
    const [c, profile, extract, quality, review] = await Promise.all([readJson(id, "case.json"), readJson(id, "profile.json"), readJson(id, "extract.json"), readJson(id, "quality.json"), readJson(id, "review.json")]);
    if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ case: c, profile, extract, quality, review });
  } catch {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
}
