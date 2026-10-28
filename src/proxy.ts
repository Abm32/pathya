import { NextResponse, type NextRequest } from "next/server";

/** Shared-code gate for the demo deployment. Disabled when ACCESS_CODE is empty. ponytail: swap for real auth when multi-tenant. */
export function proxy(req: NextRequest) {
  const code = process.env.ACCESS_CODE;
  if (!code) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/api/login") || pathname.startsWith("/_next")) return NextResponse.next();
  if (req.cookies.get("access")?.value === code) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|opengraph-image).*)"] };
