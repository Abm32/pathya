import { NextResponse, type NextRequest } from "next/server";

/** Stable link to the pinned public sample report (first id in PUBLIC_CASES). */
export function GET(req: NextRequest) {
  const id = (process.env.PUBLIC_CASES ?? "").split(",")[0]?.trim();
  return NextResponse.redirect(new URL(id ? `/report/${id}` : "/", req.url));
}
