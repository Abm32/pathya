"""Generate the extraction benchmark: synthetic Indian PGx lab reports with known genotypes.

python3 scripts/bench/gen.py [seed] [dir]   ->  <dir>/*.pdf|*.jpg + <dir>/truth.json
(default seed 20261030 into fixtures/bench; the held-out set is seed 7 into fixtures/bench-heldout)

Four layouts seen in Indian PGx reports (star-allele table, rsID table, narrative, variant checklist),
each rendered three ways: clean PDF, phone photo, harsh photo. Every document is synthetic.
"""
import json, random, subprocess, sys, tempfile
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer

ARGV = sys.argv[1:]
POP = bool(ARGV) and ARGV[0] == "pop"
if POP:
    ARGV = ARGV[1:]
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / (ARGV[1] if len(ARGV) > 1 else ("fixtures/pop" if POP else "fixtures/bench"))
rnd = random.Random(int(ARGV[0]) if ARGV else (815 if POP else 20261030))

# Truth alleles. DPYD uses PharmCAT's HGVS names (what normaliseDiplotype produces); other genes star alleles.
HAPB3, C85, A2, C13, D949 = "c.1129-5923C>G, c.1236G>A (HapB3)", "c.85T>C (*9A)", "c.1905+1G>A (*2A)", "c.1679T>G (*13)", "c.2846A>T"
DPYD_INFO = {  # allele: (short label, rsID, ref/alt, activity value)
    HAPB3: ("c.1236G>A (HapB3)", "rs75017182", "C/G", 0.5),
    C85: ("c.85T>C (*9A)", "rs1801265", "A/G", 1.0),
    A2: ("c.1905+1G>A (*2A)", "rs3918290", "C/T", 0.0),
    C13: ("c.1679T>G (*13)", "rs55886062", "A/C", 0.0),
    D949: ("c.2846A>T", "rs67376798", "T/A", 0.5),
}
POOLS = {
    "DPYD": [("Reference", "Reference"), (HAPB3, "Reference"), (C85, "Reference"), (HAPB3, C85), (A2, "Reference"), (D949, "Reference"), (A2, C13), (HAPB3, HAPB3)],
    "UGT1A1": [("*1", "*1"), ("*1", "*28"), ("*28", "*28"), ("*1", "*6"), ("*6", "*28")],
    "TPMT": [("*1", "*1"), ("*1", "*3C"), ("*1", "*3A"), ("*3A", "*3C")],
    "NUDT15": [("*1", "*1"), ("*1", "*3"), ("*3", "*3")],
    "CYP2D6": [("*1", "*1"), ("*1", "*4"), ("*4", "*10"), ("*10", "*10"), ("*1", "*41"), ("*4", "*4"), ("*1", "*2")],
    "CYP2C19": [("*1", "*1"), ("*1", "*2"), ("*2", "*2"), ("*1", "*17"), ("*2", "*17"), ("*2", "*3")],
}
# How each tested allele is printed in a "variants tested" list.
TESTED_TXT = {
    ("DPYD", A2): "rs3918290 (*2A)", ("DPYD", C13): "rs55886062 (*13)", ("DPYD", D949): "rs67376798 (c.2846A>T)",
    ("DPYD", HAPB3): "rs75017182 (HapB3)", ("DPYD", C85): "rs1801265 (c.85T>C)",
    ("UGT1A1", "*28"): "TA repeat rs3064744 (*28)", ("UGT1A1", "*6"): "rs4148323 (*6)",
    ("NUDT15", "*3"): "rs116855232 (*3)",
}
# Full panel per gene, in the order a report lists it. A simulated lab may test only a subset (see PANELS).
ALL_TESTED = {
    "DPYD": [HAPB3, C85, A2, C13, D949], "UGT1A1": ["*28", "*6"], "TPMT": ["*2", "*3A", "*3B", "*3C"],
    "NUDT15": ["*3"], "CYP2D6": ["*2", "*3", "*4", "*5", "*6", "*10", "*41"], "CYP2C19": ["*2", "*3", "*17"],
}
# A report lists the variants it tested in its own order, which need not be the row order.
TEXT_ORDER = {"DPYD": [A2, C13, D949, HAPB3, C85]}
def tested_text(g, alleles):
    order = TEXT_ORDER.get(g, ALL_TESTED[g])
    return ", ".join(TESTED_TXT.get((g, al), al) for al in sorted(alleles, key=order.index))
