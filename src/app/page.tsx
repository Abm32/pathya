"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Recorder } from "./recorder";
import { Cite } from "./cite";
import { RunLog, type StepEvent } from "./run-log";
import { Pipeline } from "./pipeline";
import { CountUp } from "./fx";
import { Architecture, EnzymeSim, Population } from "./concepts";
import { Chapter, PROOF, Proof, StoryRail, Vignette } from "./story";
import { PRETEST_SAMPLES, PretestResult } from "./pretest-panel";

const SAMPLE_MEDS: Record<string, string> = {
  A: "Xeloda\nirinotecan\nondansetron\npantoprazole\nclopidogrel",
  B: "fluorouracil (5-FU)\nmercaptopurine\ntramadol",
  // CAPOX for colon cancer with standard supportive care: the case the demo report describes
  lab: "Xeloda 1000 mg/m² BD\noxaliplatin\nEmeset 8\nDexona 8 mg\nPan 40",
};

export default function Home() {
  const r = useRouter();
  const [mode, setMode] = useState<"report" | "vcf" | "pretest">("report");
  const [meds, setMeds] = useState(SAMPLE_MEDS.lab);
  const [label, setLabel] = useState("");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<StepEvent[]>([]);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [locked, setLocked] = useState(false); // a run hit the access gate
  const logRef = useRef<HTMLDivElement>(null);
  const consoleRef = useRef<HTMLDivElement>(null);

  async function submit(fd: FormData, medList = meds, scroll = true) {
    setErr(null); setReady(false); setBusy(true);
    setSteps([{ type: "step", step: "upload", status: "active", detail: "Uploading", at: Date.now() }]);
    fd.set("meds", medList);
    fd.set("label", label);
    if (scroll) setTimeout(() => logRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    try {
      const res = await fetch("/api/analyze?stream=1", { method: "POST", body: fd });
      if (res.status === 401) { setLocked(true); setSteps([]); setBusy(false); return; }
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
          else if (e.type === "error") throw new Error(e.detail ?? e.error ?? "analysis failed");
          else if (e.type === "done") { setReady(true); setTimeout(() => r.push(`/report/${e.id}`), 1400); return; }
        }
      }
      throw new Error("Connection closed before the report finished. Try again.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setSteps([]); // never leave the pipeline looking frozen
      setBusy(false);
    }
  }

  const checkRegimen = () => {
    setMode("pretest"); setMeds(PRETEST_SAMPLES[0].meds);
    consoleRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const sample = (s: string, scroll = true) => {
    const fd = new FormData();
    fd.set("sample", s);
    const m = SAMPLE_MEDS[s === "photo" ? "lab" : s];
    setMeds(m);
    submit(fd, m, scroll);
  };

  return (
    <main className="mx-auto max-w-6xl px-4">
      <StoryRail />
      {/* Hero */}
      <section className="grid min-h-[calc(100svh-3.5rem)] grid-cols-1 content-center items-center gap-10 pb-10 pt-14 md:pt-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="rise">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-xs text-muted">
            <span className="live-dot" aria-hidden /> Live on AWS Mumbai · {PROOF.calls}/{PROOF.calls} gene calls on held-out reports
          </div>
          <h1 className="display mt-6 text-[2.7rem] sm:text-6xl">
            Chemo toxicity,<br />caught <span className="glow-text">before<br />cycle one.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
            At diagnosis, Pathya tells the oncologist which gene test to order. When the result comes back, even as a WhatsApp photo
            of <span className="num text-foreground">HapB3 heterozygous</span>, it attaches the CPIC dose text with citations, adds the Indian
            evidence CPIC misses, and explains it to the patient in Malayalam.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" disabled={busy} onClick={() => sample("photo", false)} className="btn btn-primary btn-lg">
              Run it on a phone photo <span aria-hidden>→</span>
            </button>
            <button type="button" onClick={checkRegimen} className="btn btn-ghost btn-lg">No test yet? Check a regimen</button>
          </div>
          {locked && (
            <div role="alert" className="reveal mt-4 max-w-xl rounded-xl border border-[rgba(255,181,71,0.4)] bg-[rgba(255,181,71,0.07)] p-4 text-sm">
              <p className="font-medium">Live runs need the pilot access code, because each one calls Muse Spark.</p>
              <p className="mt-1 text-muted">
                <a href="/sample" className="text-accent underline decoration-accent/30 underline-offset-2">Open this photo, already run</a>, try the{" "}
                <button type="button" onClick={checkRegimen} className="text-accent underline decoration-accent/30 underline-offset-2">pre-test check</button> (no code), or{" "}
                <a href="/login?next=/" className="text-accent underline decoration-accent/30 underline-offset-2">sign in</a>.
              </p>
            </div>
          )}
          <div className="mt-5 flex items-center gap-3">
            <a href="/sample-photo.jpg" target="_blank" rel="noreferrer" className="photo-thumb" aria-label="Open the sample WhatsApp photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/sample-photo.jpg" alt="" width={46} height={62} />
              {busy && <span className="scan" aria-hidden />}
            </a>
            <p className="text-xs leading-relaxed text-muted">This synthetic Indian-panel report, photographed skewed and noisy like a WhatsApp forward, is what the button reads. About 45 seconds end to end, or <a href="/sample" className="text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">open a finished report</a>.</p>
          </div>
        </div>
        <div className="rise" style={{ animationDelay: "120ms" }}>
          <Pipeline steps={steps} />
        </div>
        <a href="#story-patient" className="cue rise justify-self-center lg:col-span-2 print:hidden" style={{ animationDelay: "500ms" }}>
          <span>Scroll for the story</span><i aria-hidden />
        </a>
      </section>

      <Chapter id="story-patient" n="01" kicker="The patient" title={<>Her lab report is right.<br /><span className="glow-text">Her dose is still wrong.</span></>}
        lede="One gene test, read correctly, changes the first dose of chemotherapy. Here is what happens when nobody reads it.">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Vignette />
          <div className="lg:sticky lg:top-24 lg:self-start">
            <p className="sr eyebrow">This is not one patient</p>
            <section aria-label="Why this matters" className="mt-4 grid gap-3 sm:grid-cols-2">
        {[
          { v: 48, s: "%", t: "of fluoropyrimidine deaths are DPYD carriers, who are only 4% of patients", src: "Sharma 2021", glow: "rgba(255,100,100,0.5)" },
          { v: 25, s: "%", p: "~", t: "of Indians carry DPYD c.85T>C. CPIC calls it normal; South Indian cohorts link it to toxicity", src: "PMC11300675", glow: "rgba(255,181,71,0.5)" },
          { v: 0, s: "", t: "Indian national guidelines on DPYD or UGT1A1 testing before chemotherapy", src: "ICMR / NCG, none found", glow: "rgba(124,138,255,0.5)" },
          { v: 75, s: "%", t: "of Indian prescribers say they are not confident reading a pharmacogenomic report", src: "PMC9696651", glow: "rgba(46,230,200,0.5)" },
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

      <Chapter id="story-enzyme" n="02" kicker="The mechanism" title={<>One enzyme decides<br />whether the dose is <span className="glow-text">safe.</span></>}
        lede="DPD clears 5-FU and capecitabine. A DPYD variant slows it. Same dose, slower clearance, and the drug piles up past the toxic line. Change the inputs.">
        <div className="sr"><EnzymeSim /></div>
      </Chapter>

      <Chapter id="story-india" n="03" kicker="The population" title={<>India carries a <span className="glow-text">different risk.</span></>}
        lede="CPIC's DPYD rules were built on European data. In Indians the risk sits in different variants, and one variant CPIC calls normal carries a toxicity signal in South Indian cohorts.">
        <div className="sr"><Population /></div>
      </Chapter>

      <Chapter id="story-system" n="04" kicker="The system" title={<>The model reads.<br /><span className="glow-text">The guideline decides.</span></>}
        lede="Muse Spark reads the report, Muse Voice takes the consult as it is dictated in Malayalam and English, and Muse Spark explains the result. Everything that sets a dose sits in a locked, deterministic core. The model can rank and explain the dose text. It cannot change it.">
        <div className="sr"><Architecture /></div>
      </Chapter>

      <Chapter id="story-proof" n="05" kicker="The proof" title={<>Tested on reports<br />it had <span className="glow-text">never seen.</span></>}
        lede="Thirty-six synthetic Indian lab reports, as clean PDFs, phone photos and the kind of skewed, shadowed photo that arrives over WhatsApp. Every gene call scored against the truth.">
        <Proof />
      </Chapter>

      {/* Console */}
      <Chapter id="console" n="06" kicker="Your turn" title={<>Run a case. <span className="glow-text">Watch it think.</span></>}
        lede="Upload a report or pick a sample. Every step streams from the server as it finishes. No dose ever comes from the language model.">
      <div ref={consoleRef} className="sr grid scroll-mt-24 gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <form className="card spot space-y-5 p-6" onSubmit={(e) => { e.preventDefault(); submit(new FormData(e.currentTarget)); }}>
          <div className="flex flex-wrap gap-2 text-sm">
            {(["pretest", "report", "vcf"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m} className="chip">
                {m === "pretest" ? "No test yet" : m === "report" ? "Lab report (PDF / photo)" : "Genotype VCF"}
              </button>
            ))}
          </div>
          {mode === "pretest" ? (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-muted">Write the planned regimen the way you would on the chart. Pathya lists the gene tests to order before cycle 1 and why, from a fixed guideline table that runs instantly in your browser. Muse Spark is asked only to name drugs the table does not know; the table still decides the test.</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-xs text-muted">Try a regimen</span>
                {PRETEST_SAMPLES.map((x) => (
                  <button key={x.label} type="button" onClick={() => setMeds(x.meds)} aria-pressed={meds === x.meds} className="btn btn-ghost btn-sm aria-pressed:border-accent aria-pressed:text-accent">{x.label}</button>
                ))}
              </div>
              <label className="block">
                <span className="text-sm font-medium">Planned regimen and supportive care</span>
                <textarea value={meds} onChange={(e) => setMeds(e.target.value)} rows={5} className="field mt-1 font-mono" />
              </label>
              <PretestResult meds={meds} />
              <p className="border-t border-line pt-4 text-sm text-muted">
                Result back? <button type="button" onClick={() => setMode("report")} className="text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">Upload the lab report</button> with this same regimen.
              </p>
            </div>
          ) : (<>
          {mode === "report" ? (
            <label className="block">
              <span className="text-sm font-medium">Lab PGx report</span>
              <input name="report" type="file" accept="application/pdf,image/*" className="file mt-1" />
              <span className="mt-1 block text-xs text-muted">Muse Spark reads the PDF or photo and quotes every call verbatim; PharmCAT assigns phenotypes.</span>
            </label>
          ) : (
            <label className="block">
              <span className="text-sm font-medium">VCF</span>
              <input name="vcf" type="file" accept=".vcf,.gz,.bgz" className="file mt-1" />
            </label>
          )}
          <label className="block">
            <span className="text-sm font-medium">Case label <span className="font-normal text-muted">(no patient identifiers)</span></span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. CRC-2026-014" autoComplete="off" className="field mt-1" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Medications, current and planned</span>
            <textarea value={meds} onChange={(e) => setMeds(e.target.value)} rows={6} className="field mt-1 font-mono" />
          </label>
          <Recorder
            onResult={(res) => {
              setTranscript(res.transcript);
              const names = res.extract.medications.map((m) => (m.dose ? `${m.name} (${m.dose}, ${m.context})` : `${m.name} (${m.context})`));
              setMeds((prev) => [...prev.split("\n").filter(Boolean), ...names].join("\n"));
            }}
          />
          {transcript && (
            <details className="rounded-lg border border-line bg-background p-3 text-sm">
              <summary className="cursor-pointer">Transcript <span className="badge badge-meta ml-1">Muse Voice · diarized</span></summary>
              <pre className="ml mt-2 whitespace-pre-wrap text-xs">{transcript}</pre>
            </details>
          )}
          <div className="space-y-3 border-t border-line pt-4">
            <button disabled={busy} aria-busy={busy} className="btn btn-primary w-full sm:w-auto sm:min-w-40">{busy ? "Analysing…" : "Analyse"}</button>
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs text-muted">Try a sample</span>
              <button type="button" disabled={busy} onClick={() => sample("lab")} className="btn btn-ghost btn-sm">Lab PDF, Indian panel</button>
              <button type="button" disabled={busy} onClick={() => sample("photo")} className="btn btn-ghost btn-sm">Same report, phone photo</button>
              <button type="button" disabled={busy} onClick={() => sample("A")} className="btn btn-ghost btn-sm">VCF A</button>
              <button type="button" disabled={busy} onClick={() => sample("B")} className="btn btn-ghost btn-sm">VCF B</button>
            </div>
          </div>
          {err && <p role="alert" className="text-sm text-danger">{err}</p>}
          {locked && <p className="text-sm text-warn">Live runs need the pilot access code. <a href="/login?next=/" className="underline underline-offset-2">Sign in</a>, or <a href="/sample" className="underline underline-offset-2">open the finished sample report</a>.</p>}
          </>)}
        </form>

        <aside className="space-y-4 text-sm lg:sticky lg:top-20 lg:self-start">
          {steps.length > 0 && (
            <div ref={logRef} className="scroll-mt-4">
              <h2 className="section-title mb-2">Live run</h2>
              <RunLog steps={steps} onDone={ready} />
            </div>
          )}
          {steps.length === 0 && mode === "pretest" && (
            <div className="card spot p-5">
              <h3 className="section-title">Why test before cycle 1</h3>
              <ul className="mt-4 space-y-3 text-sm text-muted">
                <li><span className="font-medium text-foreground">The result comes too late.</span> Indian labs take 7 to 10 days, so a test ordered at the first infusion returns after the toxicity window. Order it at diagnosis.</li>
                <li><span className="font-medium text-foreground">The risky genes differ here.</span> HapB3 rather than *2A for DPYD, NUDT15 rather than TPMT for thiopurines, and G6PD deficiency in about 8.5% of Indians before rasburicase.</li>
                <li><span className="font-medium text-foreground">When it comes back,</span> upload the report or a photo of it. The same regimen is checked against the actual genotype.</li>
              </ul>
            </div>
          )}
          {steps.length === 0 && mode !== "pretest" && (
            <div className="card spot p-5">
              <h3 className="section-title">What happens when you press Analyse</h3>
              <ol className="mt-4 space-y-3 text-sm text-muted">
                <li className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-3"><span className="badge justify-self-start badge-meta">Muse Spark</span><span>reads the PDF or photo and quotes each gene call verbatim</span></li>
                <li className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-3"><span className="badge justify-self-start badge-det">PharmCAT</span><span>assigns phenotypes, attaches CPIC, DPWG and FDA-label dosing</span></li>
                <li className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-3"><span className="badge justify-self-start badge-det">India lens</span><span>fires cited rules for HapB3, c.85T&gt;C, NUDT15</span></li>
                <li className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-3"><span className="badge justify-self-start badge-meta">Muse Spark</span><span>ranks each drug and writes EN + Malayalam</span></li>
                <li className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-3"><span className="badge justify-self-start badge-meta">Muse Voice</span><span>turns a dictated consult into the medication list</span></li>
              </ol>
            </div>
          )}
        </aside>
      </div>
      </Chapter>
    </main>
  );
}
