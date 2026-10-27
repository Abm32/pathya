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
 *  - sample: "A" | "B" | "lab"             -> bundled fixtures
 * plus meds (newline/comma list), label.
 */
export async function POST(req: Request) {
  const fd = await req.formData();
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
  if (!hasVcf && !hasReport) return NextResponse.json({ error: "upload a VCF or a lab report" }, { status: 400 });
  const file = (hasVcf ? vcf : report) as File;
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "file too large (25 MB max)" }, { status: 413 });
  if (hasVcf && !/\.vcf(\.gz|\.bgz)?$/i.test(file.name)) return NextResponse.json({ error: "genotype file must be .vcf or .vcf.gz" }, { status: 400 });
  if (!hasVcf && file.type !== "application/pdf" && !IMG.has(file.type)) return NextResponse.json({ error: "report must be PDF, PNG, JPEG or WebP" }, { status: 400 });

  const meds = medsRaw.split(/[\n,;]+/).map((m) => m.trim().toLowerCase()).filter(Boolean).slice(0, 40);
  const id = newId();
  const dir = caseDir(id);
  await fs.mkdir(dir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await audit(id, "upload", { kind: hasVcf ? "vcf" : "report", bytes: file.size, meds: meds.length, label });

  try {
    let reportPath: string;
    let extract: LabExtract | null = null;
    if (hasVcf) {
      const vcfName = "input" + (file.name.match(/\.vcf(\.gz|\.bgz)?$/i)?.[0] ?? ".vcf").toLowerCase();
      await fs.writeFile(path.join(dir, vcfName), buf);
      reportPath = await runPharmcat(dir, { vcf: vcfName });
    } else {
      await fs.writeFile(path.join(dir, "report" + (file.type === "application/pdf" ? ".pdf" : ".img")), buf);
      extract = await extractLabReport(buf, file.type, file.name);
      await writeJson(id, "extract.json", extract);
      await audit(id, "muse.extract.ok", { genes: extract.genes.length, lab: extract.labName });
      const tsv = toOutsideCalls(extract);
      if (!tsv.trim()) throw new Error("No gene results could be read from the report");
      await fs.writeFile(path.join(dir, "outside.tsv"), tsv);
      reportPath = await runPharmcat(dir, { outsideCalls: "outside.tsv" });
    }
    const profile = await loadProfile(reportPath);
    const lens = indiaLens(profile, { meds, panelNotes: extract?.methodNotes });
    await writeJson(id, "case.json", { id, label, meds, source: hasVcf ? "vcf" : "report", createdAt: new Date().toISOString(), status: "called" });
    await writeJson(id, "profile.json", profile);
    await writeJson(id, "lens.json", lens);
    await audit(id, "pharmcat.ok", { genesCalled: profile.genes.filter((g) => g.called).length, lens: lens.length });
    if (process.env.MODEL_API_KEY) {
      try {
        const ai = await generateReport(profile, meds, lens);
        await writeJson(id, "ai.json", ai);
        await audit(id, "muse.report.ok", { model: process.env.MUSE_MODEL ?? "muse-spark-1.3", meds: ai.medications.length });
      } catch (e) {
        await audit(id, "muse.report.fail", { msg: String(e).slice(0, 500) });
      }
    }
    return NextResponse.json({ id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await audit(id, "fail", { msg: msg.slice(0, 500) });
    return NextResponse.json({ error: "analysis failed", detail: msg.slice(0, 800) }, { status: 500 });
  }
}
