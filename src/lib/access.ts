import { cookies } from "next/headers";
import { readJson } from "./store";

/**
 * Curator credential, not an entry gate: the site is open to anyone (see src/proxy.ts). Signing in is
 * what allows a write into a verified cohort or a curator review. Empty ACCESS_CODE makes everyone a curator.
 * ponytail: swap for real auth when multi-tenant.
 */
export async function signedIn() {
  const code = process.env.ACCESS_CODE;
  return !code || (await cookies()).get("access")?.value === code;
}

/** Cohorts anyone may read, comma-separated. The first is the default the site links to. */
export const publicCohorts = () => (process.env.PUBLIC_COHORT ?? "demo").split(",").map((s) => s.trim()).filter(Boolean);
export const publicCohort = () => publicCohorts()[0] ?? "demo";
export const cohortIsPublic = (name: string) => publicCohorts().includes(name);

/**
 * Every cohort here is verified against ground truth by a script, so a visitor's run must never land in
 * one. Anything built without the curator credential is filed under VISITOR_COHORT, which is public, so
 * whoever made the record can read it back.
 */
export const VISITOR_COHORT = "visitors";

/** Where a run may actually be filed: curators choose, visitors always get the visitors cohort. */
export async function writableCohort(requested: string) {
  return (await signedIn()) ? requested : VISITOR_COHORT;
}

/** A record is readable without the code if it is pinned in PUBLIC_CASES or belongs to a public (synthetic) cohort. */
export async function canRead(id: string) {
  if (await signedIn()) return true;
  if ((process.env.PUBLIC_CASES ?? "").split(",").map((s) => s.trim()).includes(id)) return true;
  const c = await readJson<{ cohort?: string }>(id, "case.json").catch(() => null);
  return Boolean(c?.cohort && cohortIsPublic(c.cohort));
}
