"""Score PharmCAT's calls from real sequence against the real GeT-RM consensus genotypes.

  python3 scripts/getrm/fetch.py && python3 scripts/getrm/score.py

Runs the same PharmCAT 3.4 image the app runs, once per sample, then compares gene by gene.
Writes docs/getrm-results.json and prints the table that docs/GETRM.md quotes.

Two genes cannot be compared on allele names and say so in the output:
  * SLCO1B1 - the consensus tables use the legacy star names (*1A, *1B, *17), PharmCAT uses PharmVar's
    (*1, *37, *15), and the legacy set is not a renaming of the new one. Scored on transporter function.
  * DPYD - GeT-RM reports only the variants its labs typed, while PharmCAT names every allele it finds,
    benign ones included. Scored as: every variant GeT-RM reports must be among PharmCAT's alleles.
"""
import collections, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RUN = os.path.join(ROOT, "data", "getrm", "run")
VCF = os.path.join(ROOT, "data", "getrm", "vcf")
GENES = ["DPYD", "CYP2C19", "CYP2C9", "TPMT", "NUDT15", "UGT1A1", "SLCO1B1", "VKORC1"]

DPYD = {"*1": "Reference", "*2": "c.1905+1G>A", "*2A": "c.1905+1G>A", "*4": "c.1601G>A", "*5": "c.1627A>G",
        "*6": "c.2194G>A", "*9": "c.85T>C", "*9A": "c.85T>C", "*13": "c.1679T>G", "*10": "c.2983G>T",
        "HapB3": "c.1129-5923C>G"}
# CPIC function per SLCO1B1 allele; a diplotype is Decreased if either allele is, Increased only if both are.
SLCO_FN = {"*1": "Normal", "*1A": "Normal", "*1B": "Normal", "*37": "Normal",
           "*5": "Decreased", "*15": "Decreased", "*17": "Decreased", "*14": "Increased", "*20": "Increased"}
# A diplotype of two decreased-function alleles is Poor Function, not Decreased.
SLCO_DIP = {("Decreased", "Decreased"): "Poor"}


def dpyd(a):
    a = a.strip().strip("()").strip()
    for k, v in DPYD.items():
        if a.lower() == k.lower():
            return v
    m = re.search(r"c\.[0-9+\-]+[A-Z]>[A-Z]", a)
    return m.group(0) if m else a


def truth_alleles(gene, s):
    s = s.strip()
    # "no variant detected" on one chromosome is the reference allele written out.
    s = re.sub(r"\b(no variants? detected|none detected|negative)\b", "*1", s, flags=re.I).strip()
    if gene == "VKORC1" and re.fullmatch(r"[GA]{2}", s):
        return sorted({"G": "C", "A": "T"}[c] for c in s)   # rs9923231 is reported on the minus strand
    if "/" not in s:
        return None
    parts = [p.strip() for p in s.split("/")]
    if gene == "DPYD":
        return sorted(dpyd(p) for p in parts)
    if gene == "UGT1A1":
        return sorted("+".join(x for x in (y.strip() for y in p.strip("() ").split("+")) if x and x not in ("*60", "*80")) or "*1" for p in parts)
    return sorted(parts)


def called_alleles(rep, gene):
    g = (rep.get("genes") or {}).get(gene) or {}
    out = []
    for d in g.get("sourceDiplotypes") or g.get("recommendationDiplotypes") or []:
        a1 = (d.get("allele1") or {}).get("name")
        a2 = (d.get("allele2") or {}).get("name")
        if not a1:
            continue
        pair = [re.sub(r"^\*80\+", "", x) for x in (a1, a2 or a1)]
        if gene == "CYP2C19":
            pair = ["*1" if x == "*38" else x for x in pair]   # PharmVar renamed the CYP2C19 reference allele *38
        if gene == "VKORC1":
            pair = [re.sub(r".*\(([CT])\).*", r"\1", x) for x in pair]
        if gene == "DPYD":
            pair = [dpyd(x) for x in pair]
        out.append(sorted(pair))
    return out


