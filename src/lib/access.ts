import { cookies } from "next/headers";
import { readJson } from "./store";

/** Shared-code gate. Empty ACCESS_CODE disables it. ponytail: swap for real auth when multi-tenant. */
export async function signedIn() {
  const code = process.env.ACCESS_CODE;
  return !code || (await cookies()).get("access")?.value === code;
}

/** Cohorts anyone may read, comma-separated. The first is the default the site links to. */
export const publicCohorts = () => (process.env.PUBLIC_COHORT ?? "demo").split(",").map((s) => s.trim()).filter(Boolean);
export const publicCohort = () => publicCohorts()[0] ?? "demo";
export const cohortIsPublic = (name: string) => publicCohorts().includes(name);

/** A record is readable without the code if it is pinned in PUBLIC_CASES or belongs to the public (synthetic) cohort. */
export async function canRead(id: string) {
  if (await signedIn()) return true;
  if ((process.env.PUBLIC_CASES ?? "").split(",").map((s) => s.trim()).includes(id)) return true;
  const c = await readJson<{ cohort?: string }>(id, "case.json").catch(() => null);
  return Boolean(c?.cohort && cohortIsPublic(c.cohort));
}
