/** Stable link to the pinned public sample report (first id in PUBLIC_CASES). Relative Location: behind Caddy, req.url carries the container's host. */
export function GET() {
  const id = (process.env.PUBLIC_CASES ?? "").split(",")[0]?.trim();
  return new Response(null, { status: 307, headers: { Location: id ? `/report/${id}` : "/" } });
}
