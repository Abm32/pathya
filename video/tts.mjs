// Narration for the demo video. Local neural TTS, no API key, no network after the voice is cached.
//   node video/tts.mjs            # writes video/out/vo/<id>.wav and video/out/timing.json
//   node video/tts.mjs --list     # print the measured durations only
// The audio is cut first on purpose: the measured length of each line is what the picture is edited to.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "video/out/vo");
const VOICES = path.join(ROOT, "video/voices");
const script = JSON.parse(readFileSync(path.join(ROOT, "video/script.json"), "utf8"));

mkdirSync(OUT, { recursive: true });
mkdirSync(VOICES, { recursive: true });

if (!existsSync(path.join(VOICES, `${script.voice}.onnx`))) {
  console.log(`fetching voice ${script.voice}`);
  execFileSync("python3", ["-m", "piper.download_voices", "--data-dir", VOICES, script.voice], { stdio: "inherit" });
}

const duration = (f) =>
  Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }).trim());

const timing = [];
for (const s of script.scenes) {
  const wav = path.join(OUT, `${s.id}.wav`);
  if (!existsSync(wav) || process.argv.includes("--force")) {
    execFileSync(
      "piper",
      ["-m", script.voice, "--data-dir", VOICES, "--length-scale", String(script.lengthScale), "--sentence-silence", "0.32", "-f", wav],
      { input: s.vo },
    );
  }
  timing.push({ id: s.id, card: s.card, shot: s.shot, vo: s.vo, seconds: Number(duration(wav).toFixed(2)) });
}

// Every scene gets a breath after it, so the cut never lands on the last syllable.
const PAD = 0.45;
let t = 0;
for (const s of timing) {
  s.start = Number(t.toFixed(2));
  s.total = Number((s.seconds + PAD).toFixed(2));
  t += s.total;
}
const total = Number(t.toFixed(2));
writeFileSync(path.join(ROOT, "video/out/timing.json"), JSON.stringify({ total, pad: PAD, scenes: timing }, null, 1));

const mmss = (x) => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, "0")}`;
for (const s of timing) console.log(`${mmss(s.start).padStart(5)}  ${String(s.total).padStart(6)}s  ${s.id}`);
console.log(`\ntotal ${mmss(total)} (${total}s), hard limit 3:00`);
if (total > 180) console.log(`OVER BY ${(total - 180).toFixed(1)}s — cut words, do not speed the voice up`);
