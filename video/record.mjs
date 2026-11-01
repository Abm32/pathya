// Shoot the picture. One clip per scene, each cut to the exact length of its narration.
//   node video/record.mjs            # every scene
//   node video/record.mjs 09 11      # only these (by scene number prefix)
// Headless, so it never touches the desktop, and deterministic, so a re-shoot is identical.
import { chromium } from "playwright";
import { mkdirSync, readFileSync, renameSync, rmSync, existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "video/out/clips");
const SITE = process.env.SITE ?? "https://pathya.anukritiai.com";
const CARDS = pathToFileURL(path.join(ROOT, "video/cards.html")).href;
const PHOTO = pathToFileURL(path.join(ROOT, "video/photo.html")).href;
const timing = JSON.parse(readFileSync(path.join(ROOT, "video/out/timing.json"), "utf8"));
const only = process.argv.slice(2);

mkdirSync(OUT, { recursive: true });
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));

/** Scroll the page over `secs` with an ease, the way a hand moves, not a jump. */
const glide = (page, to, secs) =>
  page.evaluate(
    ([to, ms]) =>
      new Promise((done) => {
        const from = scrollY, d = to - from, t0 = performance.now();
        const ease = (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2);
        (function step(t) {
          const p = Math.min(1, (t - t0) / ms);
          scrollTo(0, from + d * ease(p));
          p < 1 ? requestAnimationFrame(step) : done();
        })(t0);
      }),
    [to, secs * 1000],
  );

const card = async (page, id) => {
  await page.goto(`${CARDS}?id=${id}`);
  await page.evaluate(() => document.fonts.ready);
};

const site = async (page, url) => {
  await page.goto(SITE + url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "*{scrollbar-width:none!important}*::-webkit-scrollbar{display:none!important}" });
};

// Each scene fills exactly its narration length. Card first, then the thing itself.
const SHOTS = {
  "01-hook": async (p, d) => { await card(p, "01-hook"); await sleep(d * 0.36); await p.goto(PHOTO); await sleep(d * 0.64); },
  "02-gap": async (p, d) => { await card(p, "02-gap"); await sleep(d * 0.45); await site(p, "/"); await sleep(0.8); await glide(p, 900, d * 0.55 - 1.2); },
  "03-read": async (p, d) => { await card(p, "03-read"); await sleep(d * 0.3); await site(p, "/sample"); await sleep(1); await glide(p, 520, d * 0.7 - 1.4); },
  "04-standardise": async (p, d) => { await card(p, "04-standardise"); await sleep(d * 0.26); await site(p, "/report/ec1531ccb77c"); await sleep(1); await glide(p, 1500, d * 0.74 - 1.4); },
  "05-open": async (p, d) => { await card(p, "05-open"); await sleep(d * 0.3); await site(p, "/report/73ee62927c10"); await sleep(1); await glide(p, 760, d * 0.7 - 1.4); },
  "06-voice": async (p, d) => { await card(p, "06-voice"); await sleep(d * 0.42); await site(p, "/"); await sleep(0.6); await glide(p, 1750, d * 0.58 - 1); },
  "07-curate": async (p, d) => { await card(p, "07-curate"); await sleep(d * 0.4); await site(p, "/report/ec1531ccb77c"); await sleep(0.7); await glide(p, 2600, d * 0.6 - 1.1); },
  "08-cohort": async (p, d) => { await card(p, "08-cohort"); await sleep(d * 0.3); await site(p, "/cohort"); await sleep(1); await glide(p, 900, d * 0.7 - 1.4); },
  "09-getrm": async (p, d) => { await card(p, "09-getrm"); await sleep(d * 0.44); await card(p, "09b-table"); await sleep(d * 0.56); },
  "10-gap-found": async (p, d) => { await card(p, "10-gap-found"); await sleep(d); },
  "11-harder": async (p, d) => { await card(p, "11-harder"); await sleep(d * 0.52); await site(p, "/cohort?c=india-sim"); await sleep(1); await glide(p, 1100, d * 0.48 - 1.4); },
  "12-close": async (p, d) => { await card(p, "12-close"); await sleep(d); },
};

const browser = await chromium.launch();
for (const s of timing.scenes) {
  if (only.length && !only.some((o) => s.id.startsWith(o))) continue;
  const final = path.join(OUT, `${s.id}.webm`);
  if (existsSync(final) && !process.argv.includes("--force")) { console.log(`${s.id} cached`); continue; }
  const tmp = path.join(OUT, `.tmp-${s.id}`);
  rmSync(tmp, { recursive: true, force: true });
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    colorScheme: "dark",
    recordVideo: { dir: tmp, size: { width: 1920, height: 1080 } },
  });
  const page = await ctx.newPage();
  const t0 = Date.now();
  await SHOTS[s.id](page, s.total);
  const held = (Date.now() - t0) / 1000;
  if (held < s.total) await sleep(s.total - held);   // never cut a clip short of its line
  await ctx.close();
  const produced = (await import("node:fs")).readdirSync(tmp).find((f) => f.endsWith(".webm"));
  renameSync(path.join(tmp, produced), final);
  rmSync(tmp, { recursive: true, force: true });
  console.log(`${s.id}  ${s.total}s  shot`);
}
await browser.close();
console.log(`\nclips in ${OUT}`);
