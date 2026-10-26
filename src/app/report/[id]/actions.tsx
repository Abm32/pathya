"use client";
import { useState } from "react";

export function PrintButton() {
  return <button type="button" onClick={() => window.print()} className="rounded border px-3 py-1.5 text-sm print:hidden">Print / PDF</button>;
}

export function LatestCheck({ id, enabled }: { id: string; enabled: boolean }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [rows, setRows] = useState<{ drug: string; summary: string; citations: { url: string; title: string }[] }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  if (!enabled) return null;
  return (
    <section className="mt-8 print:hidden">
      <div className="flex items-center gap-3">
        <h2 className="font-medium">Newer than our guideline data?</h2>
        <button
          type="button"
          disabled={state === "busy"}
          onClick={async () => {
            setState("busy"); setErr(null);
            const r = await fetch(`/api/latest/${id}`, { method: "POST" });
            const j = await r.json();
            if (!r.ok) { setErr(j.error ?? "failed"); setState("idle"); return; }
            setRows(j.latest); setState("done");
          }}
          className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {state === "busy" ? "Searching with Muse Spark…" : "Check labels & guidelines (web search)"}
        </button>
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      {rows.length > 0 && (
        <div className="mt-3 divide-y rounded-lg border text-sm">
          {rows.map((r) => (
            <div key={r.drug} className="p-3">
              <div className="font-medium">{r.drug}</div>
              <p className="mt-1 text-neutral-700">{r.summary}</p>
              <p className="mt-1 text-xs">{r.citations.map((c) => <a key={c.url} href={c.url} target="_blank" rel="noreferrer" className="mr-3 underline">{c.title || c.url}</a>)}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function ConfirmPanel({ id, drugs, confirmed }: { id: string; drugs: { drug: string; risk: string }[]; confirmed: { clinician: string; at: string } | null }) {
  const [clinician, setClinician] = useState("");
  const [note, setNote] = useState("");
  const [decisions, setDecisions] = useState<Record<string, string>>(Object.fromEntries(drugs.map((d) => [d.drug, "accept"])));
  const [done, setDone] = useState(confirmed);
  const [err, setErr] = useState<string | null>(null);
  if (done) return <p className="mt-8 rounded-lg border border-green-300 bg-green-50 p-3 text-sm">Reviewed and confirmed by <b>{done.clinician}</b> on {new Date(done.at).toLocaleString()}. Logged in the case audit trail.</p>;
  return (
    <form
      className="mt-8 rounded-lg border p-4 print:hidden"
      onSubmit={async (e) => {
        e.preventDefault(); setErr(null);
        const r = await fetch(`/api/confirm/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clinician, decisions, note }) });
        const j = await r.json();
        if (!r.ok) return setErr(j.error ?? "failed");
        setDone({ clinician, at: new Date().toISOString() });
      }}
    >
      <h2 className="font-medium">Clinician review</h2>
      <p className="mt-1 text-sm text-neutral-600">Nothing leaves this page as advice until you confirm. Your decisions are written to the audit log.</p>
      <div className="mt-3 space-y-2 text-sm">
        {drugs.map((d) => (
          <div key={d.drug} className="flex items-center gap-3">
            <span className="w-40 font-medium">{d.drug}</span>
            {["accept", "modify", "reject"].map((v) => (
              <label key={v} className="flex items-center gap-1">
                <input type="radio" name={d.drug} checked={decisions[d.drug] === v} onChange={() => setDecisions({ ...decisions, [d.drug]: v })} /> {v}
              </label>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        <input value={clinician} onChange={(e) => setClinician(e.target.value)} placeholder="Your initials / ID" className="rounded border px-3 py-1.5 text-sm" required />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="flex-1 rounded border px-3 py-1.5 text-sm" />
        <button className="rounded bg-black px-4 py-1.5 text-sm text-white">Confirm review</button>
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
    </form>
  );
}