TESTED = {g: tested_text(g, al) for g, al in ALL_TESTED.items()}
STAR_RS = {  # rsID layout for star genes: allele -> (rsID, het genotype, hom genotype)
    ("UGT1A1", "*28"): ("rs3064744", "(TA)6/(TA)7", "(TA)7/(TA)7"), ("UGT1A1", "*6"): ("rs4148323", "G/A", "A/A"),
    ("TPMT", "*3C"): ("rs1142345", "A/G", "G/G"), ("TPMT", "*3B"): ("rs1800460", "C/T", "T/T"),
    ("NUDT15", "*3"): ("rs116855232", "C/T", "T/T"),
    ("CYP2D6", "*4"): ("rs3892097", "C/T", "T/T"), ("CYP2D6", "*10"): ("rs1065852", "G/A", "A/A"), ("CYP2D6", "*41"): ("rs28371725", "C/T", "T/T"), ("CYP2D6", "*2"): ("rs16947", "G/A", "A/A"),
    ("CYP2C19", "*2"): ("rs4244285", "G/A", "A/A"), ("CYP2C19", "*3"): ("rs4986893", "G/A", "A/A"), ("CYP2C19", "*17"): ("rs12248560", "C/T", "T/T"),
}
CYP2D6_AS = {"*1": 1, "*2": 1, "*4": 0, "*10": 0.25, "*41": 0.5}
NOFN = {"TPMT": {"*3A", "*3B", "*3C"}, "NUDT15": {"*3"}, "UGT1A1": {"*28", "*6"}}


def phenotype(gene, a, b):
    if gene == "DPYD":
        s = sum(DPYD_INFO[x][3] if x in DPYD_INFO else 1.0 for x in (a, b))
        return ("Normal metabolizer" if s >= 2 else "Intermediate metabolizer" if s >= 1 else "Poor metabolizer"), f"{s:g}"
    if gene == "CYP2D6":
        s = CYP2D6_AS[a] + CYP2D6_AS[b]
        return ("Poor metabolizer" if s == 0 else "Intermediate metabolizer" if s <= 1 else "Normal metabolizer"), f"{s:g}"
    if gene == "CYP2C19":
        nf = sum(x in ("*2", "*3") for x in (a, b)); inc = sum(x == "*17" for x in (a, b))
        return ("Poor metabolizer" if nf == 2 else "Intermediate metabolizer" if nf == 1 else "Ultrarapid metabolizer" if inc == 2 else "Rapid metabolizer" if inc else "Normal metabolizer"), ""
    n = sum(x in NOFN[gene] for x in (a, b))
    return ["Normal metabolizer", "Intermediate metabolizer", "Poor metabolizer"][n], ""


def dpyd_text(a, b):
    """How labs write DPYD results: detected variants with zygosity."""
    if (a, b) == ("Reference", "Reference"):
        return "No tested variant detected"
    if a == b:
        return f"{DPYD_INFO[a][0]} homozygous"
    return "; ".join(f"{DPYD_INFO[x][0]} heterozygous" for x in (a, b) if x != "Reference")


def star_text(gene, a, b):
    if gene == "UGT1A1":
        ta = {"*1": "TA6", "*28": "TA7", "*6": "TA6"}
        return f"{a}/{b} ({ta[a]}/{ta[b]})" if "*6" not in (a, b) else f"{a}/{b}"
    if gene == "TPMT" and "*3A" in (a, b):
        return f"{a}/{b} (*3B + *3C in cis)"
    return f"{a}/{b}"


