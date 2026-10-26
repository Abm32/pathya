import { NextResponse } from "next/server";
import { meta, MUSE_MODEL } from "@/lib/meta";
import { audit, readJson, writeJson } from "@/lib/store";
import type { AiReport } from "@/lib/report-ai";

type Cite = { url: string; title: string };
export type LatestCheck = { drug: string; summary: string; citations: Cite[] }[];

/** For each actionable drug, ask Muse Spark with web_search for label/guideline changes newer than the bundled CPIC data. Cached per case. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const cached = await readJson<LatestCheck>(id, "latest.json").catch(() => null);
  if (cached) return NextResponse.json({ latest: cached, cached: true });
  const ai = await readJson<AiReport>(id, "ai.json").catch(() => null);
  if (!ai) return NextResponse.json({ error: "no AI report for this case" }, { status: 404 });
  const targets = ai.medications.filter((m) => m.risk === "avoid" || m.risk === "adjust").slice(0, 4);
  const out: LatestCheck = [];
  for (const m of targets) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = await meta().responses.create({
      model: MUSE_MODEL,
      tools: [{ type: "web_search" }],
      include: ["web_search_call.results"],
      input: `In 2 sentences: has the FDA or EMA label, or the CPIC/DPWG guideline, for ${m.drug} and ${m.genes.join("/")} changed since 2024? Give the date and what changed. If nothing changed, say so.`,
    });
    // Muse narrates each search step as its own message; the answer is the last message. Sources come from web_search_call.results.
    const msgs = (r.output ?? []).filter((o: { type: string }) => o.type === "message");
    const last = msgs[msgs.length - 1];
    const summary = (last?.content ?? []).map((b: { text?: string }) => b.text ?? "").join(" ").trim();
    const citations: Cite[] = [];
    for (const o of r.output ?? []) {
      if (o.type !== "web_search_call") continue;
      for (const res of o.results ?? []) if (res.url) citations.push({ url: res.url, title: res.title ?? res.url });
    }
    out.push({ drug: m.drug, summary, citations: citations.filter((c, i, arr) => arr.findIndex((x) => x.url === c.url) === i).slice(0, 4) });
  }
  await writeJson(id, "latest.json", out);
  await audit(id, "muse.web_search.ok", { drugs: out.map((o) => o.drug) });
  return NextResponse.json({ latest: out, cached: false });
}
