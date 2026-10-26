import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

/** Run PharmCAT (docker or jar) on a VCF that already lives inside `dir`. Returns path to <base>.report.json. */
export async function runPharmcat(dir: string, vcfName: string, outsideCallsName?: string) {
  const runner = process.env.PHARMCAT_RUNNER ?? "docker";
  const base = vcfName.replace(/\.vcf(\.gz|\.bgz)?$/i, "");
  const args =
    runner === "jar"
      ? ["-jar", process.env.PHARMCAT_JAR!, "-vcf", path.join(dir, vcfName), "-o", dir, "-reporterJson", "-del"]
      : ["run", "--rm", "-v", `${path.resolve(dir)}:/pharmcat/data`, "pgkb/pharmcat", "pharmcat_pipeline",
         `/pharmcat/data/${vcfName}`, "-reporterJson", "-del"];
  if (outsideCallsName) {
    args.push("-po", runner === "jar" ? path.join(dir, outsideCallsName) : `/pharmcat/data/${outsideCallsName}`);
  }
  const cmd = runner === "jar" ? "java" : "docker";
  const log = await exec(cmd, args);
  const report = path.join(dir, `${base}.report.json`);
  await fs.access(report).catch(() => {
    throw new Error(`PharmCAT produced no report.\n${log.slice(-2000)}`);
  });
  return report;
}

function exec(cmd: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}\n${out.slice(-2000)}`))));
  });
}

// ---------- normalised model ----------
export type GeneCall = {
  gene: string;
  diplotype: string; // "*1/*2A"
  phenotype: string; // "Intermediate Metabolizer" | "No Result"
  activityScore?: string;
  called: boolean;
  source: "MATCHER" | "OUTSIDE" | "NONE";
  relatedDrugs: string[];
};

export type Citation = { pmid?: string; title: string; year?: number; url?: string };

export type DrugAnnotation = {
  drug: string;
  pharmgkbId: string;
  source: "CPIC" | "DPWG" | "FDA_LABEL" | "FDA_PGX";
  genes: string[];
  classification?: string; // Strong / Moderate / Optional
  recommendation?: string;
  implications: string[];
  url?: string;
  citations: Citation[];
  /** true when the matched annotation says no change needed */
  noChange: boolean;
};

export type PgxProfile = {
  pharmcatVersion: string;
  dataVersion: string;
  genes: GeneCall[];
  drugs: DrugAnnotation[];
};

const SOURCE_KEY: Record<string, DrugAnnotation["source"]> = {
  "CPIC Guideline Annotation": "CPIC",
  "DPWG Guideline Annotation": "DPWG",
  "FDA Label Annotation": "FDA_LABEL",
  "FDA PGx Association": "FDA_PGX",
};

const NO_CHANGE =
  /no indication to change|use label-recommended|^use at standard dose|^initiate standard starting|^initiate therapy with recommended starting dose|^standard dosing|does not provide a recommendation|no reason to avoid|^no (dose )?adjustment/i;

/** FDA/DPWG text arrives as HTML. Flatten to plain text. */
export function plain(html?: string) {
  if (!html) return html;
  return html
    .replace(/<li>/gi, "\n- ").replace(/<\/?(ul|ol|p|br|em|strong|b|i)[^>]*>/gi, "")
    .replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'")
    .replace(/\n{2,}/g, "\n").trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseReport(report: any): PgxProfile {
  const genes: GeneCall[] = Object.values(report.genes ?? {}).map((g: any) => {
    const dip = (g.recommendationDiplotypes ?? g.sourceDiplotypes ?? [])[0];
    const a1 = dip?.allele1?.name ?? "Unknown";
    const a2 = dip?.allele2?.name ?? (dip?.allele2 === null ? "" : "Unknown");
    const phenotype = dip?.phenotypes?.[0] ?? "No Result";
    const called = !!dip && a1 !== "Unknown" && phenotype !== "No Result";
    return {
      gene: g.geneSymbol,
      diplotype: a2 ? `${a1}/${a2}` : a1,
      phenotype,
      activityScore: dip?.activityScore && dip.activityScore !== "n/a" ? String(dip.activityScore) : undefined,
      called,
      source: g.callSource === "MATCHER" ? "MATCHER" : g.callSource === "OUTSIDE" ? "OUTSIDE" : "NONE",
      relatedDrugs: (g.relatedDrugs ?? []).map((d: any) => d.name),
    };
  });

  const drugs: DrugAnnotation[] = [];
  for (const [sourceName, byDrug] of Object.entries<any>(report.drugs ?? {})) {
    const source = SOURCE_KEY[sourceName] ?? "CPIC";
    for (const d of Object.values<any>(byDrug)) {
      for (const gl of d.guidelines ?? []) {
        const genesInGl = new Set<string>();
        for (const ann of gl.annotations ?? []) {
          for (const gt of ann.genotypes ?? []) for (const dp of gt.diplotypes ?? []) genesInGl.add(dp.gene);
          const rec = plain(ann.drugRecommendation as string | undefined);
          drugs.push({
            drug: d.name,
            pharmgkbId: d.id,
            source,
            genes: [...genesInGl],
            classification: ann.classification,
            recommendation: rec,
            implications: (ann.implications ?? []).map((x: string) => plain(x)!),
            url: gl.url ?? d.urls?.[0],
            citations: (d.citations ?? []).map((c: any) => ({ pmid: c.pmid, title: c.title, year: c.year, url: c._sameAs })),
            noChange: !!rec && NO_CHANGE.test(rec),
          });
        }
        if (!(gl.annotations ?? []).length) {
          drugs.push({ drug: d.name, pharmgkbId: d.id, source, genes: [], implications: [], url: gl.url, citations: [], noChange: false });
        }
      }
    }
  }
  return { pharmcatVersion: report.pharmcatVersion, dataVersion: report.dataVersion, genes, drugs };
}

export async function loadProfile(reportPath: string) {
  return parseReport(JSON.parse(await fs.readFile(reportPath, "utf8")));
}