def rsid_rows(gene, a, b, tested=None):
    """rsID layout rows: (rsID, genotype, zygosity). Only alleles this panel tests appear."""
    panel = (tested or ALL_TESTED)[gene]
    if gene == "DPYD":
        rows = []
        for allele in panel:
            _, rs, gt, _ = DPYD_INFO[allele]
            n = (a == allele) + (b == allele)
            ref, alt = gt.split("/")
            rows.append((rs, [f"{ref}/{ref}", f"{ref}/{alt}", f"{alt}/{alt}"][n], ["Wild type", "Heterozygous", "Homozygous"][n]))
        return rows
    rows, alleles = [], [a, b]
    if gene == "TPMT":  # *3A = *3B + *3C on one chromosome
        alleles = [x for y in alleles for x in (["*3B", "*3C"] if y == "*3A" else [y])]
    for (g, al), (rs, het, hom) in STAR_RS.items():
        if g != gene or al not in panel:
            continue
        n = alleles.count(al)
        wt = het.split("/")[0]
        rows.append((rs, [f"{wt}/{wt}" if not wt.startswith("(") else "(TA)6/(TA)6", het, hom][n], ["Wild type", "Heterozygous", "Homozygous"][n]))
    return rows


def checklist(gene, a, b, tested=None):
    """Variant checklist layout: every tested allele with Detected / Not detected."""
    panel = (tested or ALL_TESTED)[gene]
    seen = lambda x: ["Not detected", "Detected (heterozygous)", "Detected (homozygous)"][(a == x) + (b == x)]
    if gene == "DPYD":
        return [(DPYD_INFO[x][0], seen(x)) for x in panel]
    return [(al, seen(al)) for al in panel]


ss = getSampleStyleSheet()
small = ParagraphStyle("s", parent=ss["Normal"], fontSize=8.5, leading=10.5)
body = ParagraphStyle("b", parent=ss["Normal"], fontSize=10, leading=13.5)
LABS = ["Synthetic Genomics Lab (Kochi) · TEST DOCUMENT", "Sample Molecular Diagnostics, Bengaluru · NOT A REAL LAB",
        "Demo Precision Oncology Labs, Chennai · SYNTHETIC", "Example Pharmacogenomics Centre, Mumbai · FOR SOFTWARE TESTING"]
DISTRACT = "Drugs potentially affected: capecitabine, 5-fluorouracil, irinotecan, azathioprine, mercaptopurine, tamoxifen, clopidogrel, ondansetron."


