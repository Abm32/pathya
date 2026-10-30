"use client";
import { useState } from "react";
import { pretest, unmatched, type ModelMap } from "@/lib/pretest";

export const PRETEST_SAMPLES: { label: string; meds: string }[] = [
  { label: "CAPOX, colon", meds: "Xeloda 1000 mg/m² BD\noxaliplatin\nEmeset 8\nDexona 8 mg\nPan 40" },
  { label: "FOLFIRI, 2nd line", meds: "5-FU infusion\nirinotecan\nleucovorin\nEmeset 8\nContramal 50" },
  { label: "ALL maintenance", meds: "6-MP\nmethotrexate\nZofran\nOmez 20" },
  { label: "Lymphoma, high TLS risk", meds: "R-CHOP\nFasturtec\nallopurinol\nPan 40" },
  { label: "Brands the table lacks", meds: "Tab. capcitabin 500 bd\nInj. Camptosar 100\nOndansetron MD 4\nT. Rabicip 20" },
];

/** What the oncologist tells the patient about the test. Malayalam reviewed by a native speaker before clinical use. */
export const PATIENT_TEXT = {
  en: "Before your chemotherapy starts, your doctor is asking for a blood test that looks at a few of your genes. Some people's bodies clear certain cancer medicines slowly, and a standard dose can then cause serious side effects. With this result your doctor can choose a safe starting dose for you. The result usually takes 7 to 10 days, so the sample is taken now.",
  ml: "കീമോതെറാപ്പി തുടങ്ങുന്നതിന് മുമ്പ്, നിങ്ങളുടെ ചില ജീനുകൾ പരിശോധിക്കുന്ന ഒരു രക്തപരിശോധന ഡോക്ടർ നിർദ്ദേശിക്കുന്നു. ചിലരുടെ ശരീരം ചില കാൻസർ മരുന്നുകൾ സാവധാനം മാത്രമേ പുറന്തള്ളൂ; അവർക്ക് സാധാരണ ഡോസ് ഗുരുതരമായ പാർശ്വഫലങ്ങൾ ഉണ്ടാക്കാം. ഈ ഫലം അറിഞ്ഞാൽ, നിങ്ങൾക്ക് സുരക്ഷിതമായ തുടക്ക ഡോസ് ഡോക്ടർക്ക് തീരുമാനിക്കാം. ഫലം ലഭിക്കാൻ സാധാരണയായി 7 മുതൽ 10 ദിവസം വരെ എടുക്കും, അതിനാലാണ് ഇപ്പോൾ തന്നെ സാമ്പിൾ എടുക്കുന്നത്.",
};

export const requestHref = (meds: string, mapped: ModelMap) => {
  const used = Object.fromEntries(Object.entries(mapped).filter(([k]) => meds.includes(k)));
  return `/request?m=${encodeURIComponent(meds)}${Object.keys(used).length ? `&x=${encodeURIComponent(JSON.stringify(used))}` : ""}`;
};

/**
 * Live result of the pre-test check. The table decides every test, instantly and in the browser.
 * Lines it cannot match can be sent to Muse Spark, which only names the drug; the table then decides again.
 */
export function PretestResult({ meds }: { meds: string }) {
  const [mapped, setMapped] = useState<ModelMap>({});
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const r = pretest(meds, mapped);
  const pending = unmatched(meds).filter((l) => !(l in mapped));

  async function ask() {
    setAsking(true); setNote(null);
    const res = await fetch("/api/pretest-map", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ regimen: pending.join("\n") }) }).catch(() => null);
    setAsking(false);
    if (!res) return setNote("Network error. Try again.");
    if (res.status === 401) return setNote("Asking Muse Spark needs the pilot access code. The table result above needs none.");
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return setNote(j.error ?? "Muse Spark could not name these drugs.");
    setMapped((m) => ({ ...m, ...Object.fromEntries(pending.map((l) => [l, j.mapped?.[l] ?? []])) }));
  }

  return (
    <div aria-live="polite" className="space-y-3">
      {pending.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[rgba(124,138,255,0.35)] bg-[rgba(124,138,255,0.07)] p-3.5 text-sm">
          <span className="min-w-0 flex-1">
            <span className="font-medium">{pending.length} {pending.length === 1 ? "line is" : "lines are"} not in the table:</span>{" "}
            <span className="text-muted">{pending.join(", ")}</span>
          </span>
          <button type="button" onClick={ask} disabled={asking} className="btn btn-ghost btn-sm">
            <span className="badge badge-meta">Muse Spark</span>{asking ? "Naming…" : "Name these drugs"}
          </button>
          {note && <p className="w-full text-xs text-warn">{note}</p>}
        </div>
      )}
      {!r.tests.length && !pending.length && (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted">Nothing on this list matches a gene-drug guideline in Pathya&apos;s table. A drug missing from the table is not proof that no test is needed.</p>
      )}
      {r.tests.map((t, i) => (
        <div key={t.gene} className={`reveal rounded-xl border p-4 ${t.tier === "before" ? "pre-before" : "border-line bg-[rgba(255,255,255,0.02)]"}`} style={{ animationDelay: `${i * 60}ms` }}>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`risk ${t.tier === "before" ? "risk-adjust" : "risk-standard"}`}>{t.tier === "before" ? "Order before cycle 1" : "Useful, not urgent"}</span>
            <span className="num text-lg font-semibold">{t.gene}</span>
          </div>
          <ul className="mt-2.5 space-y-2 text-sm">
            {t.drugs.map((d) => (
              <li key={d.drug}>
                <span className="font-medium">{d.drug}</span>
                {d.input.toLowerCase() !== d.drug && <span className="text-muted"> from &ldquo;{d.input}&rdquo;</span>}
                {d.viaModel && <span className="badge badge-meta ml-2">named by Muse Spark</span>}
                <span className="text-muted"> · {d.source}</span>
                <p className="mt-0.5 text-foreground/75">{d.why}</p>
              </li>
            ))}
          </ul>
          {t.gene === "DPYD" && (
            <p className="mt-3 border-t border-line pt-3 text-xs text-muted">
              Indian labs list DPYD panels at ₹7,000 to ₹17,000 with a 7 to 10 day turnaround, so order at diagnosis to have the result before cycle 1.
            </p>
          )}
        </div>
      ))}
      {r.noGuideline.length > 0 && <p className="px-1 text-xs text-muted">No gene guideline: {r.noGuideline.join(", ")}</p>}
      {r.tests.length > 0 && (
        <>
          <details className="ev rounded-xl border border-line p-4 text-sm">
            <summary className="flex items-center gap-1.5 font-medium"><span className="ev-caret" aria-hidden>›</span> What to tell the patient</summary>
            <p className="mt-3 leading-relaxed text-foreground/80">{PATIENT_TEXT.en}</p>
            <p className="ml mt-3 leading-8 text-foreground/90">{PATIENT_TEXT.ml}</p>
          </details>
          <a href={requestHref(meds, mapped)} target="_blank" rel="noreferrer" className="btn btn-primary w-full sm:w-auto">Print the test request</a>
        </>
      )}
    </div>
  );
}
