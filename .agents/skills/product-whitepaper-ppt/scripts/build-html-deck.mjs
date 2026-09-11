#!/usr/bin/env node
/**
 * Build a polished HTML whitepaper deck under:
 *   <repo>/docs/material/<slug>/deck/index.html
 *
 * Reads outline.json + slides.md + diagrams/*.mmd
 *
 * Usage:
 *   node build-html-deck.mjs --repo /path/to/repo --slug product-whitepaper [--theme paper|deep-blue]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SECTION_LABELS = {
  A: "开场",
  B: "定位与价值",
  C: "核心亮点",
  D: "技术架构",
  E: "业务场景",
  F: "落地与收束",
  cover: "开场",
  highlights: "核心亮点",
  architecture: "技术架构",
  scenarios: "业务场景",
  closing: "收束",
};

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

function die(msg) {
  console.error(`[build-html-deck] ${msg}`);
  process.exit(1);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseSlidesMd(md) {
  const parts = md.split(/^##\s+(P\d+)\s*·\s*(.+)$/m);
  /** @type {Record<string, { title: string, body: string }>} */
  const map = {};
  for (let i = 1; i < parts.length; i += 3) {
    const id = parts[i].toUpperCase();
    const title = (parts[i + 1] || "").trim();
    const body = (parts[i + 2] || "").trim();
    map[id] = { title, body };
  }
  return map;
}

function mdInline(text) {
  let t = escapeHtml(text);
  t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
  return t;
}

function isTableSep(line) {
  return /^\|?\s*:?-{3,}.*\|/.test(line);
}