def build(path, layout, genes, idx, tested=None):
    doc = SimpleDocTemplate(str(path), pagesize=A4, leftMargin=40, rightMargin=40, topMargin=36, bottomMargin=36)
    font = "Times-Roman" if layout == "narrative" else "Helvetica"
    h = ParagraphStyle("h", parent=ss["Title"], fontName=font.replace("-Roman", "-Bold") if font.startswith("Times") else "Helvetica-Bold", fontSize=15)
    el = [Paragraph(LABS[idx % 4], h),
          Paragraph(f"Report ID BENCH-{idx:03d} · Sample: peripheral blood (EDTA) · Reported {rnd.randint(1, 28)} Oct 2026 · Patient: [redacted] · Age/Sex: {rnd.randint(28, 76)}/{rnd.choice('MF')}", small),
          Spacer(1, 8), Paragraph("<b>PHARMACOGENOMIC ONCOLOGY PANEL</b>", body), Spacer(1, 6)]
    ts = TableStyle([("GRID", (0, 0), (-1, -1), 0.4, colors.grey), ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8eef0")),
                     ("VALIGN", (0, 0), (-1, -1), "TOP"), ("FONTSIZE", (0, 0), (-1, -1), 8.5)])
    P = lambda t: Paragraph(t, small)
    if layout == "star":
        rows = [[P("<b>Gene</b>"), P("<b>Variants tested</b>"), P("<b>Result</b>"), P("<b>Interpretation</b>")]]
        for g, (a, b) in genes.items():
            ph, s = phenotype(g, a, b)
            res = dpyd_text(a, b) if g == "DPYD" else star_text(g, a, b)
            rows.append([P(g), P(tested_text(g, (tested or ALL_TESTED)[g])), P(res), P(ph + (f" (activity score {s})" if s else ""))])
        el.append(Table(rows, colWidths=[55, 175, 150, 135], style=ts))
    elif layout == "rsid":
        rows = [[P("<b>Gene</b>"), P("<b>rsID</b>"), P("<b>Genotype</b>"), P("<b>Zygosity</b>")]]
        for g, (a, b) in genes.items():
            for rs, gt, z in rsid_rows(g, a, b, tested):
                rows.append([P(g), P(rs), P(gt), P(z)])
        el.append(Table(rows, colWidths=[70, 120, 130, 120], style=ts))
        el += [Spacer(1, 6), Paragraph("Genotypes are reported per rsID on the forward strand. Star-allele assignment is left to the treating clinician.", small)]
    elif layout == "narrative":
        for g, (a, b) in genes.items():
            ph, s = phenotype(g, a, b)
            if g == "DPYD":
                det = dpyd_text(a, b)
                txt = ("No variant from the tested DPYD panel was detected. " if det.startswith("No") else f"The patient carries DPYD {det}. ") + f"Predicted DPD phenotype: {ph.lower()} (activity score {s})."
            else:
                txt = f"Genotype {star_text(g, a, b)}, consistent with a {ph.lower()}" + (f" (activity score {s})." if s else ".")
            el += [Paragraph(f"<b>{g}.</b> {txt}", body), Spacer(1, 5)]
    else:  # checklist
        for g, (a, b) in genes.items():
            ph, _ = phenotype(g, a, b)
            rows = [[P(f"<b>{g}</b>"), P(f"<b>Phenotype: {ph}</b>")]] + [[P(al), P(st)] for al, st in checklist(g, a, b, tested)]
            el += [Table(rows, colWidths=[160, 220], style=ts), Spacer(1, 6)]
    el += [Spacer(1, 8), Paragraph(DISTRACT, small), Spacer(1, 4),
           Paragraph("Method: targeted genotyping by real-time PCR. Only the listed variants are assayed; variants outside this panel cannot be excluded. "
                     "Synthetic document generated for software benchmarking. Not a real patient or laboratory.", small)]
    doc.build(el)


def render(pdf, jpg, harsh):
    with tempfile.TemporaryDirectory() as t:
        subprocess.run(["pdftoppm", "-r", "95" if harsh else "115", "-jpeg", "-f", "1", "-l", "1", "-singlefile", pdf, f"{t}/p"], check=True)
        src = f"{t}/p.jpg"
        if harsh:  # skewed hand-held shot, uneven light, more blur and noise, heavy JPEG
            w, h = map(int, subprocess.run(["magick", "identify", "-format", "%w %h", src], capture_output=True, text=True).stdout.split())
            dx = int(w * 0.04)
            args = ["-virtual-pixel", "white", "-distort", "Perspective", f"0,0 {dx},{dx} {w},0 {w - dx // 3},{dx // 2} 0,{h} 0,{h - dx // 2} {w},{h} {w - dx},{h}",
                    "-rotate", str(rnd.choice([-3.5, -2.5, 2.5, 3.5])), "(", "+clone", "-sparse-color", "Barycentric", "0,0 white %[w],%[h] gray72", ")",
                    "-compose", "multiply", "-composite", "-blur", "0x0.75", "-attenuate", "0.55", "+noise", "Gaussian", "-quality", "55"]
        else:
            args = ["-rotate", str(rnd.choice([-1.8, -1.2, 1.2, 1.8])), "-blur", "0x0.4", "-fill", "#f3efe6", "-colorize", "8%", "-attenuate", "0.3", "+noise", "Gaussian", "-quality", "72"]
        subprocess.run(["magick", src, *args, jpg], check=True)


