/**
 * 生成 template-assets 单页图库 catalog.html（桌面双击即可浏览全部素材）
 * Run: npm run generate:template-catalog
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../public/template-assets");
const GALLERY_ROOT = path.join(ROOT, "gallery");
const OUT = path.join(ROOT, "catalog.html");
const CATALOG_JSON = path.resolve(__dirname, "../src/lib/templateAssetsCatalog.generated.json");

/** 图库 UI 展示用缩略图分类（统一写入 gallery/{category}/） */
const GALLERY_CATEGORIES = new Set([
  "borderless-decor",
  "screen-header",
  "title-strip",
  "component-panel",
  "canvas-dark",
  "canvas-light",
  "screen-bg",
]);

const PALETTE_HEX = {
  cyan: "#22d3ee",
  indigo: "#6366f1",
  emerald: "#34d399",
  amber: "#fbbf24",
  crimson: "#f87171",
  royal: "#60a5fa",
  slate: "#94a3b8",
  teal: "#2dd4bf",
  violet: "#a78bfa",
  gold: "#fbbf24",
  bronze: "#d6a06a",
  cobalt: "#3b82f6",
  magenta: "#f472b6",
  lime: "#a3e635",
  ivory: "#e7e5e4",
  cloud: "#3b82f6",
  paper: "#6366f1",
  frost: "#0ea5e9",
  mint: "#10b981",
  lavender: "#8b5cf6",
  rose: "#fb7185",
  sand: "#d97706",
  sky: "#38bdf8",
  peach: "#fb923c",
  sage: "#65a30d",
  coral: "#fb7185",
  blue: "#1890ff",
  green: "#52c41a",
  orange: "#fa8c16",
  navy: "#1d39c4",
};

function toRel(publicPath) {
  return publicPath.replace(/^\/template-assets\//, "").replace(/^\//, "");
}

function toPublicUrl(relOrAbs) {
  if (!relOrAbs) return "";
  if (relOrAbs.startsWith("/template-assets/")) return relOrAbs;
  if (relOrAbs.startsWith("/")) return relOrAbs;
  return `/template-assets/${toRel(relOrAbs)}`;
}

function syncLegacyScreenBackgrounds() {
  const srcDir = path.join(ROOT, "backgrounds");
  const destDir = path.join(ROOT, "packs/gov-enterprise-v1/backgrounds/legacy");
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const file of fs.readdirSync(srcDir)) {
    if (!file.endsWith(".svg")) continue;
    fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
  }
}

function buildThumbSvg(svgContent, tw = 320, th = 180) {
  const viewMatch = svgContent.match(/viewBox="0 0 (\d+) (\d+)"/);
  const vw = viewMatch ? Number(viewMatch[1]) : 1920;
  const vh = viewMatch ? Number(viewMatch[2]) : 1080;
  const inner = svgContent.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tw}" height="${th}" viewBox="0 0 ${tw} ${th}" preserveAspectRatio="xMidYMid slice">
  <g transform="scale(${tw / vw} ${th / vh})">
  ${inner}
  </g>
