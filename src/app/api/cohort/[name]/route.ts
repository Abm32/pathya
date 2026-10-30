import { NextResponse } from "next/server";
import { cohortCsv, cohortStats, loadCohort } from "@/lib/cohort";
import { publicCohort, signedIn } from "@/lib/access";

/** Cohort statistics as JSON, or every record as CSV with ?f=csv. */
export async function GET(req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  if (!/^[a-z0-9-]{1,40}$/.test(name)) return NextResponse.json({ error: "bad cohort name" }, { status: 400 });
  if (name !== publicCohort() && !(await signedIn())) return NextResponse.json({ error: "This needs the pilot access code." }, { status: 401 });
  const records = await loadCohort(name);
  if (new URL(req.url).searchParams.get("f") === "csv") {
    return new Response(cohortCsv(records), { headers: { "content-type": "text/csv", "content-disposition": `attachment; filename="pathya-cohort-${name}.csv"` } });
  }
  return NextResponse.json({ cohort: name, records: records.length, stats: cohortStats(records) });
}