# ---------------------------------------------------------------------------
# Population mode: reports drawn at published Indian allele frequencies.
#
# Each simulated person gets a true genotype sampled from ALLELE_FREQ. The lab that
# issued their report tests only part of the panel (PANELS), so the report shows the
# true genotype restricted to the variants that lab assays. Pooling such reports as if
# an untested variant were absent biases every frequency downward; the point of the
# cohort is that the coverage-aware denominator does not.
#
# Allele frequencies are the per-chromosome values implied by the published Indian
# carrier/allele figures cited below. They are simulation inputs, not measurements.
ALLELE_FREQ = {
    "DPYD": [(HAPB3, 0.017), (C85, 0.130), (A2, 0.001), (C13, 0.001), (D949, 0.002)],
    "UGT1A1": [("*28", 0.350), ("*6", 0.020)],
    "TPMT": [("*3C", 0.014), ("*3A", 0.004)],
    "NUDT15": [("*3", 0.090)],
    "CYP2C19": [("*2", 0.350), ("*3", 0.010), ("*17", 0.150)],
    "CYP2D6": [("*4", 0.080), ("*10", 0.120), ("*41", 0.100), ("*2", 0.120)],
}
# Where each input came from. "assumed" means no India-specific figure was verified.
FREQ_SOURCE = {
    "DPYD HapB3": "3.3% carriers in a WES study of 1,612 Indians (PMID 40810747)",
    "DPYD c.85T>C (*9A)": "24.9% carriers in 2,000 Indians (PMID 33105068)",
    "DPYD *2A": "0.05-0.5% carriers in Indian cohorts (PMID 40810747)",
    "DPYD *13": "near-absent in Indians (PMID 40810747); assumed 0.1%",
    "DPYD c.2846A>T": "near-absent in Indians (PMID 40810747); assumed 0.2%",
    "NUDT15 *3": "risk allele 7-11% in Indian cohorts (PMID 29470173)",
    "UGT1A1 *28": "assumed 35%, the usual South Asian figure; no single Indian source verified",
    "UGT1A1 *6": "assumed 2%; reported at low frequency in India",
    "TPMT *3C": "2.5-2.9% carriers in Indian cohorts; assumed 1.4% allele",
    "CYP2C19 *2": "assumed 35%, the usual South Asian figure",
    "CYP2C19 *17": "assumed 15%",
}
REF_ALLELE = {"DPYD": "Reference"}
# Panels a real Indian lab might run. The first tests only the European tier-1 DPYD variants,
# which is exactly the panel that cannot see the variant that matters most here.
PANELS = [
    ("DPYD tier-1 + UGT1A1 TA repeat", {"DPYD": [A2, C13, D949], "UGT1A1": ["*28"]}, 4),
    ("Extended DPYD + UGT1A1", {"DPYD": [HAPB3, C85, A2, C13, D949], "UGT1A1": ["*28", "*6"]}, 3),
    ("Thiopurine panel", {"TPMT": ["*2", "*3A", "*3B", "*3C"], "NUDT15": ["*3"]}, 2),
    ("Comprehensive oncology panel", {"DPYD": [HAPB3, C85, A2, C13, D949], "UGT1A1": ["*28", "*6"],
                                      "TPMT": ["*2", "*3A", "*3B", "*3C"], "NUDT15": ["*3"], "CYP2C19": ["*2", "*3", "*17"], "CYP2D6": ["*2", "*3", "*4", "*5", "*6", "*10", "*41"]}, 3),
    ("Cardiology pharmacogenomics panel", {"CYP2C19": ["*2", "*3", "*17"], "CYP2D6": ["*2", "*3", "*4", "*5", "*6", "*10", "*41"]}, 2),
]


def sample_genotype(gene):
    """One chromosome at a time: each carries at most one of the gene's variant alleles."""
    ref = REF_ALLELE.get(gene, "*1")
    def chrom():
        r = rnd.random(); c = 0.0
        for allele, f in ALLELE_FREQ[gene]:
            c += f
            if r < c:
                return allele
        return ref
    a, b = chrom(), chrom()
    return (a, b) if b == ref or (a != ref and a <= b) else (b, a)


