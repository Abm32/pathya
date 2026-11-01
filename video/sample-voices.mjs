// Cut the same line in several voices so a human can pick one. We cannot hear; you can.
//   node video/sample-voices.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { say } from "./speakable.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "video/out/voice-samples");
const KEY = readFileSync(path.join(ROOT, ".env"), "utf8").match(/^ELEVENLABS_API=(.*)$/mi)[1].trim().replace(/^["']|["']$/g, "");

// Indian English narrators from the shared library, plus the two strongest on the account.
const CANDIDATES = [
  ["esha", "NxYGDTZngCTtbvawEZyg", "Esha — Indian, clear and warm (524 cloned)"],
  ["deepak", "kl7otY2fICBwLVzeNEb6", "Deepak — Indian, confident, informative (489 cloned)"],
  ["keshav", "WHvZF5poLGMBdCKsjSGC", "Keshav — Indian, gentle, narrative"],
  ["arjun", "mvDV2Li2ac134CyNRkSL", "Arjun — Indian, warm storyteller"],
  ["daniel", "onwK4e9ZLuTAKqWW03F9", "Daniel — British, steady broadcaster"],
  ["george", "JBFqnCBsd6RMkjVDRZzb", "George — British, warm"],
];

// A hard line: a gene variant, a number, and a place name all in one breath.
const LINE =
  "Reading the report is the easy half. Counting a panel that never tested c.85T>C as a non-carrier " +
  "puts the frequency at fifteen percent. The truth was twenty-five. Muse Voice takes results read " +
  "aloud, Malayalam and English mixed, the way people speak in a Kochi clinic.";

mkdirSync(OUT, { recursive: true });
const text = say(LINE);
console.log(`spoken as: ${text}\n`);

for (const [slug, id, label] of CANDIDATES) {
  const mp3 = path.join(OUT, `${slug}.mp3`);
  const body = JSON.stringify({
    text,
    model_id: "eleven_v4",
    voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed: 0.96 },
  });
  execFileSync("curl", ["-sS", "-X", "POST", `https://api.elevenlabs.io/v1/text-to-speech/${id}?output_format=mp3_44100_192`,
    "-H", `xi-api-key: ${KEY}`, "-H", "content-type: application/json", "-d", body, "-o", mp3]);
  const d = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3], { encoding: "utf8" }).trim();
  console.log(`${slug.padEnd(8)} ${Number(d).toFixed(1)}s   ${label}`);
}

// One file to listen through, each take announced by a tone so they are easy to tell apart.
const list = path.join(OUT, "list.txt");
writeFileSync(list, CANDIDATES.map(([s]) => `file '${s}.mp3'`).join("\n"));
execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", list,
  path.join(OUT, "all-voices.mp3")]);
console.log(`\nindividually: ${OUT}/<name>.mp3`);
console.log(`all in order:  ${OUT}/all-voices.mp3`);
