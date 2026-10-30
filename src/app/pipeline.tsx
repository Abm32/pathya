"use client";
import { useEffect, useRef, useState } from "react";
import type { StepEvent } from "./run-log";

type Node = { key: StepEvent["step"] | "record" | "curator"; title: string; sub: string; who: string; meta: boolean };
const NODES: Node[] = [
  { key: "upload", title: "Report in", sub: "PDF, WhatsApp photo, voice or VCF", who: "Input", meta: false },
  { key: "extract", title: "Read every call", sub: "verbatim quotes, strict schema", who: "Muse Spark", meta: true },
  { key: "pharmcat", title: "Standardise", sub: "PharmVar alleles, CPIC phenotype terms", who: "PharmCAT", meta: false },
  { key: "quality", title: "Quality checks", sub: "India panel coverage, identifier removed", who: "Rules", meta: false },
  { key: "record", title: "Research record", sub: "JSON · TSV · CSV, joins the cohort", who: "Output", meta: false },
  { key: "curator", title: "Curator verifies", sub: "each call against the source", who: "Human", meta: false },
];

/** Hero diagram. Idle: cycles to show the flow. Running: mirrors real server events. */
export function Pipeline({ steps }: { steps: StepEvent[] }) {
  const [demo, setDemo] = useState(0);
  const running = steps.length > 0;
  useEffect(() => {
    if (running) return;
    const t = setInterval(() => setDemo((d) => (d + 1) % NODES.length), 1300);
    return () => clearInterval(t);
  }, [running]);

  const t0 = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) return;
    t0.current = Date.now();
    const t = setInterval(() => setElapsed(Date.now() - t0.current), 100);
    return () => clearInterval(t);
  }, [running]);
  const state = new Map<string, string>();
  const live = new Map<string, string>();
  for (const s of steps) { state.set(s.step, s.status); const t = liveText(s); if (t) live.set(s.step, t); }
  
  if (running && steps.some((s) => s.step === "quality" && s.status === "done")) { state.set("record", "done"); state.set("curator", "active"); }

  return (
    <div className="card spot relative overflow-hidden p-5">
      {running && <div className="scan" aria-hidden />}
      <div className="mb-4 flex items-center gap-2">
        <span className="live-dot" aria-hidden />
        <span className="eyebrow">{running ? "Live pipeline" : "Pipeline"}</span>
        {running
          ? <span className="num ml-auto text-sm text-accent">{(elapsed / 1000).toFixed(1)} s</span>
          : <span className="num ml-auto hidden text-[11px] text-muted sm:inline">verifiable core · model reads only</span>}
      </div>
      <ol className="relative space-y-2.5">
        {NODES.map((n, i) => {
          const st = running ? state.get(n.key) ?? "idle" : i === demo ? "active" : i < demo ? "done" : "idle";
          return (
            <li key={n.key} className="relative">
              {i > 0 && (
                <svg aria-hidden className="absolute -top-2.5 left-[19px] h-2.5 w-1" viewBox="0 0 2 10" preserveAspectRatio="none">
                  <line x1="1" y1="0" x2="1" y2="10" className={st === "idle" ? "flow-line" : "flow-pulse"} />
                </svg>
              )}
              <div data-state={st} className="node flex items-center gap-3 rounded-xl border border-line bg-[rgba(255,255,255,0.02)] px-3 py-2.5">
                <span className={`grid size-[26px] flex-none place-items-center rounded-lg border text-[11px] font-semibold num ${st === "idle" ? "border-line text-muted" : "border-accent text-accent"}`}>
                  {st === "done" ? "✓" : i + 1}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium leading-tight">{n.title}</div>
                  <div key={live.get(n.key) ?? n.sub} className={`truncate text-xs ${running && live.get(n.key) ? "reveal text-accent" : "text-muted"}`}>{(running && live.get(n.key)) || n.sub}</div>
                </div>
                <span className={`badge ml-auto ${n.meta ? "badge-meta" : "badge-det"}`}>{n.who}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Short, concrete status line for each node while a run is live. */
function liveText(s: StepEvent): string | undefined {
  if (s.step === "extract" && s.genes) return `${s.genes.length} gene calls read, each quoted verbatim`;
  if (s.step === "pharmcat" && s.phenotypes) {
    const flagged = s.phenotypes.filter((p) => !/normal/i.test(p.phenotype)).length;
    return `${s.phenotypes.length} genes standardised · ${flagged} non-reference`;
  }
  if (s.step === "quality" && s.notes) return s.notes.length ? `${s.notes.length} India-relevant ${s.notes.length === 1 ? "variant" : "variants"} not stated as tested` : "panel covers the India-relevant variants";
  return s.detail;
}
