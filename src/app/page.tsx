"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const SAMPLE_MEDS = {
  A: "capecitabine\nirinotecan\nondansetron\nomeprazole\nclopidogrel",
  B: "fluorouracil (5-FU)\nmercaptopurine\ntramadol",
};

export default function Home() {
  const r = useRouter();
  const [meds, setMeds] = useState(SAMPLE_MEDS.A);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(fd: FormData) {
    setErr(null);
    setBusy("Calling alleles with PharmCAT, then reasoning with Muse Spark…");
    fd.set("meds", meds);
    fd.set("label", label);
    const res = await fetch("/api/analyze", { method: "POST", body: fd });
    const j = await res.json();
    setBusy(null);
    if (!res.ok) return setErr(j.detail ?? j.error ?? "failed");
    r.push(`/report/${j.id}`);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Anukriti PGx Copilot</h1>
      <p className="mt-2 text-neutral-600">
        Upload a patient genotype (VCF, GRCh38) and their medication list. Get a CPIC-grounded toxicity risk report for the
        oncologist and a plain-language explanation for the patient in English and Malayalam.
      </p>

      <form
        className="mt-8 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit(new FormData(e.currentTarget));
        }}
      >
        <label className="block">
          <span className="text-sm font-medium">Case label (no PHI)</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. CRC-2026-014" className="mt-1 w-full rounded border px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Genotype VCF</span>
          <input name="vcf" type="file" accept=".vcf,.gz,.bgz" className="mt-1 block w-full text-sm" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Medication list (one per line)</span>
          <textarea value={meds} onChange={(e) => setMeds(e.target.value)} rows={6} className="mt-1 w-full rounded border px-3 py-2 font-mono text-sm" />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={!!busy} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">Analyse</button>
          <span className="text-sm text-neutral-500">or try a sample:</span>
          {(["A", "B"] as const).map((s) => (
            <button
              key={s}
              type="button"
              disabled={!!busy}
              onClick={() => {
                const fd = new FormData();
                fd.set("sample", s);
                setMeds(SAMPLE_MEDS[s]);
                fd.set("meds", SAMPLE_MEDS[s]);
                submit(fd);
              }}
              className="rounded border px-3 py-2 text-sm disabled:opacity-50"
            >
              Patient {s}
            </button>
          ))}
        </div>
        {busy && <p className="text-sm text-neutral-600">{busy}</p>}
        {err && <p className="text-sm text-red-600">{err}</p>}
      </form>
      <p className="mt-10 text-xs text-neutral-500">
        Decision support only. Every recommendation carries its guideline source; a clinician confirms before any change in therapy.
      </p>
    </main>
  );
}
