import { NextResponse } from "next/server";

const attempts = new Map<string, { n: number; t: number }>(); // ponytail: in-memory per instance

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  const a = attempts.get(ip) ?? { n: 0, t: Date.now() };
  if (Date.now() - a.t > 15 * 60_000) Object.assign(a, { n: 0, t: Date.now() });
  if (a.n >= 10) return NextResponse.json({ error: "too many attempts, wait 15 minutes" }, { status: 429 });
  const { code } = await req.json().catch(() => ({ code: "" }));
  if (!process.env.ACCESS_CODE || code !== process.env.ACCESS_CODE) {
    attempts.set(ip, { n: a.n + 1, t: a.t });
    return NextResponse.json({ error: "wrong code" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("access", code, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 14 });
  return res;
}