def slco1b1(rep, tv):
    alleles = [a.strip() for a in tv.split("/")]
    if any(a not in SLCO_FN for a in alleles):
        return ("unscored", f"legacy name {tv} has no PharmVar equivalent")
    fns = sorted(SLCO_FN[a] for a in alleles)
    want = SLCO_DIP.get(tuple(fns)) or ("Decreased" if "Decreased" in fns else "Increased" if fns.count("Increased") == 2 else "Normal")
    d = (((rep.get("genes") or {}).get("SLCO1B1") or {}).get("recommendationDiplotypes") or [{}])[0]
    pheno = (d.get("phenotypes") or ["No Result"])[0]
    got = pheno.replace(" Function", "")
    detail = f"{(d.get('allele1') or {}).get('name')}/{(d.get('allele2') or {}).get('name')} = {pheno}, expected {want}"
    if got in ("Indeterminate", "No Result", "n/a"):
        return ("unscored", detail)
    return ("match" if got == want else "MISMATCH", detail)


def pharmcat(sample):
    report = f"{RUN}/{sample}.report.json"
    if os.path.exists(report):
        return json.load(open(report))
    os.makedirs(RUN, exist_ok=True)
    subprocess.run(["cp", f"{VCF}/{sample}.vcf", RUN], check=True)
    subprocess.run(["docker", "run", "--rm", "-v", f"{RUN}:/pharmcat/data", "pgkb/pharmcat",
                    "pharmcat_pipeline", f"/pharmcat/data/{sample}.vcf", "-reporterJson", "-del"],
                   check=True, stdout=subprocess.DEVNULL)
    return json.load(open(report))


if __name__ == "__main__":
    truth = json.load(open(f"{ROOT}/fixtures/getrm/truth.json"))
    if "--all" in sys.argv:
        samples = sorted(truth)
    else:
        samples = sys.argv[1:] or json.load(open(f"{ROOT}/fixtures/getrm/selected.json"))
    rows, tally = [], collections.defaultdict(lambda: [0, 0, 0])
    for s in samples:
        rep = pharmcat(s)
        for gene in GENES:
            tv = (truth.get(s) or {}).get(gene)
            if not tv:
                continue
            if gene == "SLCO1B1":
                res, detail = slco1b1(rep, tv)
            elif "undefined" in tv or re.search(r"c\.\d+[A-Z]>[A-Z] het", tv):
                res, detail = "unscored", "the consensus table reports variants, not a diplotype"
            elif re.search(r"deletion|duplication|hemizygous|exon \d+", tv, re.I):
                res, detail = "unscored", "structural variant: copy number is outside what this panel can call"
            else:
                # Some consensus entries give two possible diplotypes ("*8/*33 or *1/*46"); either is a match.
                options = [truth_alleles(gene, part) for part in re.split(r"\s+or\s+", tv)]
                got = called_alleles(rep, gene)
                if any(o is None for o in options) or not got:
                    res, detail = "unscored", str(got)
                else:
                    ok = any(({a for a in exp if a != "Reference"} <= set(c)) if gene == "DPYD" else c == exp
                             for exp in options for c in got)
                    res, detail = ("match" if ok else "MISMATCH"), " | ".join("/".join(c) for c in got)
            tally[gene][{"match": 0, "MISMATCH": 1, "unscored": 2}[res]] += 1
            rows.append({"sample": s, "gene": gene, "getrm": tv, "pharmcat": detail, "result": res})

    total = [0, 0, 0]
    print(f"{'gene':9} {'match':>6} {'mismatch':>9} {'unscored':>9}  concordance")
    for g in GENES:
        m, x, u = tally[g]
        total = [total[0] + m, total[1] + x, total[2] + u]
        if m + x + u:
            print(f"{g:9} {m:6} {x:9} {u:9}  " + (f"{m / (m + x) * 100:.0f}%" if m + x else "n/a"))
    print(f"{'TOTAL':9} {total[0]:6} {total[1]:9} {total[2]:9}  {total[0] / (total[0] + total[1]) * 100:.1f}%")
    for r in rows:
        if r["result"] == "MISMATCH":
            print(f"  {r['sample']:9} {r['gene']:8} GeT-RM={r['getrm']:22} PharmCAT={r['pharmcat']}")
    json.dump({"samples": len(samples), "match": total[0], "mismatch": total[1], "unscored": total[2], "calls": rows},
              open(f"{ROOT}/docs/getrm-results.json", "w"), indent=1)
