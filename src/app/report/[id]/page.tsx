import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canRead, cohortIsPublic, publicCohort, signedIn as isSignedIn } from "@/lib/access";
import { promises as fs } from "node:fs";
import path from "node:path";
import { readJson, caseDir } from "@/lib/store";
import type { PgxProfile } from "@/lib/pharmcat";
import type { LabExtract } from "@/lib/pdf-extract";
import { quality as recomputeQuality, type Quality } from "@/lib/quality";
import type { CaseMeta, Review } from "@/lib/cohort";
import { CuratorReview, LiteratureCheck, PrintButton } from "./actions";
import { CountUp, SectionNav } from "@/app/fx";

export const dynamic = "force-dynamic";

const SOURCE: Record<string, string> = { report: "Lab report", dictation: "Dictated", vcf: "VCF" };

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

export default async function RecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await readJson<CaseMeta>(id, "case.json").catch(() => null);
  if (!c) notFound();
  if (!(await canRead(id))) redirect(`/login?next=/report/${id}`);
  const profile = (await readJson<PgxProfile>(id, "profile.json"))!;
  const extract = await readJson<LabExtract>(id, "extract.json");
  const stored = await readJson<Quality>(id, "quality.json");
  const review = await readJson<Review>(id, "review.json");
  const trace = await runTrace(id);
  // Public sample records are readable without the code; actions that call a model or write data are not.
  const signedIn = await isSignedIn();
  // an anonymous visitor can only open the public cohort, so never link them into a private one
  const cohortVisible = signedIn || Boolean(c.cohort && cohortIsPublic(c.cohort));
  const sourceKind = await fs.access(path.join(caseDir(id), "report.pdf")).then(() => "pdf" as const, () =>
    fs.access(path.join(caseDir(id), "report.img")).then(() => "img" as const, () => null));
  const called = profile.genes.filter((g) => g.called);
  // quality.json is the audit record written at ingest; the page recomputes from the stored extract
  // so that a corrected rule applies to records ingested before it
  const q = extract ? recomputeQuality(extract, profile) : stored;
  const gaps = q?.coverage.filter((x) => !x.stated) ?? [];
  const total = trace.find((t) => t.who === "Total")?.ms;
  const quoteFor = (gene: string) => extract?.genes.find((g) => g.gene.toUpperCase() === gene)?.verbatim;
  const nav = [
    { id: "calls", label: "Calls" },
    ...(q ? [{ id: "coverage", label: "Coverage" }] : []),
    { id: "export", label: "Export" },
    { id: "review", label: "Review" },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 pb-10 print:py-0">
      <header className="rise pt-10">
        <Link href="/" className="text-sm text-muted hover:text-foreground print:hidden">← New record</Link>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="display text-4xl sm:text-5xl">{c.label || `Record ${id}`}</h1>
          <span className="badge badge-det">{SOURCE[c.source] ?? c.source}</span>
          {c.cohort && (cohortVisible ? <Link href={`/cohort?c=${c.cohort}`} className="badge badge-meta">cohort · {c.cohort}</Link> : <span className="badge badge-meta">cohort · {c.cohort}</span>)}
          {review && <span className="badge badge-det">Curator verified</span>}
          <span className="ml-auto"><PrintButton /></span>
        </div>
        <p className="num mt-3 text-xs text-muted">{new Date(c.createdAt).toLocaleString()} · PharmCAT {profile.pharmcatVersion} · Research record, not medical advice</p>
      </header>

      <section aria-label="Record overview" className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { v: called.length, l: "Genes standardised" },
          { v: extract?.genes.filter((g) => g.verbatim).length ?? 0, l: "Calls quoted" },
          { v: gaps.length, l: "Coverage gaps", warn: gaps.length > 0 },
          { v: q?.identifierRemoved ? 1 : 0, l: "Identifiers removed" },
        ].map((k, i) => (
          <div key={k.l} className="card spot kpi rise p-4" style={{ animationDelay: `${80 + i * 60}ms`, ["--kpi-glow" as string]: k.warn ? "rgba(255,181,71,0.45)" : "rgba(46,230,200,0.25)" }}>
            <div className="kpi-value" style={{ color: k.warn ? "var(--warn)" : undefined }}><CountUp to={k.v} ms={700} /></div>
            <div className="mt-2 text-xs font-medium uppercase tracking-wider text-muted">{k.l}</div>
          </div>
        ))}
        <div className="card spot kpi rise p-4" style={{ animationDelay: "320ms", ["--kpi-glow" as string]: "rgba(46,230,200,0.35)" }}>
          <div className="kpi-value"><span className="glow-text">{total ? <CountUp to={total / 1000} decimals={1} suffix="s" ms={900} /> : "—"}</span></div>
          <div className="mt-2 text-xs font-medium uppercase tracking-wider text-muted">Upload to record</div>
        </div>
      </section>

      {trace.length > 0 && (
        <ol className="rise mt-4 flex flex-wrap items-center gap-1.5 print:hidden" style={{ animationDelay: "420ms" }} aria-label="How this record was produced">
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

      <section className="mt-10">
        <H2 id="calls" sub={extract ? <><span className="badge badge-meta">Muse Spark</span> each call quoted from the source, then standardised by PharmCAT</> : "called by PharmCAT from the VCF"}>Calls</H2>
        <div className="card spot mt-5 p-5 text-sm">
          {extract && (
            <p className="text-xs text-muted">
              {extract.labName}{extract.reportDate ? ` · ${extract.reportDate}` : ""}
              {sourceKind && <> · <a href={`/api/report/${id}/source`} target="_blank" rel="noreferrer" className="text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">open original {sourceKind === "pdf" ? "PDF" : "photo"}</a></>}
            </p>
          )}
          <div className={sourceKind === "img" ? "mt-4 grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]" : "mt-2"}>
            {sourceKind === "img" && (
              <a href={`/api/report/${id}/source`} target="_blank" rel="noreferrer" className="relative block self-start overflow-hidden rounded-lg border border-line print:hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/report/${id}/source`} alt="Uploaded lab report photo" className="w-full" />
                <div className="scan" aria-hidden />
              </a>
            )}
            <div className="min-w-0 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left">
                <thead className="text-xs text-muted"><tr><th className="py-2 pr-3 font-medium">Gene</th><th className="py-2 pr-3 font-medium">As printed</th><th className="py-2 pr-3 font-medium">Standardised</th><th className="py-2 font-medium">Phenotype term</th></tr></thead>
                <tbody className="divide-y divide-line border-t border-line">
                  {called.map((g) => (
                    <tr key={g.gene} className="align-top">
                      <td className="num py-2.5 pr-3 font-semibold">{g.gene}</td>
                      <td className="py-2.5 pr-3 text-muted">{quoteFor(g.gene) ? <>&ldquo;{quoteFor(g.gene)}&rdquo;</> : "—"}</td>
                      <td className="num py-2.5 pr-3 text-accent">{g.diplotype}</td>
                      <td className="py-2.5">{g.phenotype}{g.activityScore ? <span className="text-muted"> · activity {g.activityScore}</span> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {extract?.methodNotes && <p className="mt-4 text-xs leading-relaxed text-muted">Method as printed: {extract.methodNotes}</p>}
        </div>
      </section>

      {q && (
        <section className="mt-14">
          <H2 id="coverage" sub="deterministic rules · which India-relevant variants this panel named">Coverage</H2>
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            {q.coverage.map((x) => (
              <div key={x.gene + x.variant} className={`card p-4 text-sm ${x.stated ? "" : "note-warn"}`}>
                <div className="flex items-center gap-2">
                  <span className="num rounded-md border border-line px-1.5 py-0.5 text-[11px]">{x.gene}</span>
                  <span className="num font-medium">{x.variant}</span>
                  <span className={`ml-auto text-xs ${x.stated ? "text-ok" : "text-warn"}`}>{x.stated ? "named on the report" : x.documented ? "not in this panel" : "panel not documented"}</span>
                </div>
                <p className="mt-2 text-xs text-muted">{x.why}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted">
            A variant the panel did not name is left out of cohort statistics for that variant, rather than counted as absent.
            {q.identifierRemoved && " A patient or lab reference printed on the report was removed before storage."}
            {q.unread.length > 0 && ` Could not read: ${q.unread.join(", ")}.`}
            {q.warnings.length > 0 && ` Reader notes: ${q.warnings.join(" ")}`}
          </p>
        </section>
      )}

      <section className="mt-14">
        <H2 id="export" sub="de-identified · the same record in three formats">Export</H2>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <a href={`/api/report/${id}/export?f=json`} className="btn btn-ghost btn-sm">JSON, full record</a>
          <a href={`/api/report/${id}/export?f=tsv`} className="btn btn-ghost btn-sm">PharmCAT outside-call TSV</a>
          <a href={`/api/report/${id}/export?f=csv`} className="btn btn-ghost btn-sm">CSV row</a>
          <Link href={cohortVisible && c.cohort ? `/cohort?c=${c.cohort}` : "/cohort"} className="btn btn-ghost btn-sm">See the {cohortVisible && c.cohort ? c.cohort : publicCohort()} cohort →</Link>
        </div>
      </section>

      <div id="review" className="scroll-mt-32" />
      {signedIn ? (
        <>
          <LiteratureCheck id={id} />
          <CuratorReview id={id} calls={called.map((g) => ({ gene: g.gene, diplotype: g.diplotype }))} reviewed={review} />
        </>
      ) : (
        <section className="card mt-10 p-6 print:hidden">
          <h2 className="text-lg font-semibold tracking-tight">Curator review</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            This is a read-only sample. In the pilot, a curator checks each call against the source document before the record counts in a cohort,
            and Muse Spark web search finds published Indian frequency data for each variant. Both are written to the audit log.
          </p>
          <a href={`/login?next=/report/${id}`} className="btn btn-ghost btn-sm mt-4">Sign in with the pilot code</a>
        </section>
      )}
      <footer className="mt-12 border-t border-line pt-4 text-xs text-muted">
        Research tool, not medical advice. Pathya reads and standardises pharmacogenomic results; it makes no dose, drug or test recommendation. Audit log: <code className="num">data/cases/{id}/audit.log</code>.
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
    else if (e.event === "record.ok") { out.push({ who: "PharmCAT", what: `standardised ${e.genesCalled} genes`, ms, meta: false }); out.push({ who: "Rules", what: `${e.coverageGaps} coverage ${Number(e.coverageGaps) === 1 ? "gap" : "gaps"}`, meta: false }); }
    else if (e.event === "muse.web_search.ok") out.push({ who: "Muse Spark", what: "searched published frequencies", meta: true });
    else if (e.event === "curator.review") out.push({ who: "Curator", what: `verified (${e.curator})`, meta: false });
    else continue;
    prev = e;
  }
  const last = ev.find((e) => e.event === "record.ok");
  if (last) out.push({ who: "Total", what: "upload to record", ms: Date.parse(last.ts) - t0, meta: false });
  return out;
}
