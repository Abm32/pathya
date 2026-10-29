"use client";
import { useEffect, useState } from "react";

/** One observer for the whole app: any `.sr` element gets `.in` the first time it scrolls into view. */
export function ScrollFx() {
  useEffect(() => {
    const io = new IntersectionObserver((ens) => {
      for (const e of ens) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.12 });
    const scan = () => document.querySelectorAll(".sr:not(.in)").forEach((el) => io.observe(el));
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, []);
  return <div aria-hidden className="read-progress print:hidden" />;
}

export const CHAPTERS = [
  { id: "story-patient", n: "01", label: "The patient" },
  { id: "story-enzyme", n: "02", label: "The mechanism" },
  { id: "story-india", n: "03", label: "The population" },
  { id: "story-system", n: "04", label: "The system" },
  { id: "story-proof", n: "05", label: "The proof" },
  { id: "console", n: "06", label: "Your turn" },
];

/** Fixed chapter rail on wide screens, with scroll-spy. */
export function StoryRail() {
  const [cur, setCur] = useState("");
  useEffect(() => {
    const io = new IntersectionObserver((ens) => {
      const vis = ens.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (vis) setCur(vis.target.id);
    }, { rootMargin: "-35% 0px -55% 0px" });
    CHAPTERS.forEach((c) => { const el = document.getElementById(c.id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);
  const at = CHAPTERS.findIndex((c) => c.id === cur);
  return (
    <nav aria-label="Story chapters" data-show={at >= 0} className="rail print:hidden">
      <ol>
        {CHAPTERS.map((c, i) => (
          <li key={c.id}>
            <a href={`#${c.id}`} aria-current={c.id === cur} data-past={i < at}>
              <span className="rail-dot" /><span className="num rail-n">{c.n}</span><span className="rail-label">{c.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Chapter opener: outlined number, kicker, headline, lede. */
export function Chapter({ id, n, kicker, title, lede, children }: { id: string; n: string; kicker: string; title: React.ReactNode; lede?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="chapter scroll-mt-20 pt-28">
      <div className="grid gap-x-8 md:grid-cols-[auto_minmax(0,1fr)]">
        <div aria-hidden className="sr chapter-n hidden md:block">{n}</div>
        <div className="max-w-3xl">
          <p className="sr eyebrow" style={{ ["--d" as string]: "60ms" }}><span className="text-accent">{n}</span> · {kicker}</p>
          <h2 id={`${id}-h`} className="sr display mt-3 text-4xl sm:text-5xl" style={{ ["--d" as string]: "120ms" }}>{title}</h2>
          {lede && <p className="sr mt-5 text-lg leading-relaxed text-muted" style={{ ["--d" as string]: "200ms" }}>{lede}</p>}
        </div>
      </div>
      <div className="mt-10 min-w-0">{children}</div>
    </section>
  );
}

const BEATS: { when: string; title: string; body: React.ReactNode; tone?: "bad" | "good" }[] = [
  { when: "Day 0 · diagnosis", title: "Colon cancer, 54, Kochi", body: <>The plan is CAPOX: capecitabine with oxaliplatin. Standard, effective, started at full dose.</> },
  { when: "Day 2 · the report", title: "A gene test arrives on WhatsApp", body: <>A photo of a lab page: <span className="num rounded-md border border-line bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 text-foreground">DPYD c.1236G&gt;A heterozygous (HapB3)</span>. It is correct. Nobody on the ward knows what to do with it.</> },
  { when: "Day 3 · the gap", title: "Forty patients, no pharmacogenomics training", body: <>Three in four Indian prescribers say they cannot read these reports with confidence. There is no national guideline to fall back on.</> },
  { when: "Without a check", title: "Full dose, half the clearance", body: <>DPYD carriers are about 4% of patients and about 48% of fluoropyrimidine deaths. Toxicity shows up in week two: mucositis, diarrhoea, neutropenia.</>, tone: "bad" },
  { when: "With Pathya, under a minute", title: "Start at 50%, then titrate", body: <>The photo is read, the call quoted line by line, CPIC&apos;s dose text attached with citations, the Indian evidence added, and the reason explained to her in Malayalam. The oncologist confirms.</>, tone: "good" },
];

/** The case told as a timeline; the thread draws as you scroll. */
export function Vignette() {
  return (
    <ol className="story-thread relative space-y-5 pl-9 sm:pl-12">
      {BEATS.map((b, i) => (
        <li key={i} className="sr relative" style={{ ["--d" as string]: `${i * 40}ms` }}>
          <span aria-hidden className="beat-dot" data-tone={b.tone} />
          <div className={`card spot p-5 sm:p-6 ${b.tone === "bad" ? "beat-bad" : b.tone === "good" ? "beat-good" : ""}`}>
            <p className="eyebrow" style={{ color: b.tone === "bad" ? "var(--danger)" : b.tone === "good" ? "var(--accent)" : undefined }}>{b.when}</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">{b.title}</h3>
            <p className="mt-2 leading-relaxed text-foreground/80">{b.body}</p>
          </div>
        </li>
      ))}
      <li className="sr text-xs text-muted">Illustrative case built from the synthetic demo report. Figures: Sharma 2021; PMC9696651.</li>
    </ol>
  );
}

type Bar = { who: string; pct: number; tone: "meta" | "det" | "base" };
function Bars({ label, bars }: { label: string; bars: Bar[] }) {
  return (
    <div className="sr">
      <p className="text-sm font-medium">{label}</p>
      <div className="mt-3 space-y-2.5">
        {bars.map((b, i) => (
          <div key={b.who} className="grid grid-cols-[7.5rem_minmax(0,1fr)_3.5rem] items-center gap-3 text-xs">
            <span className="text-muted">{b.who}</span>
            <span className="bar"><i data-tone={b.tone} style={{ ["--w" as string]: `${Math.max(b.pct, 0.6)}%`, ["--d" as string]: `${150 + i * 120}ms` }} /></span>
            <span className="num text-right text-sm text-foreground">{b.pct.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Numbers from docs/bench-results-heldout.json (scripts/bench.mts on fixtures/bench-heldout) and docs/bench-results.json (meds).
export const PROOF = {
  reports: 36, calls: 177,
  render: [
    { label: "Clean PDF", muse: 100, open: 100, rules: 98 },
    { label: "Phone photo", muse: 100, open: 100, rules: 44 },
    { label: "Harsh photo: skewed, shadowed, compressed", muse: 100, open: 100, rules: 0 },
  ],
  meds: { inputs: 26, muse: 26, open: 26, rulesPgx: 2, pgx: 20 },
};

export function Proof() {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="card spot space-y-7 p-6">
        <div className="sr flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-lg font-semibold tracking-tight">Reading the lab report</h3>
          <span className="text-xs text-muted">{PROOF.calls} gene calls · {PROOF.reports} reports · exact diplotype</span>
        </div>
        {PROOF.render.map((r) => (
          <Bars key={r.label} label={r.label} bars={[
            { who: "Muse Spark 1.3", pct: r.muse, tone: "meta" },
            { who: "Spark Open", pct: r.open, tone: "meta" },
            { who: "OCR + rules", pct: r.rules, tone: "base" },
          ]} />
        ))}
      </div>
      <div className="grid content-start gap-5">
        <div className="card spot p-6">
          <h3 className="sr text-lg font-semibold tracking-tight">Reading the prescription</h3>
          <p className="sr mt-1 text-xs text-muted">Xeloda, 5FU, Campto, Emeset, Clopilet, Pan 40, &ldquo;Xeloda tablet randu neram&rdquo;…</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="sr kpi rounded-xl border border-line p-4" style={{ ["--d" as string]: "120ms" }}>
              <div className="kpi-value"><span className="glow-text">{PROOF.meds.muse}/{PROOF.meds.inputs}</span></div>
              <p className="mt-2 text-xs text-muted">Muse Spark, every run, both models</p>
            </div>
            <div className="sr kpi rounded-xl border border-line p-4" style={{ ["--d" as string]: "220ms" }}>
              <div className="kpi-value text-muted">{PROOF.meds.rulesPgx}/{PROOF.meds.pgx}</div>
              <p className="mt-2 text-xs text-muted">Name lookup, on the names that matter</p>
            </div>
          </div>
        </div>
        <div className="sr card spot p-6 text-sm leading-relaxed text-muted">
          <p><span className="font-medium text-foreground">Held out.</span> New genotypes and new photos, generated with a seed the pipeline was never tuned on, in four layouts Indian labs use: star table, rsID table, narrative, variant checklist. The OCR baseline was written knowing every layout, so this is its best case. Real lab formats will be harder; the clinician pilot is the next test.</p>
          <p className="mt-3"><span className="font-medium text-foreground">Found along the way:</span> two real bugs on the development set, fixed before the held-out run.</p>
        </div>
      </div>
    </div>
  );
}
