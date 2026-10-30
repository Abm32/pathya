import { NextResponse } from "next/server";

/**
 * The demo is open: anyone can read a record, run a report through the pipeline and dictate results,
 * with no code. Nothing here blocks a visitor.
 *
 * ACCESS_CODE is no longer an entry barrier; it is a curator credential. Signing in at /login is what
 * lets someone write into a verified cohort or record a curator review (see src/lib/access.ts). The
 * endpoints that spend model credits carry a per-IP budget instead (src/lib/limit.ts).
 */
export function proxy() {
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|opengraph-image|sample-photo.jpg).*)"] };
