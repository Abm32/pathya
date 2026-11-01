// Gene notation is written for a page, not for a mouth. A TTS model reading "c.85T>C" literally gets
// it wrong in a way a pharmacogeneticist would notice immediately, so spell it the way one says it.
// Only the narration is rewritten; nothing here touches the captions or the product.

const RULES = [
  // Variants: c.85T>C -> "c dot eighty-five T to C"
  [/\bc\.(\d+)([+-]\d+)?([ACGT])>([ACGT])\b/g, (_, n, off, a, b) => `c dot ${num(n)}${off ? ` ${off.replace("+", "plus ").replace("-", "minus ")}` : ""} ${a} to ${b}`],
  [/\bc\.(\d+)([+-]\d+)?\b/g, (_, n, off) => `c dot ${num(n)}${off ? ` ${off.replace("+", "plus ").replace("-", "minus ")}` : ""}`],
  // Star alleles: *2A -> "star two A"
  [/\*(\d+)([A-Z])?\b/g, (_, n, s) => `star ${num(n)}${s ? ` ${s}` : ""}`],
  // Coverage depth: 30x -> "thirty ex"
  [/\b(\d+)x\b/gi, (_, n) => `${num(n)} ex`],
  // Gene names a model mispronounces as words or initialisms
  [/\bDPYD\b/g, "D P Y D"],
  [/\bSLCO1B1\b/g, "S L C O one B one"],
  [/\bNUDT15\b/g, "NUD T fifteen"],
  [/\bUGT1A1\b/g, "U G T one A one"],
  [/\bTPMT\b/g, "T P M T"],
  [/\bVKORC1\b/g, "V KOR C one"],
  [/\bCYP2C19\b/g, "sip two C nineteen"],
  [/\bCYP2C9\b/g, "sip two C nine"],
  [/\bCYP2D6\b/g, "sip two D six"],
  [/\bHapB3\b/g, "hap B three"],
  [/\bGeT-RM\b/g, "get R M"],
  [/\bGRCh38\b/g, "G R C h thirty-eight"],
  [/\bPharmCAT\b/g, "farm cat"],
  [/\bCPIC\b/g, "see-pick"],
  [/\bPharmVar\b/g, "farm var"],
  [/\bVCF\b/g, "V C F"],
  [/\bCSV\b/g, "C S V"],
  [/\bPDF\b/g, "P D F"],
  [/\bPMID\b/g, "pub med I D"],
  [/\bCI\b/g, "confidence interval"],
  [/\bpathya\.anukritiai\.com\b/gi, "pathya dot anukriti A I dot com"],
  [/\bമ|പഥ്യം/g, ""],   // the Malayalam wordmark is on screen, not spoken
];

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/** Small numbers read better spelled out; large ones the normaliser handles fine. */
function num(s) {
  const n = Number(s);
  if (!Number.isInteger(n) || n < 0 || n > 999) return s;
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : "");
  return `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` ${num(String(n % 100))}` : ""}`;
}

export function say(text) {
  let out = text;
  for (const [re, to] of RULES) out = out.replace(re, to);
  return out.replace(/\s{2,}/g, " ").trim();
}