</svg>`;
}

function ensureScreenBgThumb(item) {
  if (item.category !== "screen-bg" || !item.src) return null;
  const srcPath = path.join(ROOT, item.src);
  if (!fs.existsSync(srcPath)) return null;
  const thumbRel = `packs/gov-enterprise-v1/thumbs/${item.id}.svg`;
  const thumbPath = path.join(ROOT, thumbRel);
  const svg = fs.readFileSync(srcPath, "utf8");
  fs.mkdirSync(path.dirname(thumbPath), { recursive: true });
  fs.writeFileSync(thumbPath, buildThumbSvg(svg), "utf8");
  return toPublicUrl(thumbRel);
}

function resolveItemSrcPath(item) {
  const rel = item.src || toRel(item.url || item.bg || item.path || "");
  if (!rel) return null;
  const srcPath = path.join(ROOT, rel);
  return fs.existsSync(srcPath) ? srcPath : null;
}

function resolvePackThumbPath(item) {
  if (!item.id) return null;
  const thumbRel = `packs/gov-enterprise-v1/thumbs/${item.id}.svg`;
  const thumbPath = path.join(ROOT, thumbRel);
  return fs.existsSync(thumbPath) ? thumbPath : null;
}

/** 写入 gallery/{category}/{id}.svg，供图库格子统一预览 */
function ensureGalleryThumb(item) {
  if (!GALLERY_CATEGORIES.has(item.category) || !item.id) return null;
  const destRel = `gallery/${item.category}/${item.id}.svg`;
  const destPath = path.join(ROOT, destRel);
  const packThumb = resolvePackThumbPath(item);
  const srcPath = packThumb || resolveItemSrcPath(item);
  if (!srcPath) return null;

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const svg = fs.readFileSync(srcPath, "utf8");
  const isPrebuiltThumb =
    packThumb != null ||
    item.category === "canvas-dark" ||
    item.category === "canvas-light" ||
    item.category === "screen-bg";
  fs.writeFileSync(destPath, isPrebuiltThumb ? svg : buildThumbSvg(svg), "utf8");
  return toPublicUrl(destRel);
}

function finalizeCatalogItem(item) {
  const url =
    item.url ||
    (item.bg ? toPublicUrl(item.bg) : "") ||
    (item.path ? toPublicUrl(item.path) : "") ||
    toPublicUrl(item.src);
  let thumbUrl = item.thumbUrl || toPublicUrl(item.src) || url;
  if (item.category === "top-decor-clear" && item.pack === "gov-enterprise-v1") {
    const thumbRel = `packs/gov-enterprise-v1/thumbs/${item.id}.svg`;
    if (fs.existsSync(path.join(ROOT, thumbRel))) {
      thumbUrl = toPublicUrl(thumbRel);
    }
  }
  if (item.category === "screen-bg") {
    const generated = ensureScreenBgThumb(item);
    if (generated) thumbUrl = generated;
  }
  if (item.category === "canvas-dark" || item.category === "canvas-light") {
    const thumbRel = `packs/gov-enterprise-v1/thumbs/${item.id}.svg`;
    if (fs.existsSync(path.join(ROOT, thumbRel))) {
      thumbUrl = toPublicUrl(thumbRel);
    }
  }
  // gallery/ 仅作分类归档；运行时 thumbUrl 走 packs/thumbs 或全图 url
  ensureGalleryThumb(item);
  return { ...item, url, thumbUrl, label: item.label || item.id };
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

function scanSvgs(dir, pack, category) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return [];
  const out = [];
  for (const file of fs.readdirSync(full)) {
    if (!file.endsWith(".svg")) continue;
    const id = file.replace(/\.svg$/, "");
    out.push({
      id,
      pack,
      category,
      src: `${dir}/${file}`.replace(/\\/g, "/"),
      palette: id.split("-")[2] || "misc",
      pattern: id.split("-").slice(3).join("-") || category,
    });
  }
  return out;
}

function collectItems() {
  const items = [];
  syncLegacyScreenBackgrounds();

  const gov = readJson("packs/gov-enterprise-v1/manifest.json");
  for (const row of gov.items) {
    items.push({
      id: row.id,
      pack: "gov-enterprise-v1",
      category: row.category,
      palette: row.palette,
      pattern: row.pattern || row.style || "",
      motif: row.motif || "",
      src: toRel(row.path),
      url: row.path,
      label: row.id,
    });
    if (row.category.startsWith("canvas-")) {
      const thumbRel = `packs/gov-enterprise-v1/thumbs/${row.id}.svg`;
      if (fs.existsSync(path.join(ROOT, thumbRel))) {
        items.push({
          id: `${row.id}-thumb`,
          pack: "gov-enterprise-v1",
          category: "canvas-thumb",
          palette: row.palette,
          pattern: row.pattern || "",
          src: thumbRel,
          label: `${row.id} · 缩略图`,
        });
      }
    }
  }

  const de = readJson("packs/de-dashboard-v1/manifest.json");
  for (const row of de.assets || []) {
    items.push({
      id: row.slug,
      pack: "de-dashboard-v1",
      category: "dashboard-template",
      palette: row.theme,
      pattern: row.layout,
      src: toRel(row.thumb),
      bg: toRel(row.background),
      url: row.background,
      thumbUrl: row.thumb,
      label: row.slug,
    });
  }
  for (const row of de.variants || []) {
    items.push({
      id: row.slug,
      pack: "de-dashboard-v1",
      category: "dashboard-variant",
      palette: row.theme,
      pattern: row.variant,
      src: toRel(row.background),
      url: row.background,
      label: row.slug,
    });
  }

  items.push(
    ...scanSvgs("packs/gov-enterprise-v1/backgrounds/legacy", "gov-enterprise-v1", "screen-bg"),
  );
  items.push(...scanSvgs("thumbs", "legacy", "thumb"));

  const borderlessPath = "packs/borderless-decor-v1/manifest.json";
  if (fs.existsSync(path.join(ROOT, borderlessPath))) {
    const borderless = readJson(borderlessPath);
    for (const row of borderless.items || []) {
      items.push({
        id: row.id,
        pack: "borderless-decor-v1",
        category: "borderless-decor",
        palette: row.palette,
        pattern: row.style,
        src: toRel(row.path),
        url: row.path,
        label: row.id,
      });
    }
  }

  return items;
}

function buildHtml(items) {
  const palettes = [...new Set(items.map((i) => i.palette).filter(Boolean))].sort();
  const categories = [...new Set(items.map((i) => i.category))].sort();
  const data = JSON.stringify({ items, palettes, categories, generatedAt: new Date().toISOString() });

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>VitalSpan 模板素材总览 · ${items.length} 张</title>
  <style>
    :root {
      --bg: #0b0f14;
      --card: #141a22;
      --border: #243044;
      --text: #e8edf5;
      --muted: #8b9cb3;
      --accent: #1890ff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", system-ui, sans-serif;
      background: radial-gradient(1200px 600px at 10% -10%, #1a2744 0%, transparent 55%),
        radial-gradient(900px 500px at 90% 0%, #2a1a3d 0%, transparent 50%), var(--bg);
      color: var(--text);
      min-height: 100vh;
    }
    header {
      position: sticky; top: 0; z-index: 20;
      backdrop-filter: blur(12px);
      background: rgba(11, 15, 20, 0.88);
      border-bottom: 1px solid var(--border);
      padding: 16px 20px 12px;
    }
    h1 { margin: 0 0 4px; font-size: 1.25rem; font-weight: 700; }
    .sub { color: var(--muted); font-size: 0.82rem; margin-bottom: 12px; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    input[type=search] {
      flex: 1 1 200px; min-width: 160px;
      padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border);
      background: var(--card); color: var(--text);
    }
    select {
      padding: 8px 10px; border-radius: 8px; border: 1px solid var(--border);
      background: var(--card); color: var(--text);
    }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    .chip {
      border: 1px solid var(--border); background: var(--card);
      color: var(--muted); font-size: 0.72rem; padding: 4px 10px;
      border-radius: 999px; cursor: pointer; user-select: none;
      display: inline-flex; align-items: center; gap: 6px;
    }
    .chip i { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
    .chip.active { color: var(--text); border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
    main { padding: 16px 20px 40px; }
    .stats { color: var(--muted); font-size: 0.8rem; margin-bottom: 12px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 12px;
    }
    .card {
      background: var(--card); border: 1px solid var(--border);
      border-radius: 12px; overflow: hidden; cursor: zoom-in;
      transition: transform .15s, border-color .15s;
    }
    .card:hover { transform: translateY(-2px); border-color: #3d5270; }
    .thumb {
      aspect-ratio: 16/10; background: #0a0e12;
      display: flex; align-items: center; justify-content: center;
      overflow: hidden;
    }
    .thumb img { width: 100%; height: 100%; object-fit: cover; }
    .meta { padding: 8px 10px 10px; }
    .meta .id { font-size: 0.72rem; font-weight: 600; word-break: break-all; }
    .meta .tags { margin-top: 4px; display: flex; flex-wrap: wrap; gap: 4px; }
    .tag {
      font-size: 0.65rem; padding: 2px 6px; border-radius: 4px;
      background: #1e2836; color: var(--muted);
    }
    .lightbox {
      position: fixed; inset: 0; z-index: 50; display: none;
      background: rgba(0,0,0,.88); align-items: center; justify-content: center; padding: 24px;
    }
    .lightbox.open { display: flex; }
    .lightbox img { max-width: min(96vw, 1400px); max-height: 88vh; border-radius: 8px; box-shadow: 0 20px 60px #000; }
    .lightbox .cap { position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%);
      color: #cbd5e1; font-size: 0.85rem; background: rgba(0,0,0,.5); padding: 6px 12px; border-radius: 8px; }
    .lightbox button {
      position: absolute; top: 16px; right: 16px;
      background: #1e293b; color: #fff; border: none; border-radius: 8px;
      padding: 8px 12px; cursor: pointer;
    }
    .section-title {
      margin: 24px 0 10px; font-size: 0.9rem; color: var(--muted);
      border-bottom: 1px solid var(--border); padding-bottom: 6px;
    }
    .palette-bar {
      display: flex; flex-wrap: wrap; gap: 4px; margin: 8px 0 4px;
    }
    .swatch {
      width: 22px; height: 22px; border-radius: 6px; border: 1px solid rgba(255,255,255,.15);
      cursor: pointer; title: attr(data-name);
    }
  </style>
</head>
<body>
  <header>
    <h1>模板素材总览</h1>
    <p class="sub">gov-enterprise-v1 · de-dashboard-v1 · 单文件浏览全部背景 / 面板 / 样式变体</p>
    <div class="toolbar">
      <input id="q" type="search" placeholder="搜索名称、色系、图案…" />
      <select id="pack"><option value="">全部素材包</option></select>
      <select id="cat"><option value="">全部分类</option></select>
    </div>
    <div class="palette-bar" id="paletteBar"></div>
    <div class="chips" id="paletteChips"></div>
  </header>
  <main>
    <p class="stats" id="stats"></p>
    <div class="grid" id="grid"></div>
  </main>
  <div class="lightbox" id="lightbox" role="dialog">
    <button type="button" id="lbClose">关闭</button>
    <img id="lbImg" alt="" />
    <div class="cap" id="lbCap"></div>
  </div>
  <script id="catalog-data" type="application/json">${data}</script>
  <script>
    const { items, palettes, categories } = JSON.parse(document.getElementById('catalog-data').textContent);
    const PALETTE_HEX = ${JSON.stringify(PALETTE_HEX)};
    const CAT_LABEL = {
      'canvas-dark': '深色大屏背景',
      'canvas-light': '浅色看板背景',
      'component-panel': '组件面板',
      'title-strip': '标题装饰条',
      'top-decor-clear': '透明顶部装饰',
      'borderless-decor': '无边框装饰图',
      'dashboard-template': '仪表板模板',
      'dashboard-variant': '仪表板色系变体',
      'screen-bg': '经典大屏',
      'thumb': '经典缩略图',
      'canvas-thumb': '画布缩略图',
    };
    const packSel = document.getElementById('pack');
    const catSel = document.getElementById('cat');
    const q = document.getElementById('q');
    const grid = document.getElementById('grid');
    const stats = document.getElementById('stats');
    const paletteChips = document.getElementById('paletteChips');
    const paletteBar = document.getElementById('paletteBar');
    let activePalette = '';

    [...new Set(items.map(i => i.pack))].forEach(p => {
      const o = document.createElement('option'); o.value = p; o.textContent = p; packSel.appendChild(o);
    });
    categories.forEach(c => {
      const o = document.createElement('option'); o.value = c; o.textContent = CAT_LABEL[c] || c; catSel.appendChild(o);
    });

    palettes.forEach(p => {
      const hex = PALETTE_HEX[p] || '#64748b';
      const sw = document.createElement('div');
      sw.className = 'swatch'; sw.style.background = hex; sw.title = p;
      sw.onclick = () => { activePalette = activePalette === p ? '' : p; render(); paintChips(); };
      paletteBar.appendChild(sw);

      const chip = document.createElement('span');
      chip.className = 'chip'; chip.dataset.p = p;
      chip.innerHTML = '<i style="background:' + hex + '"></i>' + p;
      chip.onclick = () => { activePalette = activePalette === p ? '' : p; render(); paintChips(); };
      paletteChips.appendChild(chip);
    });

    function paintChips() {
      paletteChips.querySelectorAll('.chip').forEach(el => {
        el.classList.toggle('active', el.dataset.p === activePalette);
      });
    }

    function match(item) {
      const text = (item.id + ' ' + item.palette + ' ' + item.pattern + ' ' + item.category).toLowerCase();
      if (q.value && !text.includes(q.value.trim().toLowerCase())) return false;
      if (packSel.value && item.pack !== packSel.value) return false;
      if (catSel.value && item.category !== catSel.value) return false;
      if (activePalette && item.palette !== activePalette) return false;
      return true;
    }

    function render() {
      const list = items.filter(match);
      stats.textContent = '显示 ' + list.length + ' / ' + items.length + ' 张 · 点击卡片放大预览';
      grid.innerHTML = list.map(item => {
        const src = item.src;
        const tags = [item.palette, item.pattern, item.category].filter(Boolean).slice(0, 3);
        return '<article class="card" data-src="' + src + '" data-label="' + item.id + '">' +
          '<div class="thumb"><img loading="lazy" src="' + src + '" alt="" /></div>' +
          '<div class="meta"><div class="id">' + item.id + '</div><div class="tags">' +
          tags.map(t => '<span class="tag">' + t + '</span>').join('') + '</div></div></article>';
      }).join('');
    }

    grid.addEventListener('click', e => {
      const card = e.target.closest('.card');
      if (!card) return;
      lbImg.src = card.dataset.src;
      lbCap.textContent = card.dataset.label;
      lightbox.classList.add('open');
    });
    const lightbox = document.getElementById('lightbox');
    const lbImg = document.getElementById('lbImg');
    const lbCap = document.getElementById('lbCap');
    document.getElementById('lbClose').onclick = () => lightbox.classList.remove('open');
    lightbox.onclick = e => { if (e.target === lightbox) lightbox.classList.remove('open'); };

    [q, packSel, catSel].forEach(el => el.addEventListener('input', render));
    render();
  </script>
</body>
</html>`;
}

const items = collectItems().map(finalizeCatalogItem);
fs.writeFileSync(OUT, buildHtml(items), "utf8");
console.log(`Wrote catalog.html with ${items.length} items -> ${OUT}`);

const catalogPayload = {
  generatedAt: new Date().toISOString(),
  total: items.length,
  items: items.map(({ id, pack, category, palette, pattern, label, url, thumbUrl }) => ({
    id,
    pack,
    category,
    palette: palette || "",
    pattern: pattern || "",
    label,
    url,
    thumbUrl: thumbUrl || url,
  })),
};
fs.writeFileSync(CATALOG_JSON, `${JSON.stringify(catalogPayload, null, 2)}\n`, "utf8");
console.log(`Wrote catalog JSON -> ${CATALOG_JSON}`);
