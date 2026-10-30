import { NextResponse, type NextRequest } from "next/server";

/**
 * Shared-code gate for the demo deployment. Disabled when ACCESS_CODE is empty. ponytail: swap for real auth when multi-tenant.
 * Open without the code (read-only, no model cost): the home page, /sample, the public cohort, and records that are pinned in
 * PUBLIC_CASES or belong to the public cohort. Runs, uploads, dictation, web search and curator review stay gated.
 */
export function proxy(req: NextRequest) {
  const code = process.env.ACCESS_CODE;
  if (!code) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/api/login") || pathname.startsWith("/_next")) return NextResponse.next();
  if (req.cookies.get("access")?.value === code) return NextResponse.next();
  // Read-only pages pass; /report and /cohort (and their APIs) check per record or cohort in src/lib/access.ts.
  const readOnly = req.method === "GET" && (pathname === "/" || pathname === "/sample" || pathname === "/cohort"
    || /^\/report\/[a-f0-9]{12}$/.test(pathname) || /^\/api\/report\/[a-f0-9]{12}(\/source|\/export)?$/.test(pathname) || /^\/api\/cohort\/[a-z0-9-]+$/.test(pathname));
  if (readOnly) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "This needs the pilot access code. Sign in at /login, then try again." }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|opengraph-image|sample-photo.jpg).*)"] };
