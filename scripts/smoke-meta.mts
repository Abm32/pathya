// pnpm tsx --env-file=.env scripts/smoke-meta.mts [audio.wav]
import { promises as fs } from "node:fs";
import { meta, MUSE_MODEL, structured, transcribe } from "../src/lib/meta";

const t = (label: string) => { const s = Date.now(); return () => `${label} ${Date.now() - s}ms`; };
const step = async (name: string, fn: () => Promise<void>) => { try { await fn(); } catch (e) { console.log(name, "ERR", String(e).slice(0, 700)); } };

await step("chat", async () => {
  const d = t("chat");
  const r = await meta().chat.completions.create({ model: MUSE_MODEL, messages: [{ role: "user", content: "Reply with the single word OK." }] });
  console.log(d(), JSON.stringify(r.choices[0].message.content), r.usage);
});
await step("structured", async () => {
  const d = t("structured");
  const r = await structured<{ gene: string; phenotype: string }>({
    name: "T", system: "Extract.", user: "DPYD c.1905+1G>A heterozygous, intermediate metabolizer",
    schema: { type: "object", additionalProperties: false, required: ["gene", "phenotype"], properties: { gene: { type: "string" }, phenotype: { type: "string" } } },
  });
  console.log(d(), r);
});
await step("web_search", async () => {
  const d = t("web_search");
  const r: any = await meta().responses.create({
    model: MUSE_MODEL, tools: [{ type: "web_search" } as any],
    input: "What did the FDA change in the capecitabine label regarding DPYD in 2024-2025? One sentence with a citation.",
  });
  const msg = r.output.find((o: any) => o.type === "message");
  const block = msg?.content?.[0];
  console.log(d(), r.output_text?.slice(0, 300), "\n annotations:", JSON.stringify((block?.annotations ?? []).slice(0, 2)));
});
await step("pdf", async () => {
  const d = t("pdf");
  const pdf = Buffer.from(`%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 100]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 70>>stream\nBT /F1 14 Tf 10 50 Td (DPYD genotype: *1/*2A  TPMT: *1/*3A) Tj ET\nendstream\nendobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>`);
  const r: any = await meta().responses.create({
    model: MUSE_MODEL,
    input: [{ type: "message", role: "user", content: [
      { type: "input_text", text: "List the gene diplotypes in this report as JSON." },
      { type: "input_file", filename: "r.pdf", file_data: `data:application/pdf;base64,${pdf.toString("base64")}` } as any,
    ] }],
  });
  console.log(d(), r.output_text?.slice(0, 200));
});
await step("asr", async () => {
  const d = t("asr");
  let buf: Buffer;
  const p = process.argv[2];
  if (p) buf = await fs.readFile(p);
  else {
    const n = 24000, data = Buffer.alloc(n * 2); const h = Buffer.alloc(44);
    h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
    h.writeUInt32LE(24000, 24); h.writeUInt32LE(48000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
    buf = Buffer.concat([h, data]);
  }
  const r = await transcribe(new Blob([new Uint8Array(buf)], { type: "audio/wav" }), { diarize: true, languages: ["Malayalam", "English"], keywords: ["capecitabine", "irinotecan"] });
  console.log(d(), JSON.stringify(r).slice(0, 600));
});
