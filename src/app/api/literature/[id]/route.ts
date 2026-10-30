import { NextResponse } from "next/server";
import { meta, MUSE_MODEL } from "@/lib/meta";
import { audit, readJson, writeJson } from "@/lib/store";
import type { PgxProfile } from "@/lib/pharmcat";

type Cite = { url: string; title: string };
export type Literature = { allele: string; summary: string; citations: Cite[] }[];

/** For each non-reference allele in the record, Muse Spark web search finds published frequency data in Indian populations. Cached per record. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const cached = await readJson<Literature>(id, "literature.json").catch(() => null);
  if (cached) return NextResponse.json({ literature: cached, cached: true });
  const profile = await readJson<PgxProfile>(id, "profile.json").catch(() => null);
  if (!profile) return NextResponse.json({ error: "not found" }, { status: 404 });
  const alleles = [...new Set(profile.genes.filter((g) => g.called).flatMap((g) => g.diplotype.split("/").map((a) => a.trim()).filter((a) => a && !/^(\*1|Reference)$/.test(a)).map((a) => `${g.gene} ${a}`)))].slice(0, 4);
  const out: Literature = [];
  for (const allele of alleles) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = await meta().responses.create({
      model: MUSE_MODEL,
      tools: [{ type: "web_search" }],
      include: ["web_search_call.results"],
      input: `In 2 sentences: what allele or carrier frequency of ${allele} has been published for Indian or South Asian populations, in which study and how many people? Report numbers only from sources you found; if none, say so. Do not give clinical advice.`,
    });
    const msgs = (r.output ?? []).filter((o: { type: string }) => o.type === "message");
    const summary = (msgs[msgs.length - 1]?.content ?? []).map((b: { text?: string }) => b.text ?? "").join(" ").trim();
    const citations: Cite[] = [];
    for (const o of r.output ?? []) if (o.type === "web_search_call") for (const res of o.results ?? []) if (res.url) citations.push({ url: res.url, title: res.title ?? res.url });
    out.push({ allele, summary, citations: citations.filter((c, i, a) => a.findIndex((x) => x.url === c.url) === i).slice(0, 4) });
  }
  await writeJson(id, "literature.json", out);
  await audit(id, "muse.web_search.ok", { alleles: out.map((o) => o.allele) });
  return NextResponse.json({ literature: out, cached: false });
}