function splitTableRow(line) {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

function looksLikeRiskHeaders(headers) {
  const h = headers.map((x) => x.replace(/\s/g, ""));
  const joined = h.join("|");
  return (
    (h.includes("症状") || h.includes("异常") || h.includes("问题")) &&
    (h.includes("系统行为") || h.includes("处理") || h.includes("行为")) &&
    (h.includes("用户下一步") || h.includes("下一步") || h.includes("建议"))
  );
}

function renderRiskCards(headers, rows) {
  const cards = rows
    .map((cols, i) => {
      const [symptom, behavior, next] = [
        cols[0] || "",
        cols[1] || "",
        cols[2] || "",
      ];
      return `<article class="risk-card">
  <div class="risk-idx">${String(i + 1).padStart(2, "0")}</div>
  <h3>${mdInline(symptom)}</h3>
  <dl>
    <div><dt>系统行为</dt><dd>${mdInline(behavior)}</dd></div>
    <div><dt>用户下一步</dt><dd>${mdInline(next)}</dd></div>
  </dl>
</article>`;
    })
    .join("\n");
  return `<div class="risk-grid">${cards}</div>`;
}

function renderTable(headers, rows) {
  const th = headers.map((h) => `<th>${mdInline(h)}</th>`).join("");
  const tr = rows
    .map(
      (cols) =>
        `<tr>${cols
          .map((c, i) => `<td${i === 0 ? ' class="col-key"' : ""}>${mdInline(c)}</td>`)
          .join("")}</tr>`
    )
    .join("\n");
  return `<div class="table-wrap"><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
}

function renderColumns(items) {
  const cards = items
    .map((it) => {
      const [title, ...rest] = it.split(/[：:]/);
      const body = rest.join("：").trim() || "";
      return `<article class="col-card"><h3>${mdInline(title.trim())}</h3>${
        body ? `<p>${mdInline(body)}</p>` : ""
      }</article>`;
    })
    .join("\n");
  return `<div class="col-grid cols-${Math.min(items.length, 4)}">${cards}</div>`;
}

function renderSteps(items) {
  const lis = items
    .map(
      (t, i) =>
        `<li><span class="step-num">${i + 1}</span><span class="step-text">${mdInline(
          t
        )}</span></li>`
    )
    .join("\n");
  return `<ol class="step-list">${lis}</ol>`;
}

/**
 * Convert slides.md body → presentation HTML (tables, cards, steps — never raw pipes).
 */
function bodyToHtml(body, materialDir, role) {
  const lines = body.split(/\r?\n/);
  const out = [];
  let listBuf = [];
  let listType = null;
  let diagramPath = null;
  const meta = {};

  const flushList = () => {
    if (!listType || !listBuf.length) {
      listType = null;
      listBuf = [];
      return;
    }
    if (listType === "ol" || meta.layout === "steps") {
      out.push(renderSteps(listBuf));
    } else if (meta.layout === "columns" || meta.layout === "cards") {
      out.push(renderColumns(listBuf));
    } else if (role === "result" || role === "breakdown" || role === "metrics") {
      // short bullet clusters → cards when 3–6 items
      if (listBuf.length >= 3 && listBuf.length <= 6 && listBuf.every((x) => x.length < 80)) {
        out.push(renderColumns(listBuf));
      } else {
        out.push(
          `<ul class="plain-list">${listBuf
            .map((t) => `<li>${mdInline(t)}</li>`)
            .join("")}</ul>`
        );
      }
    } else {
      out.push(
        `<ul class="plain-list">${listBuf
          .map((t) => `<li>${mdInline(t)}</li>`)
          .join("")}</ul>`
      );
    }
    listType = null;
    listBuf = [];
  };

  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (!trimmed) {
      flushList();
      i += 1;
      continue;
    }

    const diagramMatch = trimmed.match(/^-?\s*diagram:\s*(.+)$/i);
    if (diagramMatch) {
      diagramPath = diagramMatch[1].trim();
      i += 1;
      continue;
    }

    const metaMatch = trimmed.match(
      /^-?\s*(kicker|lead|subtitle|layout):\s*(.+)$/i
    );
    if (metaMatch) {
      meta[metaMatch[1].toLowerCase()] = metaMatch[2].trim();
      i += 1;
      continue;
    }

    // Markdown table
    if (trimmed.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1].trim())) {
      flushList();
      const headers = splitTableRow(trimmed);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().includes("|") && !isTableSep(lines[i].trim())) {
        rows.push(splitTableRow(lines[i].trim()));
        i += 1;
      }
      if (
        meta.layout === "cards" ||
        meta.layout === "risks" ||
        role === "risks" ||
        looksLikeRiskHeaders(headers)
      ) {
        out.push(renderRiskCards(headers, rows));
      } else {
        out.push(renderTable(headers, rows));
      }
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      if (listType && listType !== "ul") flushList();
      listType = "ul";
      listBuf.push(trimmed.replace(/^[-*]\s+/, ""));
      i += 1;
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      if (listType && listType !== "ol") flushList();
      listType = "ol";
      listBuf.push(trimmed.replace(/^\d+\.\s+/, ""));
      i += 1;
      continue;
    }

    flushList();
    // don't dump raw pipe lines as paragraphs
    if (/^\|.+\|$/.test(trimmed) || isTableSep(trimmed)) {
      i += 1;
      continue;
    }
    out.push(`<p>${mdInline(trimmed)}</p>`);
    i += 1;
  }
  flushList();

  if (diagramPath) {
    const abs = path.isAbsolute(diagramPath)
      ? diagramPath
      : path.join(materialDir, diagramPath);
    if (fs.existsSync(abs)) {
      const mmd = fs.readFileSync(abs, "utf8").trim();
      out.unshift(`<pre class="mermaid">${escapeHtml(mmd)}</pre>`);
    } else {
      out.unshift(
        `<p class="warn">缺少流程图文件：${escapeHtml(diagramPath)}</p>`
      );
    }
  }

  return { html: out.join("\n"), meta };
}

function padId(n) {
  return `P${String(n).padStart(2, "0")}`;
}

function sectionLabel(section) {
  if (!section) return "";
  const key = String(section).trim();
  if (SECTION_LABELS[key]) return SECTION_LABELS[key];
  if (/^[A-F]$/i.test(key)) return SECTION_LABELS[key.toUpperCase()] || key;
  return key;
}

function buildCss(theme) {
  const deep = theme === "deep-blue";
  return `
@import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Noto+Serif+SC:wght@600&display=swap");
:root {
  --bg: ${deep ? "#0b1220" : "#f4f1ea"};
  --bg-elev: ${deep ? "#121a2b" : "#fffcf7"};
  --ink: ${deep ? "#eef2ff" : "#161616"};
  --muted: ${deep ? "#9aa8c7" : "#5a5a5a"};
  --accent: ${deep ? "#5b9dff" : "#0b3d2e"};
  --accent-soft: ${deep ? "rgba(91,157,255,0.12)" : "rgba(11,61,46,0.08)"};
  --line: ${deep ? "#243049" : "#ddd6c8"};
  --danger: ${deep ? "#ff8f8f" : "#9b1c1c"};
  --slide-w: 1280px;
  --slide-h: 720px;
  --font-display: "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif;
  --font-body: "IBM Plex Sans", "Source Han Sans SC", "PingFang SC", sans-serif;
  --shadow: ${deep ? "0 12px 40px rgba(0,0,0,0.35)" : "0 10px 30px rgba(22,22,22,0.06)"};
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: #0a0a0a; color: var(--ink); font-family: var(--font-body); }
.stage { height: 100%; display: grid; place-items: center; overflow: hidden; }
.frame { width: var(--slide-w); height: var(--slide-h); transform-origin: center center; }
.deck { position: relative; width: var(--slide-w); height: var(--slide-h); }
.slide {
  position: absolute; inset: 0; display: none; padding: 48px 56px 56px;
  background:
    radial-gradient(1200px 500px at 100% -10%, ${deep ? "rgba(91,157,255,0.10)" : "rgba(11,61,46,0.06)"}, transparent 55%),
    var(--bg);
  overflow: hidden;
}
.slide.active { display: flex; flex-direction: column; gap: 18px; }
.slide[data-role="cover"] { justify-content: flex-end; padding-bottom: 72px; }
.slide[data-role="transition"] { justify-content: center; }
.section-tag {
  display: inline-flex; align-items: center; gap: 8px;
  width: fit-content; padding: 4px 10px; border-radius: 999px;
  background: var(--accent-soft); color: var(--accent);
  font-size: 12px; font-weight: 600; letter-spacing: 0.04em;
}
.section-tag::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--accent); }
.kicker { color: var(--accent); letter-spacing: 0.12em; font-size: 13px; font-weight: 600; text-transform: uppercase; }
h1 { font-family: var(--font-display); font-weight: 600; font-size: 56px; line-height: 1.12; margin: 0; max-width: 16ch; }
h2 { font-family: var(--font-display); font-weight: 600; font-size: 34px; line-height: 1.2; margin: 0; }
.lead, .subtitle { color: var(--muted); font-size: 18px; max-width: 48ch; line-height: 1.5; }
.body { flex: 1; min-height: 0; overflow: hidden; font-size: 17px; line-height: 1.55; color: var(--ink); }
.body > p { margin: 0 0 12px; color: var(--muted); max-width: 70ch; }
.body .warn { color: var(--danger); }

/* Lists */
.plain-list { margin: 0; padding-left: 1.15em; }
.plain-list li { margin-bottom: 8px; }
.step-list { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 10px; }
.step-list li {
  display: grid; grid-template-columns: 36px 1fr; gap: 14px; align-items: start;
  padding: 12px 14px; background: var(--bg-elev); border: 1px solid var(--line); border-radius: 12px;
}
.step-num {
  width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
  background: var(--accent); color: ${deep ? "#0b1220" : "#fff"}; font-size: 13px; font-weight: 700;
}
.step-text { padding-top: 3px; }

/* Cards / columns */
.col-grid { display: grid; gap: 14px; margin-top: 4px; }
.col-grid.cols-3 { grid-template-columns: repeat(3, 1fr); }
.col-grid.cols-4 { grid-template-columns: repeat(4, 1fr); }
.col-grid.cols-2 { grid-template-columns: repeat(2, 1fr); }
.col-grid.cols-1 { grid-template-columns: 1fr; }
.col-card {
  background: var(--bg-elev); border: 1px solid var(--line); border-radius: 14px;
  padding: 16px 18px; box-shadow: var(--shadow); min-height: 110px;
}
.col-card h3 { margin: 0 0 8px; font-size: 16px; font-weight: 600; }
.col-card p { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.45; }

/* Risk / exception cards */
.risk-grid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;
  max-height: 520px;
}
.risk-card {
  background: var(--bg-elev); border: 1px solid var(--line); border-radius: 14px;
  padding: 14px 16px 14px 14px; display: grid; grid-template-columns: 36px 1fr; gap: 10px 12px;
  box-shadow: var(--shadow);
}
.risk-idx {
  grid-row: 1 / span 2; width: 32px; height: 32px; border-radius: 10px;
  display: grid; place-items: center; font-size: 12px; font-weight: 700;
  background: var(--accent-soft); color: var(--accent);
}
.risk-card h3 { margin: 0; font-size: 15px; line-height: 1.35; grid-column: 2; }
.risk-card dl { margin: 0; grid-column: 2; display: grid; gap: 6px; }
.risk-card dl > div { display: grid; grid-template-columns: 72px 1fr; gap: 8px; font-size: 13px; }
.risk-card dt { color: var(--muted); font-weight: 600; }
.risk-card dd { margin: 0; color: var(--ink); }

