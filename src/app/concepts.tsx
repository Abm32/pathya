"use client";
import { useEffect, useRef, useState } from "react";

/* Teaching models for the home page. Illustrative only, never used for dosing. */

const COL = { teal: "#2ee6c8", violet: "#9aa6ff", amber: "#ffb547", red: "#ff6464", green: "#5fe39a", pink: "#ff8fb0", muted: "#8b979c", dim: "rgba(255,255,255,0.13)" };
const reduced = () => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function useCanvas(height: number | (() => number)) {
  const ref = useRef<HTMLCanvasElement>(null);
  const size = useRef({ w: 0, h: 0, ctx: null as CanvasRenderingContext2D | null });
  useEffect(() => {
    const cv = ref.current!;
    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = cv.clientWidth, h = typeof height === "function" ? height() : height;
      cv.width = w * dpr; cv.height = h * dpr; cv.style.height = `${h}px`;
      const ctx = cv.getContext("2d")!; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      size.current = { w, h, ctx };
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(cv);
    return () => ro.disconnect();
  }, [height]);
  return { ref, size };
}

function Seg<T extends string | number>({ label, value, options, onChange, stack }: { label: string; value: T; options: { v: T; t: string }[]; onChange: (v: T) => void; stack?: boolean }) {
  return (
    <div className="grid gap-2">
      <span className="eyebrow">{label}</span>
      <div role="group" aria-label={label} className={`seg ${stack ? "seg-stack" : ""}`}>
        {options.map((o) => <button key={String(o.v)} type="button" aria-pressed={value === o.v} onClick={() => onChange(o.v)}>{o.t}</button>)}
      </div>
    </div>
  );
}

function Verdict({ tone, big, what, why }: { tone: "ok" | "warn" | "bad"; big: string; what: string; why: string }) {
  return (
    <div className="verdict" data-tone={tone} aria-live="polite">
      <div className="display text-[30px]">{big}</div>
      <div className="mt-1.5 font-semibold">{what}</div>
      <div className="mt-1.5 text-[13px] text-muted">{why}</div>
    </div>
  );
}

/* 2. 1,000 Indian patients */
type Kind = "hapb3" | "2a" | "rare" | "c85" | "none";
const KINDS: Kind[] = (() => {
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const k: Kind[] = Array(1000).fill("none");
  const put = (kind: Kind, n: number) => { let p = 0; while (p < n) { const i = Math.floor(rnd() * 1000); if (k[i] === "none") { k[i] = kind; p++; } } };
  put("hapb3", 33); put("2a", 2); put("rare", 21); put("c85", 250);
  return k;
})();
const KCOL: Record<Kind, string> = { hapb3: COL.red, "2a": COL.amber, rare: COL.pink, c85: COL.violet, none: COL.dim };
type PopMode = "all" | "cpic" | "lens";
const cols = () => (typeof window !== "undefined" && window.innerWidth < 640 ? 25 : 40);
function popHeight() {
  const el = document.getElementById("pop-wrap");
  const w = el ? el.clientWidth : 700, c = cols();
  return Math.round(52 + Math.ceil(1000 / c) * Math.min(20, (w - 28) / c) + 14);
}

