"use client";
import { useEffect, useRef, useState } from "react";

/** One document listener drives the cursor spotlight on every `.spot` surface. */
export function Spotlight() {
  useEffect(() => {
    const on = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.(".spot") as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    document.addEventListener("pointermove", on, { passive: true });
    return () => document.removeEventListener("pointermove", on);
  }, []);
  return null;
}

/** Counts up to `to` once when scrolled into view. Renders the final value for print and no-JS. */
export function CountUp({ to, decimals = 0, prefix = "", suffix = "", ms = 1100 }: { to: number; decimals?: number; prefix?: string; suffix?: string; ms?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [v, setV] = useState(to);
  useEffect(() => {
    const el = ref.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setV(0);
    const io = new IntersectionObserver(([en]) => {
      if (!en.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / ms);
        setV(to * (1 - Math.pow(1 - p, 4)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [to, ms]);
  return <span ref={ref}>{prefix}{v.toFixed(decimals)}{suffix}</span>;
}

/** Sticky in-page nav with scroll-spy. */
export function SectionNav({ items }: { items: { id: string; label: string }[] }) {
  const [cur, setCur] = useState(items[0]?.id);
  useEffect(() => {
    const io = new IntersectionObserver((ens) => {
      const vis = ens.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (vis) setCur(vis.target.id);
    }, { rootMargin: "-20% 0px -70% 0px" });
    items.forEach((i) => { const el = document.getElementById(i.id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [items]);
  return (
    <nav aria-label="Report sections" className="snav sticky top-[57px] z-20 -mx-4 overflow-x-auto border-b border-line bg-[rgba(6,8,10,0.75)] px-4 py-2 backdrop-blur-xl print:hidden">
      <div className="flex gap-1">
        {items.map((i) => <a key={i.id} href={`#${i.id}`} aria-current={cur === i.id}>{i.label}</a>)}
      </div>
    </nav>
  );
}

/** Two-language patient text: tabs on screen, both on paper. */
export function LangTabs({ en, ml }: { en: string; ml: string }) {
  const [t, setT] = useState<"ml" | "en">("ml");
  return (
    <div>
      <div role="tablist" aria-label="Patient explanation language" className="tabs print:hidden">
        <button role="tab" aria-selected={t === "ml"} onClick={() => setT("ml")} className="tab ml">മലയാളം</button>
        <button role="tab" aria-selected={t === "en"} onClick={() => setT("en")} className="tab">English</button>
      </div>
      <div role="tabpanel" className={`ml mt-4 whitespace-pre-line text-[17px] leading-9 ${t === "ml" ? "reveal" : "hidden"} print:block`}>{ml}</div>
      <div role="tabpanel" className={`mt-4 whitespace-pre-line text-[17px] leading-relaxed ${t === "en" ? "reveal" : "hidden"} print:mt-6 print:block`}>{en}</div>
    </div>
  );
}
