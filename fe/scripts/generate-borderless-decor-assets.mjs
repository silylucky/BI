/**
 * 生成无边框装饰图素材包 borderless-decor-v1（对标 DataEase 富文本/组件背景弧形光带）
 * Run: npm run generate:borderless-decor
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FE_ROOT = path.resolve(__dirname, "..");
const PACK_ROOT = path.join(FE_ROOT, "public/template-assets/packs/borderless-decor-v1");
const PACK_ID = "borderless-decor-v1";
const PUBLIC_PREFIX = `/template-assets/packs/${PACK_ID}`;
const W = 480;
const H = 120;

const COLORS = {
  coral: "#fb7185",
  peach: "#fb923c",
  orange: "#f97316",
  gold: "#fbbf24",
  amber: "#f59e0b",
  cyan: "#22d3ee",
  cobalt: "#3b82f6",
  violet: "#8b5cf6",
  emerald: "#34d399",
  magenta: "#ec4899",
};

const STYLES = [
  "arc-swoosh",
  "arc-top",
  "double-arc",
  "wave-soft",
  "glow-streak",
  "bow-deep",
  "diamond-flare",
  "dotted-arc",
  "twin-swoosh",
  "particle-trail",
];

function stableId(seed) {
  return crypto.createHash("md5").update(seed).digest("hex").slice(0, 8);
}

function defsBlock(id, color) {
  return `<defs>
    <linearGradient id="${id}-h" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${color}" stop-opacity="0"/>
      <stop offset="42%" stop-color="${color}" stop-opacity="0.95"/>
      <stop offset="58%" stop-color="${color}" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="${id}-v" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient>
    <filter id="${id}-g" x="-20%" y="-40%" width="140%" height="180%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>`;
}

function bodyForStyle(style, id, color) {
  const mx = W / 2;
  switch (style) {
    case "arc-top":
      return `<path d="M32 32 Q${mx} 92 448 32 L448 0 L32 0 Z" fill="url(#${id}-v)" opacity="0.55"/>
  <path d="M32 32 Q${mx} 92 448 32" fill="none" stroke="url(#${id}-h)" stroke-width="2.2" filter="url(#${id}-g)"/>`;
    case "double-arc":
      return `<path d="M40 78 Q${mx} 38 440 78" fill="none" stroke="url(#${id}-h)" stroke-width="2" filter="url(#${id}-g)"/>
  <path d="M48 92 Q${mx} 52 432 92" fill="none" stroke="url(#${id}-h)" stroke-width="1.2" opacity="0.65"/>`;
    case "wave-soft":
      return `<path d="M24 86 Q120 62 ${mx} 86 T456 86" fill="none" stroke="url(#${id}-h)" stroke-width="2.4" filter="url(#${id}-g)"/>
  <path d="M24 86 Q120 70 ${mx} 86 T456 86 L456 120 L24 120 Z" fill="url(#${id}-v)" opacity="0.35"/>`;
    case "glow-streak":
      return `<path d="M48 60 L432 60" stroke="url(#${id}-h)" stroke-width="3" filter="url(#${id}-g)"/>
  <path d="M48 60 L432 60" stroke="url(#${id}-h)" stroke-width="1" opacity="0.8"/>
  <ellipse cx="${mx}" cy="60" rx="80" ry="18" fill="${color}" opacity="0.12"/>`;
    case "bow-deep":
      return `<path d="M28 96 Q${mx} 8 452 96 L452 120 L28 120 Z" fill="url(#${id}-v)" opacity="0.4"/>
  <path d="M28 96 Q${mx} 8 452 96" fill="none" stroke="url(#${id}-h)" stroke-width="2.5" filter="url(#${id}-g)"/>`;
    case "diamond-flare":
      return `<path d="M36 84 Q${mx} 30 444 84" fill="none" stroke="url(#${id}-h)" stroke-width="2.2" filter="url(#${id}-g)"/>
  <polygon points="${mx - 8},74 ${mx},62 ${mx + 8},74 ${mx},86" fill="${color}" opacity="0.75"/>
  <polygon points="44,80 52,72 60,80 52,88" fill="${color}" opacity="0.45"/>
  <polygon points="420,80 428,72 436,80 428,88" fill="${color}" opacity="0.45"/>`;
    case "dotted-arc":
      return `<path d="M32 88 Q${mx} 34 448 88" fill="none" stroke="url(#${id}-h)" stroke-width="2" stroke-dasharray="6 5" filter="url(#${id}-g)"/>
  <path d="M32 88 Q${mx} 34 448 88 L448 120 L32 120 Z" fill="url(#${id}-v)" opacity="0.28"/>`;
    case "twin-swoosh":
      return `<path d="M40 90 Q${mx - 40} 42 280 78 Q${mx + 60} 98 440 70" fill="none" stroke="url(#${id}-h)" stroke-width="3" filter="url(#${id}-g)"/>
  <path d="M56 98 Q${mx} 58 424 86" fill="none" stroke="url(#${id}-h)" stroke-width="1" opacity="0.55"/>`;
    case "particle-trail":
      return `<path d="M32 88 Q${mx} 34 448 88" fill="none" stroke="url(#${id}-h)" stroke-width="1.8" filter="url(#${id}-g)"/>
  ${Array.from({ length: 11 }, (_, i) => {
    const t = i / 10;
    const x = 32 + t * (W - 64);
    const y = 88 - Math.sin(t * Math.PI) * 54;
    const r = 1.5 + (i % 3) * 0.6;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${color}" opacity="${(0.35 + (i % 4) * 0.15).toFixed(2)}"/>`;
  }).join("\n  ")}`;
    case "arc-swoosh":
    default:
      return `<path d="M32 88 Q${mx} 28 448 88 L448 120 L32 120 Z" fill="url(#${id}-v)" opacity="0.42"/>
  <path d="M32 88 Q${mx} 28 448 88" fill="none" stroke="url(#${id}-h)" stroke-width="2.5" filter="url(#${id}-g)"/>
  <path d="M32 88 Q${mx} 28 448 88" fill="none" stroke="url(#${id}-h)" stroke-width="1" opacity="0.85"/>`;
  }
}

function buildSvg(style, colorName, colorHex) {
  const id = stableId(`${style}-${colorName}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${defsBlock(id, colorHex)}
  ${bodyForStyle(style, id, colorHex)}
</svg>`;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function generate() {
  const itemsDir = path.join(PACK_ROOT, "items");
  if (fs.existsSync(itemsDir)) {
    for (const f of fs.readdirSync(itemsDir)) fs.unlinkSync(path.join(itemsDir, f));
  }
  ensureDir(itemsDir);

  const items = [];
  for (const style of STYLES) {
    for (const [colorName, colorHex] of Object.entries(COLORS)) {
      const id = `decor-${style}-${colorName}`;
      const rel = `items/${id}.svg`;
      const svg = buildSvg(style, colorName, colorHex);
      fs.writeFileSync(path.join(PACK_ROOT, rel), svg, "utf8");
      items.push({
        id,
        category: "borderless-decor",
        path: `${PUBLIC_PREFIX}/${rel}`,
        style,
        palette: colorName,
        color: colorHex,
        tags: ["borderless", "widget-bg", "richtext", style, colorName],
      });
    }
  }

  const manifest = {
    id: PACK_ID,
    version: 1,
    generatedAt: new Date().toISOString().slice(0, 10),
    total: items.length,
    defaultSize: [W, H],
    categories: {
      "borderless-decor": { count: items.length, defaultSize: [W, H] },
    },
    items,
  };

  fs.writeFileSync(path.join(PACK_ROOT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const readme = `# 无边框装饰图 \`${PACK_ID}\`

> \`npm run generate:borderless-decor\` 自动生成。透明底 SVG，供富文本/组件「背景 · 图片」使用。

## 统计

| 样式 | 色系 | 合计 |
|------|------|------|
| ${STYLES.length} 款 | ${Object.keys(COLORS).length} 色 | **${items.length}** |

## 命名

\`decor-{style}-{color}.svg\`

## 引用

\`/template-assets/packs/borderless-decor-v1/items/decor-arc-swoosh-coral.svg\`
`;
  fs.writeFileSync(path.join(PACK_ROOT, "README.md"), readme, "utf8");

  // FE 静态目录（供 import）
  const feLib = path.join(FE_ROOT, "src/lib/borderlessDecorCatalog.generated.json");
  fs.writeFileSync(
    feLib,
    JSON.stringify(
      items.map((row) => ({
        id: row.id,
        label: row.id.replace(/^decor-/, "").replace(/-/g, " "),
        url: row.path,
        style: row.style,
        palette: row.palette,
      })),
      null,
      2,
    ),
    "utf8",
  );

  return manifest;
}

const manifest = generate();
console.log(`Generated ${manifest.total} borderless decor assets -> ${PACK_ROOT}`);
if (manifest.total !== 100) {
  console.error(`Expected 100 items, got ${manifest.total}`);
  process.exit(1);
}
