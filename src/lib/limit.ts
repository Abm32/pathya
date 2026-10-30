/**
 * Per-IP budget for the endpoints that cost money. The site is open to anyone, so the only thing
 * standing between a loop and an empty credit balance is this.
 * ponytail: in-memory per instance; a second container would need Redis.
 */
const hits = new Map<string, { n: number; t: number }>();

export function ipOf(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

/** True when this IP has spent its budget for the window. */
export function overBudget(req: Request, bucket: string, max: number, windowMs = 60 * 60_000) {
  const key = `${bucket}:${ipOf(req)}`;
  const h = hits.get(key) ?? { n: 0, t: Date.now() };
  if (Date.now() - h.t > windowMs) { h.n = 0; h.t = Date.now(); }
  h.n++;
  hits.set(key, h);
  return h.n > max;
}

export const BUSY = {
  error: "This demo is open to everyone, so each visitor gets a few live runs an hour and you have used yours.",
  detail: "The finished records and the cohort pages stay open. Try again in an hour, or run it yourself: the repository is public.",
};
