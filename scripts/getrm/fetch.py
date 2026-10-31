"""Rebuild the real-data benchmark inputs from their two public sources.

  python3 scripts/getrm/fetch.py            # truth table + per-sample VCFs for fixtures/getrm/selected.json
  python3 scripts/getrm/fetch.py --all      # every GeT-RM sample that is also in 1000 Genomes (208)

Truth: the CDC GeT-RM consolidated PGx/HLA table, consensus genotypes from multiple labs for Coriell
reference DNA (https://www.cdc.gov/lab-quality/php/get-rm/reference-materials.html).
Genotypes: the 1000 Genomes 30x high-coverage phased panel on GRCh38, sliced over HTTP at the gene
regions PharmCAT reads. Nothing here is synthetic and nothing here is a patient.

Writes fixtures/getrm/truth.json (committed) and data/getrm/vcf/<sample>.vcf (gitignored, ~3 MB each).
Needs pysam and openpyxl.
"""
import argparse, json, os, re, sys, urllib.request
import openpyxl, pysam

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FIX = os.path.join(ROOT, "fixtures", "getrm")
OUT = os.path.join(ROOT, "data", "getrm")
XLSX = "https://www.cdc.gov/lab-quality/media/files/2025/08/Consolidated_PGx-HLA_table_1-22-25-V4.xlsx"
KGP = "http://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/1000G_2504_high_coverage/working"
PANEL = f"{KGP}/20220422_3202_phased_SNV_INDEL_SV/1kGP_high_coverage_Illumina.chr{{c}}.filtered.SNV_INDEL_SV_phased_panel.vcf.gz"

# Column index of each gene in the consolidated table, and the PharmCAT GRCh38 region for it.
COL = {"CYP2C9": 19, "CYP2C19": 21, "CYP2D6": 23, "DPYD": 33, "NUDT15": 48, "SLCO1B1": 54, "TPMT": 58, "UGT1A1": 60, "VKORC1": 68}
# CYP2D6 is in the truth table but not sliced: its calls need copy number, which this panel cannot give.
REGIONS = {"DPYD": ("1", 97078587, 97883768), "UGT1A1": ("2", 233759524, 233761373), "TPMT": ("6", 18130287, 18149527),
           "CYP2C19": ("10", 94761500, 94853314), "CYP2C9": ("10", 94938283, 94989423), "SLCO1B1": ("12", 21141175, 21239558),
           "NUDT15": ("13", 48037348, 48046171), "VKORC1": ("16", 31095968, 31096768)}


def cache(url, name):
    path = os.path.join(OUT, name)
    os.makedirs(OUT, exist_ok=True)
    if not os.path.exists(path):
        print(f"downloading {name}", flush=True)
        urllib.request.urlretrieve(url, path)
    return path


def truth_table():
    """GeT-RM consensus genotypes, keyed by Coriell ID, restricted to samples 1000 Genomes also sequenced."""
    rows = list(openpyxl.load_workbook(cache(XLSX, "getrm.xlsx"), read_only=True)["PGx HLA Genotypes"].iter_rows(values_only=True))
    ped = open(cache(f"{KGP}/1kGP.3202_samples.pedigree_info.txt", "1kgp.ped")).read().split()
    sequenced = {w for w in ped if w.startswith(("HG", "NA"))}
    out = {}
    for r in rows[2:]:
        sid = str(r[1]).strip() if r[1] else ""
        if sid in sequenced:
            out[sid] = {g: (str(r[i]).strip() if r[i] else None) for g, i in COL.items()}
    return out


def write_vcfs(samples):
    """One VCF per sample holding every panel site in the PharmCAT gene regions, genotypes as released."""
    os.makedirs(f"{OUT}/vcf", exist_ok=True)
    rows = {s: [] for s in samples}
    contigs = {}
    for gene, (c, start, end) in REGIONS.items():
        vf = pysam.VariantFile(PANEL.format(c=c))
        contigs[f"chr{c}"] = vf.header.contigs[f"chr{c}"].length
        n = 0
        for rec in vf.fetch(f"chr{c}", start, end):
            if any(a is None or a.startswith("<") for a in rec.alts or []):
                continue  # symbolic structural alleles: PharmCAT reads none of them
            for s in samples:
                gt = rec.samples[s]["GT"]
                if gt is None or any(g is None for g in gt):
                    continue
                sep = "|" if rec.samples[s].phased else "/"
                rows[s].append((rec.pos, f"chr{c}\t{rec.pos}\t{rec.id or '.'}\t{rec.ref}\t{','.join(rec.alts)}\t.\tPASS\t.\tGT\t{sep.join(str(g) for g in gt)}"))
            n += 1
        vf.close()
        print(f"{gene}: {n} sites", flush=True)
    header = ('##fileformat=VCFv4.2\n##FILTER=<ID=PASS,Description="All filters passed">\n'
              + "".join(f"##contig=<ID={k},length={v},assembly=GRCh38>\n" for k, v in sorted(contigs.items(), key=lambda kv: int(kv[0][3:])))
              + '##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">\n')
    for s in samples:
        rows[s].sort(key=lambda r: r[0])
        with open(f"{OUT}/vcf/{s}.vcf", "w") as f:
            f.write(header + f"#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\t{s}\n")
            f.write("\n".join(r[1] for r in rows[s]) + "\n")
        print(f"{s}: {len(rows[s])} sites", flush=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true", help="every overlapping sample, not just fixtures/getrm/selected.json")
    args = ap.parse_args()
    truth = truth_table()
    os.makedirs(FIX, exist_ok=True)
    json.dump(truth, open(f"{FIX}/truth.json", "w"), indent=0)
    print(f"{len(truth)} GeT-RM samples with 1000 Genomes sequence")
    samples = sorted(truth) if args.all else json.load(open(f"{FIX}/selected.json"))
    write_vcfs(samples)
