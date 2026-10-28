import { useId } from "react";

/** Pathya mark: a two-strand helix (the genotype) that resolves into one path, the P, ending at a node (the decision). */
export function Mark({ size = 28, tile = true, weight = 2.8, className = "", style }: { size?: number | string; tile?: boolean; weight?: number; className?: string; style?: React.CSSProperties }) {
  const g = `pg${useId().replace(/:/g, "")}`;
  const bg = tile ? "#0b1115" : "var(--background)";
  return (
    <svg aria-hidden viewBox="0 0 32 32" width={size} height={size} fill="none" className={`logo ${className}`} style={style}>
      <defs>
        <linearGradient id={g} x1="8" y1="28" x2="26" y2="6" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2ee6c8" /><stop offset="1" stopColor="#9aa6ff" />
        </linearGradient>
      </defs>
      {tile && <rect x=".5" y=".5" width="31" height="31" rx="7.5" fill={bg} stroke="#2ee6c8" strokeOpacity=".28" />}
      <g transform={tile ? "translate(16 16) scale(.8) translate(-16.75 -16.25)" : undefined} strokeLinecap="round" strokeWidth={weight}>
        <path d="M14.5 28C14.5 24.5 8.5 24.5 8.5 21S14.5 17.5 14.5 14" stroke="#9aa6ff" />
        <path d="M8.5 28C8.5 24.5 14.5 24.5 14.5 21" stroke={bg} strokeWidth={weight + 2.6} />
        <path className="logo-path" pathLength={1} d="M8.5 28C8.5 24.5 14.5 24.5 14.5 21S8.5 17.5 8.5 14V12.5C8.5 7.5 11.5 4.5 16.5 4.5S25 7.8 25 12 21.5 19.5 17.5 19.5" stroke={`url(#${g})`} />
        <circle className="logo-node" cx="17.5" cy="19.5" r={weight} fill="#2ee6c8" />
      </g>
    </svg>
  );
}

/**
 * Wordmark: the mark stands in for the P of "Pathya".
 * Glyph box in the 32-unit viewBox is x 7.1-26.4, y 3.1-29.4, so at 0.95em the bowl meets ascender height
 * and the stem ends on the baseline; the negative margins trim the viewBox padding.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline font-semibold tracking-tight ${className}`}>
      <span className="sr-only">Pathya</span>
      <Mark tile={false} size="0.95em" weight={3.4} style={{ verticalAlign: "-0.08em", marginLeft: "-0.2em", marginRight: "-0.12em", alignSelf: "baseline" }} />
      <span aria-hidden>athya</span>
    </span>
  );
}
