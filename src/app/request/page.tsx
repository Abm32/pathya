"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { pretest, type ModelMap } from "@/lib/pretest";
import { PATIENT_TEXT } from "../pretest-panel";
import { Mark } from "../logo";

/** Printable pharmacogenomic test request built from the regimen in the URL. Nothing is stored; no patient data is in the URL. */
function Request() {
  const q = useSearchParams();
  const meds = q.get("m") ?? "";
  let mapped: ModelMap = {};
  try { mapped = JSON.parse(q.get("x") ?? "{}"); } catch { /* ignore a malformed link */ }
  const r = pretest(meds, mapped);
  const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const field = "border-b border-dashed border-[var(--line-strong)] pb-1 pt-5 text-xs text-muted";

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 print:max-w-none print:p-0">
      <div className="mb-6 flex flex-wrap items-center gap-3 print:hidden">
        <button type="button" onClick={() => print()} className="btn btn-primary">Print or save as PDF</button>
        <span className="text-sm text-muted">Fill the patient fields by hand. Nothing here is stored.</span>
      </div>
      <article className="card p-8 print:border-0 print:p-0">
        <header className="flex items-start gap-4">
          <Mark size={40} />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Pharmacogenomic test request</h1>
            <p className="mt-1 text-sm text-muted">Before cycle 1 of chemotherapy · prepared with Pathya · {today}</p>
          </div>
        </header>

        <div className="mt-4 grid gap-x-8 sm:grid-cols-2 print:grid-cols-2">
          <p className={field}>Patient ID / hospital number</p>
          <p className={field}>Age / sex</p>
          <p className={field}>Diagnosis</p>
          <p className={field}>Planned start of cycle 1</p>
          <p className={field}>Ordering oncologist</p>
          <p className={field}>Signature</p>
        </div>

        <h2 className="mt-8 eyebrow">Tests requested</h2>
        {r.tests.length ? (
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs text-muted"><tr><th className="py-2 pr-3 font-medium">Gene</th><th className="py-2 pr-3 font-medium">Priority</th><th className="py-2 pr-3 font-medium">Because of</th><th className="py-2 font-medium">Guideline</th></tr></thead>
            <tbody className="divide-y divide-line border-t border-line">
              {r.tests.map((t) => (
                <tr key={t.gene} className="align-top">
                  <td className="num py-2.5 pr-3 font-semibold">{t.gene}</td>
                  <td className="py-2.5 pr-3">{t.tier === "before" ? "Before cycle 1" : "Useful"}</td>
                  <td className="py-2.5 pr-3">{t.drugs.map((d) => d.drug).join(", ")}</td>
                  <td className="py-2.5 text-muted">{[...new Set(t.drugs.map((d) => d.source))].join("; ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="mt-3 text-sm text-muted">No drug in this regimen matched a gene-drug guideline.</p>}
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Sample: EDTA whole blood for genotyping; G6PD is usually an enzyme-activity test. Confirm sample type, panel coverage and turnaround with the laboratory.
          A targeted panel may not include every Indian-relevant variant (for DPYD, ask for HapB3 / c.1236G&gt;A and c.85T&gt;C).
        </p>

        <h2 className="mt-8 eyebrow">Planned regimen</h2>
        <p className="num mt-2 whitespace-pre-line text-sm">{meds || "Not given"}</p>

        <h2 className="mt-8 eyebrow">For the patient</h2>
        <p className="mt-2 text-sm leading-relaxed">{PATIENT_TEXT.en}</p>
        <p className="ml mt-3 text-[15px] leading-8">{PATIENT_TEXT.ml}</p>

        <footer className="mt-8 border-t border-line pt-3 text-[11px] leading-relaxed text-muted">
          Decision support for qualified clinicians, not medical advice. Tests come from CPIC, DPWG and FDA-label gene-drug pairs. The treating oncologist decides what to order.
        </footer>
      </article>
    </main>
  );
}

export default function Page() {
  return <Suspense><Request /></Suspense>;
}
