"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Recorder } from "./recorder";
import { Cite } from "./cite";

const SAMPLE_MEDS: Record<string, string> = {
  A: "Xeloda\nirinotecan\nondansetron\npantoprazole\nclopidogrel",
  B: "fluorouracil (5-FU)\nmercaptopurine\ntramadol",
  lab: "capecitabine\nirinotecan\nazathioprine\nondansetron\ntamoxifen",
};

const STAGES = ["Reading the result", "Calling phenotypes (PharmCAT)", "Mapping medications & writing the report (Muse Spark)"];

export default function Home() {
  const r = useRouter();
  const [mode, setMode] = useState<"report" | "vcf">("report");
  const [meds, setMeds] = useState(SAMPLE_MEDS.lab);
  const [label, setLabel] = useState("");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!busy) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  async function submit(fd: FormData) {
    setErr(null);
    setBusy(true);
    fd.set("meds", meds);
    fd.set("label", label);
    const res = await fetch("/api/analyze", { method: "POST", body: fd });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(j.detail ?? j.error ?? "failed");
    r.push(`/report/${j.id}`);
  }

  const sample = (s: string) => {
    const fd = new FormData();
    fd.set("sample", s);
    setMeds(SAMPLE_MEDS[s]);
    submit(fd);
  };
  const stage = elapsed < 8 ? 0 : elapsed < 14 ? 1 : 2;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight">
          The lab report says <span className="font-mono text-accent">HapB3 heterozygous</span>.<br />
          What do you prescribe at 9 a.m.?
        </h1>
        <p className="mt-3 text-muted">
          Pathya turns a pharmacogenomic result into an oncologist-ready toxicity report: dose actions from CPIC, DPWG and FDA labels with
          citations, an India-specific variant lens, and a patient explanation in English and Malayalam.
        </p>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-[1fr_300px]">
        <form className="card space-y-5 p-5" onSubmit={(e) => { e.preventDefault(); submit(new FormData(e.currentTarget)); }}>
          <div className="flex gap-2 text-sm">
            {(["report", "vcf"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m} className="chip">
                {m === "report" ? "Lab report (PDF / photo)" : "Genotype VCF (GRCh38)"}
              </button>
            ))}
          </div>
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
              <span className="mr-1 text-xs text-muted">Try a sample:</span>
              <button type="button" disabled={busy} onClick={() => sample("lab")} className="btn btn-ghost btn-sm">Lab PDF, Indian panel</button>
              <button type="button" disabled={busy} onClick={() => sample("photo")} className="btn btn-ghost btn-sm">Same report, phone photo</button>
              <button type="button" disabled={busy} onClick={() => sample("A")} className="btn btn-ghost btn-sm">VCF A</button>
              <button type="button" disabled={busy} onClick={() => sample("B")} className="btn btn-ghost btn-sm">VCF B</button>
            </div>
          </div>
          {busy && (
            <ol aria-live="polite" className="space-y-1 text-sm">
              {STAGES.map((s, i) => (
                <li key={s} className={i < stage ? "text-muted line-through" : i === stage ? "font-medium text-accent" : "text-muted"}>
                  {i < stage ? "✓ " : i === stage ? "● " : "○ "}{s}{i === stage ? ` · ${elapsed}s` : ""}
                </li>
              ))}
            </ol>
          )}
          {err && <p role="alert" className="text-sm text-danger">{err}</p>}
        </form>

        <aside className="space-y-4 text-sm">
          <div className="card p-4">
            <h2 className="section-title">How it works</h2>
            <ol className="mt-2 space-y-2 text-muted">
              <li><b className="text-foreground">1. Read.</b> <span className="badge badge-meta">Muse Spark</span> extracts gene calls from the PDF or phone photo, quoting the source text.</li>
              <li><b className="text-foreground">2. Call.</b> <span className="badge badge-det">PharmCAT</span> assigns phenotypes and attaches CPIC, DPWG and FDA-label text. No dose comes from an LLM.</li>
              <li><b className="text-foreground">3. India lens.</b> Rule-based notes for HapB3, c.85T&gt;C and NUDT15, each with a PMID.</li>
              <li><b className="text-foreground">4. Explain.</b> <span className="badge badge-meta">Muse Spark</span> ranks risk per medication and writes for the clinician and, in Malayalam, for the patient.</li>
              <li><b className="text-foreground">5. Dictate.</b> <span className="badge badge-meta">Muse Voice</span> turns the consult into a medication list.</li>
            </ol>
          </div>
          <div className="card p-4">
            <h2 className="section-title">Why India needs its own lens</h2>
            <p className="mt-2 text-muted">CPIC's DPYD panel was derived from Europeans. In Indians, *2A is near-absent, HapB3 is the dominant risk variant and c.85T&gt;C runs at ~25% with replicated toxicity association in Kerala cohorts.</p>
            <p className="mt-2 text-xs text-muted"><Cite text="PMID 40810747 · PMC11300675 · PMID 33105068" /></p>
          </div>
        </aside>
      </div>
    </main>
  );
}
