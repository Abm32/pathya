import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { runPharmcat, loadProfile } from "@/lib/pharmcat";
import { newId, caseDir, writeJson, audit } from "@/lib/store";
import { extractFromText, extractLabReport, toOutsideCalls, type LabExtract } from "@/lib/pdf-extract";
import { deidentify, quality } from "@/lib/quality";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BYTES = 25 * 1024 * 1024;
const IMG = new Set(["image/png", "image/jpeg", "image/webp"]);

/**
 * Turns one pharmacogenomic result into a de-identified research record. POST multipart, one of:
 *  - report: lab PDF or image          -> Muse Spark reads it -> PharmCAT standardises the calls
 *  - transcript: results read aloud    -> Muse Spark reads the text -> PharmCAT
 *  - vcf: .vcf/.vcf.gz (GRCh38)        -> PharmCAT
 *  - sample: "A" | "B" | "lab" | "photo" -> bundled synthetic fixtures
 * plus label and cohort. ?stream=1 returns NDJSON step events instead of one JSON body.
 * Research tool: no dose, drug or test recommendation is produced or stored.
 */
type Emit = (e: Record<string, unknown>) => void;

export async function POST(req: Request) {
  const fd = await req.formData();
  const stream = new URL(req.url).searchParams.get("stream") === "1";
  if (!stream) {
    const r = await run(fd, () => {});
    return NextResponse.json(r.body, { status: r.status });
  }
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

const SAMPLE_LABELS: Record<string, string> = { A: "Sample A · VCF", B: "Sample B · VCF", lab: "Sample · Indian panel PDF", photo: "Sample · WhatsApp photo" };

async function run(fd: FormData, emit: Emit): Promise<{ status: number; body: Record<string, unknown> }> {
  const sample = String(fd.get("sample") ?? "");
  const label = String(fd.get("label") ?? "").slice(0, 80) || (SAMPLE_LABELS[sample] ?? "");
  const cohort = String(fd.get("cohort") ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
  const transcript = String(fd.get("transcript") ?? "").trim().slice(0, 8000);
  let vcf = fd.get("vcf");
  let report = fd.get("report");
  if (/^[AB]$/.test(sample)) vcf = new File([await fs.readFile(path.resolve(`fixtures/oncology-patient-${sample}.vcf`))], `oncology-patient-${sample}.vcf`);
  if (sample === "lab") report = new File([await fs.readFile(path.resolve("fixtures/lab-report-demo.pdf"))], "lab-report-demo.pdf", { type: "application/pdf" });
  if (sample === "photo") report = new File([await fs.readFile(path.resolve("fixtures/lab-report-photo.jpg"))], "lab-report-photo.jpg", { type: "image/jpeg" });

  const hasVcf = vcf instanceof File && vcf.size > 0;
  const hasReport = report instanceof File && report.size > 0;
  if (!hasVcf && !hasReport && !transcript) return { status: 400, body: { error: "upload a lab report or VCF, or dictate the results" } };
  const file = hasVcf ? (vcf as File) : hasReport ? (report as File) : null;
  if (file && file.size > MAX_BYTES) return { status: 413, body: { error: "file too large (25 MB max)" } };
  if (hasVcf && !/\.vcf(\.gz|\.bgz)?$/i.test(file!.name)) return { status: 400, body: { error: "genotype file must be .vcf or .vcf.gz" } };
  if (hasReport && !hasVcf && file!.type !== "application/pdf" && !IMG.has(file!.type)) return { status: 400, body: { error: "report must be PDF, PNG, JPEG or WebP" } };

  const source = hasVcf ? "vcf" : hasReport ? "report" : "dictation";
  const id = newId();
  const dir = caseDir(id);
  await fs.mkdir(dir, { recursive: true });
  await audit(id, "upload", { kind: source, bytes: file?.size ?? transcript.length, label, cohort });
  emit({ type: "step", step: "upload", status: "done", detail: file ? `${file.name} · ${Math.max(1, Math.round(file.size / 1024))} KB` : `Dictated results · ${transcript.split(/\s+/).length} words` });

  let t = Date.now();
  const lap = () => { const ms = Date.now() - t; t = Date.now(); return ms; };
  try {
    let reportPath: string;
    let extract: LabExtract | null = null;
    if (hasVcf) {
      const vcfName = "input" + (file!.name.match(/\.vcf(\.gz|\.bgz)?$/i)?.[0] ?? ".vcf").toLowerCase();
      await fs.writeFile(path.join(dir, vcfName), Buffer.from(await file!.arrayBuffer()));
      emit({ type: "step", step: "pharmcat", status: "active", detail: "Matching VCF positions to PharmVar haplotypes" });
      reportPath = await runPharmcat(dir, { vcf: vcfName });
    } else {
      if (file) {
        const buf = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(path.join(dir, "report" + (file.type === "application/pdf" ? ".pdf" : ".img")), buf);
        emit({ type: "step", step: "extract", status: "active", detail: `Muse Spark is reading the ${file.type === "application/pdf" ? "PDF" : "photo"}` });
        extract = await extractLabReport(buf, file.type, file.name);
      } else {
        await fs.writeFile(path.join(dir, "transcript.txt"), transcript);
        emit({ type: "step", step: "extract", status: "active", detail: "Muse Spark is reading the dictated results" });
        extract = await extractFromText(transcript);
      }
      await audit(id, "muse.extract.ok", { genes: extract.genes.length, lab: extract.labName });
      emit({ type: "step", step: "extract", status: "done", ms: lap(), detail: extract.labName || "Results read", genes: extract.genes.map((g) => ({ gene: g.gene, call: g.diplotype || g.phenotype, verbatim: g.verbatim })) });
      const tsv = toOutsideCalls(extract);
      if (!tsv.trim()) throw new Error("No gene results could be read");
      await fs.writeFile(path.join(dir, "outside.tsv"), tsv);
      emit({ type: "step", step: "pharmcat", status: "active", detail: "Standardising allele names and phenotype terms with PharmCAT" });
      reportPath = await runPharmcat(dir, { outsideCalls: "outside.tsv" });
    }
    const profile = await loadProfile(reportPath);
    const called = profile.genes.filter((g) => g.called);
    emit({ type: "step", step: "pharmcat", status: "done", ms: lap(), detail: `PharmCAT ${profile.pharmcatVersion} · ${called.length} genes standardised`, phenotypes: called.map((g) => ({ gene: g.gene, diplotype: g.diplotype, phenotype: g.phenotype })) });

    const q = quality(extract, profile);
    if (extract) await writeJson(id, "extract.json", deidentify(extract));
    // Only the standardised calls are kept; PharmCAT's guideline annotations are not part of a research record.
    await writeJson(id, "profile.json", { ...profile, drugs: [], genes: profile.genes.map((g) => ({ ...g, relatedDrugs: [] })) });
    await writeJson(id, "quality.json", q);
    await writeJson(id, "case.json", { id, label, cohort, source, createdAt: new Date().toISOString() });
    const gaps = q.coverage.filter((c) => !c.stated);
    await audit(id, "record.ok", { genesCalled: called.length, coverageGaps: gaps.length, identifierRemoved: q.identifierRemoved });
    emit({
      type: "step", step: "quality", status: "done", ms: lap(),
      detail: `${gaps.length ? `${gaps.length} India-relevant ${gaps.length === 1 ? "variant" : "variants"} not stated as tested` : "Panel covers the India-relevant variants"}${q.identifierRemoved ? " · identifier removed" : ""}`,
      notes: gaps.map((g) => ({ gene: g.gene, title: `${g.variant} not stated as tested`, level: "info" })),
    });
    return { status: 200, body: { id } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await audit(id, "fail", { msg: msg.slice(0, 500) });
    return { status: 500, body: { error: "could not build the record", detail: msg.slice(0, 800) } };
  }
}
