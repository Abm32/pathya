import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Pathya: India's gene data, out of WhatsApp photos. Pharmacogenomic reports in, verified research records out.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const steps = ["Report / photo / voice", "Muse Spark", "PharmCAT", "Quality checks", "Cohort"];

export default async function Image() {
  const semibold = await readFile(join(process.cwd(), "assets/Geist-SemiBold.ttf"));
  const icon = `data:image/svg+xml;base64,${(await readFile(join(process.cwd(), "src/app/icon.svg"))).toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "64px 72px", color: "#e8eef0", background: "radial-gradient(circle at 85% 10%, rgba(154,166,255,0.28), transparent 45%), radial-gradient(circle at 10% 100%, rgba(46,230,200,0.22), transparent 50%), #06080a" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <img src={icon} width={88} height={88} alt="" />
          <div style={{ fontSize: 52, fontWeight: 600, letterSpacing: -1.5 }}>Pathya</div>
          <div style={{ marginLeft: "auto", fontSize: 20, color: "#2ee6c8", border: "1px solid rgba(46,230,200,0.4)", borderRadius: 999, padding: "8px 18px" }}>Pharmacogenomic research data</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 52 }}>
          <div style={{ fontSize: 76, fontWeight: 600, letterSpacing: -2.5, lineHeight: 1.05 }}>India&apos;s gene data,</div>
          <div style={{ fontSize: 76, fontWeight: 600, letterSpacing: -2.5, lineHeight: 1.05, color: "#2ee6c8" }}>out of WhatsApp photos.</div>
          <div style={{ fontSize: 30, color: "#9aa8ad", marginTop: 24, fontWeight: 400 }}>Reports in. Verified, de-identified research records out.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: "auto" }}>
          {steps.map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 20, padding: "10px 16px", borderRadius: 12, background: "rgba(255,255,255,0.05)", border: `1px solid ${i === 1 || i === 4 ? "rgba(154,166,255,0.5)" : "rgba(46,230,200,0.45)"}`, color: i === 1 || i === 4 ? "#c3caff" : "#9ff3e4" }}>{s}</div>
              {i < steps.length - 1 && <div style={{ fontSize: 22, color: "#55636a" }}>→</div>}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", fontSize: 18, color: "#6b7a80", marginTop: 22 }}>Meta Global AI Developer Hackathon 2026 · Anukriti AI, Kochi</div>
      </div>
    ),
    { ...size, fonts: [{ name: "Geist", data: semibold, weight: 600, style: "normal" }] },
  );
}
