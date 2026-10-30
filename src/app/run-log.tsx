"use client";
import { useEffect, useState } from "react";

export type StepEvent = {
  type: "step";
  step: "upload" | "extract" | "pharmcat" | "quality";
  status: "active" | "done" | "fail";
  ms?: number;
  at?: number; // client arrival time, for live timers
  detail?: string;
  genes?: { gene: string; call: string; verbatim: string }[];
  phenotypes?: { gene: string; diplotype: string; phenotype: string }[];
  notes?: { gene: string; title: string; level: string }[];
};

const META: Record<StepEvent["step"], { title: string; badge: string; kind: "meta" | "det" }> = {
  upload: { title: "Received", badge: "Pathya", kind: "det" },
  extract: { title: "Reading report", badge: "Muse Spark", kind: "meta" },
  pharmcat: { title: "Standardised", badge: "PharmCAT", kind: "det" },
  quality: { title: "Quality checks", badge: "rules", kind: "det" },
};

/** Live pipeline trace: one row per real server event, results revealed as they land. */
export function RunLog({ steps, onDone }: { steps: StepEvent[]; onDone?: boolean }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);


  const rows = new Map<string, StepEvent>();
  for (const s of steps) rows.set(s.step, { ...rows.get(s.step), ...s });

  return (
    <ol aria-live="polite" className="card divide-y divide-line overflow-hidden">
      {[...rows.values()].map((s) => {
        const m = META[s.step];
        const active = s.status === "active";
        const secs = active ? Math.max(0, now - (s.at ?? now)) / 1000 : (s.ms ?? 0) / 1000;
        return (
          <li key={s.step} className={`run-row p-3.5 ${active ? "run-active" : ""}`}>
            <div className="flex items-center gap-2.5">
              <span aria-hidden className={`run-dot ${s.status}`} />
              <span className="text-sm font-medium">{m.title}</span>
              <span className={`badge ${m.kind === "meta" ? "badge-meta" : "badge-det"}`}>{m.badge}</span>
              {(active || s.ms !== undefined) && <span className="num ml-auto whitespace-nowrap text-xs text-muted">{secs.toFixed(1)} s</span>}
            </div>
            {s.detail && <p className="mt-1 pl-5 text-xs text-muted">{s.detail}</p>}
            {s.genes && (
              <ul className="mt-2 space-y-1 pl-5">
                {s.genes.map((g, i) => (
                  <li key={g.gene} className="reveal text-xs" style={{ animationDelay: `${i * 70}ms` }}>
                    <span className="num font-medium text-foreground">{g.gene} {g.call}</span>{" "}
                    <span className="text-muted">“{g.verbatim.length > 90 ? g.verbatim.slice(0, 90) + "…" : g.verbatim}”</span>
                  </li>
                ))}
              </ul>
            )}
            {s.phenotypes && (
              <div className="mt-2 flex flex-wrap gap-1.5 pl-5">
                {s.phenotypes.map((p, i) => (
                  <span key={p.gene} className={`reveal rounded-md border px-2 py-0.5 text-xs ${/normal/i.test(p.phenotype) ? "" : "note-warn"}`} style={{ animationDelay: `${i * 60}ms` }}>
                    <b>{p.gene}</b> <span className="text-muted">{p.phenotype.replace(/ Metabolizer$/i, " met.")}</span>
                  </span>
                ))}
              </div>
            )}
            {s.notes && s.notes.length > 0 && (
              <ul className="mt-2 space-y-1 pl-5 text-xs">
                {s.notes.map((n, i) => <li key={i} className="reveal" style={{ animationDelay: `${i * 80}ms` }}><b>{n.gene}</b> {n.title}</li>)}
              </ul>
            )}
          </li>
        );
      })}
      {onDone && <li className="reveal p-3.5 text-sm font-medium text-accent">Record ready. Opening…</li>}
    </ol>
  );
}