export function Population() {
  const [mode, setMode] = useState<PopMode>("all");
  const live = useRef({ mode: "all" as PopMode, at: 0 });
  useEffect(() => { live.current = { mode, at: performance.now() }; }, [mode]);
  const { ref, size } = useCanvas(popHeight);

  useEffect(() => {
    let raf = 0;
    const tval = new Float32Array(1000);
    const still = reduced();
    const frame = (t: number) => {
      const { ctx, w } = size.current; if (!ctx) { raf = requestAnimationFrame(frame); return; }
      const { mode: m, at } = live.current;
      const c = cols(), gap = Math.min(20, (w - 28) / c), r = gap * 0.32, left = (w - gap * c) / 2 + gap / 2, top = 52;
      ctx.clearRect(0, 0, w, size.current.h);
      const since = (t - at) / 1000;
      for (let i = 0; i < 1000; i++) {
        const k = KINDS[i];
        const on = m === "all" ? k !== "none" : m === "cpic" ? k === "hapb3" || k === "2a" : k !== "none";
        const delay = still ? 0 : ((i % c) + Math.floor(i / c)) * 0.006;
        if (still || since > delay) tval[i] += ((on ? 1 : 0) - tval[i]) * (still ? 1 : 0.18);
        const x = left + (i % c) * gap, y = top + Math.floor(i / c) * gap + gap / 2;
        ctx.globalAlpha = 1; ctx.fillStyle = COL.dim; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        if (tval[i] > 0.02) {
          ctx.globalAlpha = tval[i]; ctx.fillStyle = KCOL[k];
          ctx.beginPath(); ctx.arc(x, y, r * (0.8 + 0.25 * tval[i]), 0, Math.PI * 2); ctx.fill();
          if (m === "lens" && k === "c85") { ctx.strokeStyle = COL.teal; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(x, y, r * 1.55 + Math.sin(t / 300 + i) * 0.6, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1; }
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [size]);

  const V: Record<PopMode, [("ok" | "warn"), string, string, string, string]> = {
    all: ["warn", "~5.6%", "carry a decreased-function DPYD variant", "And about one in four carry c.85T>C, a variant whose effect CPIC and South Indian cohorts disagree on.", "Who carries what"],
    cpic: ["warn", "35 / 56", "decreased-function carriers a European tier-1 panel detects", "Rarer variants need sequencing, and c.85T>C is not on that panel at all, so most Indian reports say nothing about it.", "Tier-1 panel: *2A, *13, c.2846A>T, HapB3"],
    lens: ["ok", "2 studies", "of about 2,000 and 1,612 people carry India's DPYD evidence", "Every lab report already issued is a data point nobody is counting. Pathya turns them into records a study can use.", "Where the evidence is thin"],
  };
  const v = V[mode];
  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div id="pop-wrap" className="card relative min-w-0 overflow-hidden">
        <div className="pointer-events-none absolute left-3 top-3"><span className="pill">{v[4]}</span></div>
        <canvas ref={ref} className="block w-full max-w-full" aria-label="One thousand dots representing Indian patients, coloured by DPYD variant" />
      </div>
      <div className="grid min-w-0 content-start gap-4">
        <Seg label="Show" stack value={mode} onChange={setMode} options={[{ v: "all", t: "Who carries what" }, { v: "cpic", t: "What a tier-1 panel flags" }, { v: "lens", t: "Where the evidence is thin" }]} />
        <ul className="grid gap-2 text-[13px]">
          {([["hapb3", "33", "HapB3 carriers, the most common Indian decreased-function variant"], ["2a", "~2", "*2A carriers, the classic European variant, rare here"], ["rare", "~21", "rarer decreased-function variants only sequencing finds"], ["c85", "~250", "c.85T>C (*9A). CPIC: normal function. South Indian cohorts report a toxicity signal: an open research question"]] as const).map(([k, n, t]) => (
            <li key={k} className="flex items-baseline gap-2.5"><i className="size-2.5 flex-none translate-y-px rounded-full" style={{ background: KCOL[k] }} /><b className="num min-w-[3.4ch] text-right">{n}</b><span className="text-foreground/85">{t}</span></li>
          ))}
        </ul>
        <Verdict tone={v[0]} big={v[1]} what={v[2]} why={v[3]} />
        <p className="text-xs text-muted">Per 1,000, rounded from PMID 40810747 (WES, n=1,612) and PMID 33105068 (n=2,000). Groups can overlap in real patients.</p>
      </div>
    </div>
  );
}

/* 3. Architecture */
export function Architecture() {
  return (
    <div className="card min-w-0 overflow-x-auto p-4">
      <svg viewBox="0 0 1000 370" className="block min-w-[760px]" role="img" aria-label="A lab report, photo or dictation is read by Muse Spark into a verifiable core of PharmCAT standardisation, quality rules and an audit log, then becomes a de-identified research record that a curator verifies and a cohort aggregates">
        <defs><linearGradient id="core-g" x1="0" x2="1"><stop offset="0" stopColor="rgba(46,230,200,0.14)" /><stop offset="1" stopColor="rgba(46,230,200,0.04)" /></linearGradient></defs>
        <rect x="330" y="50" width="340" height="260" rx="22" fill="url(#core-g)" stroke="rgba(46,230,200,0.55)" />
        <text x="350" y="82" fill={COL.teal} fontSize="12" fontWeight="600" letterSpacing="2">VERIFIABLE CORE</text>
        <g className="lock" transform="translate(632 64)"><rect x="0" y="9" width="20" height="15" rx="3" fill={COL.teal} /><path d="M4 9 V6 a6 6 0 0 1 12 0 V9" fill="none" stroke={COL.teal} strokeWidth="2.4" /></g>
        {[["PharmCAT 3.4", "PharmVar allele names, CPIC phenotype terms", 102], ["Quality rules", "India panel coverage, identifier removed", 166], ["Audit log", "every step, append-only", 230]].map(([a, b, y]) => (
          <g key={a as string} fontSize="14">
            <rect x="352" y={y as number} width="296" height="54" rx="12" fill="#0c1013" stroke="rgba(255,255,255,0.12)" />
            <text x="370" y={(y as number) + 23} fill="#e9eef0" fontWeight="600">{a}</text>
            <text x="370" y={(y as number) + 42} fill={COL.muted} fontSize="12">{b}</text>
          </g>
        ))}
        {[[30, "Lab report", "PDF, photo, voice", false], [180, "Muse Spark", "reads, quotes", true], [700, "Record", "JSON · TSV · CSV", false], [850, "Cohort", "group statistics", false]].map(([x, a, b, meta]) => (
          <g key={x as number} fontSize="14">
            <rect x={x as number} y="140" width="120" height="80" rx="14" fill={meta ? "rgba(124,138,255,0.10)" : "#0c1013"} stroke={meta ? "rgba(124,138,255,0.55)" : "rgba(255,255,255,0.14)"} />
            <text x={(x as number) + 16} y="173" fill={meta ? COL.violet : "#e9eef0"} fontWeight="600">{a}</text>
            <text x={(x as number) + 16} y="193" fill={COL.muted} fontSize="12">{b}</text>
          </g>
        ))}
        <path className="flow-line" d="M150 180 H180 M300 180 H352 M648 180 H700 M820 180 H850" />
        <path className="flow-pulse" style={{ stroke: COL.violet }} d="M150 180 H180 M300 180 H352" />
        <path className="flow-pulse" d="M648 180 H700 M820 180 H850" />
        <text x="700" y="245" fill={COL.muted} fontSize="12">a curator verifies each call</text>
        <g fontSize="11" fill={COL.muted} fontFamily="var(--font-geist-mono), monospace">
          <text x="304" y="342">IN: gene calls + verbatim quotes</text>
          <text x="560" y="342">OUT: de-identified record, no advice</text>
        </g>
        <circle r="7" fill={COL.teal} className="packet" style={{ offsetPath: "path('M40 180 H970')", filter: `drop-shadow(0 0 8px ${COL.teal})` }} />
      </svg>
    </div>
  );
}