/* Tables */
.table-wrap {
  border: 1px solid var(--line); border-radius: 14px; overflow: hidden;
  background: var(--bg-elev); box-shadow: var(--shadow); max-height: 500px;
}
table { width: 100%; border-collapse: collapse; font-size: 14px; }
thead th {
  text-align: left; padding: 12px 14px; background: var(--accent-soft);
  color: var(--accent); font-weight: 600; border-bottom: 1px solid var(--line);
}
tbody td { padding: 11px 14px; border-bottom: 1px solid var(--line); vertical-align: top; }
tbody tr:last-child td { border-bottom: 0; }
td.col-key { font-weight: 600; white-space: nowrap; width: 22%; }
tbody tr:nth-child(even) td { background: ${deep ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)"}; }

/* Mermaid */
.body .mermaid {
  background: var(--bg-elev); border: 1px solid var(--line); border-radius: 14px;
  padding: 18px; max-height: 460px; overflow: auto; box-shadow: var(--shadow);
}

code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.92em; padding: 1px 6px; border-radius: 4px;
  background: var(--accent-soft);
}

.chrome {
  position: fixed; left: 0; right: 0; bottom: 0; height: 48px;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 20px; background: rgba(0,0,0,0.78); color: #eee; font-size: 13px; z-index: 10;
}
.chrome button {
  background: transparent; border: 1px solid #666; color: #eee;
  padding: 6px 12px; border-radius: 6px; cursor: pointer;
}
.chrome button:hover { border-color: #aaa; }

@media print {
  html, body { background: #fff !important; height: auto !important; }
  .chrome { display: none !important; }
  .stage { display: block !important; height: auto !important; }
  .frame { transform: none !important; width: 1280px !important; height: auto !important; }
  .deck { height: auto !important; }
  .slide {
    position: relative !important; inset: auto !important; display: flex !important;
    width: 1280px !important; height: 720px !important;
    page-break-after: always; break-after: page; overflow: hidden !important;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .slide:last-child { page-break-after: auto; break-after: auto; }
}
@page { size: 1280px 720px; margin: 0; }
`.trim();
}

function buildJs() {
  return `
const slides = [...document.querySelectorAll(".slide")];
let i = 0;
const counter = document.querySelector("[data-counter]");
function show(n) {
  i = (n + slides.length) % slides.length;
  slides.forEach((s, idx) => s.classList.toggle("active", idx === i));
  counter.textContent = (i + 1) + " / " + slides.length;
  history.replaceState(null, "", "#p" + (i + 1));
}
document.querySelector("[data-prev]").onclick = () => show(i - 1);
document.querySelector("[data-next]").onclick = () => show(i + 1);
window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); show(i + 1); }
  if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); show(i - 1); }
  if (e.key === "Home") show(0);
  if (e.key === "End") show(slides.length - 1);
});
function fit() {
  const frame = document.querySelector(".frame");
  const sx = window.innerWidth / 1280;
  const sy = (window.innerHeight - 48) / 720;
  const s = Math.min(sx, sy) * 0.98;
  frame.style.transform = "scale(" + s + ")";
}
window.addEventListener("resize", fit);
fit();
const hash = location.hash.match(/#p(\\d+)/i);
show(hash ? Math.max(0, parseInt(hash[1], 10) - 1) : 0);
`.trim();
}

function ensureReadme(materialDir, slug, title, pageCount) {
  const readme = path.join(materialDir, "README.md");
  if (fs.existsSync(readme)) return;
  const text = `# ${title}

产品白皮书宣传 Deck（${pageCount} 页）。

## 预览（HTML）

\`\`\`bash
open docs/material/${slug}/deck/index.html
\`\`\`

## 导出 PDF

\`\`\`bash
node <skill-root>/scripts/export-pdf.mjs --repo <repo> --slug ${slug}
\`\`\`

产物：\`docs/material/${slug}/export/${slug}.pdf\`
`;
  fs.writeFileSync(readme, text, "utf8");
}

