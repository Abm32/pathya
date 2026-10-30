/**
 * Pre-test check: from a planned regimen, which pharmacogenomic tests to order before cycle 1, and why.
 * Deterministic: a fixed gene-drug table from CPIC / DPWG / FDA labels, no model call, no patient data.
 */

export type Tier = "before" | "useful";
type Pair = { drug: string; aliases: string[]; gene: string; tier: Tier; source: string; why: string };

// ponytail: hand-kept table of oncology + supportive-care pairs; regenerate from PharmCAT's guideline data if it grows.
const PAIRS: Pair[] = [
  { drug: "capecitabine", aliases: ["xeloda", "capecitabin", "capegard", "cape", "capox", "capeox", "xelox", "capiri", "xeliri", "eox", "ecx", "xp"], gene: "DPYD", tier: "before", source: "CPIC A · FDA label", why: "DPYD carriers are ~4% of patients and ~48% of fluoropyrimidine deaths; CPIC starts carriers at 50% or avoids the drug." },
  { drug: "fluorouracil", aliases: ["5fu", "fluracil", "adrucil", "5fluorouracil", "folfox", "mfolfox6", "folfiri", "folfirinox", "mfolfirinox", "folfoxiri", "flot", "dcf", "tpf", "ecf", "pf", "mayo", "degramont", "lv5fu2"], gene: "DPYD", tier: "before", source: "CPIC A · FDA label", why: "Same DPD pathway as capecitabine; FDA added DPD-deficiency testing language in 2026." },
  { drug: "tegafur", aliases: ["uftoral", "s1", "teysuno", "sox", "uft"], gene: "DPYD", tier: "before", source: "DPWG", why: "Prodrug of 5-FU, cleared by DPD." },
  { drug: "irinotecan", aliases: ["campto", "cpt11", "irinotel", "onivyde", "folfiri", "folfirinox", "mfolfirinox", "folfoxiri", "capiri", "xeliri", "irinox"], gene: "UGT1A1", tier: "before", source: "DPWG · FDA label", why: "UGT1A1 *28/*28 or *6 carriers clear SN-38 slowly: neutropenia and diarrhoea at standard dose." },
  { drug: "sacituzumab govitecan", aliases: ["trodelvy", "sacituzumab"], gene: "UGT1A1", tier: "before", source: "FDA label", why: "Same SN-38 payload as irinotecan." },
  { drug: "mercaptopurine", aliases: ["6mp", "purinethol", "purixan"], gene: "TPMT + NUDT15", tier: "before", source: "CPIC A", why: "Thiopurine myelosuppression; in Indians NUDT15 drives more of the risk than TPMT." },
  { drug: "thioguanine", aliases: ["6tg", "tioguanine"], gene: "TPMT + NUDT15", tier: "before", source: "CPIC A", why: "Thiopurine myelosuppression; NUDT15 matters more than TPMT in South Asians." },
  { drug: "azathioprine", aliases: ["imuran", "azoran", "azimune"], gene: "TPMT + NUDT15", tier: "before", source: "CPIC A", why: "Thiopurine myelosuppression; NUDT15 matters more than TPMT in South Asians." },
  { drug: "rasburicase", aliases: ["fasturtec", "elitek", "rasburi"], gene: "G6PD", tier: "before", source: "CPIC A · FDA boxed warning", why: "Contraindicated in G6PD deficiency (haemolysis, methaemoglobinaemia). About 8.5% of Indians are deficient. Use an enzyme-activity test." },
  { drug: "tamoxifen", aliases: ["nolvadex", "tamodex", "mamofen"], gene: "CYP2D6", tier: "useful", source: "CPIC A", why: "Poor and intermediate metabolizers make less endoxifen; CPIC suggests an aromatase inhibitor or a higher dose." },
  { drug: "ondansetron", aliases: ["zofran", "emeset", "ondem", "vomikind"], gene: "CYP2D6", tier: "useful", source: "CPIC A", why: "Ultrarapid metabolizers clear it fast and get less antiemetic effect." },
  { drug: "tropisetron", aliases: ["navoban"], gene: "CYP2D6", tier: "useful", source: "CPIC A", why: "Ultrarapid metabolizers get less antiemetic effect." },
  { drug: "tramadol", aliases: ["contramal", "ultracet", "tramazac"], gene: "CYP2D6", tier: "useful", source: "CPIC A", why: "Ultrarapid metabolizers risk toxicity; poor metabolizers get poor pain relief." },
  { drug: "codeine", aliases: ["codeine phosphate"], gene: "CYP2D6", tier: "useful", source: "CPIC A", why: "Ultrarapid metabolizers risk morphine toxicity; poor metabolizers get no relief." },
  { drug: "clopidogrel", aliases: ["plavix", "clopilet", "deplatt", "clopitab"], gene: "CYP2C19", tier: "useful", source: "CPIC A", why: "Poor metabolizers (common in South Asians) get little antiplatelet effect." },
  { drug: "pantoprazole", aliases: ["pan40", "pan", "pantocid", "pantop"], gene: "CYP2C19", tier: "useful", source: "CPIC A", why: "Exposure depends on CYP2C19; dose changes for rapid metabolizers and long-term use." },
  { drug: "omeprazole", aliases: ["omez", "prilosec"], gene: "CYP2C19", tier: "useful", source: "CPIC A", why: "Exposure depends on CYP2C19." },
  { drug: "esomeprazole", aliases: ["nexpro", "nexium", "esoz"], gene: "CYP2C19", tier: "useful", source: "CPIC A", why: "Exposure depends on CYP2C19." },
  { drug: "rabeprazole", aliases: ["razo", "rablet", "aciphex"], gene: "CYP2C19", tier: "useful", source: "CPIC A", why: "Exposure depends on CYP2C19." },
  { drug: "lansoprazole", aliases: ["prevacid", "lanzol"], gene: "CYP2C19", tier: "useful", source: "CPIC A", why: "Exposure depends on CYP2C19." },
  { drug: "voriconazole", aliases: ["vfend", "vorier"], gene: "CYP2C19", tier: "useful", source: "CPIC A", why: "Antifungal in haem-onc; poor and rapid metabolizers miss the target level." },
];

