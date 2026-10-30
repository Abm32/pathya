import { NextResponse, type NextRequest } from "next/server";

/**
 * Shared-code gate for the demo deployment. Disabled when ACCESS_CODE is empty. ponytail: swap for real auth when multi-tenant.
 * Open without the code (read-only, no model cost): the home page with its story and pre-test check, /sample, and the
 * report pages of cases listed in PUBLIC_CASES. Runs, uploads, dictation, web search and confirmations stay gated.
 */
export function proxy(req: NextRequest) {
  const code = process.env.ACCESS_CODE;
  if (!code) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/api/login") || pathname.startsWith("/_next")) return NextResponse.next();
  if (req.cookies.get("access")?.value === code) return NextResponse.next();
  const pub = (process.env.PUBLIC_CASES ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const readOnly = req.method === "GET" && (pathname === "/" || pathname === "/sample"
    || pub.some((id) => pathname === `/report/${id}` || pathname === `/api/report/${id}` || pathname === `/api/report/${id}/source`));
  if (readOnly) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "This needs the pilot access code. Sign in at /login, then try again." }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|opengraph-image|sample-photo.jpg).*)"] };
