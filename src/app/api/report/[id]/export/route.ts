import { readJson } from "@/lib/store";
import { canRead } from "@/lib/access";
import { cohortCsv, type CaseMeta, type Review } from "@/lib/cohort";
import type { Quality } from "@/lib/quality";
import type { PgxProfile } from "@/lib/pharmcat";

/** One record as JSON (full), PharmCAT outside-call TSV, or a one-row CSV. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[a-f0-9]{12}$/.test(id) || !(await canRead(id))) return new Response("This needs the pilot access code.", { status: 401 });
  const f = new URL(req.url).searchParams.get("f") ?? "json";
  const meta = await readJson<CaseMeta>(id, "case.json").catch(() => null);
  const profile = await readJson<PgxProfile>(id, "profile.json").catch(() => null);
  if (!meta || !profile) return new Response("not found", { status: 404 });
  const name = `pathya-${id}`;
  if (f === "tsv") {
    const tsv = profile.genes.filter((g) => g.called).map((g) => [g.gene, g.diplotype, "", ""].join("\t")).join("\n") + "\n";
    return new Response(tsv, { headers: { "content-type": "text/tab-separated-values", "content-disposition": `attachment; filename="${name}.tsv"` } });
  }
  const quality = await readJson<Quality>(id, "quality.json");
  const review = await readJson<Review>(id, "review.json");
  if (f === "csv") return new Response(cohortCsv([{ meta, profile, quality, review }]), { headers: { "content-type": "text/csv", "content-disposition": `attachment; filename="${name}.csv"` } });
  const extract = await readJson(id, "extract.json");
  const body = { record: meta, calls: profile.genes.filter((g) => g.called).map(({ gene, diplotype, phenotype, activityScore, source }) => ({ gene, diplotype, phenotype, activityScore, source })), extract, quality, review, pharmcat: { version: profile.pharmcatVersion, data: profile.dataVersion }, note: "Research record. Not medical advice." };
  return new Response(JSON.stringify(body, null, 2), { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="${name}.json"` } });
}
