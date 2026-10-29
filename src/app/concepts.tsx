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

/* 1. DPD enzyme clearing 5-FU: dN/dt = R*dose - k*activity*N */
const BASE = 120, TOXIC = 185, R = 36, K = R / BASE;
export function EnzymeSim() {
  const [act, setAct] = useState(1);
  const [dose, setDose] = useState(1);
  const [exp, setExp] = useState(1);
  const live = useRef({ act: 1, dose: 1 });
  useEffect(() => { live.current = { act, dose }; }, [act, dose]);
  const { ref, size } = useCanvas(420);

  useEffect(() => {
    let N = BASE, raf = 0, last = performance.now(), tick = 0;
    const hist: number[] = [];
    const spawn = () => ({ x: Math.random() * 0.06, y: 0.12 + Math.random() * 0.44, vx: 0.04 + Math.random() * 0.06, vy: (Math.random() - 0.5) * 0.02 });
    const parts = Array.from({ length: BASE }, () => ({ ...spawn(), x: Math.random() }));
    const enz = Array.from({ length: 7 }, (_, i) => ({ x: 0.1 + i * 0.13, y: 0.28 + (i % 2) * 0.12, ph: Math.random() * 6 }));
    const still = reduced();
    const frame = (t: number) => {
      const { ctx, w, h } = size.current; if (!ctx) { raf = requestAnimationFrame(frame); return; }
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      const { act: a, dose: d } = live.current;
      N += (R * d - K * a * N) * dt * 1.6;
      hist.push(N); if (hist.length > 360) hist.shift();
      if (++tick % 6 === 0) setExp(N / BASE);
      const target = Math.min(520, Math.round(N));
      while (parts.length < target) parts.push(spawn());
      while (parts.length > target) parts.splice(Math.floor(Math.random() * parts.length), 1);
      const hot = N > TOXIC;
      ctx.clearRect(0, 0, w, h);
      const vh = h * 0.6;
      ctx.fillStyle = "rgba(255,100,100,0.04)"; ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath(); ctx.roundRect(10, 46, w - 20, vh - 56, 18); ctx.fill(); ctx.stroke();
      ctx.fillStyle = COL.muted; ctx.font = "600 10px var(--font-geist-mono), monospace"; ctx.fillText("BLOODSTREAM · DPD ENZYME IN VIOLET", 22, vh - 20);
      for (const e of enz) {
        e.ph += dt * (0.6 + a * 3);
        const ex = e.x * (w - 40) + 20, ey = 46 + e.y * (vh - 56) + Math.sin(e.ph) * 6;
        const m = a > 0.2 ? (0.25 + 0.25 * Math.abs(Math.sin(e.ph * 1.5))) * Math.PI : 0.04;
        ctx.globalAlpha = 0.35 + 0.65 * Math.min(1, a); ctx.fillStyle = COL.violet;
        ctx.beginPath(); ctx.moveTo(ex, ey); ctx.arc(ex, ey, 13, m, Math.PI * 2 - m); ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 0.85; ctx.fillStyle = hot ? COL.red : COL.teal;
      for (const p of parts) {
        if (!still) { p.x += p.vx * dt * 1.2; p.y += p.vy * dt; if (p.x > 1) p.x = 0; if (p.y < 0.1 || p.y > 0.58) p.vy *= -1; }
        ctx.beginPath(); ctx.arc(p.x * (w - 40) + 20, 46 + p.y * (vh - 56), 2.4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      const cy0 = vh + 14, ch = h - cy0 - 16, cx0 = 20, cw = w - cx0 - 20, maxY = TOXIC * 1.9;
      const Y = (v: number) => cy0 + ch - Math.min(1, v / maxY) * ch;
      ctx.fillStyle = "rgba(95,227,154,0.07)"; ctx.fillRect(cx0, Y(BASE * 1.3), cw, Y(BASE * 0.7) - Y(BASE * 1.3));
      ctx.strokeStyle = "rgba(255,100,100,0.7)"; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(cx0, Y(TOXIC)); ctx.lineTo(cx0 + cw, Y(TOXIC)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = COL.red; ctx.fillText("TOXIC", cx0 + 6, Y(TOXIC) - 5);
      ctx.fillStyle = COL.green; ctx.fillText("THERAPEUTIC", cx0 + 6, Y(BASE * 0.7) - 5);
      ctx.fillStyle = COL.muted; ctx.fillText("EXPOSURE", cx0 + 2, cy0 + 10);
      const X = (i: number) => cx0 + (i / 359) * cw;
      const g = ctx.createLinearGradient(0, cy0, 0, cy0 + ch); g.addColorStop(0, "rgba(46,230,200,0.35)"); g.addColorStop(1, "rgba(46,230,200,0)");
      ctx.beginPath(); hist.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
      ctx.lineTo(X(hist.length - 1), cy0 + ch); ctx.lineTo(cx0, cy0 + ch); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
      ctx.beginPath(); hist.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
      ctx.strokeStyle = hot ? COL.red : COL.teal; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
      ctx.fillStyle = hot ? COL.red : COL.teal; ctx.beginPath(); ctx.arc(X(hist.length - 1), Y(N), 4, 0, Math.PI * 2); ctx.fill();
      if (N > maxY) ctx.fillText("OFF THE CHART ↑", X(hist.length - 1) - 110, cy0 + 12);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [size]);

  const ratio = dose / act;
  const v: [("ok" | "warn" | "bad"), string, string, string] =
    act >= 1
      ? dose === 1 ? ["ok", "In range", "Standard dose", "Normal DPD activity clears the drug as fast as it arrives."] : ["warn", "Under-dosed", "Lower than needed", "Halving the dose with normal DPD risks under-treating the cancer."]
      : act >= 0.4
      ? dose === 1 ? ["bad", `${ratio.toFixed(1)}× exposure`, "Toxic range at a standard dose", "Half-speed DPD lets 5-FU accumulate: severe diarrhoea, mucositis, neutropenia."] : ["ok", "Back in range", "CPIC: start at 50%, then titrate", "Half the dose at half the clearance matches a normal patient's exposure."]
      : ["bad", `${Math.round(ratio)}× exposure`, "CPIC: avoid fluoropyrimidines", "With almost no DPD activity, even a reduced dose stays far above the toxic line."];

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="card relative min-w-0 overflow-hidden">
        <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap gap-2">
          <span className="pill">{act >= 1 ? "DPYD normal" : act >= 0.4 ? "DPYD intermediate" : "DPYD poor"}</span>
          <span className="pill">Dose {Math.round(dose * 100)}%</span>
          <span className="pill" style={{ color: exp * BASE > TOXIC ? COL.red : exp < 0.7 ? COL.amber : COL.green }}>Exposure {exp.toFixed(1)}×</span>
        </div>
        <canvas ref={ref} className="block w-full max-w-full" aria-label="Animated model: 5-FU particles entering the blood and being cleared by DPD, with an exposure chart" />
      </div>
      <div className="grid min-w-0 content-start gap-4">
        <Seg label="DPYD result" stack value={act} onChange={setAct} options={[{ v: 1, t: "Normal · activity score 2" }, { v: 0.5, t: "HapB3 carrier · score 1.5" }, { v: 0.05, t: "No-function alleles · score 0" }]} />
        <Seg label="Starting dose" value={dose} onChange={setDose} options={[{ v: 1, t: "100%" }, { v: 0.5, t: "50%" }]} />
        <Verdict tone={v[0]} big={v[1]} what={v[2]} why={v[3]} />
        <p className="text-xs text-muted">Illustrative model, not pharmacokinetics. Dose actions follow CPIC&apos;s DPYD guideline (PMID 29152729).</p>
      </div>
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
    all: ["warn", "~5.6%", "carry a decreased-function DPYD variant", "Plus about one in four carry c.85T>C, which no CPIC rule acts on.", "Who carries what"],
    cpic: ["warn", "35 / 56", "decreased-function carriers a tier-1 panel would catch", "Rarer variants need sequencing. The 250 c.85T>C carriers get no flag at all.", "Tier-1 panel: *2A, *13, c.2846A>T, HapB3"],
    lens: ["ok", "+250", "c.85T>C carriers flagged for early monitoring", "No dose change, since CPIC says normal. The oncologist is told to watch cycle one closely, with the South Indian evidence cited.", "Tier-1 panel + India lens"],
  };
  const v = V[mode];
  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div id="pop-wrap" className="card relative min-w-0 overflow-hidden">
        <div className="pointer-events-none absolute left-3 top-3"><span className="pill">{v[4]}</span></div>
        <canvas ref={ref} className="block w-full max-w-full" aria-label="One thousand dots representing Indian patients, coloured by DPYD variant" />
      </div>
      <div className="grid min-w-0 content-start gap-4">
        <Seg label="Show" stack value={mode} onChange={setMode} options={[{ v: "all", t: "Who carries what" }, { v: "cpic", t: "What a tier-1 panel flags" }, { v: "lens", t: "What the India lens adds" }]} />
        <ul className="grid gap-2 text-[13px]">
          {([["hapb3", "33", "HapB3 carriers, the most common Indian decreased-function variant"], ["2a", "~2", "*2A carriers, the classic European variant, rare here"], ["rare", "~21", "rarer decreased-function variants only sequencing finds"], ["c85", "~250", "c.85T>C (*9A). CPIC: normal. South Indian cohorts: hand-foot syndrome, diarrhoea"]] as const).map(([k, n, t]) => (
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
      <svg viewBox="0 0 1000 370" className="block min-w-[760px]" role="img" aria-label="Lab report flows to Muse Spark reading, into a locked deterministic core of PharmCAT, guideline text and India rules, out to Muse Spark explaining, then to the oncologist">
        <defs><linearGradient id="core-g" x1="0" x2="1"><stop offset="0" stopColor="rgba(46,230,200,0.14)" /><stop offset="1" stopColor="rgba(46,230,200,0.04)" /></linearGradient></defs>
        <rect x="330" y="50" width="340" height="260" rx="22" fill="url(#core-g)" stroke="rgba(46,230,200,0.55)" />
        <text x="350" y="82" fill={COL.teal} fontSize="12" fontWeight="600" letterSpacing="2">DETERMINISTIC CORE</text>
        <g className="lock" transform="translate(632 64)"><rect x="0" y="9" width="20" height="15" rx="3" fill={COL.teal} /><path d="M4 9 V6 a6 6 0 0 1 12 0 V9" fill="none" stroke={COL.teal} strokeWidth="2.4" /></g>
        {[["PharmCAT 3.4", "diplotype → phenotype", 102], ["CPIC · DPWG · FDA label text", "dose action, verbatim", 166], ["India lens rules", "HapB3 · c.85T>C · NUDT15, each with a PMID", 230]].map(([a, b, y]) => (
          <g key={a as string} fontSize="14">
            <rect x="352" y={y as number} width="296" height="54" rx="12" fill="#0c1013" stroke="rgba(255,255,255,0.12)" />
            <text x="370" y={(y as number) + 23} fill="#e9eef0" fontWeight="600">{a}</text>
            <text x="370" y={(y as number) + 42} fill={COL.muted} fontSize="12">{b}</text>
          </g>
        ))}
        {[[30, "Lab report", "PDF or photo", false], [180, "Muse Spark", "reads, quotes", true], [700, "Muse Spark", "ranks, explains", true], [850, "Oncologist", "confirms, logged", false]].map(([x, a, b, meta]) => (
          <g key={x as number} fontSize="14">
            <rect x={x as number} y="140" width="120" height="80" rx="14" fill={meta ? "rgba(124,138,255,0.10)" : "#0c1013"} stroke={meta ? "rgba(124,138,255,0.55)" : "rgba(255,255,255,0.14)"} />
            <text x={(x as number) + 16} y="173" fill={meta ? COL.violet : "#e9eef0"} fontWeight="600">{a}</text>
            <text x={(x as number) + 16} y="193" fill={COL.muted} fontSize="12">{b}</text>
          </g>
        ))}
        <path className="flow-line" d="M150 180 H180 M300 180 H352 M648 180 H700 M820 180 H850" />
        <path className="flow-pulse" style={{ stroke: COL.violet }} d="M150 180 H180 M300 180 H352" />
        <path className="flow-pulse" d="M648 180 H700 M820 180 H850" />
        <g fontSize="11" fill={COL.muted} fontFamily="var(--font-geist-mono), monospace">
          <text x="304" y="342">IN: gene calls + verbatim quotes</text>
          <text x="560" y="342">OUT: phenotypes + guideline dose text, unchanged</text>
        </g>
        <circle r="7" fill={COL.teal} className="packet" style={{ offsetPath: "path('M40 180 H970')", filter: `drop-shadow(0 0 8px ${COL.teal})` }} />
      </svg>
    </div>
  );
}
