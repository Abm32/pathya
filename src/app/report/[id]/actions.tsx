"use client";
import { useState } from "react";

export function PrintButton() {
  return <button type="button" onClick={() => window.print()} className="btn btn-ghost btn-sm print:hidden">Print / PDF</button>;
}

export function LatestCheck({ id, enabled }: { id: string; enabled: boolean }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [rows, setRows] = useState<{ drug: string; summary: string; citations: { url: string; title: string }[] }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  if (!enabled) return null;
  return (
    <section className="mt-10 print:hidden">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="section-title">Newer than our guideline data?</h2>
        <button
          type="button"
          disabled={state === "busy"}
          aria-busy={state === "busy"}
          onClick={async () => {
            setState("busy"); setErr(null);
            const r = await fetch(`/api/latest/${id}`, { method: "POST" });
            const j = await r.json();
            if (!r.ok) { setErr(j.error ?? "Search failed. Try again."); setState("idle"); return; }
            setRows(j.latest); setState("done");
          }}
          className="btn btn-ghost btn-sm"
        >
          {state === "busy" ? "Searching with Muse Spark…" : "Check labels & guidelines"}
          <span className="badge badge-meta">web search</span>
        </button>
      </div>
      {err && <p role="alert" className="mt-2 text-sm text-danger">{err}</p>}
      {state === "done" && rows.length === 0 && <p className="mt-2 text-sm text-muted">Nothing newer than the bundled CPIC data was found for these drugs.</p>}
      {rows.length > 0 && (
        <div className="card mt-3 divide-y divide-line text-sm">
          {rows.map((r) => (
            <div key={r.drug} className="p-4">
              <div className="font-medium">{r.drug}</div>
              <p className="mt-1">{r.summary}</p>
              <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {r.citations.map((c) => <a key={c.url} href={c.url} target="_blank" rel="noreferrer" className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent">{c.title || c.url}</a>)}
              </p>
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
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (done)
    return (
      <p className="note-info mt-10 rounded-lg border p-4 text-sm">
        Reviewed and confirmed by <b>{done.clinician}</b> on <span className="num">{new Date(done.at).toLocaleString()}</span>. Logged in the case audit trail.
      </p>
    );
  return (
    <form
      className="card mt-10 p-5 print:hidden"
      onSubmit={async (e) => {
        e.preventDefault(); setErr(null); setBusy(true);
        const r = await fetch(`/api/confirm/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clinician, decisions, note }) });
        const j = await r.json();
        setBusy(false);
        if (!r.ok) return setErr(j.error ?? "Could not save. Try again.");
        setDone({ clinician, at: new Date().toISOString() });
      }}
    >
      <h2 className="text-base font-semibold">Clinician review</h2>
      <p className="mt-1 text-sm text-muted">Nothing leaves this page as advice until you confirm. Each decision is written to the audit log.</p>
      <div className="mt-4 divide-y divide-line border-y border-line text-sm">
        {drugs.map((d) => (
          <fieldset key={d.drug} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
            <legend className="sr-only">{d.drug}</legend>
            <span className="w-40 font-medium">{d.drug}</span>
            <div className="flex gap-2">
              {(["accept", "modify", "reject"] as const).map((v) => (
                <label key={v} className="chip btn-sm cursor-pointer">
                  <input type="radio" name={d.drug} value={v} checked={decisions[d.drug] === v} onChange={() => setDecisions({ ...decisions, [d.drug]: v })} className="sr-only" />
                  {v}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[10rem_1fr_auto]">
        <label className="block">
          <span className="sr-only">Clinician initials or ID</span>
          <input value={clinician} onChange={(e) => setClinician(e.target.value)} placeholder="Initials / ID" autoComplete="off" className="field" required />
        </label>
        <label className="block">
          <span className="sr-only">Note</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="field" />
        </label>
        <button disabled={busy} className="btn btn-primary">{busy ? "Saving…" : "Confirm review"}</button>
      </div>
      {err && <p role="alert" className="mt-2 text-sm text-danger">{err}</p>}
    </form>
  );
}
