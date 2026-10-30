import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { promises as fs } from "node:fs";
import path from "node:path";
import { readJson, caseDir } from "@/lib/store";
import type { PgxProfile } from "@/lib/pharmcat";
import type { AiReport } from "@/lib/report-ai";
import type { LensNote } from "@/lib/india-lens";
import type { LabExtract } from "@/lib/pdf-extract";
import { ConfirmPanel, LatestCheck, PrintButton } from "./actions";
import { Cite } from "@/app/cite";
import { CountUp, LangTabs, SectionNav } from "@/app/fx";

export const dynamic = "force-dynamic";

const ORDER = ["avoid", "adjust", "caution", "unknown", "standard"];
const KPI = [
  { risk: "avoid", label: "Avoid", color: "var(--danger)", glow: "rgba(255,100,100,0.55)" },
  { risk: "adjust", label: "Adjust dose", color: "var(--warn)", glow: "rgba(255,181,71,0.5)" },
  { risk: "caution", label: "Monitor", color: "var(--warn)", glow: "rgba(255,181,71,0.25)" },
  { risk: "standard", label: "Standard", color: "var(--ok)", glow: "rgba(95,227,154,0.35)" },
];

/** Phenotype to a 0-100 activity bar and a colour, for the genotype meters. */
function activity(ph: string): { w: number; c: string } {
  const p = ph.toLowerCase();
  if (/poor|no function|deficien/.test(p)) return { w: 14, c: "var(--danger)" };
  if (/intermediate|decreased/.test(p)) return { w: 48, c: "var(--warn)" };
  if (/ultrarapid/.test(p)) return { w: 100, c: "var(--info)" };
  if (/rapid|increased/.test(p)) return { w: 92, c: "var(--info)" };
  if (/normal/.test(p)) return { w: 80, c: "var(--ok)" };
  return { w: 30, c: "var(--muted)" };
}

function H2({ children, sub, id }: { children: React.ReactNode; sub?: React.ReactNode; id?: string }) {
  return (
    <div id={id} className="scroll-mt-32">
      <h2 className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="display text-2xl">{children}</span>
        {sub && <span className="text-xs text-muted">{sub}</span>}
      </h2>
    </div>
  );
}

