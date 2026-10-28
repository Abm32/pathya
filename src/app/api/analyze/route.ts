import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { runPharmcat, loadProfile } from "@/lib/pharmcat";
import { newId, caseDir, writeJson, audit } from "@/lib/store";
import { generateReport } from "@/lib/report-ai";
import { extractLabReport, toOutsideCalls, type LabExtract } from "@/lib/pdf-extract";
import { indiaLens } from "@/lib/india-lens";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BYTES = 25 * 1024 * 1024;
const IMG = new Set(["image/png", "image/jpeg", "image/webp"]);

/**
 * POST multipart. One of:
 *  - vcf: .vcf/.vcf.gz (GRCh38)            -> PharmCAT pipeline
 *  - report: lab PDF or image              -> Muse Spark extraction -> PharmCAT outside calls
 *  - sample: "A" | "B" | "lab" | "photo"   -> bundled fixtures
 * ?stream=1 returns NDJSON progress events instead of a single JSON body.
 * plus meds (newline/comma list), label.
 */
type Emit = (e: Record<string, unknown>) => void;

export async function POST(req: Request) {
  const fd = await req.formData();
  const stream = new URL(req.url).searchParams.get("stream") === "1";
  if (!stream) {
    const r = await run(fd, () => {});
    return NextResponse.json(r.body, { status: r.status });
  }
  // NDJSON progress stream: one JSON event per line, last line is {type:"done"|"error"}.
  const enc = new TextEncoder();
  const body = new ReadableStream({
    async start(ctrl) {
      const emit: Emit = (e) => ctrl.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      const r = await run(fd, emit);
      emit(r.status === 200 ? { type: "done", ...r.body } : { type: "error", ...r.body });
      ctrl.close();
    },
  });
  return new Response(body, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store", "x-accel-buffering": "no" } });
}

async function run(fd: FormData, emit: Emit): Promise<{ status: number; body: Record<string, unknown> }> {
  const sample = String(fd.get("sample") ?? "");
  const medsRaw = String(fd.get("meds") ?? "");
  const label = String(fd.get("label") ?? "").slice(0, 80);
  let vcf = fd.get("vcf");
  let report = fd.get("report");
  if (/^[AB]$/.test(sample)) vcf = new File([await fs.readFile(path.resolve(`fixtures/oncology-patient-${sample}.vcf`))], `oncology-patient-${sample}.vcf`);
  if (sample === "lab") report = new File([await fs.readFile(path.resolve("fixtures/lab-report-demo.pdf"))], "lab-report-demo.pdf", { type: "application/pdf" });
  if (sample === "photo") report = new File([await fs.readFile(path.resolve("fixtures/lab-report-photo.jpg"))], "lab-report-photo.jpg", { type: "image/jpeg" });

  const hasVcf = vcf instanceof File && vcf.size > 0;
  const hasReport = report instanceof File && report.size > 0;
  if (!hasVcf && !hasReport) return { status: 400, body: { error: "upload a VCF or a lab report" } };
  const file = (hasVcf ? vcf : report) as File;
  if (file.size > MAX_BYTES) return { status: 413, body: { error: "file too large (25 MB max)" } };
  if (hasVcf && !/\.vcf(\.gz|\.bgz)?$/i.test(file.name)) return { status: 400, body: { error: "genotype file must be .vcf or .vcf.gz" } };
  if (!hasVcf && file.type !== "application/pdf" && !IMG.has(file.type)) return { status: 400, body: { error: "report must be PDF, PNG, JPEG or WebP" } };

  const meds = medsRaw.split(/[\n,;]+/).map((m) => m.trim().toLowerCase()).filter(Boolean).slice(0, 40);
  const id = newId();
  const dir = caseDir(id);
  await fs.mkdir(dir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await audit(id, "upload", { kind: hasVcf ? "vcf" : "report", bytes: file.size, meds: meds.length, label });
  emit({ type: "step", step: "upload", status: "done", detail: `${file.name} · ${Math.max(1, Math.round(file.size / 1024))} KB · ${meds.length} medications` });

  let t = Date.now();
  const lap = () => { const ms = Date.now() - t; t = Date.now(); return ms; };
  try {
    let reportPath: string;
    let extract: LabExtract | null = null;
    if (hasVcf) {
      const vcfName = "input" + (file.name.match(/\.vcf(\.gz|\.bgz)?$/i)?.[0] ?? ".vcf").toLowerCase();
      await fs.writeFile(path.join(dir, vcfName), buf);
      emit({ type: "step", step: "pharmcat", status: "active", detail: "Matching VCF positions to PharmVar haplotypes" });
      reportPath = await runPharmcat(dir, { vcf: vcfName });
    } else {
      await fs.writeFile(path.join(dir, "report" + (file.type === "application/pdf" ? ".pdf" : ".img")), buf);
      emit({ type: "step", step: "extract", status: "active", detail: `Muse Spark is reading the ${file.type === "application/pdf" ? "PDF" : "photo"}` });
      extract = await extractLabReport(buf, file.type, file.name);
      await writeJson(id, "extract.json", extract);
      await audit(id, "muse.extract.ok", { genes: extract.genes.length, lab: extract.labName });
      emit({ type: "step", step: "extract", status: "done", ms: lap(), detail: extract.labName, genes: extract.genes.map((g) => ({ gene: g.gene, call: g.diplotype || g.phenotype, verbatim: g.verbatim })) });
      const tsv = toOutsideCalls(extract);
      if (!tsv.trim()) throw new Error("No gene results could be read from the report");
      await fs.writeFile(path.join(dir, "outside.tsv"), tsv);
      emit({ type: "step", step: "pharmcat", status: "active", detail: "Assigning phenotypes and attaching CPIC / DPWG / FDA text" });
      reportPath = await runPharmcat(dir, { outsideCalls: "outside.tsv" });
    }
    const profile = await loadProfile(reportPath);
    const lens = indiaLens(profile, { meds, panelNotes: extract?.methodNotes });
    await writeJson(id, "case.json", { id, label, meds, source: hasVcf ? "vcf" : "report", createdAt: new Date().toISOString(), status: "called" });
    await writeJson(id, "profile.json", profile);
    await writeJson(id, "lens.json", lens);
    await audit(id, "pharmcat.ok", { genesCalled: profile.genes.filter((g) => g.called).length, lens: lens.length });
    const called = profile.genes.filter((g) => g.called);
    emit({ type: "step", step: "pharmcat", status: "done", ms: lap(), detail: `PharmCAT ${profile.pharmcatVersion} · ${profile.drugs.length} guideline annotations`, phenotypes: called.map((g) => ({ gene: g.gene, diplotype: g.diplotype, phenotype: g.phenotype })) });
    emit({ type: "step", step: "lens", status: "done", ms: lap(), detail: lens.length ? `${lens.length} population-specific ${lens.length === 1 ? "rule" : "rules"} fired` : "No India-specific rule applies", notes: lens.map((n) => ({ gene: n.gene, title: n.title, level: n.level })) });
    if (process.env.MODEL_API_KEY) {
      emit({ type: "step", step: "report", status: "active", detail: `Ranking ${meds.length} medications against ${called.length} phenotypes, writing EN + Malayalam` });
      try {
        const ai = await generateReport(profile, meds, lens);
        await writeJson(id, "ai.json", ai);
        await audit(id, "muse.report.ok", { model: process.env.MUSE_MODEL ?? "muse-spark-1.3", meds: ai.medications.length });
        emit({ type: "step", step: "report", status: "done", ms: lap(), detail: ai.clinicianSummary.split(/(?<=\.)\s/)[0], meds: ai.medications.map((m) => ({ drug: m.drug, risk: m.risk })) });
      } catch (e) {
        await audit(id, "muse.report.fail", { msg: String(e).slice(0, 500) });
        emit({ type: "step", step: "report", status: "fail", ms: lap(), detail: "Narrative unavailable; deterministic results kept" });
      }
    }
    return { status: 200, body: { id } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await audit(id, "fail", { msg: msg.slice(0, 500) });
    return { status: 500, body: { error: "analysis failed", detail: msg.slice(0, 800) } };
  }
}
