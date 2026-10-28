import Link from "next/link";
import { notFound } from "next/navigation";
import { promises as fs } from "node:fs";
import path from "node:path";
import { readJson, caseDir } from "@/lib/store";
import type { PgxProfile } from "@/lib/pharmcat";
import type { AiReport } from "@/lib/report-ai";
import type { LensNote } from "@/lib/india-lens";
import type { LabExtract } from "@/lib/pdf-extract";
import { ConfirmPanel, LatestCheck, PrintButton } from "./actions";
import { Cite } from "@/app/cite";

export const dynamic = "force-dynamic";

const ORDER = ["avoid", "adjust", "caution", "unknown", "standard"];

function H2({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <h2 className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="section-title">{children}</span>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </h2>
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
  const sourceKind = await fs.access(path.join(caseDir(id), "report.pdf")).then(() => "pdf" as const, () =>
    fs.access(path.join(caseDir(id), "report.img")).then(() => "img" as const, () => null));
  const called = profile.genes.filter((g) => g.called);
  const uncalled = profile.genes.filter((g) => !g.called).map((g) => g.gene);
  const meds = ai ? [...ai.medications].sort((a, b) => ORDER.indexOf(a.risk) - ORDER.indexOf(b.risk)) : [];
  const medsLc = c.meds.map((m) => m.toLowerCase());
  const fallback = profile.drugs.filter((d) => (d.source === "CPIC" || d.source === "DPWG") && d.recommendation && !d.noChange && medsLc.some((m) => m.includes(d.drug) || d.drug.includes(m)));
  const actionable = meds.filter((m) => m.risk === "avoid" || m.risk === "adjust").length;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 print:py-0">
      <header className="border-b border-line pb-5">
        <Link href="/" className="text-sm text-muted hover:text-foreground print:hidden">← New case</Link>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Case {c.label || id}</h1>
          <span className="badge badge-det">{c.source === "vcf" ? "VCF" : "Lab report"}</span>
          {ai && actionable > 0 && <span className="risk risk-adjust">{actionable} {actionable === 1 ? "medication needs" : "medications need"} action</span>}
          <span className="ml-auto"><PrintButton /></span>
        </div>
        <p className="num mt-2 text-xs text-muted">{new Date(c.createdAt).toLocaleString()} · PharmCAT {profile.pharmcatVersion} · CPIC data {profile.dataVersion}</p>
        {trace.length > 0 && (
          <ol className="mt-4 flex flex-wrap items-stretch gap-1.5 print:hidden" aria-label="How this report was produced">
            {trace.map((s, i) => (
              <li key={i} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden className="text-muted">›</span>}
                <span className="inline-flex items-center gap-2 rounded-md border border-line bg-card px-2.5 py-1 text-xs">
                  <span className={`badge ${s.meta ? "badge-meta" : "badge-det"}`}>{s.who}</span>
                  <span>{s.what}</span>
                  {s.ms !== undefined && <span className="num text-muted">{(s.ms / 1000).toFixed(1)} s</span>}
                </span>
              </li>
            ))}
          </ol>
        )}
      </header>

      {ai ? (
        <section className="card mt-6 p-5" style={{ boxShadow: "inset 4px 0 0 var(--accent)" }}>
          <H2 sub={<span className="badge badge-meta">Muse Spark</span>}>Clinician summary</H2>
          <p className="mt-3 text-[17px] leading-relaxed">{ai.clinicianSummary}</p>
        </section>
      ) : (
        <p className="mt-6 rounded-lg border border-dashed p-4 text-sm text-muted">AI narrative unavailable (MODEL_API_KEY not set or the call failed). Deterministic PharmCAT results below.</p>
      )}

      <section className="mt-10">
        <H2 sub="ranked by risk; dose text is CPIC / DPWG / FDA wording">Medications</H2>
        <div className="card mt-3 divide-y divide-line">
          {ai
            ? meds.map((m) => (
                <article key={m.drug + m.matchedInput} className={`p-4 ${m.risk === "avoid" ? "row-avoid" : m.risk === "adjust" ? "row-adjust" : ""}`}>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={`risk risk-${m.risk}`}>{m.risk}</span>
                    <span className="text-base font-semibold">{m.drug}</span>
                    {m.matchedInput && m.matchedInput !== m.drug && <span className="text-xs text-muted">from “{m.matchedInput}”</span>}
                    {!m.matchedInput && <span className="text-xs text-muted">not on list, same pathway</span>}
                    <span className="num ml-auto text-xs text-muted">{m.genes.join(", ")}</span>
                  </div>
                  <p className="mt-1.5 font-medium leading-snug">{m.headline}</p>
                  <p className="mt-1 text-sm leading-relaxed">{m.action}</p>
                  <p className="mt-1.5 text-xs text-muted">
                    {m.evidence}
                    {m.citations.length > 0 && <span> · <Cite text={m.citations.join(", ")} /></span>}
                  </p>
                </article>
              ))
            : fallback.map((d, i) => (
                <article key={i} className="row-adjust p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="risk risk-adjust">actionable</span>
                    <span className="text-base font-semibold">{d.drug}</span>
                    <span className="num ml-auto text-xs text-muted">{d.genes.join(", ")} · {d.source} {d.classification}</span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed">{d.recommendation}</p>
                </article>
              ))}
          {ai && ai.unmappedMedications.length > 0 && <p className="p-4 text-sm text-muted">No pharmacogenomic guideline applies: {ai.unmappedMedications.join(", ")}</p>}
        </div>
      </section>

      {lens.length > 0 && (
        <section className="mt-10 space-y-3">
          <H2 sub="population-specific evidence, rule-based, not from the model">India lens</H2>
          {lens.map((n, i) => (
            <div key={i} className={`rounded-lg border p-4 text-sm ${n.level === "warn" ? "note-warn" : "note-info"}`}>
              <div className="font-semibold">{n.gene}: {n.title}</div>
              <p className="mt-1 leading-relaxed">{n.body}</p>
              <p className="mt-1.5 text-xs text-muted"><Cite text={n.sources.join(" · ")} /></p>
            </div>
          ))}
        </section>
      )}

      <section className="mt-10">
        <H2 sub={`${called.length} genes called by PharmCAT`}>Genotype</H2>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
          {called.map((g) => {
            const hot = !/normal|^no result/i.test(g.phenotype) && g.phenotype !== "";
            return (
              <div key={g.gene} className={`rounded-lg border p-3 ${hot ? "note-warn" : "bg-card"}`}>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold">{g.gene}</span>
                  <span className="text-[10px] uppercase tracking-wide text-muted">{g.source === "OUTSIDE" ? "lab" : "vcf"}</span>
                </div>
                <div className="num mt-0.5 truncate text-sm" title={g.diplotype}>{g.diplotype}</div>
                <div className="mt-0.5 text-xs text-muted">{g.phenotype}{g.activityScore ? ` · AS ${g.activityScore}` : ""}</div>
              </div>
            );
          })}
        </div>
        {uncalled.length > 0 && <p className="mt-3 text-xs text-muted">Not tested / not called: {uncalled.join(", ")}</p>}
      </section>

      {extract && (
        <section className="card mt-10 p-4 text-sm">
          <H2 sub={<><span className="badge badge-meta">Muse Spark</span> each call quoted verbatim</>}>Read from the lab report</H2>
          <p className="mt-2 text-xs text-muted">
            {extract.labName}{extract.reportDate ? ` · ${extract.reportDate}` : ""}
            {sourceKind && <> · <a href={`/api/report/${id}/source`} target="_blank" rel="noreferrer" className="text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">open original {sourceKind === "pdf" ? "PDF" : "photo"}</a></>}
          </p>
          <div className={sourceKind === "img" ? "mt-3 grid gap-4 md:grid-cols-[180px_1fr]" : ""}>
          {sourceKind === "img" && (
            <a href={`/api/report/${id}/source`} target="_blank" rel="noreferrer" className="block self-start overflow-hidden rounded-md border border-line print:hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/report/${id}/source`} alt="Uploaded lab report photo" className="w-full" />
            </a>
          )}
          <ul className="mt-2 space-y-1.5">
            {extract.genes.map((g, i) => (
              <li key={i} className="grid gap-x-3 sm:grid-cols-[14rem_1fr]">
                <span className="num">{g.gene} {g.diplotype || g.phenotype || g.activityScore}</span>
                <span className="text-muted">“{g.verbatim}”</span>
              </li>
            ))}
          </ul>
          </div>
          {extract.methodNotes && <p className="mt-3 text-xs text-muted">{extract.methodNotes}</p>}
          {extract.warnings.length > 0 && <p className="mt-2 text-xs text-warn">{extract.warnings.join(" ")}</p>}
        </section>
      )}

      {ai && (
        <>
          <section className="mt-10 grid gap-4 md:grid-cols-2 md:items-start print:break-before-page">
            <div className="card p-5">
              <H2>For the patient · English</H2>
              <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed">{ai.patient.en}</p>
            </div>
            <div className="card p-5">
              <H2><span className="ml normal-case tracking-normal">രോഗിക്ക്</span> · Malayalam</H2>
              <p className="ml mt-3 whitespace-pre-line text-[15px] leading-8">{ai.patient.ml}</p>
            </div>
          </section>
          <section className="mt-8 text-sm text-muted">
            <H2>Limitations</H2>
            <ul className="mt-2 list-disc space-y-1 pl-5">{ai.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>
          </section>
          <LatestCheck id={id} enabled={!!ai} />
          <ConfirmPanel id={id} drugs={meds.filter((m) => m.risk !== "standard" && m.risk !== "unknown").map((m) => ({ drug: m.drug, risk: m.risk }))} confirmed={confirmed} />
        </>
      )}
      <footer className="mt-10 border-t border-line pt-4 text-xs text-muted">
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
