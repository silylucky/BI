/**
 * DataEase-style dashboard canvas backgrounds + rich preview thumbnails.
 * Run: npm run generate:de-dashboard-assets
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACK_ROOT = path.resolve(
  __dirname,
  "../public/template-assets/packs/de-dashboard-v1",
);
const PUBLIC_PREFIX = "/template-assets/packs/de-dashboard-v1";

const THEMES = {
  blue: { accent: "#1890ff", accent2: "#13c2c2", bg: "#f0f2f5", bgTo: "#e8ecf1", glow: "#1890ff" },
  indigo: { accent: "#597ef7", accent2: "#9254de", bg: "#f0f2f5", bgTo: "#eef0f8", glow: "#597ef7" },
  green: { accent: "#52c41a", accent2: "#13c2c2", bg: "#f0f2f5", bgTo: "#eef5ec", glow: "#52c41a" },
  violet: { accent: "#722ed1", accent2: "#eb2f96", bg: "#f0f2f5", bgTo: "#f3eef8", glow: "#722ed1" },
  teal: { accent: "#13c2c2", accent2: "#1890ff", bg: "#f0f2f5", bgTo: "#ecf6f6", glow: "#13c2c2" },
  slate: { accent: "#595959", accent2: "#1890ff", bg: "#f0f2f5", bgTo: "#ececec", glow: "#8c8c8c" },
  orange: { accent: "#fa8c16", accent2: "#fa541c", bg: "#f0f2f5", bgTo: "#fff7e6", glow: "#fa8c16" },
  rose: { accent: "#eb2f96", accent2: "#f759ab", bg: "#f0f2f5", bgTo: "#fff0f6", glow: "#eb2f96" },
  amber: { accent: "#faad14", accent2: "#d48806", bg: "#f0f2f5", bgTo: "#fffbe6", glow: "#faad14" },
  cyan: { accent: "#13c2c2", accent2: "#36cfc9", bg: "#f0f2f5", bgTo: "#e6fffb", glow: "#13c2c2" },
  navy: { accent: "#1d39c4", accent2: "#597ef7", bg: "#f0f2f5", bgTo: "#f0f5ff", glow: "#1d39c4" },
  lime: { accent: "#a0d911", accent2: "#52c41a", bg: "#f0f2f5", bgTo: "#fcffe6", glow: "#a0d911" },
  coral: { accent: "#ff4d4f", accent2: "#ff7875", bg: "#f0f2f5", bgTo: "#fff1f0", glow: "#ff4d4f" },
  gold: { accent: "#d48806", accent2: "#faad14", bg: "#f0f2f5", bgTo: "#fffbe6", glow: "#d48806" },
};

const BG_VARIANTS = ["dots", "stripes", "mesh", "band"];

function svgHeader(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">`;
}

function shadowFilter(id) {
  return `<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="2" stdDeviation="6" flood-color="#000000" flood-opacity="0.06"/>
  </filter>`;
}

/** 画布底图：浅灰渐变 + 顶栏光晕；variant 扩展不同纹理 */
function buildCanvasBg(theme, id, variant = "default") {
  const t = THEMES[theme];
  let variantLayer = "";
  if (variant === "stripes") {
    variantLayer = `<pattern id="${id}-stripes" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
      <line x1="0" y1="0" x2="0" y2="24" stroke="${t.accent}" stroke-width="1" opacity="0.05"/>
    </pattern>
    <rect width="1920" height="1080" fill="url(#${id}-stripes)"/>`;
  } else if (variant === "mesh") {
    variantLayer = `<radialGradient id="${id}-mesh" cx="80%" cy="20%" r="60%">
      <stop stop-color="${t.accent2}" stop-opacity="0.08"/><stop offset="1" stop-opacity="0"/>
    </radialGradient>
    <rect width="1920" height="1080" fill="url(#${id}-mesh)"/>`;
  } else if (variant === "band") {
    variantLayer = `<rect y="0" width="1920" height="56" fill="${t.accent}" opacity="0.06"/>
    <line x1="0" y1="56" x2="1920" y2="56" stroke="${t.accent}" stroke-width="1" opacity="0.2"/>`;
  }
  return `${svgHeader(1920, 1080)}
  <defs>
    <linearGradient id="${id}-bg" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="${t.bg}"/>
      <stop offset="1" stop-color="${t.bgTo}"/>
    </linearGradient>
    <radialGradient id="${id}-glow" cx="50%" cy="0%" r="55%">
      <stop stop-color="${t.glow}" stop-opacity="0.07"/>
      <stop offset="1" stop-opacity="0"/>
    </radialGradient>
    <pattern id="${id}-dots" width="20" height="20" patternUnits="userSpaceOnUse">
      <circle cx="10" cy="10" r="0.8" fill="${t.accent}" opacity="0.04"/>
    </pattern>
  </defs>
  <rect width="1920" height="1080" fill="url(#${id}-bg)"/>
  <rect width="1920" height="1080" fill="url(#${id}-glow)"/>
  ${variant === "dots" || variant === "default" ? `<rect width="1920" height="1080" fill="url(#${id}-dots)"/>` : variantLayer}
  <rect width="1920" height="3" fill="${t.accent}" opacity="0.35"/>
</svg>`;
}

