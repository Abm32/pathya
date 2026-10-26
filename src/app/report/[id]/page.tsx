import { notFound } from "next/navigation";
import { readJson } from "@/lib/store";
import type { PgxProfile } from "@/lib/pharmcat";
import type { AiReport } from "@/lib/report-ai";

export const dynamic = "force-dynamic";

const RISK: Record<string, string> = {
  avoid: "bg-red-600 text-white",
  adjust: "bg-amber-500 text-black",
  caution: "bg-yellow-200 text-black",
  standard: "bg-green-100 text-green-900",
  unknown: "bg-neutral-200 text-neutral-700",
};

export default async function Report({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await readJson<{ label: string; meds: string[]; createdAt: string }>(id, "case.json").catch(() => null);
  if (!c) notFound();
  const profile = (await readJson<PgxProfile>(id, "profile.json"))!;
  const ai = await readJson<AiReport>(id, "ai.json");
  const called = profile.genes.filter((g) => g.called);
  // Deterministic fallback (no AI): only guideline drugs that match the entered medication list by name.
  const medsLc = c.meds.map((m) => m.toLowerCase());
  const actionable = profile.drugs.filter(
    (d) => (d.source === "CPIC" || d.source === "DPWG") && d.recommendation && !d.noChange && medsLc.some((m) => m.includes(d.drug) || d.drug.includes(m)),
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Case {c.label || id}</h1>
        <span className="text-xs text-neutral-500">PharmCAT {profile.pharmcatVersion} · data {profile.dataVersion}</span>
      </header>

      {ai ? (
        <section className="mt-6 rounded-lg border p-4">
          <h2 className="font-medium">Clinician summary <span className="ml-2 text-xs text-neutral-500">Muse Spark</span></h2>
          <p className="mt-2">{ai.clinicianSummary}</p>
        </section>
      ) : (
        <p className="mt-6 rounded border border-dashed p-3 text-sm text-neutral-500">AI narrative unavailable (MODEL_API_KEY not set or call failed). Deterministic PharmCAT results below.</p>
      )}

      <section className="mt-8">
        <h2 className="font-medium">Medications</h2>
        <div className="mt-3 divide-y rounded-lg border">
          {ai
            ? ai.medications.map((m) => (
                <div key={m.drug + m.matchedInput} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${RISK[m.risk]}`}>{m.risk}</span>
                    <span className="font-medium">{m.drug}</span>
                    {m.matchedInput && m.matchedInput !== m.drug && <span className="text-xs text-neutral-500">from “{m.matchedInput}”</span>}
                    <span className="ml-auto text-xs text-neutral-500">{m.genes.join(", ")}</span>
                  </div>
                  <p className="mt-1">{m.headline}</p>
                  <p className="mt-1 text-sm text-neutral-700">{m.action}</p>
                  <p className="mt-1 text-xs text-neutral-500">{m.evidence} · {m.citations.join(", ")}</p>
                </div>
              ))
            : actionable.map((d, i) => (
                <div key={i} className="p-4">
                  <div className="flex gap-2">
                    <span className="rounded bg-amber-500 px-2 py-0.5 text-xs font-semibold uppercase">actionable</span>
                    <span className="font-medium">{d.drug}</span>
                    <span className="ml-auto text-xs text-neutral-500">{d.genes.join(", ")} · {d.source} {d.classification}</span>
                  </div>
                  <p className="mt-1 text-sm">{d.recommendation}</p>
                </div>
              ))}
          {ai && ai.unmappedMedications.length > 0 && (
            <p className="p-4 text-sm text-neutral-500">No pharmacogenomic guideline for: {ai.unmappedMedications.join(", ")}</p>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-medium">Genotype</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          {called.map((g) => {
            const hot = /poor|intermediate|rapid|ultrarapid|decreased|increased|positive/i.test(g.phenotype) && !/normal/i.test(g.phenotype);
            return (
              <div key={g.gene} className={`rounded border p-3 ${hot ? "border-amber-400 bg-amber-50" : ""}`}>
                <div className="text-sm font-semibold">{g.gene}</div>
                <div className="font-mono text-xs">{g.diplotype}</div>
                <div className="text-xs text-neutral-600">{g.phenotype}{g.activityScore ? ` · AS ${g.activityScore}` : ""}</div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-neutral-500">Not called from this VCF: {profile.genes.filter((g) => !g.called).map((g) => g.gene).join(", ")}</p>
      </section>

      {ai && (
        <>
          <section className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border p-4">
              <h2 className="font-medium">For the patient (English)</h2>
              <p className="mt-2 whitespace-pre-line text-sm">{ai.patient.en}</p>
            </div>
            <div className="rounded-lg border p-4">
              <h2 className="font-medium">രോഗിക്ക് (മലയാളം)</h2>
              <p className="mt-2 whitespace-pre-line text-sm">{ai.patient.ml}</p>
            </div>
          </section>
          <section className="mt-8 text-xs text-neutral-500">
            <h2 className="font-medium text-neutral-700">Limitations</h2>
            <ul className="mt-1 list-disc pl-5">{ai.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>
          </section>
        </>
      )}
    </main>
  );
}
