import OpenAI from "openai";

export const MUSE_MODEL = process.env.MUSE_MODEL ?? "muse-spark-1.3";

/**
 * Two inference paths for the same Muse family:
 *  - meta:    Muse Spark 1.3 on api.meta.ai (hosted; strict JSON schema, PDF input, web_search).
 *  - baseten: Muse Spark Open (open weights) on Baseten. Same OpenAI wire format, but the
 *             schema is advisory only and there is no responses API. Because the weights are
 *             open, this path is what a hospital would self-host for data residency.
 * MUSE_PROVIDER picks the primary for text generation; the other is the automatic fallback.
 */
export type Provider = "meta" | "baseten";
const PROVIDERS: Record<Provider, { baseURL: string; key: string | undefined; model: string; strictJson: boolean }> = {
  meta: {
    baseURL: process.env.MODEL_API_BASE_URL ?? "https://api.meta.ai/v1",
    key: process.env.MODEL_API_KEY,
    model: MUSE_MODEL,
    strictJson: true,
  },
  baseten: {
    baseURL: process.env.BASETEN_BASE_URL ?? "https://inference.baseten.co/v1",
    key: process.env.BASETEN_API_KEY,
    model: process.env.BASETEN_MODEL ?? "meta-models/muse-spark-open-1026",
    strictJson: false,
  },
};
export const PRIMARY: Provider = process.env.MUSE_PROVIDER === "baseten" ? "baseten" : "meta";
export const providerModel = (p: Provider) => PROVIDERS[p].model;
export const hasProvider = (p: Provider) => Boolean(PROVIDERS[p].key);

const _clients: Partial<Record<Provider, OpenAI>> = {};
export function client(p: Provider = "meta") {
  const cfg = PROVIDERS[p];
  if (!cfg.key) throw new Error(`${p === "meta" ? "MODEL_API_KEY" : "BASETEN_API_KEY"} not set`);
  return (_clients[p] ??= new OpenAI({ baseURL: cfg.baseURL, apiKey: cfg.key }));
}
/** api.meta.ai client: responses API, PDF input, web_search. */
export const meta = () => client("meta");

export type JsonSchema = Record<string, unknown>;

export type StructuredOpts = {
  name: string;
  schema: JsonSchema;
  system: string;
  user: string | OpenAI.Chat.ChatCompletionContentPart[];
  reasoning?: "minimal" | "low" | "medium" | "high";
  provider?: Provider;
};

/** Pull the first JSON object out of model text (open model may wrap it in fences or prose). */
function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] ?? text;
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error(`no JSON object in model output: ${text.slice(0, 200)}`);
  return JSON.parse(fenced.slice(start, end + 1));
}

async function structuredOn<T>(p: Provider, opts: StructuredOpts): Promise<T> {
  const cfg = PROVIDERS[p];
  const system = cfg.strictJson
    ? opts.system
    : `${opts.system}\n\nOutput ONLY one JSON object, no prose, no markdown, matching exactly this JSON schema:\n${JSON.stringify(opts.schema)}`;
  const res = await client(p).chat.completions.create({
    model: cfg.model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: opts.user },
    ],
    response_format: { type: "json_schema", json_schema: { name: opts.name, strict: true, schema: opts.schema } },
    ...(opts.reasoning ? { reasoning_effort: opts.reasoning === "minimal" && !cfg.strictJson ? "low" : opts.reasoning } : {}),
  });
  const text = res.choices[0]?.message?.content;
  if (!text) throw new Error("Muse returned empty content");
  return (cfg.strictJson ? JSON.parse(text) : extractJson(text)) as T;
}

/** Strict JSON-schema structured output. Primary provider first, other one on failure. */
export async function structured<T>(opts: StructuredOpts): Promise<T> {
  return (await structuredWith<T>(opts)).value;
}

/** Same, but says which provider actually answered, so a record can state the model that read it. */
export async function structuredWith<T>(opts: StructuredOpts): Promise<{ value: T; provider: Provider }> {
  const first = opts.provider ?? PRIMARY;
  const second: Provider = first === "meta" ? "baseten" : "meta";
  try {
    return { value: await structuredOn<T>(first, opts), provider: first };
  } catch (e) {
    if (opts.provider || !hasProvider(second)) throw e;
    console.warn(`[muse] ${first} failed (${String(e).slice(0, 120)}), falling back to ${second}`);
    return { value: await structuredOn<T>(second, opts), provider: second };
  }
}

export type Transcript = {
  sessionId: string;
  transcript: string;
  audioDurationMs: number;
  turns: { turnId: number; startMs: number; endMs: number; transcript: string; speaker?: string }[];
};

/** Batch transcription. WAV only (mono, 16-bit PCM, 16 or 24 kHz, <=10 min). */
export async function transcribe(
  wav: Blob,
  opts: { diarize?: boolean; languages?: string[]; keywords?: string[] } = {},
): Promise<Transcript> {
  const fd = new FormData();
  fd.append(
    "request",
    new Blob(
      [JSON.stringify({
        model: "muse-voice-transcribe-1.0",
        audioEncoding: "WAV",
        mode: opts.diarize ? "DIARIZATION" : "ENDPOINTING",
        ...(opts.languages ? { languageBias: opts.languages } : {}),
        ...(opts.keywords ? { keywords: opts.keywords } : {}),
      })],
      { type: "application/json" },
    ),
  );
  fd.append("audio", wav, "audio.wav");
  const r = await fetch(`${process.env.MODEL_API_BASE_URL ?? "https://api.meta.ai/v1"}/asr/transcribe`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.MODEL_API_KEY}` },
    body: fd,
  });
  if (!r.ok) throw new Error(`transcribe ${r.status}: ${await r.text()}`);
  return r.json();
}
