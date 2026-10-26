import OpenAI from "openai";

export const MUSE_MODEL = process.env.MUSE_MODEL ?? "muse-spark-1.3";

let _client: OpenAI | undefined;
export function meta() {
  if (!process.env.MODEL_API_KEY) throw new Error("MODEL_API_KEY not set");
  return (_client ??= new OpenAI({
    baseURL: process.env.MODEL_API_BASE_URL ?? "https://api.meta.ai/v1",
    apiKey: process.env.MODEL_API_KEY,
  }));
}

export type JsonSchema = Record<string, unknown>;

/** Strict JSON-schema structured output via Chat Completions. */
export async function structured<T>(opts: {
  name: string;
  schema: JsonSchema;
  system: string;
  user: string | OpenAI.Chat.ChatCompletionContentPart[];
  reasoning?: "minimal" | "low" | "medium" | "high";
}): Promise<T> {
  const res = await meta().chat.completions.create({
    model: MUSE_MODEL,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    response_format: { type: "json_schema", json_schema: { name: opts.name, strict: true, schema: opts.schema } },
    ...(opts.reasoning ? { reasoning_effort: opts.reasoning } : {}),
  });
  const text = res.choices[0]?.message?.content;
  if (!text) throw new Error("Muse returned empty content");
  return JSON.parse(text) as T;
}

/** Transcribe an audio file (batch). Returns raw API JSON; shape confirmed once key is live. */
export async function transcribe(file: Blob, filename: string) {
  const fd = new FormData();
  fd.append("model", "muse-voice-transcribe-1.0");
  fd.append("file", file, filename);
  const r = await fetch(`${process.env.MODEL_API_BASE_URL ?? "https://api.meta.ai/v1"}/asr/transcribe`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.MODEL_API_KEY}` },
    body: fd,
  });
  if (!r.ok) throw new Error(`transcribe ${r.status}: ${await r.text()}`);
  return r.json();
}
