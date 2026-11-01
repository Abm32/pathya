// Narration for the demo video. ElevenLabs, voice set in script.json.
//   node video/tts.mjs [--force] [--voice <voice_id>]
//
// The audio is cut first on purpose: the measured length of each line is what the picture is edited to.
// Each sentence is a separate request, so its length is measured rather than estimated and the captions
// land where the voice actually is. previous_text/next_text carry the prosody across those joins, so
// splitting costs nothing in delivery - without them each sentence would start cold.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { say } from "./speakable.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "video/out/vo");
const script = JSON.parse(readFileSync(path.join(ROOT, "video/script.json"), "utf8"));
const KEY = readFileSync(path.join(ROOT, ".env"), "utf8").match(/^ELEVENLABS_API=(.*)$/mi)?.[1].trim().replace(/^["']|["']$/g, "");
if (!KEY) throw new Error("ELEVENLABS_API missing from .env");
const voiceId = process.argv.includes("--voice") ? process.argv[process.argv.indexOf("--voice") + 1] : script.voiceId;
const force = process.argv.includes("--force");

mkdirSync(OUT, { recursive: true });
const duration = (f) =>
  Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }).trim());

/** Caption-sized pieces: a line read at a glance, broken where a speaker breathes. */
function lines(sentence, max = 46) {
  const out = [];
  let cur = "";
  for (const w of sentence.trim().split(/\s+/)) {
    if (cur && (cur + " " + w).length > max) { out.push(cur); cur = w; }
    else cur = cur ? `${cur} ${w}` : w;
    if (/[,:;]$/.test(cur) && cur.length > max * 0.55) { out.push(cur); cur = ""; }
  }
  if (cur) out.push(cur);
  if (out.length > 1 && out.at(-1).split(/\s+/).length <= 2 && (out.at(-2) + " " + out.at(-1)).length <= max + 12) {
    out.splice(-2, 2, `${out.at(-2)} ${out.at(-1)}`);
  }
  return out;
}

// Every sentence in the film, in order, so each request can see its neighbours.
const flat = [];
for (const s of script.scenes)
  for (const sentence of s.vo.match(/[^.!?]+[.!?]+/g)?.map((x) => x.trim()) ?? [s.vo])
    flat.push({ scene: s.id, sentence });

const GAP = 0.2;   // silence between sentences
const byScene = new Map();
flat.forEach((f, i) => {
  const dir = path.join(OUT, f.scene);
  if (force && !byScene.has(f.scene)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const n = (byScene.get(f.scene) ?? []).length;
  // Keyed by what is actually said, so editing a line can never reuse the old take.
  const key = createHash("sha256").update(`${voiceId}|${script.model}|${JSON.stringify(script.voiceSettings)}|${say(f.sentence)}`).digest("hex").slice(0, 10);
  const mp3 = path.join(dir, `${String(n).padStart(2, "0")}-${key}.mp3`);
  if (!existsSync(mp3)) {
    const body = JSON.stringify({
      text: say(f.sentence),
      model_id: script.model,
      previous_text: i > 0 ? say(flat[i - 1].sentence) : undefined,
      next_text: i < flat.length - 1 ? say(flat[i + 1].sentence) : undefined,
      voice_settings: script.voiceSettings,
    });
    const out = execFileSync("curl", ["-sS", "--fail-with-body", "-X", "POST",
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_192`,
      "-H", `xi-api-key: ${KEY}`, "-H", "content-type: application/json", "-d", body, "-o", mp3]);
    void out;
    if (readFileSync(mp3).subarray(0, 1).toString() === "{") throw new Error(`TTS failed: ${readFileSync(mp3, "utf8").slice(0, 300)}`);
  }
  byScene.set(f.scene, [...(byScene.get(f.scene) ?? []), { mp3, sentence: f.sentence, seconds: duration(mp3) }]);
  process.stdout.write(`\r synthesised ${i + 1}/${flat.length}  `);
});
console.log();

const silence = path.join(OUT, "_gap.mp3");
execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", `anullsrc=r=44100:cl=mono:d=${GAP}`, silence]);

const timing = [];
for (const s of script.scenes) {
  const parts = byScene.get(s.id);
  const dir = path.join(OUT, s.id);
  const list = path.join(dir, "list.txt");
  writeFileSync(list, parts.flatMap((p, i) => (i ? [`file '${silence}'`, `file '${p.mp3}'`] : [`file '${p.mp3}'`])).join("\n"));
  const sceneWav = path.join(OUT, `${s.id}.wav`);
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", list,
    "-ar", "48000", "-ac", "1", sceneWav]);

  const cues = [];
  let t = 0;
  for (const p of parts) {
    const ls = lines(p.sentence);
    const chars = ls.reduce((a, l) => a + l.length, 0);
    let lt = t;
    for (const l of ls) {
      const d = (p.seconds * l.length) / chars;
      cues.push({ text: l, start: Number(lt.toFixed(3)), end: Number((lt + d).toFixed(3)) });
      lt += d;
    }
    t += p.seconds + GAP;
  }
  timing.push({ id: s.id, card: s.card, shot: s.shot, vo: s.vo, seconds: Number(duration(sceneWav).toFixed(2)), cues });
}

const PAD = 0.32;
let t = 0;
for (const s of timing) {
  s.start = Number(t.toFixed(2));
  s.total = Number((s.seconds + PAD).toFixed(2));
  t += s.total;
}
const total = Number(t.toFixed(2));
writeFileSync(path.join(ROOT, "video/out/timing.json"), JSON.stringify({ total, pad: PAD, voiceId, scenes: timing }, null, 1));

const mmss = (x) => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, "0")}`;
for (const s of timing) console.log(`${mmss(s.start).padStart(5)}  ${String(s.total).padStart(6)}s  ${String(s.cues.length).padStart(2)} cues  ${s.id}`);
console.log(`\n${flat.length} sentences, ${script.model}, total ${mmss(total)} (${total}s), hard limit 3:00`);
if (total > 180) console.log(`OVER BY ${(total - 180).toFixed(1)}s — cut words, do not speed the voice up`);