export type PretestResult = {
  tests: { gene: string; tier: Tier; drugs: { input: string; drug: string; source: string; why: string }[] }[];
  noGuideline: string[];
};

const words = (s: string) => s.toLowerCase().replace(/\b(\d)[\s-]+([a-z]{2})\b/g, "$1$2").replace(/\b([a-z]{1,3})[\s-]+(\d{1,2})\b/g, "$1$2").split(/[^a-z0-9]+/).filter(Boolean);
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Short aliases (cape, pan, s1, 6mp) must be a whole word; longer ones may appear anywhere in the line. */
function match(line: string): Pair[] {
  const w = words(line), sq = squash(line);
  return PAIRS.filter((p) => [p.drug, ...p.aliases].some((a) => { const x = squash(a); return x.length >= 5 ? sq.includes(x) : w.includes(x); }));
}

export function pretest(regimen: string): PretestResult {
  const byGene = new Map<string, PretestResult["tests"][number]>();
  const noGuideline: string[] = [];
  for (const line of regimen.split(/\n|,/).map((l) => l.trim()).filter(Boolean)) {
    const hits = match(line);
    if (!hits.length) { noGuideline.push(line); continue; }
    for (const p of hits) {
      const t = byGene.get(p.gene) ?? { gene: p.gene, tier: p.tier, drugs: [] };
      if (!t.drugs.some((d) => d.drug === p.drug)) t.drugs.push({ input: line, drug: p.drug, source: p.source, why: p.why });
      byGene.set(p.gene, t);
    }
  }
  const tests = [...byGene.values()].sort((a, b) => (a.tier === b.tier ? 0 : a.tier === "before" ? -1 : 1));
  return { tests, noGuideline };
}