export default async function Report({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await readJson<{ label: string; meds: string[]; createdAt: string; source: string }>(id, "case.json").catch(() => null);
  if (!c) notFound();
  const profile = (await readJson<PgxProfile>(id, "profile.json"))!;
  const ai = await readJson<AiReport>(id, "ai.json");
  const lens = (await readJson<LensNote[]>(id, "lens.json")) ?? [];
  const extract = await readJson<LabExtract>(id, "extract.json");
  const confirmed = await readJson<{ clinician: string; at: string }>(id, "confirmation.json");
  const trace = await runTrace(id);
  // Public sample cases are readable without the code; actions that call a model or write data are not.
  const signedIn = !process.env.ACCESS_CODE || (await cookies()).get("access")?.value === process.env.ACCESS_CODE;
  const sourceKind = await fs.access(path.join(caseDir(id), "report.pdf")).then(() => "pdf" as const, () =>
    fs.access(path.join(caseDir(id), "report.img")).then(() => "img" as const, () => null));
  const called = profile.genes.filter((g) => g.called);
  const uncalled = profile.genes.filter((g) => !g.called).map((g) => g.gene);
  const meds = ai ? [...ai.medications].sort((a, b) => ORDER.indexOf(a.risk) - ORDER.indexOf(b.risk)) : [];
  const medsLc = c.meds.map((m) => m.toLowerCase());
  const fallback = profile.drugs.filter((d) => (d.source === "CPIC" || d.source === "DPWG") && d.recommendation && !d.noChange && medsLc.some((m) => m.includes(d.drug) || d.drug.includes(m)));
  const count = (r: string) => meds.filter((m) => m.risk === r).length;
  const total = trace.find((t) => t.who === "Total")?.ms;
  const nav = [
    { id: "summary", label: "Summary" },
    { id: "medications", label: "Medications" },
    ...(lens.length ? [{ id: "india", label: "India lens" }] : []),
    { id: "genotype", label: "Genotype" },
    ...(extract ? [{ id: "source", label: "Source" }] : []),
    ...(ai ? [{ id: "patient", label: "Patient" }, { id: "review", label: "Review" }] : []),
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 pb-10 print:py-0">
      {/* Case hero */}
      <header className="rise pt-10">
        <Link href="/" className="text-sm text-muted hover:text-foreground print:hidden">← New case</Link>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="display text-4xl sm:text-5xl">{c.label.startsWith("Sample") ? c.label : `Case ${c.label || id}`}</h1>
          <span className="badge badge-det">{c.source === "vcf" ? "VCF" : "Lab report"}</span>
          {confirmed && <span className="badge badge-det">Clinician confirmed</span>}
          <span className="ml-auto"><PrintButton /></span>
        </div>
        <p className="num mt-3 text-xs text-muted">{new Date(c.createdAt).toLocaleString()} · PharmCAT {profile.pharmcatVersion} · CPIC data {profile.dataVersion}</p>
      </header>

      {ai && (
        <section aria-label="Risk overview" className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-6">
          {KPI.map((k, i) => (
            <div key={k.risk} className="card spot kpi rise p-4" style={{ animationDelay: `${80 + i * 60}ms`, ["--kpi-glow" as string]: count(k.risk) ? k.glow : "transparent" }}>
              <div className="kpi-value" style={{ color: count(k.risk) ? k.color : "var(--muted)" }}><CountUp to={count(k.risk)} ms={700} /></div>
              <div className="mt-2 text-xs font-medium uppercase tracking-wider text-muted">{k.label}</div>
            </div>
          ))}
          <div className="card spot kpi rise p-4" style={{ animationDelay: "320ms" }}>
            <div className="kpi-value"><CountUp to={called.length} ms={700} /></div>
            <div className="mt-2 text-xs font-medium uppercase tracking-wider text-muted">Genes called</div>
          </div>
          <div className="card spot kpi rise p-4" style={{ animationDelay: "380ms", ["--kpi-glow" as string]: "rgba(46,230,200,0.35)" }}>
            <div className="kpi-value"><span className="glow-text">{total ? <CountUp to={total / 1000} decimals={1} suffix="s" ms={900} /> : "—"}</span></div>
            <div className="mt-2 text-xs font-medium uppercase tracking-wider text-muted">Upload to report</div>
          </div>
        </section>
      )}

      {trace.length > 0 && (
        <ol className="rise mt-4 flex flex-wrap items-center gap-1.5 print:hidden" style={{ animationDelay: "420ms" }} aria-label="How this report was produced">
          {trace.filter((s) => s.who !== "Total").map((s, i) => (
            <li key={i} className="flex items-center">
              <span className="inline-flex items-center gap-2 rounded-lg border border-line bg-[rgba(255,255,255,0.03)] px-2.5 py-1.5 text-xs">
                <span className={`badge ${s.meta ? "badge-meta" : "badge-det"}`}>{s.who}</span>
                <span>{s.what}</span>
                {s.ms !== undefined && <span className="num text-muted">{(s.ms / 1000).toFixed(1)}s</span>}
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-8"><SectionNav items={nav} /></div>

      <div id="summary" className="scroll-mt-32" />
      {ai ? (
        <section className="card spot mt-8 overflow-hidden p-6 sm:p-8">
          <div aria-hidden className="absolute inset-y-0 left-0 w-1 bg-[image:var(--brand-v)] shadow-[0_0_24px_rgba(46,230,200,0.6)] print:bg-accent" />
          <div className="flex items-center gap-2"><span className="eyebrow">At a glance</span><span className="badge badge-det">CPIC · DPWG · FDA</span></div>
          <ul className="mt-4 divide-y divide-line">
            {meds.map((m) => (
              <li key={m.drug + m.matchedInput} className="grid grid-cols-[5.6rem_minmax(0,1fr)] items-baseline gap-x-4 gap-y-1 py-3 sm:grid-cols-[5.6rem_11rem_minmax(0,1fr)]">
                <span className={`risk risk-${m.risk} justify-center`}>{m.risk}</span>
                <span className="text-lg font-semibold tracking-tight">{m.drug}</span>
                <span className="col-span-2 text-[15px] leading-snug text-foreground/85 sm:col-span-1">{m.headline}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 border-t border-line pt-4">
            <div className="flex items-center gap-2"><span className="eyebrow">Clinician summary</span><span className="badge badge-meta">Muse Spark</span></div>
            <p className="mt-2 text-[15px] leading-relaxed text-foreground/80">{ai.clinicianSummary}</p>
          </div>
        </section>
      ) : (
        <p className="mt-8 rounded-xl border border-dashed p-4 text-sm text-muted">AI narrative unavailable (MODEL_API_KEY not set or the call failed). Deterministic PharmCAT results below.</p>
      )}

      <section className="mt-14">
        <H2 id="medications" sub="ranked by risk · dose text is CPIC / DPWG / FDA wording">Medications</H2>
        <div className="mt-5 space-y-3">
          {ai
            ? meds.map((m, i) => (
                <article key={m.drug + m.matchedInput} className={`card spot lift rise overflow-hidden p-5 ${m.risk === "avoid" ? "row-avoid" : m.risk === "adjust" ? "row-adjust" : ""}`} style={{ animationDelay: `${i * 50}ms` }}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className={`risk risk-${m.risk} min-w-[5.6rem] justify-center`}>{m.risk}</span>
                    <span className="text-lg font-semibold tracking-tight">{m.drug}</span>
                    {m.matchedInput && m.matchedInput !== m.drug && <span className="text-xs text-muted">from “{m.matchedInput}”</span>}
                    {!m.matchedInput && <span className="text-xs text-muted">not on list, same pathway</span>}
                    <span className="ml-auto flex gap-1">{m.genes.map((g) => <span key={g} className="num rounded-md border border-line px-1.5 py-0.5 text-[11px] text-muted">{g}</span>)}</span>
                  </div>
                  <p className="mt-2.5 text-[17px] font-medium leading-snug">{m.headline}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-foreground/80">{m.action}</p>
                  <details className="ev mt-3 text-xs">
                    <summary className="inline-flex items-center gap-1.5 text-muted hover:text-foreground"><span className="ev-caret" aria-hidden>›</span> Evidence and citations</summary>
                    <p className="mt-2 leading-relaxed text-muted">{m.evidence}{m.citations.length > 0 && <> · <Cite text={m.citations.join(", ")} /></>}</p>
                  </details>
                </article>
              ))
            : fallback.map((d, i) => (
                <article key={i} className="card row-adjust p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="risk risk-adjust min-w-[5.6rem] justify-center">actionable</span>
                    <span className="text-lg font-semibold">{d.drug}</span>
                    <span className="num ml-auto text-xs text-muted">{d.genes.join(", ")} · {d.source} {d.classification}</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed">{d.recommendation}</p>
                </article>
              ))}
          {ai && ai.unmappedMedications.length > 0 && <p className="px-1 text-sm text-muted">No pharmacogenomic guideline applies: {ai.unmappedMedications.join(", ")}</p>}
        </div>
      </section>

      {lens.length > 0 && (
        <section className="mt-14">
          <H2 id="india" sub="population-specific evidence · deterministic rules, not the model">India lens</H2>
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            {lens.map((n, i) => (
              <div key={i} className={`card spot lift p-5 text-sm ${n.level === "warn" ? "note-warn" : "note-info"}`}>
                <div className="flex items-center gap-2"><span className="num rounded-md border border-line px-1.5 py-0.5 text-[11px]">{n.gene}</span><span className="eyebrow">{n.level === "warn" ? "Flag" : "Context"}</span></div>
                <div className="mt-3 text-base font-semibold leading-snug">{n.title}</div>
                <p className="mt-2 leading-relaxed text-foreground/80">{n.body}</p>
                <p className="mt-3 text-xs text-muted"><Cite text={n.sources.join(" · ")} /></p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-14">
        <H2 id="genotype" sub={`${called.length} genes called by PharmCAT`}>Genotype</H2>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {called.map((g, i) => {
            const a = activity(g.phenotype);
            return (
              <div key={g.gene} className="card spot lift p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-base font-semibold">{g.gene}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted">{g.source === "OUTSIDE" ? "from lab report" : "from VCF"}</span>
                </div>
                <div className="num mt-1 truncate text-lg" title={g.diplotype}>{g.diplotype}</div>
                <div className="meter mt-3" aria-hidden><i style={{ ["--w" as string]: `${a.w}%`, ["--c" as string]: a.c, animationDelay: `${i * 80}ms` }} /></div>
                <div className="mt-2 text-xs" style={{ color: a.c }}>{g.phenotype}{g.activityScore ? <span className="text-muted"> · activity score {g.activityScore}</span> : null}</div>
              </div>
            );
          })}
        </div>
        {uncalled.length > 0 && <p className="mt-4 text-xs text-muted">Not tested / not called: {uncalled.join(", ")}</p>}
      </section>

      {extract && (
        <section className="mt-14">
          <H2 id="source" sub={<><span className="badge badge-meta">Muse Spark</span> every call quoted verbatim from the original</>}>Source</H2>
          <div className="card spot mt-5 p-5 text-sm">
            <p className="text-xs text-muted">
              {extract.labName}{extract.reportDate ? ` · ${extract.reportDate}` : ""}
              {sourceKind && <> · <a href={`/api/report/${id}/source`} target="_blank" rel="noreferrer" className="text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">open original {sourceKind === "pdf" ? "PDF" : "photo"}</a></>}
            </p>
            <div className={sourceKind === "img" ? "mt-4 grid gap-5 md:grid-cols-[220px_1fr]" : "mt-2"}>
              {sourceKind === "img" && (
                <a href={`/api/report/${id}/source`} target="_blank" rel="noreferrer" className="relative block self-start overflow-hidden rounded-lg border border-line print:hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/report/${id}/source`} alt="Uploaded lab report photo" className="w-full" />
                  <div className="scan" aria-hidden />
                </a>
              )}
              <ul className="divide-y divide-line">
                {extract.genes.map((g, i) => (
                  <li key={i} className="grid gap-x-4 gap-y-0.5 py-2.5 sm:grid-cols-[13rem_1fr]">
                    <span className="num font-medium">{g.gene} <span className="text-accent">{g.diplotype || g.phenotype || g.activityScore}</span></span>
                    <span className="text-muted">“{g.verbatim}”</span>
                  </li>
                ))}
              </ul>
            </div>
            {extract.methodNotes && <p className="mt-4 text-xs leading-relaxed text-muted">{extract.methodNotes}</p>}
            {extract.warnings.length > 0 && <p className="mt-2 text-xs text-warn">{extract.warnings.join(" ")}</p>}
          </div>
        </section>
      )}

      {ai && (
        <>
          <section className="mt-14 print:break-before-page">
            <H2 id="patient" sub="written for the patient, not for a journal">For the patient</H2>
            <div className="card spot mt-5 p-6 sm:p-8"><LangTabs en={ai.patient.en} ml={ai.patient.ml} /></div>
          </section>
          <section className="mt-10 text-sm text-muted">
            <h3 className="section-title">Limitations</h3>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">{ai.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>
          </section>
          <div id="review" className="scroll-mt-32" />
          {signedIn ? (
            <>
              <LatestCheck id={id} enabled={!!ai} />
              <ConfirmPanel id={id} drugs={meds.filter((m) => m.risk !== "standard" && m.risk !== "unknown").map((m) => ({ drug: m.drug, risk: m.risk }))} confirmed={confirmed} />
            </>
          ) : (
            <section className="card mt-10 p-6 print:hidden">
              <h2 className="text-lg font-semibold tracking-tight">Clinician review</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                This is a read-only sample. In the pilot, the oncologist accepts, modifies or rejects each flagged drug here, and Muse Spark web search checks for label changes newer than the bundled guideline data. Both are written to the audit log.
              </p>
              <a href={`/login?next=/report/${id}`} className="btn btn-ghost btn-sm mt-4">Sign in with the pilot code</a>
            </section>
          )}
        </>
      )}
      <footer className="mt-12 border-t border-line pt-4 text-xs text-muted">
        Decision support, not medical advice. Dose text is CPIC / DPWG / FDA-label wording via PharmCAT; Muse Spark maps, ranks and explains. Audit log: <code className="num">data/cases/{id}/audit.log</code>.
      </footer>
    </main>
  );
}

type TraceStep = { who: string; what: string; ms?: number; meta: boolean };
/** Reconstructs the pipeline from the append-only audit log: who did what, and how long it took. */
async function runTrace(id: string): Promise<TraceStep[]> {
  const raw = await fs.readFile(path.join(caseDir(id), "audit.log"), "utf8").catch(() => "");
  const ev = raw.split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) as { ts: string; event: string; [k: string]: unknown }[];
  const out: TraceStep[] = [];
  let prev = ev.find((e) => e.event === "upload");
  if (!prev) return out;
  const t0 = Date.parse(prev.ts);
  for (const e of ev) {
    const ms = Date.parse(e.ts) - Date.parse(prev.ts);
    if (e.event === "muse.extract.ok") out.push({ who: "Muse Spark", what: `read ${e.genes} gene calls`, ms, meta: true });
    else if (e.event === "pharmcat.ok") { out.push({ who: "PharmCAT", what: `called ${e.genesCalled} phenotypes`, ms, meta: false }); if (Number(e.lens) > 0) out.push({ who: "India lens", what: `${e.lens} ${Number(e.lens) === 1 ? "rule" : "rules"} fired`, meta: false }); }
    else if (e.event === "muse.report.ok") out.push({ who: "Muse Spark", what: `ranked ${e.meds} medications, EN + ML`, ms, meta: true });
    else if (e.event === "muse.report.fail") out.push({ who: "Muse Spark", what: "narrative failed, deterministic kept", ms, meta: true });
    else if (e.event === "muse.web_search.ok") out.push({ who: "Muse Spark", what: "checked labels on the web", meta: true });
    else if (e.event === "clinician.confirm") out.push({ who: "Clinician", what: `confirmed (${e.clinician})`, meta: false });
    else continue;
    prev = e;
  }
  const last = [...ev].reverse().find((e) => e.event === "muse.report.ok" || e.event === "pharmcat.ok");
  if (last) out.push({ who: "Total", what: "upload to report", ms: Date.parse(last.ts) - t0, meta: false });
  return out;
}