function main() {
  const repo = path.resolve(arg("repo", ""));
  const slug = arg("slug", "product-whitepaper");
  const theme = arg("theme", "paper");
  if (!repo || !fs.existsSync(repo)) die("需要有效 --repo 路径");

  const materialDir = path.join(repo, "docs", "material", slug);
  const outlinePath = path.join(materialDir, "outline.json");
  const slidesPath = path.join(materialDir, "slides.md");
  if (!fs.existsSync(outlinePath)) die(`缺少 ${outlinePath}`);
  if (!fs.existsSync(slidesPath)) die(`缺少 ${slidesPath}`);

  const outline = JSON.parse(fs.readFileSync(outlinePath, "utf8"));
  const slidesMap = parseSlidesMd(fs.readFileSync(slidesPath, "utf8"));
  const slideList = outline.slides || [];
  if (slideList.length < 30) {
    die(`页数 ${slideList.length} < 30，请先补全 outline.json`);
  }

  const title = outline.title || slug;
  const sections = slideList.map((s, idx) => {
    const n = s.id || idx + 1;
    const key = padId(n);
    const fromMd = slidesMap[key] || slidesMap[`P${n}`] || {};
    const pageTitle = fromMd.title || s.title || `第 ${n} 页`;
    const role = s.role || "statement";
    const { html, meta } = bodyToHtml(fromMd.body || "", materialDir, role);
    const kicker = meta.kicker || "";
    const lead = meta.lead || meta.subtitle || "";
    const isCover = role === "cover" || n === 1;
    const isTransition = role === "transition";
    const sec = sectionLabel(s.section);
    return `
<section class="slide" id="p${n}" data-role="${escapeHtml(role)}">
  ${sec ? `<div class="section-tag">${escapeHtml(sec)}</div>` : ""}
  ${kicker ? `<div class="kicker">${escapeHtml(kicker)}</div>` : ""}
  ${
    isCover || isTransition
      ? `<h1>${escapeHtml(pageTitle)}</h1>`
      : `<h2>${escapeHtml(pageTitle)}</h2>`
  }
  ${lead ? `<div class="lead">${escapeHtml(lead)}</div>` : ""}
  <div class="body">${html}</div>
</section>`;
  });

  const htmlDoc = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>${buildCss(theme)}</style>
</head>
<body data-theme="${escapeHtml(theme)}">
  <div class="stage">
    <div class="frame">
      <main class="deck">
        ${sections.join("\n")}
      </main>
    </div>
  </div>
  <div class="chrome">
    <button type="button" data-prev>上一页</button>
    <span data-counter>1 / ${slideList.length}</span>
    <button type="button" data-next>下一页</button>
  </div>
  <script type="module">
    import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
    mermaid.initialize({
      startOnLoad: true,
      theme: "${theme === "deep-blue" ? "dark" : "neutral"}",
      flowchart: { curve: "basis", padding: 12 },
      themeVariables: { fontSize: "14px" }
    });
  </script>
  <script>${buildJs()}</script>
</body>
</html>
`;

  const deckDir = path.join(materialDir, "deck");
  fs.mkdirSync(deckDir, { recursive: true });
  const outFile = path.join(deckDir, "index.html");
  fs.writeFileSync(outFile, htmlDoc, "utf8");
  ensureReadme(materialDir, slug, title, slideList.length);

  console.log(
    JSON.stringify(
      { ok: true, pages: slideList.length, out: outFile, theme },
      null,
      2
    )
  );
}

main();
