/** Renders citation prose with PMID / PMCID tokens set in mono and linked to PubMed / PMC. */
const TOKEN = /(PMID:?\s?\d{6,9}|PMC\d{6,8})/g;
export function Cite({ text }: { text: string }) {
  return (
    <>
      {text.split(TOKEN).map((part, i) => {
        const pmid = part.match(/^PMID:?\s?(\d+)$/);
        const pmc = part.match(/^PMC(\d+)$/);
        if (!pmid && !pmc) return part;
        const href = pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid[1]}/` : `https://pmc.ncbi.nlm.nih.gov/articles/PMC${pmc![1]}/`;
        const label = pmid ? `PMID ${pmid[1]}` : `PMC${pmc![1]}`;
        return (
          <a key={i} href={href} target="_blank" rel="noreferrer" className="num text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">
            {label}
          </a>
        );
      })}
    </>
  );
}