function card(x, y, w, h, filterId, rx = 4) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="#ffffff" filter="url(#${filterId})"/>`;
}

function barChart(x, y, w, h, accent, accent2) {
  const bars = [0.55, 0.82, 0.45, 0.68, 0.9, 0.52, 0.74];
  const bw = w / (bars.length * 2);
  return bars
    .map((ratio, i) => {
      const bh = h * ratio;
      const bx = x + i * bw * 2 + bw * 0.4;
      const color = i % 2 === 0 ? accent : accent2;
      return `<rect x="${bx}" y="${y + h - bh}" width="${bw}" height="${bh}" rx="1" fill="${color}" opacity="0.85"/>`;
    })
    .join("\n  ");
}

function lineChart(x, y, w, h, accent) {
  const pts = [0.7, 0.5, 0.62, 0.38, 0.55, 0.3, 0.48, 0.65];
  const step = w / (pts.length - 1);
  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${x + i * step} ${y + h * (1 - p)}`)
    .join(" ");
  return `<path d="${d}" fill="none" stroke="${accent}" stroke-width="2" opacity="0.9"/>
  <path d="${d} L${x + w} ${y + h} L${x} ${y + h} Z" fill="${accent}" opacity="0.08"/>`;
}

function pieChart(cx, cy, r, accent, accent2) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${accent}" opacity="0.85"/>
  <path d="M${cx} ${cy} L${cx} ${cy - r} A${r} ${r} 0 0 1 ${cx + r * 0.7} ${cy + r * 0.5} Z" fill="${accent2}" opacity="0.9"/>
  <path d="M${cx} ${cy} L${cx + r * 0.7} ${cy + r * 0.5} A${r} ${r} 0 0 1 ${cx - r * 0.4} ${cy + r * 0.9} Z" fill="#faad14" opacity="0.85"/>`;
}

function kpiBlock(x, y, w, h, accent, value) {
  const barW = Math.min(56, Math.max(28, w - 32));
  return `${card(x, y, w, h, "sh")}
  <text x="${x + 16}" y="${y + 22}" font-family="system-ui,sans-serif" font-size="11" fill="#8c8c8c">${value}</text>
  <rect x="${x + 16}" y="${y + 36}" width="${barW}" height="12" rx="2" fill="#d9d9d9" opacity="0.85"/>
  <rect x="${x + 16}" y="${y + 56}" width="36" height="3" rx="1.5" fill="${accent}" opacity="0.8"/>`;
}

function mapPlaceholder(x, y, w, h, accent) {
  return `${card(x, y, w, h, "sh")}
  <ellipse cx="${x + w * 0.5}" cy="${y + h * 0.52}" rx="${w * 0.32}" ry="${h * 0.28}" fill="${accent}" opacity="0.12"/>
  <ellipse cx="${x + w * 0.42}" cy="${y + h * 0.48}" rx="${w * 0.18}" ry="${h * 0.15}" fill="${accent}" opacity="0.35"/>
  <ellipse cx="${x + w * 0.58}" cy="${y + h * 0.55}" rx="${w * 0.12}" ry="${h * 0.1}" fill="${accent}" opacity="0.5"/>
  <circle cx="${x + w * 0.35}" cy="${y + h * 0.4}" r="4" fill="${accent}"/>
  <circle cx="${x + w * 0.62}" cy="${y + h * 0.45}" r="4" fill="#faad14"/>`;
}

function tablePlaceholder(x, y, w, h) {
  const rows = 5;
  const rh = (h - 28) / rows;
  let body = card(x, y, w, h, "sh");
  body += `<rect x="${x}" y="${y}" width="${w}" height="24" fill="#fafafa" rx="4"/>`;
  for (let i = 0; i < rows; i++) {
    const ry = y + 28 + i * rh;
    body += `<rect x="${x + 12}" y="${ry}" width="${w * 0.35}" height="6" rx="2" fill="#d9d9d9" opacity="0.7"/>`;
    body += `<rect x="${x + w * 0.55}" y="${ry}" width="${w * 0.25}" height="6" rx="2" fill="#d9d9d9" opacity="0.5"/>`;
  }
  return body;
}

/** 富预览缩略图：对标 DataEase 模板市场卡片 */
function buildThumb(theme, layout) {
  const t = THEMES[theme];
  const w = 320;
  const h = 180;
  const pad = 10;
  const innerW = w - pad * 2;
  let body = "";

  switch (layout) {
    case "kpi-dual": {
      const kw = (innerW - 9) / 4;
      for (let i = 0; i < 4; i++) {
        body += kpiBlock(pad + i * (kw + 3), pad, kw, 38, t.accent, ["办结率", "在线率", "响应", "满意度"][i]);
      }
      const cy = pad + 44;
      const cw = (innerW - 6) / 2;
      body += card(pad, cy, cw, h - cy - pad, "sh");
      body += barChart(pad + 14, cy + 22, cw - 28, h - cy - pad - 36, t.accent, t.accent2);
      body += card(pad + cw + 6, cy, cw, h - cy - pad, "sh");
      body += lineChart(pad + cw + 20, cy + 22, cw - 28, h - cy - pad - 36, t.accent);
      break;
    }
    case "triple": {
      const cw = (innerW - 12) / 3;
      body += mapPlaceholder(pad, pad, cw, h - pad * 2, t.accent);
      body += card(pad + cw + 6, pad, cw, h - pad * 2, "sh");
      body += pieChart(pad + cw + 6 + cw / 2, pad + (h - pad * 2) / 2 + 4, 28, t.accent, t.accent2);
      body += tablePlaceholder(pad + (cw + 6) * 2, pad, cw, h - pad * 2);
      break;
    }
    case "ops": {
      const kw = (innerW - 9) / 4;
      for (let i = 0; i < 4; i++) {
        body += kpiBlock(pad + i * (kw + 3), pad, kw, 34, t.accent, ["GMV", "订单", "转化", "客单"][i]);
      }
      const cy = pad + 40;
      const mapW = innerW * 0.58;
      const rightW = innerW - mapW - 6;
      body += mapPlaceholder(pad, cy, mapW, h - cy - pad, t.accent);
      body += card(pad + mapW + 6, cy, rightW, (h - cy - pad - 6) / 2, "sh");
      body += lineChart(pad + mapW + 14, cy + 18, rightW - 20, (h - cy - pad - 6) / 2 - 28, t.accent);
      body += tablePlaceholder(pad + mapW + 6, cy + (h - cy - pad - 6) / 2 + 6, rightW, (h - cy - pad - 6) / 2);
      break;
    }
    case "geo-bar": {
      body += mapPlaceholder(pad, pad, innerW * 0.58, h - pad * 2, t.accent);
      body += card(pad + innerW * 0.58 + 6, pad, innerW * 0.42 - 6, (h - pad * 2) * 0.55, "sh");
      body += barChart(pad + innerW * 0.58 + 16, pad + 20, innerW * 0.42 - 28, (h - pad * 2) * 0.55 - 32, t.accent, t.accent2);
      const ky = pad + (h - pad * 2) * 0.58 + 6;
      body += kpiBlock(pad + innerW * 0.58 + 6, ky, innerW * 0.42 - 6, h - ky - pad, t.accent, "投资总额");
      break;
    }
    case "grid-ops": {
      body += tablePlaceholder(pad, pad, innerW * 0.38, h - pad * 2);
      body += mapPlaceholder(pad + innerW * 0.38 + 6, pad, innerW * 0.32, h - pad * 2, t.accent);
      body += card(pad + innerW * 0.7 + 6, pad, innerW * 0.3 - 6, h - pad * 2, "sh");
      body += barChart(pad + innerW * 0.7 + 16, pad + 24, innerW * 0.3 - 28, h - pad * 2 - 40, t.accent, t.accent2);
      break;
    }
    case "blank":
    default:
      body += `<rect x="${pad}" y="${pad}" width="${innerW}" height="${h - pad * 2}" rx="4" fill="#ffffff" opacity="0.5" stroke="#d9d9d9" stroke-width="1" stroke-dasharray="6 4"/>`;
      break;
  }

  return `${svgHeader(w, h)}
  <defs>${shadowFilter("sh")}</defs>
  <rect width="${w}" height="${h}" fill="${t.bg}"/>
  <rect width="${w}" height="${h}" fill="url(#g)" opacity="0"/>
  <defs><radialGradient id="g" cx="50%" cy="0%" r="60%"><stop stop-color="${t.glow}" stop-opacity="0.08"/><stop offset="1" stop-opacity="0"/></radialGradient></defs>
  ${body}
