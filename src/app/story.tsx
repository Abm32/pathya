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
  { id: "story-gap", n: "01", label: "The gap" },
  { id: "story-india", n: "02", label: "The population" },
  { id: "story-system", n: "03", label: "The system" },
  { id: "story-proof", n: "04", label: "The proof" },
  { id: "story-cohort", n: "05", label: "The cohort" },
  { id: "console", n: "06", label: "Your turn" },
];

/** Fixed chapter rail on wide screens, with scroll-spy. */
export function StoryRail() {
  const [cur, setCur] = useState("");
  const [past, setPast] = useState(false); // hidden over the hero
  useEffect(() => {
    const on = () => setPast(scrollY > innerHeight * 0.7);
    on(); addEventListener("scroll", on, { passive: true });
    return () => removeEventListener("scroll", on);
  }, []);
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
    <nav aria-label="Story chapters" data-show={past && at >= 0} className="rail print:hidden">
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
  { when: "A lab in Kochi", title: "A DPYD result is issued", body: <>Panel genotyping, printed as a PDF: <span className="num rounded-md border border-line bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 text-foreground">DPYD c.1236G&gt;A heterozygous (HapB3)</span>. A photo of it goes to the hospital on WhatsApp.</> },
  { when: "Then", title: "It stays in a phone", body: <>The result lives in a chat thread and a paper file. No registry ever sees it, so it never counts towards what India knows about its own variants.</> },
  { when: "The result", title: "India's evidence stays thin", body: <>Indian DPYD frequency data rests on two studies of about 2,000 and 1,612 people. There is no ICMR guideline on DPYD testing, and the variant most Indians carry, c.85T&gt;C, is still an open question.</>, tone: "bad" },
  { when: "With Pathya, under a minute", title: "Every report becomes a counted record", body: <>The photo is read and each call quoted from the page, standardised to PharmVar names, stripped of identifiers, checked for panel gaps, and added to a cohort with confidence intervals. A curator verifies it against the source.</>, tone: "good" },
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
      <li className="sr text-xs text-muted">Illustrative, built from the synthetic demo report. Figures: PMID 33105068, PMID 40810747, PMC11300675.</li>
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
  // scripts/verify-pop.mts against the live india-sim cohort; numbers in docs/pooling-results.json
  pop: { people: 120, calls: 311, undocumented: 59, truth: 25.3, naive: 15.2, aware: 30.8 },
  render: [
    { label: "Clean PDF", muse: 100, open: 100, rules: 98 },
    { label: "Phone photo", muse: 100, open: 100, rules: 44 },
    { label: "Harsh photo: skewed, shadowed, compressed", muse: 100, open: 100, rules: 0 },
  ],
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
          <h3 className="sr text-lg font-semibold tracking-tight">Open weights, same answers</h3>
          <p className="sr mt-2 text-sm leading-relaxed text-muted">Muse Spark Open, run on Baseten, matched hosted Muse Spark call for call. A lab or biobank can run the reader on its own servers, so genomic data never leaves the building.</p>
          <div className="sr kpi mt-4 rounded-xl border border-line p-4" style={{ ["--d" as string]: "120ms" }}>
            <div className="kpi-value"><span className="glow-text">{PROOF.calls}/{PROOF.calls}</span></div>
            <p className="mt-2 text-xs text-muted">gene calls on held-out reports, open-weights model</p>
          </div>
        </div>
        <div className="sr card spot p-6 text-sm leading-relaxed text-muted">
          <p><span className="font-medium text-foreground">Open dataset.</span> IndiPGx-Read v0.1: 72 synthetic Indian lab reports with ground truth (4 layouts × 3 renders × 2 sets) and the scoring harness, in the public repository.</p>
        </div>
        <div className="sr card spot p-6 text-sm leading-relaxed text-muted">
          <p><span className="font-medium text-foreground">Reading is not the hard part; pooling is.</span> We simulated {PROOF.pop.people} Indian people at published allele
            frequencies and issued each a report from a lab that tests only part of the panel. Every one of the {PROOF.pop.calls} gene calls came back exactly as printed, but the
            cohort estimate for DPYD c.85T&gt;C depends entirely on how a panel that never tested it is counted: {PROOF.pop.naive}% if counted absent, {PROOF.pop.aware}% if left out,
            against a true {PROOF.pop.truth}%.</p>
          <p className="mt-3"><span className="font-medium text-foreground">And the rule had a hole.</span> {PROOF.pop.undocumented}% of the exclusions turned out to be reports that
            never say which variants they tested, not panels that genuinely skipped them. Pathya now separates the two and shows both estimates, because only one of them is a
            question about the lab and the other is a question about the report.</p>
        </div>
        <div className="sr card spot p-6 text-sm leading-relaxed text-muted">
          <p><span className="font-medium text-foreground">Held out.</span> New genotypes and new photos, generated with a seed the pipeline was never tuned on, in four layouts Indian labs use: star table, rsID table, narrative, variant checklist. The OCR baseline was written knowing every layout, so this is its best case. Real lab formats will be harder; de-identified reports from a partner lab are the next test.</p>
          <p className="mt-3"><span className="font-medium text-foreground">Found along the way:</span> two real bugs on the development set, fixed before the held-out run.</p>
        </div>
      </div>
    </div>
  );
}

type Stat = { gene: string; variant: string; carriers: number; n: number; notStated: number; freq: number; lo: number; hi: number };

/** Live numbers from the public cohort, fetched from the running system. */
export function CohortTeaser() {
  const [d, setD] = useState<{ records: number; stats: Stat[] } | null>(null);
  useEffect(() => {
    fetch("/api/cohort/demo").then((r) => (r.ok ? r.json() : null)).then(setD).catch(() => setD(null));
  }, []);
  const rows = (d?.stats ?? []).filter((s) => s.n + s.notStated > 0).slice(0, 5);
  const pct = (x: number) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`;
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="sr card spot p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-lg font-semibold tracking-tight">Demo cohort, live</h3>
          <span className="text-xs text-muted">{d ? `${d.records} records` : "loading…"} · synthetic reports</span>
        </div>
        <div className="mt-4 space-y-3">
          {rows.map((s) => (
            <div key={s.gene + s.variant} className="grid grid-cols-[8.5rem_minmax(0,1fr)_6.5rem] items-center gap-3 text-xs">
              <span className="num"><b>{s.gene}</b> <span className="text-accent">{s.variant}</span></span>
              <span className="ci" style={{ ["--lo" as string]: `${s.lo * 100}%`, ["--hi" as string]: `${s.hi * 100}%`, ["--p" as string]: `${s.freq * 100}%` }}><i /><b /></span>
              <span className="num text-right">{s.carriers}/{s.n} · {pct(s.freq)}</span>
            </div>
          ))}
          {d && !rows.length && <p className="text-sm text-muted">No records yet.</p>}
        </div>
      </div>
      <div className="sr card spot p-6 text-sm leading-relaxed text-muted" style={{ ["--d" as string]: "120ms" }}>
        <p><span className="font-medium text-foreground">Counted honestly.</span> A report whose panel never named a variant is left out of that variant&apos;s denominator, not counted as a non-carrier. Intervals are Wilson 95%.</p>
        <p className="mt-3"><span className="font-medium text-foreground">Ready for a study.</span> One CSV, one row per record, PharmVar names. No patient identifiers, no advice.</p>
        <a href="/cohort" className="btn btn-primary mt-5">Open the cohort</a>
      </div>
    </div>
  );
}
