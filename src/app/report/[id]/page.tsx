import Link from "next/link";
import { notFound } from "next/navigation";
import { readJson } from "@/lib/store";
import type { PgxProfile } from "@/lib/pharmcat";
import type { AiReport } from "@/lib/report-ai";
import type { LensNote } from "@/lib/india-lens";
import type { LabExtract } from "@/lib/pdf-extract";
import { ConfirmPanel, LatestCheck, PrintButton } from "./actions";

export const dynamic = "force-dynamic";

const RISK: Record<string, string> = {
  avoid: "bg-red-600 text-white",
  adjust: "bg-amber-500 text-black",
  caution: "bg-yellow-200 text-black",
  standard: "bg-green-100 text-green-900",
  unknown: "bg-neutral-200 text-neutral-700",
};
const ORDER = ["avoid", "adjust", "caution", "unknown", "standard"];

export default async function Report({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await readJson<{ label: string; meds: string[]; createdAt: string; source: string }>(id, "case.json").catch(() => null);
  if (!c) notFound();
  const profile = (await readJson<PgxProfile>(id, "profile.json"))!;
  const ai = await readJson<AiReport>(id, "ai.json");
  const lens = (await readJson<LensNote[]>(id, "lens.json")) ?? [];
  const extract = await readJson<LabExtract>(id, "extract.json");
  const confirmed = await readJson<{ clinician: string; at: string }>(id, "confirmation.json");
  const called = profile.genes.filter((g) => g.called);
  const uncalled = profile.genes.filter((g) => !g.called).map((g) => g.gene);
  const meds = ai ? [...ai.medications].sort((a, b) => ORDER.indexOf(a.risk) - ORDER.indexOf(b.risk)) : [];
  const medsLc = c.meds.map((m) => m.toLowerCase());
  const fallback = profile.drugs.filter((d) => (d.source === "CPIC" || d.source === "DPWG") && d.recommendation && !d.noChange && medsLc.some((m) => m.includes(d.drug) || d.drug.includes(m)));

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 print:py-0">
      <header className="flex flex-wrap items-center gap-3 border-b pb-4">
        <Link href="/" className="text-sm text-neutral-500 print:hidden">← New case</Link>
        <h1 className="text-2xl font-semibold">Case {c.label || id}</h1>
        <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs">{c.source === "vcf" ? "VCF" : "Lab report"}</span>
        <span className="ml-auto text-xs text-neutral-500">{new Date(c.createdAt).toLocaleString()} · PharmCAT {profile.pharmcatVersion} · CPIC data {profile.dataVersion}</span>
        <PrintButton />
      </header>

      {ai ? (
        <section className="mt-6 rounded-lg border-l-4 border-black bg-neutral-50 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Clinician summary</h2>
          <p className="mt-2 text-lg leading-snug">{ai.clinicianSummary}</p>
        </section>
      ) : (
        <p className="mt-6 rounded border border-dashed p-3 text-sm text-neutral-500">AI narrative unavailable (MODEL_API_KEY not set or the call failed). Deterministic PharmCAT results below.</p>
      )}

      <section className="mt-8">
        <h2 className="font-medium">Medications</h2>
        <div className="mt-3 divide-y rounded-lg border">
          {ai
            ? meds.map((m) => (
                <div key={m.drug + m.matchedInput} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${RISK[m.risk]}`}>{m.risk}</span>
                    <span className="font-medium">{m.drug}</span>
                    {m.matchedInput && m.matchedInput !== m.drug && <span className="text-xs text-neutral-500">from “{m.matchedInput}”</span>}
                    {!m.matchedInput && <span className="text-xs text-neutral-500">not on list, same pathway</span>}
                    <span className="ml-auto font-mono text-xs text-neutral-500">{m.genes.join(", ")}</span>
                  </div>
                  <p className="mt-1 font-medium">{m.headline}</p>
                  <p className="mt-1 text-sm text-neutral-800">{m.action}</p>
                  <p className="mt-1 text-xs text-neutral-500">{m.evidence}{m.citations.length ? ` · ${m.citations.join(", ")}` : ""}</p>
                </div>
              ))
            : fallback.map((d, i) => (
                <div key={i} className="p-4">
                  <div className="flex gap-2">
                    <span className="rounded bg-amber-500 px-2 py-0.5 text-xs font-semibold uppercase">actionable</span>
                    <span className="font-medium">{d.drug}</span>
                    <span className="ml-auto text-xs text-neutral-500">{d.genes.join(", ")} · {d.source} {d.classification}</span>
                  </div>
                  <p className="mt-1 text-sm">{d.recommendation}</p>
                </div>
              ))}
          {ai && ai.unmappedMedications.length > 0 && <p className="p-4 text-sm text-neutral-500">No pharmacogenomic guideline applies: {ai.unmappedMedications.join(", ")}</p>}
        </div>
      </section>

      {lens.length > 0 && (
        <section className="mt-8 space-y-2">
          <h2 className="font-medium">India lens <span className="ml-2 text-xs font-normal text-neutral-500">population-specific evidence, rule-based</span></h2>
          {lens.map((n, i) => (
            <div key={i} className={`rounded-lg border p-3 text-sm ${n.level === "warn" ? "border-amber-400 bg-amber-50" : "border-sky-300 bg-sky-50"}`}>
              <div className="font-medium">{n.gene}: {n.title}</div>
              <p className="mt-1">{n.body}</p>
              <p className="mt-1 text-xs text-neutral-600">{n.sources.join(" · ")}</p>
            </div>
          ))}
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-medium">Genotype</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          {called.map((g) => {
            const hot = !/normal|^no result/i.test(g.phenotype) && g.phenotype !== "";
            return (
              <div key={g.gene} className={`rounded border p-3 ${hot ? "border-amber-400 bg-amber-50" : ""}`}>
                <div className="flex items-baseline justify-between"><span className="text-sm font-semibold">{g.gene}</span><span className="text-[10px] uppercase text-neutral-400">{g.source === "OUTSIDE" ? "lab" : "vcf"}</span></div>
                <div className="truncate font-mono text-xs" title={g.diplotype}>{g.diplotype}</div>
                <div className="text-xs text-neutral-600">{g.phenotype}{g.activityScore ? ` · AS ${g.activityScore}` : ""}</div>
              </div>
            );
          })}
        </div>
        {uncalled.length > 0 && <p className="mt-2 text-xs text-neutral-500">Not tested / not called: {uncalled.join(", ")}</p>}
      </section>

      {extract && (
        <section className="mt-8 rounded-lg border p-4 text-sm">
          <h2 className="font-medium">Read from the lab report <span className="ml-2 text-xs font-normal text-neutral-500">Muse Spark, each call quoted verbatim</span></h2>
          <p className="mt-1 text-xs text-neutral-600">{extract.labName}{extract.reportDate ? ` · ${extract.reportDate}` : ""}{extract.methodNotes ? ` · ${extract.methodNotes}` : ""}</p>
          <ul className="mt-2 space-y-1">
            {extract.genes.map((g, i) => (
              <li key={i}><span className="font-mono">{g.gene} {g.diplotype || g.phenotype || g.activityScore}</span> <span className="text-neutral-500">“{g.verbatim}”</span></li>
            ))}
          </ul>
          {extract.warnings.length > 0 && <p className="mt-2 text-xs text-amber-700">{extract.warnings.join(" ")}</p>}
        </section>
      )}

      {ai && (
        <>
          <section className="mt-8 grid gap-4 md:grid-cols-2 print:break-before-page">
            <div className="rounded-lg border p-4">
              <h2 className="font-medium">For the patient (English)</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{ai.patient.en}</p>
            </div>
            <div className="rounded-lg border p-4">
              <h2 className="font-medium">രോഗിക്ക് (മലയാളം)</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{ai.patient.ml}</p>
            </div>
          </section>
          <section className="mt-6 text-xs text-neutral-500">
            <h2 className="font-medium text-neutral-700">Limitations</h2>
            <ul className="mt-1 list-disc pl-5">{ai.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>
          </section>
          <LatestCheck id={id} enabled={!!ai} />
          <ConfirmPanel id={id} drugs={meds.filter((m) => m.risk !== "standard" && m.risk !== "unknown").map((m) => ({ drug: m.drug, risk: m.risk }))} confirmed={confirmed} />
        </>
      )}
      <footer className="mt-10 border-t pt-3 text-xs text-neutral-500">
        Decision support, not medical advice. Dose text is CPIC / DPWG / FDA-label wording via PharmCAT; Muse Spark maps, ranks and explains. Audit log: <code>data/cases/{id}/audit.log</code>.
      </footer>
    </main>
  );
}
