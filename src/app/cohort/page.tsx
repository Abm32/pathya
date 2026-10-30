import Link from "next/link";
import { cohortIsPublic, publicCohort, signedIn as isSignedIn } from "@/lib/access";
import { SIM_COHORT, cohortStats, loadCohort } from "@/lib/cohort";

export const dynamic = "force-dynamic";

const pct = (x: number) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`;

/** Group-level statistics over a cohort of de-identified records. Research output; no individual advice. */
export default async function Cohort({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const pub = publicCohort();
  const name = ((await searchParams).c ?? pub).toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40) || pub;
  const signedIn = await isSignedIn();
  if (!signedIn && !cohortIsPublic(name)) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="display text-3xl">This cohort is private</h1>
        <p className="mt-3 text-muted">Sign in with the pilot code to see it, or open the public <Link href="/cohort" className="text-accent underline underline-offset-2">{pub} cohort</Link>.</p>
      </main>
    );
  }
  const records = await loadCohort(name);
  const stats = cohortStats(records, name).filter((s) => s.n + s.notStated > 0);
  const sim = name === SIM_COHORT;
  const enriched = name === "demo";
  // How far naive pooling (untested counted as absent) falls below the coverage-aware estimate.
  const gap = stats.filter((s) => s.notStated > 0 && s.n > 0);
  const meanShortfall = gap.length ? gap.reduce((a, s) => a + (s.freq - s.naive), 0) / gap.length : 0;
  const reviewed = records.filter((r) => r.review).length;
  const photos = records.filter((r) => r.meta.source === "report").length;

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16">
      <header className="rise pt-10">
        <Link href="/" className="text-sm text-muted hover:text-foreground">← Pathya</Link>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="display text-4xl sm:text-5xl">Cohort · <span className="glow-text">{name}</span></h1>
          {enriched && <span className="badge badge-meta">carrier-enriched test set</span>}
          {sim && <span className="badge badge-meta">simulated at Indian frequencies</span>}
          <a href={`/api/cohort/${name}?f=csv`} className="btn btn-ghost btn-sm ml-auto">Download CSV</a>
        </div>
        <p className="mt-3 max-w-3xl text-muted">
          Group-level statistics across de-identified records. Each record came from a lab report, a WhatsApp photo, dictated results or a VCF, read by Muse Spark and standardised by PharmCAT.
          Research output, not medical advice.
        </p>
      </header>

      <section aria-label="Cohort overview" className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[[records.length, "Records"], [photos, "From reports and photos"], [reviewed, "Curator verified"], [stats.filter((s) => s.notStated > 0).length, "Variants with coverage gaps"]].map(([v, l], i) => (
          <div key={l} className="card kpi rise p-4" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="kpi-value">{v}</div>
            <div className="mt-2 text-xs font-medium uppercase tracking-wider text-muted">{l}</div>
          </div>
        ))}
      </section>

      {(enriched || sim) && (
        <p className="mt-6 rounded-xl border border-dashed border-line p-4 text-sm leading-relaxed text-muted">
          {enriched ? (
            <>
              <span className="font-medium text-foreground">These frequencies are not population estimates.</span> The demo cohort is the benchmark&apos;s reading test set,
              built to put every genotype in front of the reader at least once, so carriers are deliberately over-represented. It shows that the pipeline works end to end.
              For frequencies drawn at published Indian rates, open the <Link href={`/cohort?c=${SIM_COHORT}`} className="text-accent underline underline-offset-2">{SIM_COHORT} cohort</Link>.
            </>
          ) : (
            <>
              <span className="font-medium text-foreground">Simulated people, real sampling question.</span> Each record is a synthetic report for a person whose genotype was drawn at
              published Indian allele frequencies, issued by a lab that tests only part of the panel. Because the complete-panel answer is known, both ways of pooling can be scored
              against it. Neither column is the truth: the left one assumes a report that never named a variant tells you nothing about it, the right one assumes it means absent.
              The gap between them is the uncertainty a cohort of partially-covering panels actually carries, and <Link href="/#story-proof" className="text-accent underline underline-offset-2">chapter 04</Link> reports what each one cost.
            </>
          )}
        </p>
      )}

      {records.length === 0 ? (
        <p className="mt-10 rounded-xl border border-dashed p-6 text-muted">No records in this cohort yet. Add one from the <Link href="/#console" className="text-accent underline underline-offset-2">home page</Link> with the cohort name &ldquo;{name}&rdquo;.</p>
      ) : (
        <section className="card mt-8 overflow-x-auto p-5">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr><th className="py-2 pr-3 font-medium">Variant</th><th className="py-2 pr-3 font-medium">Carriers</th><th className="w-[34%] py-2 pr-3 font-medium">Carrier frequency, 95% CI</th><th className="py-2 pr-3 font-medium">Left out of the denominator</th><th className="py-2 pr-3 font-medium">If counted as absent</th><th className="py-2 font-medium">{sim ? "Simulated frequency" : "Published for India, for reference"}</th></tr>
            </thead>
            <tbody className="divide-y divide-line border-t border-line">
              {stats.map((s) => (
                <tr key={s.gene + s.variant} className="align-middle">
                  <td className="py-3 pr-3"><span className="num font-semibold">{s.gene}</span> <span className="num text-accent">{s.variant}</span></td>
                  <td className="num py-3 pr-3">{s.carriers}/{s.n}{s.homozygous ? <span className="text-muted"> · {s.homozygous} hom</span> : null}</td>
                  <td className="py-3 pr-3">
                    {s.n ? (
                      <div className="flex items-center gap-3">
                        <span className="ci" style={{ ["--lo" as string]: `${s.lo * 100}%`, ["--hi" as string]: `${s.hi * 100}%`, ["--p" as string]: `${s.freq * 100}%` }}><i /><b /></span>
                        <span className="num whitespace-nowrap text-xs">{pct(s.freq)} <span className="text-muted">({pct(s.lo)}–{pct(s.hi)})</span></span>
                      </div>
                    ) : <span className="text-xs text-muted">no record named this variant</span>}
                  </td>
                  <td className={`num py-3 pr-3 ${s.notStated ? "text-warn" : "text-muted"}`}>
                    {s.notStated}
                    {s.undocumented > 0 && <span className="block text-[11px] text-muted">{s.undocumented} undocumented</span>}
                  </td>
                  <td className="num py-3 pr-3 text-xs">
                    {s.notStated && s.n ? <span className="text-warn">{pct(s.naive)}</span> : <span className="text-muted">{s.n ? pct(s.naive) : "—"}</span>}
                  </td>
                  <td className="py-3 text-xs text-muted">
                    {sim ? (s.simulated === undefined ? "—" : <span className={s.n && s.simulated >= s.lo && s.simulated <= s.hi ? "num text-accent" : "num"}>{pct(s.simulated)}</span>) : (s.published ?? "—")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            Carriers have at least one copy. A record whose panel did not name a variant is left out of that variant&apos;s denominator instead of being counted as a non-carrier:
            either the report lists its panel and the variant is not in it, or the report never says which variants it tested, which is just as unknowable and is counted separately.
            Calls a curator marked unreadable are excluded. Intervals are Wilson 95% intervals.
            &ldquo;If counted as absent&rdquo; is the same records pooled the common way, with every panel that never tested a variant counted as a non-carrier.
            {sim && " The simulated frequency is what each person's genotype was drawn from; it is a simulation input, not a measurement."}
          </p>
          {sim && gap.length > 0 && (
            <p className="mt-3 text-sm leading-relaxed text-muted">
              <span className="num text-accent">{stats.filter((s) => s.simulated !== undefined && s.n > 0 && s.simulated >= s.lo && s.simulated <= s.hi).length}</span>
              {" of "}{stats.filter((s) => s.simulated !== undefined && s.n > 0).length} variants have the frequency they were drawn from inside the coverage-aware 95% interval,
              and leaving untested panels out moves the estimate up by <span className="num">{(meanShortfall * 100).toFixed(1)} points</span> on average across the {gap.length} variants
              with a coverage gap. Scored against the complete-panel answer, the naive column was actually closer on average here
              (<span className="num">1.3</span> against <span className="num">4.1</span> points): leaving records out is unbiased but noisy at this size.
              The column that matters is <span className="num">DPYD c.85T&gt;C</span>, the variant a European tier-1 panel never tests:
              <span className="num"> 15%</span> counted absent, <span className="num">31%</span> left out, against a true <span className="num">25%</span>.
              Full numbers in <span className="num">docs/pooling-results.json</span>.
            </p>
          )}
        </section>
      )}

      {records.length > 0 && (
        <section className="mt-10">
          <h2 className="section-title">Records</h2>
          <ul className="mt-3 flex flex-wrap gap-2 text-xs">
            {records.slice(-40).reverse().map((r) => (
              <li key={r.meta.id}><Link href={`/report/${r.meta.id}`} className="num inline-block rounded-md border border-line px-2 py-1 text-muted hover:border-[var(--line-strong)] hover:text-foreground">{r.meta.label || r.meta.id}</Link></li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
