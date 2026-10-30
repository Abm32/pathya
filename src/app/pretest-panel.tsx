"use client";
import { pretest } from "@/lib/pretest";

export const PRETEST_SAMPLES: { label: string; meds: string }[] = [
  { label: "CAPOX, colon", meds: "Xeloda 1000 mg/m² BD\noxaliplatin\nEmeset 8\nDexona 8 mg\nPan 40" },
  { label: "FOLFIRI, 2nd line", meds: "5-FU infusion\nirinotecan\nleucovorin\nEmeset 8\nContramal 50" },
  { label: "ALL maintenance", meds: "6-MP\nmethotrexate\nZofran\nOmez 20" },
  { label: "Lymphoma, high TLS risk", meds: "R-CHOP\nFasturtec\nallopurinol\nPan 40" },
  { label: "Breast, adjuvant", meds: "tamoxifen\nondansetron\ntramadol" },
];

/** Live result of the deterministic pre-test check. Recomputes on every keystroke; nothing leaves the browser. */
export function PretestResult({ meds }: { meds: string }) {
  const r = pretest(meds);
  if (!r.tests.length) {
    return <p className="rounded-xl border border-dashed p-4 text-sm text-muted">No drug on this list has a pharmacogenomic guideline. No gene test needed before cycle 1.</p>;
  }
  return (
    <div aria-live="polite" className="space-y-3">
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
    </div>
  );
}
