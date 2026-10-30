"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Recorder } from "./recorder";
import { Cite } from "./cite";
import { RunLog, type StepEvent } from "./run-log";
import { Pipeline } from "./pipeline";
import { CountUp } from "./fx";
import { Architecture, Population } from "./concepts";
import { Chapter, CohortTeaser, PROOF, Proof, StoryRail, Vignette } from "./story";

type Mode = "report" | "dictate" | "vcf";

export default function Home() {
  const r = useRouter();
  const [mode, setMode] = useState<Mode>("report");
  const [label, setLabel] = useState("");
  const [cohort, setCohort] = useState("visitors");
  const [transcript, setTranscript] = useState("");
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<StepEvent[]>([]);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const consoleRef = useRef<HTMLDivElement>(null);

  async function submit(fd: FormData, scroll = true) {
    setErr(null); setReady(false); setBusy(true);
    setSteps([{ type: "step", step: "upload", status: "active", detail: "Uploading", at: Date.now() }]);
    if (!fd.get("label")) fd.set("label", label);
    if (!fd.get("cohort")) fd.set("cohort", cohort);
    if (scroll) setTimeout(() => logRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    try {
      const res = await fetch("/api/analyze?stream=1", { method: "POST", body: fd });
      if (!res.ok || !res.body) { const j = await res.json().catch(() => ({})); throw new Error(j.detail ?? j.error ?? `HTTP ${res.status}`); }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        const lines = buf.split("\n"); buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const e = JSON.parse(line);
          if (e.type === "step") setSteps((p) => [...p, { ...e, at: Date.now() }]);
          else if (e.type === "error") throw new Error(e.detail ?? e.error ?? "could not build the record");
          else if (e.type === "done") { setReady(true); setTimeout(() => r.push(`/report/${e.id}`), 1400); return; }
        }
      }
      throw new Error("Connection closed before the record finished. Try again.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setSteps([]); // never leave the pipeline looking frozen
      setBusy(false);
    }
  }

  const sample = (s: string, scroll = true, provider?: string) => {
    const fd = new FormData();
    fd.set("sample", s);
    fd.set("cohort", "samples"); // keeps the demo cohort's statistics clean
    if (provider) fd.set("provider", provider);
    submit(fd, scroll);
  };

  return (
    <main className="mx-auto max-w-6xl px-4">
      <StoryRail />
      {/* Hero */}
      <section className="grid min-h-[calc(100svh-3.5rem)] grid-cols-1 content-center items-center gap-10 pb-10 pt-14 md:pt-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="rise">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-xs text-muted">
            <span className="live-dot" aria-hidden /> Live on AWS Mumbai · {PROOF.calls}/{PROOF.calls} gene calls read on held-out reports
          </div>
          <h1 className="display mt-6 text-[2.5rem] sm:text-6xl">
            India&apos;s gene data<br />is stuck in <span className="glow-text">WhatsApp<br />photos.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
            Pharmacogenomic results in India arrive as PDFs and phone photos, and stay there. Pathya reads each one with Muse Spark, quotes every call,
            standardises it with PharmCAT, removes identifiers, and adds it to a cohort researchers can count.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" disabled={busy} onClick={() => sample("photo", false)} className="btn btn-primary btn-lg">
              Read a WhatsApp photo <span aria-hidden>→</span>
            </button>
            <a href="/cohort" className="btn btn-ghost btn-lg">Open the research cohort</a>
          </div>
          <p className="mt-3 text-sm text-muted">
            or{" "}
            <button type="button" disabled={busy} onClick={() => sample("photo", false, "baseten")} className="text-accent underline decoration-accent/30 underline-offset-2 disabled:opacity-50">
              read the same photo on open weights
            </button>{" "}
            — Muse Spark Open, the path a hospital would self-host.
          </p>
          <div className="mt-5 flex items-center gap-3">
            <a href="/sample-photo.jpg" target="_blank" rel="noreferrer" className="photo-thumb" aria-label="Open the sample WhatsApp photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/sample-photo.jpg" alt="" width={46} height={62} />
              {busy && <span className="scan" aria-hidden />}
            </a>
            <p className="text-xs leading-relaxed text-muted">This synthetic Indian-panel report, photographed skewed and noisy like a WhatsApp forward, is what the button reads. About 30 seconds, or <a href="/sample" className="text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">open a finished record</a>. Research tool, not medical advice.</p>
          </div>
        </div>
        <div className="rise" style={{ animationDelay: "120ms" }}>
          <Pipeline steps={steps} />
        </div>
        <a href="#story-gap" className="cue rise justify-self-center lg:col-span-2 print:hidden" style={{ animationDelay: "500ms" }}>
          <span>Scroll for the story</span><i aria-hidden />
        </a>
      </section>

      <Chapter id="story-gap" n="01" kicker="The gap" title={<>The test was done.<br /><span className="glow-text">Nobody counted it.</span></>}
        lede="Pharmacogenomic tests are already being run in India. The results are correct, and almost none of them reach a dataset.">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Vignette />
          <div className="lg:sticky lg:top-24 lg:self-start">
            <p className="sr eyebrow">Why the data matters</p>
            <section aria-label="Why the data matters" className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { v: 48, s: "%", t: "of fluoropyrimidine deaths are in DPYD variant carriers, who are about 4% of patients", src: "Sharma 2021", glow: "rgba(255,100,100,0.5)" },
                { v: 25, s: "%", p: "~", t: "of Indians carry DPYD c.85T>C. CPIC calls it normal; South Indian cohorts report a toxicity signal", src: "PMC11300675", glow: "rgba(255,181,71,0.5)" },
                { v: 3612, s: "", t: "people in the two studies India's DPYD frequency data rests on", src: "PMID 33105068 · PMID 40810747", glow: "rgba(124,138,255,0.5)" },
                { v: 0, s: "", t: "Indian national guidelines on DPYD testing", src: "ICMR / NCG, none found", glow: "rgba(46,230,200,0.5)" },
              ].map((k, i) => (
                <div key={i} className="sr card spot lift kpi p-5" style={{ ["--d" as string]: `${i * 90}ms`, ["--kpi-glow" as string]: k.glow }}>
                  <div className="kpi-value"><CountUp to={k.v} prefix={k.p ?? ""} suffix={k.s} /></div>
                  <p className="mt-3 text-sm leading-snug text-foreground/85">{k.t}</p>
                  <p className="mt-3 text-[11px] text-muted"><Cite text={k.src} /></p>
                </div>
              ))}
            </section>
          </div>
        </div>
      </Chapter>

      <Chapter id="story-india" n="02" kicker="The population" title={<>India carries a <span className="glow-text">different risk.</span></>}
        lede="CPIC's DPYD tables were built on European data. In Indians the decreased-function variants are different, and the most common variant has an effect nobody has settled. Change the view.">
        <div className="sr"><Population /></div>
      </Chapter>

      <Chapter id="story-system" n="03" kicker="The system" title={<>The model reads.<br /><span className="glow-text">The record is verifiable.</span></>}
        lede="Muse Spark reads the page and quotes each call; Muse Voice takes results read aloud in Malayalam or English. PharmCAT standardises the names, rules check panel coverage and remove identifiers, and every step is logged. Nothing in the record is advice.">
        <div className="sr"><Architecture /></div>
      </Chapter>

      <Chapter id="story-proof" n="04" kicker="The proof" title={<>Tested on reports<br />it had <span className="glow-text">never seen.</span></>}
        lede="Thirty-six synthetic Indian lab reports, as clean PDFs, phone photos and the kind of skewed, shadowed photo that arrives over WhatsApp. Every gene call scored against the truth.">
        <Proof />
      </Chapter>

      <Chapter id="story-cohort" n="05" kicker="The cohort" title={<>One report is a result.<br /><span className="glow-text">A thousand are evidence.</span></>}
        lede="Every record joins a cohort: carrier frequency per India-relevant variant, with a confidence interval, and a count of the panels that never tested it.">
        <CohortTeaser />
      </Chapter>

      <Chapter id="console" n="06" kicker="Your turn" title={<>Build a record. <span className="glow-text">Watch it read.</span></>}
        lede="Upload a report or a photo, read the results aloud, or pick a sample. Every step streams from the server as it finishes.">
      <div ref={consoleRef} className="sr grid scroll-mt-24 gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <form className="card spot space-y-5 p-6" onSubmit={(e) => { e.preventDefault(); submit(new FormData(e.currentTarget)); }}>
          <div className="flex flex-wrap gap-2 text-sm">
            {(["report", "dictate", "vcf"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m} className="chip">
                {m === "report" ? "Lab report (PDF / photo)" : m === "dictate" ? "Read it aloud" : "Genotype VCF"}
              </button>
            ))}
          </div>
          {mode === "report" && (
            <label className="block">
              <span className="text-sm font-medium">Lab PGx report</span>
              <input name="report" type="file" accept="application/pdf,image/*" className="file mt-1" />
              <span className="mt-1 block text-xs text-muted">Muse Spark reads the PDF or photo and quotes every call; PharmCAT standardises it.</span>
            </label>
          )}
          {mode === "dictate" && (
            <div className="space-y-3">
              <Recorder onResult={(t) => setTranscript((prev) => (prev ? `${prev}\n${t}` : t))} />
              <label className="block">
                <span className="text-sm font-medium">Results as read <span className="font-normal text-muted">(dictate, or type)</span></span>
                <textarea name="transcript" value={transcript} onChange={(e) => setTranscript(e.target.value)} rows={5} placeholder="DPYD: c.1236G>A heterozygous, HapB3. UGT1A1 star one, star twenty-eight…" className="field num mt-1" />
              </label>
            </div>
          )}
          {mode === "vcf" && (
            <label className="block">
              <span className="text-sm font-medium">VCF (GRCh38)</span>
              <input name="vcf" type="file" accept=".vcf,.gz,.bgz" className="file mt-1" />
            </label>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">Record label <span className="font-normal text-muted">(no identifiers)</span></span>
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. KOCHI-LAB-0142" autoComplete="off" className="field mt-1" />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Cohort</span>
              <input value={cohort} onChange={(e) => setCohort(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} autoComplete="off" className="field num mt-1" />
            </label>
          </div>
          <p className="text-xs leading-relaxed text-muted">This demo is open to everyone and the records it makes are readable by anyone with the link, so use synthetic or de-identified reports only. Content sent to the Meta API may be used to improve Meta models.</p>
          <div className="space-y-3 border-t border-line pt-4">
            <button disabled={busy} aria-busy={busy} className="btn btn-primary w-full sm:w-auto sm:min-w-40">{busy ? "Reading…" : "Build record"}</button>
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs text-muted">Try a sample</span>
              <button type="button" disabled={busy} onClick={() => sample("lab")} className="btn btn-ghost btn-sm">Lab PDF, Indian panel</button>
              <button type="button" disabled={busy} onClick={() => sample("photo")} className="btn btn-ghost btn-sm">Same report, phone photo</button>
              <button type="button" disabled={busy} onClick={() => sample("A")} className="btn btn-ghost btn-sm">VCF A</button>
            </div>
          </div>
          {err && <p role="alert" className="text-sm text-danger">{err}</p>}
        </form>

        <aside className="space-y-4 text-sm lg:sticky lg:top-20 lg:self-start">
          {steps.length > 0 && (
            <div ref={logRef} className="scroll-mt-4">
              <h2 className="section-title mb-2">Live run</h2>
              <RunLog steps={steps} onDone={ready} />
            </div>
          )}
          {steps.length === 0 && (
            <div className="card spot p-5">
              <h3 className="section-title">What happens when you press Build record</h3>
              <ol className="mt-4 space-y-3 text-sm text-muted">
                <li className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-3"><span className="badge badge-meta justify-self-start">Muse Spark</span><span>reads the PDF or photo and quotes each gene call from the page</span></li>
                <li className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-3"><span className="badge badge-meta justify-self-start">Muse Voice</span><span>transcribes results read aloud, Malayalam and English</span></li>
                <li className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-3"><span className="badge badge-det justify-self-start">PharmCAT</span><span>standardises to PharmVar allele names and CPIC phenotype terms</span></li>
                <li className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-3"><span className="badge badge-det justify-self-start">Rules</span><span>check India-relevant panel coverage and remove identifiers</span></li>
                <li className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-3"><span className="badge badge-det justify-self-start">Cohort</span><span>the record joins its cohort; a curator verifies it</span></li>
              </ol>
            </div>
          )}
        </aside>
      </div>
      </Chapter>
    </main>
  );
}