</svg>`;
}

const SPECS = [
  { slug: "dash-blank", theme: "blue", layout: "blank" },
  { slug: "dash-dual-kpi", theme: "blue", layout: "kpi-dual" },
  { slug: "dash-triple", theme: "violet", layout: "triple" },
  { slug: "dash-ops", theme: "teal", layout: "ops" },
  { slug: "gov-efficiency", theme: "blue", layout: "kpi-dual" },
  { slug: "gov-satisfaction", theme: "violet", layout: "triple" },
  { slug: "gov-finance", theme: "green", layout: "ops" },
  { slug: "gov-investment", theme: "indigo", layout: "geo-bar" },
  { slug: "gov-grid", theme: "slate", layout: "grid-ops" },
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function write(rel, content) {
  const full = path.join(PACK_ROOT, rel);
  ensureDir(path.dirname(full));
  fs.writeFileSync(full, content, "utf8");
  return full;
}

ensureDir(PACK_ROOT);
const manifest = {
  packId: "de-dashboard-v1",
  publicPrefix: PUBLIC_PREFIX,
  assets: [],
  variants: [],
};

for (const spec of SPECS) {
  const bgPath = `backgrounds/${spec.slug}.svg`;
  const thumbPath = `thumbs/${spec.slug}.svg`;
  write(bgPath, buildCanvasBg(spec.theme, spec.slug));
  write(thumbPath, buildThumb(spec.theme, spec.layout));
  manifest.assets.push({
    slug: spec.slug,
    theme: spec.theme,
    layout: spec.layout,
    background: `${PUBLIC_PREFIX}/${bgPath}`,
    thumb: `${PUBLIC_PREFIX}/${thumbPath}`,
  });
}

for (const theme of Object.keys(THEMES)) {
  for (const variant of BG_VARIANTS) {
    const slug = `canvas-${theme}-${variant}`;
    const bgPath = `backgrounds/variants/${slug}.svg`;
    write(bgPath, buildCanvasBg(theme, slug, variant));
    manifest.variants.push({
      slug,
      theme,
      variant,
      background: `${PUBLIC_PREFIX}/${bgPath}`,
    });
  }
}

write(
  "manifest.json",
  `${JSON.stringify(manifest, null, 2)}\n`,
);
write(
  "README.md",
  `# de-dashboard-v1

DataEase 风格仪表板素材包（浅灰画布 + 富预览缩略图）。

\`\`\`bash
cd fe && npm run generate:de-dashboard-assets
\`\`\`
`,
);

console.log(
  `Generated ${SPECS.length * 2 + Object.keys(THEMES).length * BG_VARIANTS.length} files in ${PACK_ROOT}`,
);
