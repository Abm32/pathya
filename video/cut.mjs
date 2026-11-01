// Assemble the film. The audio is the master: every clip is trimmed or frame-padded to its line.
//   node video/cut.mjs [--no-subs] [--no-sfx]
// Writes video/out/pathya-demo.mp4 (H.264 + AAC, 1080p30, captions burned in),
// plus pathya-demo.srt and pathya-demo.ass for platforms that want their own.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import path from "node:path";
import { CUES } from "./sfx.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "video/out");
const SEG = path.join(OUT, "seg");
const timing = JSON.parse(readFileSync(path.join(OUT, "timing.json"), "utf8"));
const subs = !process.argv.includes("--no-subs");
const sfx = !process.argv.includes("--no-sfx");
const ff = (args) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });

// Narration polish. Cut the rumble and the boxy 250Hz mud, lift presence so consonants land, pull the
// sibilance back so it stays soft, then even out the level before the loudness pass.
const VOICE_CHAIN =
  "highpass=f=80," +
  "equalizer=f=240:t=q:w=1.1:g=-2.5," +
  "equalizer=f=3100:t=q:w=1.6:g=2.5," +
  "equalizer=f=7400:t=q:w=2.2:g=-3.5," +
  "acompressor=threshold=-20dB:ratio=3:attack=8:release=220:makeup=2," +
  "alimiter=limit=0.95";

/** Which sound sits under which scene, and when. Narration always wins; these are felt, not heard. */
const sfxFor = (id, i) => [
  ...(i > 0 ? [{ cue: "transition", at: 0 }] : []),
  ...(id === "09-getrm" ? [{ cue: "reveal", at: 0.15 }] : []),
  ...(id === "12-close" ? [{ cue: "resolve", at: 0.3 }] : []),
];

const esc = (s) => s.replace(/\\/g, "\\\\").replace(/\{/g, "\\{").replace(/\}/g, "\\}");
const ts = (t, srt) => {
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return srt
    ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(Math.floor(s)).padStart(2, "0")},${String(Math.round((s % 1) * 1000)).padStart(3, "0")}`
    : `${h}:${String(m).padStart(2, "0")}:${String(Math.floor(s)).padStart(2, "0")}.${String(Math.round((s % 1) * 100)).padStart(2, "0")}`;
};

// One line at a time, low in the frame, fading with the voice. A soft shadow rather than a hard outline
// keeps it legible over the app footage without drawing a box across the picture.
const ASS_HEAD = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Noto Sans,40,&H00F0F4F5,&H00000000,&HB4060806,0,0,1,0,2.5,2,260,260,62,1

[Events]
Format: Layer, Start, End, Style, MarginL, MarginR, MarginV, Text
`;

rmSync(SEG, { recursive: true, force: true });
mkdirSync(SEG, { recursive: true });

const ass = [ASS_HEAD];
const srt = [];
let n = 0;
for (const sc of timing.scenes) {
  for (const c of sc.cues) {
    const a = sc.start + c.start, b = sc.start + Math.min(c.end, sc.total);
    if (b - a < 0.25) continue;
    ass.push(`Dialogue: 0,${ts(a)},${ts(b)},Cap,,,,{\\fad(170,190)}${esc(c.text)}`);
    srt.push(`${++n}\n${ts(a, 1)} --> ${ts(b, 1)}\n${c.text}\n`);
  }
}
const assPath = path.join(OUT, "pathya-demo.ass");
writeFileSync(assPath, ass.join("\n") + "\n");
writeFileSync(path.join(OUT, "pathya-demo.srt"), srt.join("\n"));

const LAST = timing.scenes.length - 1;
for (const [i, s] of timing.scenes.entries()) {
  const cues = sfx ? sfxFor(s.id, i).filter((c) => existsSync(path.join(OUT, "sfx", `${c.cue}.mp3`))) : [];
  const fades = [
    i === 0 ? "fade=t=in:st=0:d=0.8" : "fade=t=in:st=0:d=0.22",
    i === LAST ? `fade=t=out:st=${(s.total - 1).toFixed(2)}:d=1` : `fade=t=out:st=${(s.total - 0.18).toFixed(2)}:d=0.18`,
  ].join(",");

  // [0] picture, [1] narration, [2..] one sound cue each.
  const inputs = ["-i", path.join(OUT, "clips", `${s.id}.webm`), "-i", path.join(OUT, "vo", `${s.id}.wav`)];
  for (const c of cues) inputs.push("-i", path.join(OUT, "sfx", `${c.cue}.mp3`));

  const chains = [
    `[0:v]tpad=stop_mode=clone:stop_duration=6,fps=30,scale=1920:1080:flags=lanczos,setsar=1,${fades}[v]`,
    `[1:a]adelay=160|160,apad,atrim=0:${s.total},${VOICE_CHAIN},afade=t=in:st=0:d=0.12,afade=t=out:st=${(s.total - 0.3).toFixed(2)}:d=0.3[vo]`,
  ];
  cues.forEach((c, k) => {
    const ms = Math.round(c.at * 1000);
    chains.push(`[${k + 2}:a]volume=${CUES[c.cue].gain}dB,aformat=channel_layouts=stereo,adelay=${ms}|${ms},apad,atrim=0:${s.total}[s${k}]`);
  });
  const mixIn = ["[vo]", ...cues.map((_, k) => `[s${k}]`)].join("");
  chains.push(cues.length
    ? `${mixIn}amix=inputs=${cues.length + 1}:normalize=0:dropout_transition=0,alimiter=limit=0.97[a]`
    : `[vo]anull[a]`);

  ff([...inputs, "-filter_complex", chains.join(";"),
    "-map", "[v]", "-map", "[a]", "-t", String(s.total),
    "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
    path.join(SEG, `${String(i).padStart(2, "0")}.mp4`)]);
  console.log(`cut ${s.id}  ${s.total}s${cues.length ? `  +${cues.map((c) => c.cue).join(",")}` : ""}`);
}

const list = path.join(SEG, "list.txt");
writeFileSync(list, timing.scenes.map((_, i) => `file '${String(i).padStart(2, "0")}.mp4'`).join("\n"));
const joined = path.join(SEG, "joined.mp4");
ff(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", joined]);

// Captions are burned once over the finished picture; the loudness pass rides along.
const mp4 = path.join(OUT, "pathya-demo.mp4");
ff(["-i", joined,
  ...(subs ? ["-vf", `subtitles=${assPath.replace(/[\\:']/g, (m) => "\\" + m)}`, "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p"] : ["-c:v", "copy"]),
  "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
  "-movflags", "+faststart", mp4]);

const probe = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration,size", "-of", "csv=p=0", mp4], { encoding: "utf8" }).trim().split(",");
const dur = Number(probe[0]);
console.log(`\n${mp4}`);
console.log(`${Math.floor(dur / 60)}:${String(Math.round(dur % 60)).padStart(2, "0")}  ${(Number(probe[1]) / 1e6).toFixed(1)} MB  ${n} cues${subs ? " burned in" : ""}${sfx ? ", sound design on" : ""}`);
if (dur > 180) console.log(`OVER THE 3:00 LIMIT by ${(dur - 180).toFixed(1)}s`);
