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
        <h1 className="mt-4 text-xl font-semibold tracking-tight">Pilot access</h1>
        <p className="mt-1 text-sm text-muted">Pathya is in a clinician pilot. Enter the code you were given. Just looking? <a href="/sample" className="text-accent underline decoration-accent/30 underline-offset-2">Open the sample report</a> or <Link href="/" className="text-accent underline decoration-accent/30 underline-offset-2">check a regimen</Link>, no code needed.</p>
      </div>
      <label className="block">
        <span className="text-sm font-medium">Access code</span>
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
