// Assemble the film. The audio is the master: every clip is trimmed or frame-padded to its line.
//   node video/cut.mjs
// Writes video/out/pathya-demo.mp4 (H.264 + AAC, 1080p30) and video/out/pathya-demo.srt.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "video/out");
const SEG = path.join(OUT, "seg");
const timing = JSON.parse(readFileSync(path.join(OUT, "timing.json"), "utf8"));
const ff = (args) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });

rmSync(SEG, { recursive: true, force: true });
mkdirSync(SEG, { recursive: true });

const LAST = timing.scenes.length - 1;
for (const [i, s] of timing.scenes.entries()) {
  const vIn = path.join(OUT, "clips", `${s.id}.webm`);
  const aIn = path.join(OUT, "vo", `${s.id}.wav`);
  // tpad clones the final frame if the shot came up short; -t then cuts every segment to the exact line length.
  // The narration starts a beat late so a cut never lands on the first syllable, and the pad is the breath after.
  const fades = [
    i === 0 ? "fade=t=in:st=0:d=0.8" : "fade=t=in:st=0:d=0.22",
    i === LAST ? `fade=t=out:st=${(s.total - 1).toFixed(2)}:d=1` : `fade=t=out:st=${(s.total - 0.18).toFixed(2)}:d=0.18`,
  ].join(",");
  ff([
    "-i", vIn, "-i", aIn,
    "-filter_complex",
    `[0:v]tpad=stop_mode=clone:stop_duration=6,fps=30,scale=1920:1080:flags=lanczos,setsar=1,${fades}[v];` +
      `[1:a]adelay=160|160,apad,atrim=0:${s.total},afade=t=in:st=0:d=0.12,afade=t=out:st=${(s.total - 0.3).toFixed(2)}:d=0.3[a]`,
    "-map", "[v]", "-map", "[a]", "-t", String(s.total),
    "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
    path.join(SEG, `${String(i).padStart(2, "0")}.mp4`),
  ]);
  console.log(`cut ${s.id}  ${s.total}s`);
}

const list = path.join(SEG, "list.txt");
writeFileSync(list, timing.scenes.map((_, i) => `file '${String(i).padStart(2, "0")}.mp4'`).join("\n"));
const mp4 = path.join(OUT, "pathya-demo.mp4");
ff(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", mp4]);

// Captions: one cue per sentence, timed inside its own scene so nothing drifts.
const srt = (t) => {
  const h = String(Math.floor(t / 3600)).padStart(2, "0");
  const m = String(Math.floor((t % 3600) / 60)).padStart(2, "0");
  const s = String(Math.floor(t % 60)).padStart(2, "0");
  return `${h}:${m}:${s},${String(Math.round((t % 1) * 1000)).padStart(3, "0")}`;
};
let n = 0;
const cues = [];
for (const sc of timing.scenes) {
  const sentences = sc.vo.match(/[^.!?]+[.!?]+/g) ?? [sc.vo];
  const chars = sentences.reduce((a, s) => a + s.length, 0);
  let t = sc.start + 0.16;
  for (const sentence of sentences) {
    const d = (sc.seconds * sentence.length) / chars;
    cues.push(`${++n}\n${srt(t)} --> ${srt(t + d)}\n${sentence.trim()}\n`);
    t += d;
  }
}
writeFileSync(path.join(OUT, "pathya-demo.srt"), cues.join("\n"));

const probe = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration,size", "-of", "csv=p=0", mp4], { encoding: "utf8" }).trim().split(",");
const dur = Number(probe[0]);
console.log(`\n${mp4}`);
console.log(`${Math.floor(dur / 60)}:${String(Math.round(dur % 60)).padStart(2, "0")}  ${(Number(probe[1]) / 1e6).toFixed(1)} MB  ${n} caption cues`);
if (dur > 180) console.log(`OVER THE 3:00 LIMIT by ${(dur - 180).toFixed(1)}s`);
