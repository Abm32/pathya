"use client";
import { useRef, useState } from "react";

/** Records mic to 16 kHz mono 16-bit WAV in the browser (no deps), posts to /api/transcribe, returns the Muse Voice transcript. */
export function Recorder({ onResult }: { onResult: (transcript: string) => void }) {
  const [state, setState] = useState<"idle" | "rec" | "busy">("idle");
  const [err, setErr] = useState<string | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const chunks = useRef<Float32Array[]>([]);
  const stop = useRef<() => void>(() => {});

  async function start() {
    setErr(null);
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { setErr("Microphone blocked. Allow mic access in the browser and try again."); return; }
    const ac = new AudioContext({ sampleRate: 16000 });
    ctx.current = ac;
    const src = ac.createMediaStreamSource(stream);
    const proc = ac.createScriptProcessor(4096, 1, 1);
    chunks.current = [];
    proc.onaudioprocess = (e) => chunks.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    src.connect(proc);
    proc.connect(ac.destination);
    stop.current = () => { proc.disconnect(); src.disconnect(); stream.getTracks().forEach((t) => t.stop()); ac.close(); };
    setState("rec");
  }

  async function finish() {
    stop.current();
    setState("busy");
    const wav = encodeWav(chunks.current, ctx.current?.sampleRate ?? 16000);
    const fd = new FormData();
    fd.set("audio", new Blob([wav], { type: "audio/wav" }), "results.wav");
    const res = await fetch("/api/transcribe", { method: "POST", body: fd });
    const j = await res.json();
    setState("idle");
    if (!res.ok) return setErr(j.error ?? "transcription failed");
    onResult(j.transcript);
  }

  return (
    <div className="flex items-center gap-3">
      {state === "rec" ? (
        <button type="button" onClick={finish} className="btn btn-danger"><span aria-hidden className="inline-block size-2.5 rounded-sm bg-white" /> Stop &amp; transcribe</button>
      ) : (
        <button type="button" disabled={state === "busy"} aria-busy={state === "busy"} onClick={start} className="btn btn-ghost">
          <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" /></svg>
          {state === "busy" ? "Transcribing with Muse Voice…" : "Dictate results (EN / ML)"}
        </button>
      )}
      {err && <span role="alert" className="text-sm text-danger">{err}</span>}
    </div>
  );
}

function encodeWav(chunks: Float32Array[], sampleRate: number) {
  const n = chunks.reduce((a, c) => a + c.length, 0);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
  let o = 44;
  for (const c of chunks) for (let i = 0; i < c.length; i++, o += 2) v.setInt16(o, Math.max(-1, Math.min(1, c[i])) * 0x7fff, true);
  return buf;
}
