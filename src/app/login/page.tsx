"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function Form() {
  const r = useRouter();
  const next = useSearchParams().get("next") ?? "/";
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="mx-auto mt-24 max-w-sm space-y-4 px-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
        if (res.ok) r.push(next);
        else setErr((await res.json()).error ?? "failed");
      }}
    >
      <h1 className="text-xl font-semibold">Pathya</h1>
      <p className="text-sm text-neutral-600">Pilot access. Enter the code you were given.</p>
      <input value={code} onChange={(e) => setCode(e.target.value)} type="password" autoFocus className="field" placeholder="Access code" />
      <button className="btn btn-primary w-full">Enter</button>
      {err && <p className="text-sm text-red-600">{err}</p>}
    </form>
  );
}

export default function Login() {
  return <Suspense><Form /></Suspense>;
}
