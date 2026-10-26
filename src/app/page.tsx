"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Recorder } from "./recorder";

const SAMPLE_MEDS: Record<string, string> = {
  A: "Xeloda\nirinotecan\nondansetron\npantoprazole\nclopidogrel",
  B: "fluorouracil (5-FU)\nmercaptopurine\ntramadol",
  lab: "capecitabine\nirinotecan\nazathioprine\nondansetron\ntamoxifen",
};

export default function Home() {
  const r = useRouter();
  const [mode, setMode] = useState<"report" | "vcf">("report");
  const [meds, setMeds] = useState(SAMPLE_MEDS.lab);
  const [label, setLabel] = useState("");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(fd: FormData) {
    setErr(null);
    setBusy(mode === "report" && !fd.get("sample")?.toString().match(/^[AB]$/) ? "Reading the report with Muse Spark, calling phenotypes with PharmCAT, writing the report…" : "Calling alleles with PharmCAT, then reasoning with Muse Spark…");
    fd.set("meds", meds);
    fd.set("label", label);
    const res = await fetch("/api/analyze", { method: "POST", body: fd });
    const j = await res.json();
    setBusy(null);
    if (!res.ok) return setErr(j.detail ?? j.error ?? "failed");
    r.push(`/report/${j.id}`);
  }

  const sample = (s: string) => {
    const fd = new FormData();
    fd.set("sample", s);
    setMeds(SAMPLE_MEDS[s]);
    submit(fd);
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Anukriti PGx Copilot</h1>
      <p className="mt-2 text-neutral-600">
        Pharmacogenomic result in, oncologist-ready toxicity report out. Dose actions from CPIC, DPWG and FDA labels with citations,
        an India-specific variant lens, and a patient explanation in English and Malayalam.
      </p>

      <form className="mt-8 space-y-5" onSubmit={(e) => { e.preventDefault(); submit(new FormData(e.currentTarget)); }}>
        <div className="flex gap-2 text-sm">
          {(["report", "vcf"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-full border px-3 py-1 ${mode === m ? "bg-black text-white" : ""}`}>
              {m === "report" ? "Lab report (PDF / photo)" : "Genotype VCF (GRCh38)"}
            </button>
          ))}
        </div>
        {mode === "report" ? (
          <label className="block">
            <span className="text-sm font-medium">Lab PGx report</span>
            <input name="report" type="file" accept="application/pdf,image/*" className="mt-1 block w-full text-sm" />
            <span className="text-xs text-neutral-500">Muse Spark reads the PDF or photo, quotes every call verbatim, then PharmCAT assigns phenotypes.</span>
          </label>
        ) : (
          <label className="block">
            <span className="text-sm font-medium">VCF</span>
            <input name="vcf" type="file" accept=".vcf,.gz,.bgz" className="mt-1 block w-full text-sm" />
          </label>
        )}
        <label className="block">
          <span className="text-sm font-medium">Case label (no patient identifiers)</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. CRC-2026-014" className="mt-1 w-full rounded border px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Medications (current + planned), one per line</span>
          <textarea value={meds} onChange={(e) => setMeds(e.target.value)} rows={6} className="mt-1 w-full rounded border px-3 py-2 font-mono text-sm" />
        </label>
        <Recorder
          onResult={(res) => {
            setTranscript(res.transcript);
            const names = res.extract.medications.map((m) => (m.dose ? `${m.name} (${m.dose}, ${m.context})` : `${m.name} (${m.context})`));
            setMeds((prev) => [...prev.split("\n").filter(Boolean), ...names].join("\n"));
          }}
        />
        {transcript && (
          <details className="rounded border p-3 text-sm">
            <summary className="cursor-pointer">Transcript (Muse Voice, diarized)</summary>
            <pre className="mt-2 whitespace-pre-wrap text-xs">{transcript}</pre>
          </details>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={!!busy} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">Analyse</button>
          <span className="text-sm text-neutral-500">or a sample:</span>
          <button type="button" disabled={!!busy} onClick={() => sample("lab")} className="rounded border px-3 py-2 text-sm disabled:opacity-50">Lab PDF (Indian panel)</button>
          <button type="button" disabled={!!busy} onClick={() => sample("A")} className="rounded border px-3 py-2 text-sm disabled:opacity-50">VCF A</button>
          <button type="button" disabled={!!busy} onClick={() => sample("B")} className="rounded border px-3 py-2 text-sm disabled:opacity-50">VCF B</button>
        </div>
        {busy && <p className="text-sm text-neutral-600">{busy}</p>}
        {err && <p className="text-sm text-red-600">{err}</p>}
      </form>
      <p className="mt-10 text-xs text-neutral-500">
        Decision support only. Every recommendation carries its guideline source; the treating clinician confirms before any change in therapy.
      </p>
    </main>
  );
}
