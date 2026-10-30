"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { Mark } from "../logo";

function Form() {
  const r = useRouter();
  const next = useSearchParams().get("next") ?? "/";
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="card mx-auto mt-20 max-w-sm space-y-4 p-6"
      onSubmit={async (e) => {
        e.preventDefault(); setErr(null); setBusy(true);
        const res = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
        setBusy(false);
        if (res.ok) r.push(next);
        else setErr((await res.json()).error ?? "That code did not work. Check it and try again.");
      }}
    >
      <div>
        <Mark size={44} />
        <h1 className="mt-4 text-xl font-semibold tracking-tight">Curator sign-in</h1>
        <p className="mt-1 text-sm text-muted">Reading records, running a report and dictating results need no code at all — just go to the <a href="/" className="text-accent underline decoration-accent/30 underline-offset-2">home page</a>. This sign-in is for curators, who verify records and write into the verified cohorts. <a href="/sample" className="text-accent underline decoration-accent/30 underline-offset-2">Open a sample record</a> or <Link href="/cohort" className="text-accent underline decoration-accent/30 underline-offset-2">the demo cohort</Link>.</p>
      </div>
      <label className="block">
        <span className="text-sm font-medium">Curator code</span>
        <input value={code} onChange={(e) => setCode(e.target.value)} type="password" autoComplete="one-time-code" autoFocus required className="field mt-1 font-mono" />
      </label>
      <button disabled={busy} className="btn btn-primary w-full">{busy ? "Checking…" : "Enter"}</button>
      {err && <p role="alert" className="text-sm text-danger">{err}</p>}
    </form>
  );
}

export default function Login() {
  return <Suspense><Form /></Suspense>;
}
