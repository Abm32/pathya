// Sound design, generated once and cached. ElevenLabs text-to-sound-effects.
//   node video/sfx.mjs [--force]
//
// Three cues only. Narration is the signal here; anything that competes with a spoken gene name is
// working against the film. Every one of these sits far enough under the voice to be felt, not heard.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "video/out/sfx");
const KEY = readFileSync(path.join(ROOT, ".env"), "utf8").match(/^ELEVENLABS_API=(.*)$/mi)[1].trim().replace(/^["']|["']$/g, "");
const force = process.argv.includes("--force");

export const CUES = {
  // Between scenes. Must be short enough to finish before the first word of the next line.
  transition: {
    text: "A soft airy whoosh transition, short and clean, gentle filtered air moving past, no music, no impact, no reverb tail",
    duration_seconds: 1.1, prompt_influence: 0.55, gain: -26,
  },
  // Under the GeT-RM card: the one moment the film asks to be believed.
  reveal: {
    text: "A deep restrained low swell rising slowly, warm cinematic sub tone, documentary, no percussion, no braam, no brass",
    duration_seconds: 3.5, prompt_influence: 0.5, gain: -24,
  },
  // The last card.
  resolve: {
    text: "A single soft warm bell chime resolving gently, clean and sparse, long quiet decay, no melody",
    duration_seconds: 2.5, prompt_influence: 0.5, gain: -25,
  },
};

mkdirSync(OUT, { recursive: true });
for (const [name, c] of Object.entries(CUES)) {
  const mp3 = path.join(OUT, `${name}.mp3`);
  if (existsSync(mp3) && !force) { console.log(`${name} cached`); continue; }
  const body = JSON.stringify({
    text: c.text, duration_seconds: c.duration_seconds, prompt_influence: c.prompt_influence,
    model_id: "eleven_text_to_sound_v2",
  });
  execFileSync("curl", ["-sS", "--fail-with-body", "-X", "POST",
    "https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_192",
    "-H", `xi-api-key: ${KEY}`, "-H", "content-type: application/json", "-d", body, "-o", mp3]);
  if (readFileSync(mp3).subarray(0, 1).toString() === "{") throw new Error(`${name}: ${readFileSync(mp3, "utf8").slice(0, 300)}`);
  const d = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3], { encoding: "utf8" }).trim();
  console.log(`${name.padEnd(11)} ${Number(d).toFixed(1)}s  at ${c.gain} dB`);
}
console.log(`\nsfx in ${OUT}`);
