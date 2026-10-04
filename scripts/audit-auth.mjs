// Measure the rendered auth layout instead of eyeballing screenshots.
// Reports computed font sizes, control heights, and any horizontal overflow,
// which is what actually breaks usability on phones.
// Run with: node scripts/audit-auth.mjs
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const PAGES = [
  ["login", "/login"],
  ["register", "/register"],
];
const VIEWPORTS = [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844 }],
];

const browser = await chromium.launch();

let failures = 0;

for (const [vp, viewport] of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();

  for (const [name, path] of PAGES) {
    await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(800);

    // The Next.js dev overlay is not part of the shipped UI, and it intercepts
    // pointer events over the bottom-left corner, which would otherwise make
    // the carousel dots read as unclickable. Hide it for the whole audit.
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    await page.waitForTimeout(200);

    const report = await page.evaluate(() => {
      const cs = (el) => getComputedStyle(el);
      const pick = (sel) => Array.from(document.querySelectorAll(sel));

      // scroll-behavior:smooth makes scrollIntoView asynchronous, so hit tests
      // would run against stale positions. Force instant scrolling for this pass.
      const root = document.documentElement;
      const prevScroll = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";

      const texts = [];
      for (const el of pick("h1, p, label span, label, button, a, small, .auth-v7-legal, .auth-v7-helper")) {
        const t = (el.textContent || "").trim();
        if (!t || el.offsetParent === null) continue;
        texts.push({
          sel: el.className || el.tagName.toLowerCase(),
          size: parseFloat(cs(el).fontSize),
          text: t.slice(0, 34),
        });
      }

      // A bounding rect understates controls whose hit area is expanded by a
      // ::before pseudo element (the carousel dots render 8x8 but are tappable
      // over a much larger area). Hit-test with elementFromPoint so the report
      // reflects what a finger actually lands on.
      const owns = (t, el) => !!t && (t === el || el.contains(t));
      const reach = (el, cx, cy, dx, dy) => {
        let d = 0;
        while (d < 60) {
          d += 1;
          const x = cx + dx * d;
          const y = cy + dy * d;
          if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return d - 1;
          if (!owns(document.elementFromPoint(x, y), el)) return d - 1;
        }
        return 59;
      };

      const controls = [];
      for (const el of pick("button, input, a.auth-v7-secondary-link")) {
        if (el.offsetParent === null) continue;
        el.scrollIntoView({ block: "center", inline: "center" });
        const r = el.getBoundingClientRect();
        const name = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || "")
          .trim().slice(0, 26);
        const sel = (el.className || el.tagName.toLowerCase()).toString().slice(0, 34);
        const w = Math.round(r.width);
        const h = Math.round(r.height);
        if (w < 1 || h < 1) {
          controls.push({ name, sel, w, h, hitW: 0, hitH: 0, why: "tidak terlihat" });
          continue;
        }
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight) {
          controls.push({ name, sel, w, h, hitW: 0, hitH: 0, why: "di luar viewport" });
          continue;
        }
        const top = document.elementFromPoint(cx, cy);
        if (!owns(top, el)) {
          controls.push({ name, sel, w, h, hitW: 0, hitH: 0, why: `tertutup oleh ${top?.tagName?.toLowerCase()}` });
          continue;
        }
        controls.push({
          name,
          sel,
          w,
          h,
          hitW: Math.round(r.width + reach(el, cx, cy, 1, 0) + reach(el, cx, cy, -1, 0)),
          hitH: Math.round(r.height + reach(el, cx, cy, 0, 1) + reach(el, cx, cy, 0, -1)),
          why: "",
        });
      }

      root.style.scrollBehavior = prevScroll;
      window.scrollTo(0, 0);

      return {
        scrollW: root.scrollWidth,
        clientW: root.clientWidth,
        texts,
        controls,
      };
    });

    const overflow = report.scrollW > report.clientW + 1;
    const tiny = report.texts.filter((t) => t.size < 12);
    // WCAG 2.2 SC 2.5.8 requires a minimum 24x24 CSS px hit area.
    const MIN = 24;
    const small = report.controls.filter((c) => c.hitW < MIN || c.hitH < MIN);

    console.log(`\n${"=".repeat(58)}\n${name} @ ${vp} (${viewport.width}px)\n${"=".repeat(58)}`);
    console.log(`overflow horizontal : ${overflow ? `YA (${report.scrollW} > ${report.clientW})` : "tidak ada"}`);
    console.log(`teks < 12px        : ${tiny.length}`);
    for (const t of tiny.slice(0, 8)) console.log(`   ${t.size}px  "${t.text}"`);
    console.log(`kontrol < ${MIN}px    : ${small.length}`);
    for (const c of small.slice(0, 8)) {
      console.log(`   ${c.hitW}x${c.hitH}  "${c.name}"${c.why ? `  ${c.why}` : ""}`);
    }

    const sizes = [...new Set(report.texts.map((t) => t.size))].sort((a, b) => a - b);
    console.log(` ukuran teks ada   : ${sizes.join(", ")}`);
    if (overflow || tiny.length || small.length) failures += 1;
  }
  await ctx.close();
}

await browser.close();
process.exit(failures ? 1 : 0);
