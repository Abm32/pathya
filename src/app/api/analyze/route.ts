import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { runPharmcat, loadProfile } from "@/lib/pharmcat";
import { newId, caseDir, writeJson, audit } from "@/lib/store";
import { generateReport } from "@/lib/report-ai";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(req: Request) {
  const fd = await req.formData();
  const sample = String(fd.get("sample") ?? "");
  let vcf = fd.get("vcf");
  if (sample && /^[AB]$/.test(sample)) {
    const buf = await fs.readFile(path.resolve(`fixtures/oncology-patient-${sample}.vcf`));
    vcf = new File([buf], `oncology-patient-${sample}.vcf`);
  }
  const medsRaw = String(fd.get("meds") ?? "");
  const label = String(fd.get("label") ?? "").slice(0, 80);
  if (!(vcf instanceof File)) return NextResponse.json({ error: "vcf file required" }, { status: 400 });
  if (!/\.vcf(\.gz|\.bgz)?$/i.test(vcf.name)) return NextResponse.json({ error: "file must be .vcf or .vcf.gz" }, { status: 400 });
  if (vcf.size > MAX_BYTES) return NextResponse.json({ error: "file too large (25 MB max)" }, { status: 413 });

  const meds = medsRaw.split(/[\n,;]+/).map((m) => m.trim().toLowerCase()).filter(Boolean).slice(0, 40);
  const id = newId();
  const dir = caseDir(id);
  await fs.mkdir(dir, { recursive: true });
  const vcfName = "input" + (vcf.name.match(/\.vcf(\.gz|\.bgz)?$/i)?.[0] ?? ".vcf").toLowerCase();
  await fs.writeFile(path.join(dir, vcfName), Buffer.from(await vcf.arrayBuffer()));
  await audit(id, "upload", { bytes: vcf.size, meds: meds.length, label });

  try {
    const report = await runPharmcat(dir, vcfName);
    const profile = await loadProfile(report);
    await writeJson(id, "case.json", { id, label, meds, createdAt: new Date().toISOString(), status: "called" });
    await writeJson(id, "profile.json", profile);
    await audit(id, "pharmcat.ok", { genesCalled: profile.genes.filter((g) => g.called).length });
    if (process.env.MODEL_API_KEY) {
      try {
        const ai = await generateReport(profile, meds);
        await writeJson(id, "ai.json", ai);
        await audit(id, "muse.ok", { model: process.env.MUSE_MODEL ?? "muse-spark-1.3", meds: ai.medications.length });
      } catch (e) {
        await audit(id, "muse.fail", { msg: String(e).slice(0, 500) });
      }
    }
    return NextResponse.json({ id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await audit(id, "pharmcat.fail", { msg: msg.slice(0, 500) });
    return NextResponse.json({ error: "PharmCAT failed", detail: msg.slice(0, 800) }, { status: 500 });
  }
}
