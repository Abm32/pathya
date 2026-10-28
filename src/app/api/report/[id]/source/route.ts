import { promises as fs } from "node:fs";
import path from "node:path";
import { caseDir } from "@/lib/store";

/** The uploaded lab report, so the clinician can check every quoted call against the original. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let dir: string;
  try { dir = caseDir(id); } catch { return new Response("bad id", { status: 400 }); }
  for (const [name, type] of [["report.pdf", "application/pdf"], ["report.img", ""]] as const) {
    const buf = await fs.readFile(path.join(dir, name)).catch(() => null);
    if (!buf) continue;
    const mime = type || (buf[0] === 0x89 ? "image/png" : buf[0] === 0xff ? "image/jpeg" : "image/webp");
    return new Response(new Uint8Array(buf), { headers: { "content-type": mime, "cache-control": "private, max-age=3600" } });
  }
  return new Response("no source document", { status: 404 });
}