def observed(gene, genotype, panel):
    """What the report can say: alleles the lab did not assay are indistinguishable from reference."""
    ref = REF_ALLELE.get(gene, "*1")
    tested = panel.get(gene, [])
    seen = [x if (x == ref or x in tested or (x == "*3A" and "*3A" in tested)) else ref for x in genotype]
    return (seen[0], seen[1]) if seen[1] == ref or seen[0] != ref else (seen[1], seen[0])


def pop_main(n):
    OUT.mkdir(parents=True, exist_ok=True)
    layouts = ["star", "rsid", "narrative", "checklist"]
    weighted = [p for p in PANELS for _ in range(p[2])]
    truth = []
    for i in range(n):
        panel_name, panel, _ = weighted[rnd.randrange(len(weighted))]
        layout = layouts[i % 4]
        if layout == "rsid" and "CYP2D6" in panel:  # rsID-only reports cannot call CYP2D6, as in the bench set
            panel = {g: a for g, a in panel.items() if g != "CYP2D6"}
        true_genes = {g: sample_genotype(g) for g in panel}
        obs = {g: observed(g, gt, panel) for g, gt in true_genes.items()}
        base = f"p{i:03d}-{layout}"
        pdf = OUT / f"{base}.pdf"
        build(pdf, layout, obs, i, panel)
        jpg = OUT / f"{base}-photo.jpg"
        render(str(pdf), str(jpg), False)
        truth.append({"id": base, "file": jpg.name, "layout": layout, "panel": panel_name,
                      "tested": {g: list(a) for g, a in panel.items()},
                      "true_genes": {g: f"{a}/{b}" for g, (a, b) in true_genes.items()},
                      "genes": {g: f"{a}/{b}" for g, (a, b) in obs.items()}})
    (OUT / "truth.json").write_text(json.dumps({"n": n, "allele_freq": {g: dict(v) for g, v in ALLELE_FREQ.items()},
                                                "freq_source": FREQ_SOURCE, "cases": truth}, indent=1))
    print(f"{n} simulated people -> {OUT}")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    truth = []
    layouts = ["star", "rsid", "narrative", "checklist"]
    for i in range(12):
        layout = layouts[i % 4]
        # CYP2D6 needs star-allele calling (rs1065852 sits on both *4 and *10), so rsID-only reports omit it, as real labs do
        pool = ["UGT1A1", "TPMT", "NUDT15", "CYP2C19"] + ([] if layout == "rsid" else ["CYP2D6"])
        others = rnd.sample(pool, rnd.randint(2, len(pool)))
        # cycle DPYD so every DPYD genotype appears at least once
        genes = {"DPYD": POOLS["DPYD"][i % len(POOLS["DPYD"])] if i < 8 else rnd.choice(POOLS["DPYD"])}
        genes.update({g: rnd.choice(POOLS[g]) for g in others})
        base = f"r{i:02d}-{layout}"
        pdf = OUT / f"{base}.pdf"
        build(pdf, layout, genes, i)
        text = subprocess.run(["pdftotext", str(pdf), "-"], capture_output=True, text=True).stdout
        for kind in ("pdf", "photo", "harsh"):
            f = pdf if kind == "pdf" else OUT / f"{base}-{kind}.jpg"
            if kind != "pdf":
                render(str(pdf), str(f), kind == "harsh")
            truth.append({"id": f"{base}-{kind}", "file": f.name, "layout": layout, "render": kind,
                          "genes": {g: f"{a}/{b}" for g, (a, b) in genes.items()}, "text": text})
    (OUT / "truth.json").write_text(json.dumps(truth, indent=1))
    print(f"{len(truth)} cases -> {OUT}")


if __name__ == "__main__":
    if POP:
        pop_main(int(ARGV[2]) if len(ARGV) > 2 else 60)
    else:
        main()
