"use client";
import { useState } from "react";

export function PrintButton() {
  return <button type="button" onClick={() => window.print()} className="btn btn-ghost btn-sm print:hidden">Print / PDF</button>;
}

/** Muse Spark web search: published frequency of each non-reference allele in Indian populations, with sources. */
export function LiteratureCheck({ id }: { id: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [rows, setRows] = useState<{ allele: string; summary: string; citations: { url: string; title: string }[] }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  return (
    <section className="mt-10 print:hidden">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="section-title">What is published for India?</h2>
        <button
          type="button"
          disabled={state === "busy"}
          aria-busy={state === "busy"}
          onClick={async () => {
            setState("busy"); setErr(null);
            const r = await fetch(`/api/literature/${id}`, { method: "POST" });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) { setErr(j.error ?? "Search failed. Try again."); setState("idle"); return; }
            setRows(j.literature); setState("done");
          }}
          className="btn btn-ghost btn-sm"
        >
          {state === "busy" ? "Searching with Muse Spark…" : "Find Indian frequency data"}
          <span className="badge badge-meta">web search</span>
        </button>
      </div>
      {err && <p role="alert" className="mt-2 text-sm text-danger">{err}</p>}
      {state === "done" && rows.length === 0 && <p className="mt-2 text-sm text-muted">This record carries only reference alleles, so there is nothing to look up.</p>}
      {rows.length > 0 && (
        <div className="card mt-3 divide-y divide-line text-sm">
          {rows.map((r) => (
            <div key={r.allele} className="p-4">
              <div className="num font-medium">{r.allele}</div>
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

type Status = "verified" | "corrected" | "unreadable";

/** A person checks each call against the source document. Data quality only; written to the audit log. */
export function CuratorReview({ id, calls, reviewed }: { id: string; calls: { gene: string; diplotype: string }[]; reviewed: { curator: string; at: string } | null }) {
  const [curator, setCurator] = useState("");
  const [note, setNote] = useState("");
  const [decisions, setDecisions] = useState<Record<string, Status>>(Object.fromEntries(calls.map((c) => [c.gene, "verified"])));
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [done, setDone] = useState(reviewed);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (done)
    return (
      <p className="note-info mt-10 rounded-lg border p-4 text-sm">
        Checked against the source by <b>{done.curator}</b> on <span className="num">{new Date(done.at).toLocaleString()}</span>. Logged in the record&apos;s audit trail.
      </p>
    );
  return (
    <form
      className="card mt-10 p-5 print:hidden"
      onSubmit={async (e) => {
        e.preventDefault(); setErr(null); setBusy(true);
        const r = await fetch(`/api/review/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ curator, decisions, corrections, note }) });
        const j = await r.json().catch(() => ({}));
        setBusy(false);
        if (!r.ok) return setErr(j.error ?? "Could not save. Try again.");
        setDone({ curator, at: new Date().toISOString() });
      }}
    >
      <h2 className="text-base font-semibold">Curator review</h2>
      <p className="mt-1 text-sm text-muted">Check each call against the source document before the record counts in a cohort. Calls marked unreadable are left out of cohort statistics.</p>
      <div className="mt-4 divide-y divide-line border-y border-line text-sm">
        {calls.map((c) => (
          <fieldset key={c.gene} className="grid gap-2 py-2.5 sm:grid-cols-[6rem_minmax(0,1fr)_auto] sm:items-center">
            <legend className="sr-only">{c.gene}</legend>
            <span className="num font-medium">{c.gene}</span>
            <span className="num truncate text-muted" title={c.diplotype}>{c.diplotype}</span>
            <div className="flex flex-wrap gap-2">
              {(["verified", "corrected", "unreadable"] as const).map((v) => (
                <label key={v} className="chip btn-sm cursor-pointer">
                  <input type="radio" name={c.gene} value={v} checked={decisions[c.gene] === v} onChange={() => setDecisions({ ...decisions, [c.gene]: v })} className="sr-only" />
                  {v}
                </label>
              ))}
            </div>
            {decisions[c.gene] === "corrected" && (
              <input value={corrections[c.gene] ?? ""} onChange={(e) => setCorrections({ ...corrections, [c.gene]: e.target.value })} placeholder="Correct call as printed, e.g. *1/*28" className="field num sm:col-span-3" />
            )}
          </fieldset>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[10rem_1fr_auto]">
        <label className="block">
          <span className="sr-only">Curator initials</span>
          <input value={curator} onChange={(e) => setCurator(e.target.value)} placeholder="Initials" autoComplete="off" className="field" required />
        </label>
        <label className="block">
          <span className="sr-only">Note</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="field" />
        </label>
        <button disabled={busy} className="btn btn-primary">{busy ? "Saving…" : "Save review"}</button>
      </div>
      {err && <p role="alert" className="mt-2 text-sm text-danger">{err}</p>}
    </form>
  );
}
