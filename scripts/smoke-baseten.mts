// pnpm tsx --env-file=.env scripts/smoke-baseten.mts
/* eslint-disable @typescript-eslint/no-explicit-any -- smoke test pokes raw API responses */
// Exercises Muse Spark Open on Baseten: chat (reasoning_content), prompt-guided JSON, image input.
import { promises as fs } from "node:fs";
import { client, providerModel, structured } from "../src/lib/meta";

const t = (label: string) => { const s = Date.now(); return () => `${label} ${Date.now() - s}ms`; };
const step = async (name: string, fn: () => Promise<void>) => { try { await fn(); } catch (e) { console.log(name, "ERR", String(e).slice(0, 700)); } };
const model = providerModel("baseten");

await step("chat", async () => {
  const d = t("chat");
  const r: any = await client("baseten").chat.completions.create({ model, messages: [{ role: "user", content: "Reply with the single word OK." }] });
  const m = r.choices[0].message;
  console.log(d(), JSON.stringify(m.content), "reasoning:", String(m.reasoning_content ?? "").slice(0, 80), r.usage);
});
await step("structured", async () => {
  const d = t("structured");
  const r = await structured<{ gene: string; phenotype: string }>({
    provider: "baseten", name: "T", system: "Extract.", user: "DPYD c.1905+1G>A heterozygous, intermediate metabolizer",
    schema: { type: "object", additionalProperties: false, required: ["gene", "phenotype"], properties: { gene: { type: "string" }, phenotype: { type: "string" } } },
  });
  console.log(d(), r);
});
await step("image", async () => {
  const d = t("image");
  const png = await fs.readFile(process.argv[2] ?? "fixtures/lab-report-demo.pdf").catch(() => null);
  if (!png || !process.argv[2]) { console.log("image skipped (pass a PNG path)"); return; }
  const r: any = await client("baseten").chat.completions.create({
    model,
    messages: [{ role: "user", content: [
      { type: "text", text: "List every gene and diplotype in this lab report." },
      { type: "image_url", image_url: { url: `data:image/png;base64,${png.toString("base64")}` } },
    ] }],
  });
  console.log(d(), r.choices[0].message.content?.slice(0, 400));
});
