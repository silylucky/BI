/**
 * Generate gov-enterprise-v1 template asset pack (129 SVGs + manifest + README).
 * Run: npm run generate:gov-assets
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FE_ROOT = path.resolve(__dirname, "..");
const PACK_ROOT = path.join(FE_ROOT, "public/template-assets/packs/gov-enterprise-v1");
const PACK_ID = "gov-enterprise-v1";
const PUBLIC_PREFIX = `/template-assets/packs/${PACK_ID}`;

// ---------------------------------------------------------------------------
// Palettes — each palette has a signature motif icon
// ---------------------------------------------------------------------------

const DARK_PALETTES = {
  cyan: { baseFrom: "#041016", baseTo: "#0c4a6e", accent: "#22d3ee", glow: "#22d3ee", glowOpacity: 0.18, motif: "hex" },
  indigo: { baseFrom: "#0f172a", baseTo: "#1e1b4b", accent: "#6366f1", glow: "#818cf8", glowOpacity: 0.16, motif: "diamond" },
  emerald: { baseFrom: "#021a14", baseTo: "#064e3b", accent: "#34d399", glow: "#10b981", glowOpacity: 0.15, motif: "leaf" },
  amber: { baseFrom: "#1a1208", baseTo: "#78350f", accent: "#fbbf24", glow: "#f59e0b", glowOpacity: 0.14, motif: "star" },
  crimson: { baseFrom: "#1a0508", baseTo: "#7f1d1d", accent: "#f87171", glow: "#ef4444", glowOpacity: 0.13, motif: "shield" },
  royal: { baseFrom: "#0a1628", baseTo: "#1e3a8a", accent: "#60a5fa", glow: "#3b82f6", glowOpacity: 0.17, motif: "orbit" },
  slate: { baseFrom: "#0f1419", baseTo: "#334155", accent: "#94a3b8", glow: "#64748b", glowOpacity: 0.12, motif: "grid-dot" },
  teal: { baseFrom: "#042f2e", baseTo: "#115e59", accent: "#2dd4bf", glow: "#14b8a6", glowOpacity: 0.15, motif: "wave" },
  violet: { baseFrom: "#1a0a2e", baseTo: "#4c1d95", accent: "#a78bfa", glow: "#8b5cf6", glowOpacity: 0.14, motif: "chevron" },
  gold: { baseFrom: "#1a1408", baseTo: "#713f12", accent: "#fbbf24", glow: "#d97706", glowOpacity: 0.16, motif: "star" },
  bronze: { baseFrom: "#1a1008", baseTo: "#57534e", accent: "#d6a06a", glow: "#a16207", glowOpacity: 0.14, motif: "shield" },
  cobalt: { baseFrom: "#081018", baseTo: "#1e3a8a", accent: "#3b82f6", glow: "#60a5fa", glowOpacity: 0.16, motif: "orbit" },
  magenta: { baseFrom: "#1a0514", baseTo: "#831843", accent: "#f472b6", glow: "#ec4899", glowOpacity: 0.14, motif: "chevron" },
  lime: { baseFrom: "#0a1408", baseTo: "#365314", accent: "#a3e635", glow: "#84cc16", glowOpacity: 0.13, motif: "leaf" },
};

function parseHex(hex) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b]
    .map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0"))
    .join("")}`;
}

function mixHex(a, b, t) {
  const A = parseHex(a);
  const B = parseHex(b);
  return rgbToHex(A.r + (B.r - A.r) * t, A.g + (B.g - A.g) * t, A.b + (B.b - A.b) * t);
}

function lighten(hex, amount) {
  return mixHex(hex, "#ffffff", amount);
}

/** 由深色 palette 推导浅色：保留同色系 + 深→浅四段过渡 */
function deriveLightPalette(dark) {
  const baseFrom = lighten(dark.baseFrom, 0.9);
  const baseMid = lighten(mixHex(dark.baseFrom, dark.baseTo, 0.45), 0.68);
  const cardTint = lighten(mixHex(dark.baseTo, dark.accent, 0.18), 0.74);
  const baseTo = lighten(mixHex(dark.baseTo, dark.accent, 0.32), 0.52);
  return {
    motif: dark.motif,
    baseFrom,
    baseMid,
    baseTo,
    base: baseFrom,
    cardTint,
    accent: dark.accent,
    accentDeep: mixHex(dark.baseTo, dark.accent, 0.62),
    accentMuted: mixHex(dark.baseFrom, dark.accent, 0.42),
    accentLight: dark.glow,
    glow: dark.glow,
    glowOpacity: Math.min(dark.glowOpacity * 2.6, 0.32),
  };
}

const LIGHT_PALETTES = Object.fromEntries(
  Object.entries(DARK_PALETTES).map(([key, dark]) => [key, deriveLightPalette(dark)]),
);

/** 深浅色共用同一套画布图案（浅色走同一 pattern 引擎 + 更高对比度） */
const CANVAS_PATTERNS = [
  "command",
  "aurora",
  "honeycomb",
  "circuit",
  "hud-scan",
  "topbar-icons",
  "gradient-mesh",
  "radial-pulse",
  /** 对标 DataEase 工作台大屏：梯形顶栏 + 电路翼 */
  "de-platform-header",
  "de-circuit-wing",
  "de-cloud-center",
];
const DARK_PATTERNS = CANVAS_PATTERNS;

const PANEL_STYLES = ["de-frame", "hud-bracket", "badge-header", "tech-rail"];
const PANEL_COLORS = [
  "cyan",
  "indigo",
  "emerald",
  "amber",
  "crimson",
  "royal",
  "slate",
  "teal",
  "violet",
  "gold",
  "bronze",
  "cobalt",
  "magenta",
];

const TITLE_STYLES = ["diamond-flank", "shield-badge", "hex-nodes"];
/** 全宽大屏顶栏（对标 DE workbranch 模板顶栏背景） */
const SCREEN_HEADER_STYLES = ["de-trapezoid-wing", "de-circuit-sym", "de-glow-plaque"];
const TITLE_COLORS = [
  "cyan",
  "indigo",
  "emerald",
  "amber",
  "royal",
  "teal",
  "violet",
  "gold",
  "cobalt",
  "magenta",
];

// ---------------------------------------------------------------------------
// Deterministic IDs (stable across regenerations)
// ---------------------------------------------------------------------------

function stableId(seed) {
  return crypto.createHash("md5").update(seed).digest("hex").slice(0, 8);
}

function svgHeader(w, h, preserve = "xMidYMid slice") {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="${preserve}">`;
}

// ---------------------------------------------------------------------------
// Icon / motif primitives (gov-tech decorative glyphs)
// ---------------------------------------------------------------------------

function iconHex(cx, cy, r, accent, opacity = 0.5) {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(" ");
  return `<polygon points="${pts}" fill="none" stroke="${accent}" stroke-width="1.2" opacity="${opacity}"/>
  <circle cx="${cx}" cy="${cy}" r="${r * 0.25}" fill="${accent}" opacity="${opacity * 0.6}"/>`;
}

function iconDiamond(cx, cy, r, accent, opacity = 0.5) {
  return `<path d="M${cx} ${cy - r} L${cx + r} ${cy} L${cx} ${cy + r} L${cx - r} ${cy} Z" fill="none" stroke="${accent}" stroke-width="1.2" opacity="${opacity}"/>
  <circle cx="${cx}" cy="${cy}" r="2" fill="${accent}" opacity="${opacity}"/>`;
}

function iconShield(cx, cy, s, accent, opacity = 0.5) {
  return `<path d="M${cx} ${cy - s} L${cx + s * 0.7} ${cy - s * 0.3} L${cx + s * 0.7} ${cy + s * 0.4} Q${cx} ${cy + s * 0.9} ${cx - s * 0.7} ${cy + s * 0.4} L${cx - s * 0.7} ${cy - s * 0.3} Z" fill="none" stroke="${accent}" stroke-width="1.2" opacity="${opacity}"/>`;
}

function iconStar(cx, cy, r, accent, opacity = 0.5) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.4;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`);
  }
  return `<polygon points="${pts.join(" ")}" fill="none" stroke="${accent}" stroke-width="1" opacity="${opacity}"/>`;
}

function iconOrbit(cx, cy, r, accent, opacity = 0.4) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${accent}" stroke-width="0.8" opacity="${opacity}"/>
  <circle cx="${cx}" cy="${cy}" r="${r * 0.55}" fill="none" stroke="${accent}" stroke-width="0.5" opacity="${opacity * 0.7}"/>
  <circle cx="${cx + r}" cy="${cy}" r="2.5" fill="${accent}" opacity="${opacity}"/>
  <circle cx="${cx - r * 0.5}" cy="${cy - r * 0.87}" r="2" fill="${accent}" opacity="${opacity * 0.8}"/>`;
}

function iconChevron(cx, cy, s, accent, opacity = 0.5, flip = false) {
  const d = flip
    ? `M${cx - s} ${cy} L${cx} ${cy - s * 0.6} L${cx} ${cy + s * 0.6} Z`
    : `M${cx + s} ${cy} L${cx} ${cy - s * 0.6} L${cx} ${cy + s * 0.6} Z`;
  return `<path d="${d}" fill="${accent}" fill-opacity="${opacity * 0.3}" stroke="${accent}" stroke-width="0.8" opacity="${opacity}"/>`;
}

function renderMotif(type, cx, cy, scale, accent, opacity = 0.45) {
  switch (type) {
    case "hex": return iconHex(cx, cy, scale, accent, opacity);
    case "diamond": return iconDiamond(cx, cy, scale, accent, opacity);
    case "shield": return iconShield(cx, cy, scale, accent, opacity);
    case "star": return iconStar(cx, cy, scale, accent, opacity);
    case "orbit": return iconOrbit(cx, cy, scale, accent, opacity);
    case "chevron":
      return `${iconChevron(cx - scale, cy, scale * 0.8, accent, opacity)}${iconChevron(cx + scale, cy, scale * 0.8, accent, opacity, true)}`;
    case "leaf":
      return `<path d="M${cx} ${cy - scale} Q${cx + scale} ${cy} ${cx} ${cy + scale} Q${cx - scale} ${cy} ${cx} ${cy - scale}" fill="none" stroke="${accent}" stroke-width="1" opacity="${opacity}"/>
  <line x1="${cx}" y1="${cy - scale}" x2="${cx}" y2="${cy + scale}" stroke="${accent}" stroke-width="0.6" opacity="${opacity * 0.6}"/>`;
    case "wave":
      return `<path d="M${cx - scale * 2} ${cy} Q${cx - scale} ${cy - scale * 0.5} ${cx} ${cy} Q${cx + scale} ${cy + scale * 0.5} ${cx + scale * 2} ${cy}" fill="none" stroke="${accent}" stroke-width="1" opacity="${opacity}"/>`;
    case "grid-dot":
      return `${iconHex(cx, cy, scale * 0.6, accent, opacity)}<circle cx="${cx - scale}" cy="${cy}" r="1.5" fill="${accent}" opacity="${opacity}"/><circle cx="${cx + scale}" cy="${cy}" r="1.5" fill="${accent}" opacity="${opacity}"/>`;
    default:
      return iconDiamond(cx, cy, scale, accent, opacity);
  }
}

function cornerBrackets(x, y, w, h, accent, size = 48, sw = 2, opacity = 0.55) {
  const s = size;
  return `<g opacity="${opacity}" stroke="${accent}" stroke-width="${sw}" fill="none">
  <path d="M${x} ${y + s} V${y} H${x + s}"/>
  <path d="M${x + w - s} ${y} H${x + w} V${y + s}"/>
  <path d="M${x + w} ${y + h - s} V${y + h} H${x + w - s}"/>
  <path d="M${x + s} ${y + h} H${x} V${y + h - s}"/>
</g>`;
}

function headerBar(w, accent, palette, id, withIcons = true) {
  const icons = withIcons
    ? Array.from({ length: 7 }, (_, i) => {
        const cx = 160 + i * 56;
        return renderMotif(palette.motif, cx, 36, 10, accent, 0.35);
      }).join("\n  ")
    : "";
  return `<defs>
    <linearGradient id="${id}-hdr" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="${accent}" stop-opacity="0.22"/>
      <stop offset="1" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="72" fill="url(#${id}-hdr)"/>
  <line x1="0" y1="72" x2="${w}" y2="72" stroke="${accent}" stroke-width="1" opacity="0.35"/>
  <line x1="48" y1="72" x2="${w - 48}" y2="72" stroke="${accent}" stroke-width="2" opacity="0.15"/>
  ${icons}`;
}

/** DataEase 大屏顶栏：霓虹发光滤镜 */
function deSciFiGlowDefs(filterId) {
  return `<filter id="${filterId}" x="-30%" y="-80%" width="160%" height="260%">
    <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="blur"/>
    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>`;
}

/** 电路翼装饰（单侧）；side=left 时 originX 为靠中心起点，向右绘制 */
function circuitWingDecor(originX, cy, accent, filterId, side) {
  const dir = side === "left" ? -1 : 1;
  const o = originX;
  const x = (dx) => o + dir * dx;
  const hatch = Array.from({ length: 5 }, (_, i) => {
    const hx = x(18 + i * 7);
    const hy = cy - 22 + i * 5;
    return `<line x1="${hx}" y1="${hy}" x2="${hx + dir * 10}" y2="${hy + 8}" stroke="${accent}" stroke-width="0.7" opacity="0.45"/>`;
  }).join("\n    ");
  return `<g filter="url(#${filterId})" stroke="${accent}" fill="none" stroke-linecap="square">
    <path d="M${x(0)} ${cy} H${x(118)} V${cy - 18} H${x(210)}" stroke-width="1.3" opacity="0.9"/>
    <path d="M${x(28)} ${cy + 12} H${x(150)} V${cy + 30} H${x(240)}" stroke-width="1.1" opacity="0.75"/>
    <path d="M${x(64)} ${cy - 8} H${x(178)}" stroke-width="1" stroke-dasharray="5 4" opacity="0.55"/>
    <path d="M${x(96)} ${cy + 22} H${x(190)} V${cy + 8}" stroke-width="0.9" opacity="0.65"/>
    <circle cx="${x(210)}" cy="${cy - 18}" r="2.8" fill="${accent}" stroke="none" opacity="0.95"/>
    <circle cx="${x(240)}" cy="${cy + 30}" r="2.2" fill="${accent}" stroke="none" opacity="0.85"/>
    <circle cx="${x(118)}" cy="${cy}" r="2" fill="${accent}" stroke="none" opacity="0.7"/>
    <rect x="${Math.min(x(82), x(96))}" y="${cy - 5}" width="14" height="5" fill="${accent}" opacity="0.55" stroke="none"/>
    <rect x="${Math.min(x(130), x(144))}" y="${cy + 16}" width="10" height="4" fill="${accent}" opacity="0.4" stroke="none"/>
    ${hatch}
  </g>`;
}

/** 梯形标题牌（云平台组织资源大屏风格） */
function trapezoidTitlePlaque(w, accent, filterId, yTop = 10, plateW = 500, plateH = 74) {
  const cx = w / 2;
  const taper = 42;
  const x0 = cx - plateW / 2;
  const x1 = cx + plateW / 2;
  const y0 = yTop;
  const y1 = yTop + plateH;
  const leftHatch = Array.from({ length: 6 }, (_, i) =>
    `<line x1="${x0 + taper - i * 5}" y1="${y0 + i * 6}" x2="${x0 + taper - i * 5 - 9}" y2="${y0 + i * 6 + 10}" stroke="${accent}" stroke-width="0.75" opacity="0.5"/>`,
  ).join("\n    ");
  const rightHatch = Array.from({ length: 6 }, (_, i) =>
    `<line x1="${x1 - taper + i * 5}" y1="${y0 + i * 6}" x2="${x1 - taper + i * 5 + 9}" y2="${y0 + i * 6 + 10}" stroke="${accent}" stroke-width="0.75" opacity="0.5"/>`,
  ).join("\n    ");
  return `<g filter="url(#${filterId})">
    <polygon points="${x0 + taper},${y0} ${x1 - taper},${y0} ${x1},${y1} ${x0},${y1}"
      fill="${accent}" fill-opacity="0.09" stroke="${accent}" stroke-width="1.8"/>
    ${leftHatch}
    ${rightHatch}
    <line x1="${cx - 28}" y1="${y1 - 5}" x2="${cx + 28}" y2="${y1 - 5}" stroke="#ffffff" stroke-width="2.2" opacity="0.92"/>
    <line x1="${cx - 12}" y1="${y1 - 5}" x2="${cx + 12}" y2="${y1 - 5}" stroke="${accent}" stroke-width="1" opacity="0.9"/>
  </g>`;
}

/** 云数据中心风格：平行四边形侧饰 + 底边发光线 */
function cloudCenterTitlePlaque(w, accent, filterId, yTop = 14, plateW = 460, plateH = 68) {
  const cx = w / 2;
  const x0 = cx - plateW / 2;
  const x1 = cx + plateW / 2;
  const y0 = yTop;
  const y1 = yTop + plateH;
  const skew = 18;
  return `<g filter="url(#${filterId})">
    <polygon points="${x0 + 24},${y0} ${x1 - 24},${y0} ${x1 - 8},${y1} ${x0 + 8},${y1}"
      fill="${accent}" fill-opacity="0.07" stroke="${accent}" stroke-width="1.5"/>
    <polygon points="${x0 - 6},${y0 + 18} ${x0 + skew},${y0 + 8} ${x0 + skew + 8},${y0 + 32} ${x0 + 2},${y0 + 42}"
      fill="${accent}" fill-opacity="0.22" stroke="${accent}" stroke-width="0.8" opacity="0.85"/>
    <polygon points="${x1 + 6},${y0 + 18} ${x1 - skew},${y0 + 8} ${x1 - skew - 8},${y0 + 32} ${x1 - 2},${y0 + 42}"
      fill="${accent}" fill-opacity="0.22" stroke="${accent}" stroke-width="0.8" opacity="0.85"/>
    <line x1="${cx - 220}" y1="${y1 - 2}" x2="${cx + 220}" y2="${y1 - 2}" stroke="${accent}" stroke-width="3.2" opacity="0.95"/>
    <line x1="${cx - 180}" y1="${y1 - 2}" x2="${cx + 180}" y2="${y1 - 2}" stroke="#ffffff" stroke-width="1" opacity="0.35"/>
  </g>`;
}

/** 简约发光标题牌 */
function glowPlaqueSimple(w, accent, filterId, yTop = 16, plateW = 420, plateH = 62) {
  const cx = w / 2;
  const x0 = cx - plateW / 2;
  const x1 = cx + plateW / 2;
  const y0 = yTop;
  const y1 = yTop + plateH;
  return `<g filter="url(#${filterId})">
    <rect x="${x0}" y="${y0}" width="${plateW}" height="${plateH}" fill="${accent}" fill-opacity="0.08" stroke="${accent}" stroke-width="1.4"/>
    <line x1="${x0 + 12}" y1="${y1}" x2="${x1 - 12}" y2="${y1}" stroke="${accent}" stroke-width="2.5" opacity="0.85"/>
    <line x1="${cx - 80}" y1="${y0 + 6}" x2="${cx + 80}" y2="${y0 + 6}" stroke="${accent}" stroke-width="0.8" opacity="0.35"/>
  </g>`;
}

/** 对标 DataEase workbranch 大屏顶栏（梯形 + 双侧电路翼） */
function deSciFiHeaderBand(w, accent, palette, filterId, variant = "de-trapezoid-wing", headerH = 100, { transparent = false } = {}) {
  const cy = headerH * 0.52;
  const wingGap = 248;
  const plaqueVariant = variant.replace(/^de-/, "");
  let plaque = trapezoidTitlePlaque(w, accent, filterId);
  if (plaqueVariant === "circuit-sym") plaque = cloudCenterTitlePlaque(w, accent, filterId);
  if (plaqueVariant === "glow-plaque") plaque = glowPlaqueSimple(w, accent, filterId);

  const hdrBgStops = transparent
    ? `<stop stop-color="${accent}" stop-opacity="0.1"/>
      <stop offset="0.55" stop-color="${palette.baseTo}" stop-opacity="0.04"/>
      <stop offset="1" stop-opacity="0"/>`
    : `<stop stop-color="${accent}" stop-opacity="0.16"/>
      <stop offset="0.55" stop-color="${palette.baseTo}" stop-opacity="0.08"/>
      <stop offset="1" stop-opacity="0"/>`;

  const hdrBgRect = transparent
    ? ""
    : `<rect width="${w}" height="${headerH}" fill="url(#${filterId}-hdr-bg)"/>`;

  return `<defs>
    ${deSciFiGlowDefs(filterId)}
    <linearGradient id="${filterId}-hdr-bg" x1="0" y1="0" x2="0" y2="1">
      ${hdrBgStops}
    </linearGradient>
  </defs>
  ${hdrBgRect}
  <line x1="0" y1="${headerH - 1}" x2="${w}" y2="${headerH - 1}" stroke="${accent}" stroke-width="1" opacity="0.4"/>
  <line x1="48" y1="${headerH - 1}" x2="${w - 48}" y2="${headerH - 1}" stroke="${accent}" stroke-width="2.5" opacity="0.12"/>
  ${circuitWingDecor(w / 2 - wingGap, cy, accent, filterId, "left")}
  ${circuitWingDecor(w / 2 + wingGap, cy, accent, filterId, "right")}
  ${plaque}
  ${renderMotif(palette.motif, w / 2, cy, 6, accent, 0.2)}`;
}

function deScreenContentFrame(w, h, accent, headerH = 100) {
  return `${cornerBrackets(20, headerH + 16, w - 40, h - headerH - 36, accent, 56, 2, 0.5)}
  ${sideRails(w, h, accent, 0.22)}
  <rect x="48" y="${headerH + 28}" width="${w - 96}" height="${h - headerH - 76}" fill="none" stroke="${accent}" stroke-width="0.6" opacity="0.12" rx="2"/>
  <line x1="48" y1="${headerH + 120}" x2="${w - 48}" y2="${headerH + 120}" stroke="${accent}" stroke-width="0.5" opacity="0.08"/>`;
}

function sideRails(w, h, accent, opacity = 0.2) {
  return `<rect x="0" y="80" width="3" height="${h - 160}" fill="${accent}" opacity="${opacity}"/>
  <rect x="${w - 3}" y="80" width="3" height="${h - 160}" fill="${accent}" opacity="${opacity}"/>
  <rect x="12" y="120" width="1" height="${h - 240}" fill="${accent}" opacity="${opacity * 0.5}"/>
  <rect x="${w - 13}" y="120" width="1" height="${h - 240}" fill="${accent}" opacity="${opacity * 0.5}"/>`;
}

function honeycombPattern(pid, accent, opacity = 0.12) {
  const r = 14;
  const h = r * Math.sqrt(3);
  return `<pattern id="${pid}" width="${r * 3}" height="${h * 2}" patternUnits="userSpaceOnUse">
    <path d="M${r} 0 L${r * 2} 0 L${r * 2.5} ${h * 0.5} L${r * 2} ${h} L${r} ${h} L${r * 0.5} ${h * 0.5} Z" fill="none" stroke="${accent}" stroke-width="0.6" opacity="${opacity}"/>
    <path d="M${r * 2.5} ${h * 1.5} L${r * 3.5} ${h * 1.5} L${r * 4} ${h * 2} L${r * 3.5} ${h * 2.5} L${r * 2.5} ${h * 2.5} L${r * 2} ${h * 2} Z" fill="none" stroke="${accent}" stroke-width="0.6" opacity="${opacity}"/>
  </pattern>`;
}

function circuitNetwork(w, h, accent, nodes = 18) {
  const pts = [];
  for (let i = 0; i < nodes; i++) {
    pts.push({ x: 80 + ((i * 173) % (w - 160)), y: 100 + ((i * 97) % (h - 200)) });
  }
  let lines = "";
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 3) % pts.length;
    if (i % 2 === 0) {
      lines += `<line x1="${pts[i].x}" y1="${pts[i].y}" x2="${pts[j].x}" y2="${pts[j].y}" stroke="${accent}" stroke-width="0.5" opacity="0.12"/>\n  `;
    }
  }
  const dots = pts.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="2" fill="${accent}" opacity="0.2"/>`).join("\n  ");
  return lines + dots;
}

function auroraWaves(w, h, accent, accent2) {
  return `<path d="M0 ${h * 0.82} C${w * 0.2} ${h * 0.76} ${w * 0.35} ${h * 0.9} ${w * 0.5} ${h * 0.84} C${w * 0.65} ${h * 0.78} ${w * 0.82} ${h * 0.92} ${w} ${h * 0.86} L${w} ${h} L0 ${h} Z" fill="${accent}" fill-opacity="0.08"/>
  <path d="M0 ${h * 0.88} C${w * 0.25} ${h * 0.82} ${w * 0.4} ${h * 0.96} ${w * 0.55} ${h * 0.9} C${w * 0.72} ${h * 0.84} ${w * 0.88} ${h * 0.98} ${w} ${h * 0.92} L${w} ${h} L0 ${h} Z" fill="${accent2 || accent}" fill-opacity="0.05"/>`;
}

function scanRing(cx, cy, r, accent) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${accent}" stroke-width="0.8" opacity="0.15"/>
  <circle cx="${cx}" cy="${cy}" r="${r * 0.65}" fill="none" stroke="${accent}" stroke-width="0.5" opacity="0.1" stroke-dasharray="4 6"/>
  <line x1="${cx - r}" y1="${cy}" x2="${cx + r}" y2="${cy}" stroke="${accent}" stroke-width="0.4" opacity="0.12"/>
  <line x1="${cx}" y1="${cy - r}" x2="${cx}" y2="${cy + r}" stroke="${accent}" stroke-width="0.4" opacity="0.12"/>`;
}

// ---------------------------------------------------------------------------
// Canvas builders
// ---------------------------------------------------------------------------

function defsBaseDark(palette, w, h, seed) {
  const id = stableId(seed);
  return {
    id,
    defs: `<defs>
    <linearGradient id="${id}-base" x1="0" y1="0" x2="${w}" y2="${h}">
      <stop stop-color="${palette.baseFrom}"/>
      <stop offset="0.5" stop-color="${palette.baseTo}" stop-opacity="0.95"/>
      <stop offset="1" stop-color="${palette.baseTo}"/>
    </linearGradient>
    <radialGradient id="${id}-glowL" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(${w * 0.18} ${h * 0.22}) scale(${w * 0.35})">
      <stop stop-color="${palette.glow}" stop-opacity="${palette.glowOpacity}"/>
      <stop offset="1" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${id}-glowR" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(${w * 0.82} ${h * 0.72}) scale(${w * 0.3})">
      <stop stop-color="${palette.accent}" stop-opacity="${palette.glowOpacity * 0.8}"/>
      <stop offset="1" stop-opacity="0"/>
    </radialGradient>
  </defs>`,
    baseFill: `url(#${id}-base)`,
    glowL: `url(#${id}-glowL)`,
    glowR: `url(#${id}-glowR)`,
    accent: palette.accent,
  };
}

function defsBaseLight(palette, w, h, seed) {
  const id = stableId(seed);
  return {
    id,
    defs: `<defs>
    <linearGradient id="${id}-base" x1="0" y1="0" x2="${w}" y2="${h}">
      <stop stop-color="${palette.baseFrom}"/>
      <stop offset="0.32" stop-color="${palette.baseMid}"/>
      <stop offset="0.68" stop-color="${palette.cardTint}"/>
      <stop offset="1" stop-color="${palette.baseTo}"/>
    </linearGradient>
    <radialGradient id="${id}-glowL" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(${w * 0.18} ${h * 0.22}) scale(${w * 0.38})">
      <stop stop-color="${palette.glow}" stop-opacity="${palette.glowOpacity}"/>
      <stop offset="0.55" stop-color="${palette.accentMuted}" stop-opacity="${palette.glowOpacity * 0.65}"/>
      <stop offset="1" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${id}-glowR" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(${w * 0.82} ${h * 0.72}) scale(${w * 0.32})">
      <stop stop-color="${palette.accent}" stop-opacity="${palette.glowOpacity * 0.85}"/>
      <stop offset="1" stop-opacity="0"/>
    </radialGradient>
  </defs>`,
    baseFill: `url(#${id}-base)`,
    glowL: `url(#${id}-glowL)`,
    glowR: `url(#${id}-glowR)`,
    accent: palette.accent,
  };
}

function scaleLightSvgOpacities(svg) {
  const scale = (value) => {
    const n = Number(value);
    if (Number.isNaN(n)) return value;
    const boosted = n < 0.12 ? n * 2.8 : n < 0.28 ? n * 2.1 : n < 0.5 ? n * 1.55 : n * 1.2;
    return Math.min(boosted, 0.9).toFixed(2);
  };
  return svg
    .replace(/opacity="([0-9.]+)"/g, (_, v) => `opacity="${scale(v)}"`)
    .replace(/stop-opacity="([0-9.]+)"/g, (_, v) => `stop-opacity="${scale(v)}"`)
    .replace(/fill-opacity="([0-9.]+)"/g, (_, v) => `fill-opacity="${scale(v)}"`);
}

function patternBody(pattern, palette, accent, w, h, id, { light = false } = {}) {
  const layer = darkPatternBody(pattern, palette, accent, w, h, id);
  if (!light) return layer;
  return {
    extraDefs: layer.extraDefs ? scaleLightSvgOpacities(layer.extraDefs) : layer.extraDefs,
    body: scaleLightSvgOpacities(layer.body),
  };
}

function darkPatternBody(pattern, palette, accent, w, h, id) {
  const pid = `${id}-pat`;
  const motif = palette.motif;
  switch (pattern) {
    case "command":
      return {
        extraDefs: honeycombPattern(pid, accent, 0.08),
        body: `${headerBar(w, accent, palette, id, true)}
  ${cornerBrackets(24, 24, w - 48, h - 48, accent, 64, 2.5, 0.6)}
  ${sideRails(w, h, accent)}
  <rect y="72" width="${w}" height="${h - 72}" fill="url(#${pid})"/>
  ${renderMotif(motif, w / 2, h * 0.48, 80, accent, 0.12)}
  ${Array.from({ length: 4 }, (_, i) => renderMotif(motif, [120, w - 120, 120, w - 120][i], [160, 160, h - 120, h - 120][i], 18, accent, 0.25)).join("\n  ")}`,
      };
    case "aurora":
      return {
        extraDefs: `<pattern id="${pid}" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" stroke="${accent}" stroke-width="0.4" opacity="0.08"/></pattern>`,
        body: `<rect width="${w}" height="${h}" fill="url(#${pid})" opacity="0.6"/>
  ${cornerBrackets(32, 32, w - 64, h - 64, accent, 40, 1.5, 0.35)}
  ${auroraWaves(w, h, accent, palette.glow)}
  ${renderMotif(motif, w * 0.5, h * 0.18, 24, accent, 0.4)}
  ${iconOrbit(w * 0.5, h * 0.45, 120, accent, 0.08)}`,
      };
    case "honeycomb":
      return {
        extraDefs: honeycombPattern(pid, accent, 0.18),
        body: `<rect width="${w}" height="${h}" fill="url(#${pid})"/>
  ${cornerBrackets(20, 20, w - 40, h - 40, accent, 36, 1.5, 0.45)}
  ${Array.from({ length: 5 }, (_, i) => iconHex(200 + i * 340, 90, 14, accent, 0.3)).join("\n  ")}
  ${renderMotif(motif, w / 2, h / 2, 100, accent, 0.08)}`,
      };
    case "circuit":
      return {
        extraDefs: "",
        body: `${circuitNetwork(w, h, accent, 22)}
  ${cornerBrackets(28, 28, w - 56, h - 56, accent, 52, 2, 0.5)}
  ${headerBar(w, accent, palette, id, false)}
  ${renderMotif(motif, w - 100, 100, 22, accent, 0.35)}
  ${renderMotif(motif, 100, h - 80, 22, accent, 0.35)}`,
      };
    case "hud-scan":
      return {
        extraDefs: `<pattern id="${pid}" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M64 0H0V64" stroke="${accent}" stroke-width="0.5" opacity="0.1"/></pattern>`,
        body: `<rect width="${w}" height="${h}" fill="url(#${pid})"/>
  ${scanRing(w / 2, h * 0.46, 200, accent)}
  ${scanRing(w / 2, h * 0.46, 320, accent)}
  ${cornerBrackets(16, 16, w - 32, h - 32, accent, 72, 3, 0.65)}
  <circle cx="${w / 2}" cy="${h * 0.46}" r="4" fill="${accent}" opacity="0.5"/>
  ${sideRails(w, h, accent, 0.25)}`,
      };
    case "topbar-icons":
      return {
        extraDefs: "",
        body: `${headerBar(w, accent, palette, id, true)}
  ${cornerBrackets(40, 88, w - 80, h - 128, accent, 32, 1.5, 0.4)}
  <rect x="60" y="100" width="${w - 120}" height="${h - 160}" fill="none" stroke="${accent}" stroke-width="0.5" opacity="0.15" rx="2"/>
  ${renderMotif(motif, w / 2, h * 0.52, 60, accent, 0.1)}
  ${Array.from({ length: 3 }, (_, i) => renderMotif(["hex", "diamond", "shield"][i], 80 + i * 40, h - 60, 12, accent, 0.3)).join("\n  ")}`,
      };
    case "gradient-mesh":
      return {
        extraDefs: `<radialGradient id="${pid}" cx="28%" cy="18%" r="55%"><stop stop-color="${accent}" stop-opacity="0.18"/><stop offset="1" stop-opacity="0"/></radialGradient>
  <radialGradient id="${pid}b" cx="78%" cy="82%" r="50%"><stop stop-color="${palette.glow}" stop-opacity="0.14"/><stop offset="1" stop-opacity="0"/></radialGradient>`,
        body: `<rect width="${w}" height="${h}" fill="url(#${pid})"/>
  <rect width="${w}" height="${h}" fill="url(#${pid}b)"/>
  ${cornerBrackets(24, 24, w - 48, h - 48, accent, 48, 2, 0.45)}
  ${auroraWaves(w, h, accent, palette.glow)}`,
      };
    case "radial-pulse":
      return {
        extraDefs: "",
        body: `${scanRing(w / 2, h * 0.48, 160, accent)}
  ${scanRing(w / 2, h * 0.48, 260, accent)}
  ${scanRing(w / 2, h * 0.48, 360, accent)}
  ${cornerBrackets(20, 20, w - 40, h - 40, accent, 40, 1.5, 0.4)}
  ${renderMotif(motif, w / 2, h * 0.48, 72, accent, 0.1)}`,
      };
    case "de-platform-header":
      return {
        extraDefs: deSciFiGlowDefs(`${id}-de`),
        body: `${deSciFiHeaderBand(w, accent, palette, `${id}-de`, "de-trapezoid-wing", 100)}
  ${deScreenContentFrame(w, h, accent, 100)}
  ${circuitNetwork(w, h, accent, 14)}
  ${renderMotif(motif, w / 2, h * 0.55, 90, accent, 0.08)}`,
      };
    case "de-circuit-wing":
      return {
        extraDefs: deSciFiGlowDefs(`${id}-de`),
        body: `${deSciFiHeaderBand(w, accent, palette, `${id}-de`, "de-trapezoid-wing", 104)}
  ${deScreenContentFrame(w, h, accent, 104)}
  ${circuitNetwork(w, h, accent, 26)}
  ${Array.from({ length: 3 }, (_, i) => renderMotif(motif, 180 + i * 520, h * 0.38, 20, accent, 0.22)).join("\n  ")}`,
      };
    case "de-cloud-center":
      return {
        extraDefs: deSciFiGlowDefs(`${id}-de`),
        body: `${deSciFiHeaderBand(w, accent, palette, `${id}-de`, "de-circuit-sym", 100)}
  ${deScreenContentFrame(w, h, accent, 100)}
  ${auroraWaves(w, h, accent, palette.glow)}
  ${renderMotif(motif, w / 2, h * 0.62, 64, accent, 0.1)}`,
      };
    default:
      return {
        extraDefs: "",
        body: `${headerBar(w, accent, palette, id, true)}
  ${cornerBrackets(40, 88, w - 80, h - 128, accent, 32, 1.5, 0.4)}`,
      };
  }
}

function buildCanvasSvg(palette, pattern, mode, paletteName, w = 1920, h = 1080) {
  const seed = `${mode}-${paletteName}-${pattern}`;
  if (mode === "dark") {
    const base = defsBaseDark(palette, w, h, seed);
    const layer = patternBody(pattern, palette, base.accent, w, h, base.id);
    const defs = layer.extraDefs
      ? base.defs.replace("</defs>", `${layer.extraDefs}\n  </defs>`)
      : base.defs;
    return `${svgHeader(w, h)}
  ${defs}
  <rect width="${w}" height="${h}" fill="${base.baseFill}"/>
  <rect width="${w}" height="${h}" fill="${base.glowL}"/>
  <rect width="${w}" height="${h}" fill="${base.glowR}"/>
  ${layer.body}
</svg>`;
  }
  const base = defsBaseLight(palette, w, h, seed);
  const layer = patternBody(pattern, palette, base.accent, w, h, base.id, { light: true });
  const defs = layer.extraDefs
    ? base.defs.replace("</defs>", `${layer.extraDefs}\n  </defs>`)
    : base.defs;
  return `${svgHeader(w, h)}
  ${defs}
  <rect width="${w}" height="${h}" fill="${base.baseFill}"/>
  <rect width="${w}" height="${h}" fill="${base.glowL}"/>
  <rect width="${w}" height="${h}" fill="${base.glowR}"/>
  ${layer.body}
</svg>`;
}

// ---------------------------------------------------------------------------
// Panel & title strip (with icons)
// ---------------------------------------------------------------------------

function buildPanelSvg(style, colorKey, w = 800, h = 480) {
  const palette = DARK_PALETTES[colorKey];
  const accent = palette.accent;
  const bg = palette.baseFrom;
  const id = stableId(`panel-${style}-${colorKey}`);
  const motif = palette.motif;

  let body = "";
  switch (style) {
    case "de-frame":
      body = `<rect width="${w}" height="${h}" fill="${bg}" fill-opacity="0.88"/>
  <path d="M16 8 H${w - 16} L${w - 8} 16 V${h - 16} L${w - 16} ${h - 8} H16 L8 ${h - 16} V16 Z" fill="none" stroke="${accent}" stroke-width="1.5" opacity="0.7"/>
  <path d="M32 20 H${w - 48} V32 H48 V${h - 48} H${w - 48} V${h - 32} H32 V20 Z" fill="none" stroke="${accent}" stroke-width="0.6" opacity="0.25"/>
  ${cornerBrackets(8, 8, w - 16, h - 16, accent, 28, 2, 0.8)}
  ${renderMotif(motif, 44, 28, 12, accent, 0.5)}
  <rect x="68" y="16" width="120" height="24" fill="${accent}" fill-opacity="0.08" rx="2"/>`;
      break;
    case "hud-bracket":
      body = `<rect width="${w}" height="${h}" fill="${bg}" fill-opacity="0.82"/>
  ${cornerBrackets(4, 4, w - 8, h - 8, accent, 56, 3, 0.85)}
  <circle cx="32" cy="32" r="3" fill="${accent}" opacity="0.7"/>
  <circle cx="${w - 32}" cy="32" r="3" fill="${accent}" opacity="0.7"/>
  <circle cx="32" cy="${h - 32}" r="3" fill="${accent}" opacity="0.7"/>
  <circle cx="${w - 32}" cy="${h - 32}" r="3" fill="${accent}" opacity="0.7"/>
  ${scanRing(w / 2, h / 2, Math.min(w, h) * 0.35, accent)}
  ${renderMotif(motif, w / 2, h / 2, 28, accent, 0.15)}`;
      break;
    case "badge-header":
      body = `<rect width="${w}" height="${h}" fill="${bg}" fill-opacity="0.9"/>
  <rect width="${w}" height="48" fill="${accent}" fill-opacity="0.12"/>
  <line x1="0" y1="48" x2="${w}" y2="48" stroke="${accent}" stroke-width="1" opacity="0.4"/>
  ${renderMotif(motif, 36, 24, 16, accent, 0.55)}
  ${renderMotif("diamond", w - 36, 24, 10, accent, 0.35)}
  <rect x="1" y="1" width="${w - 2}" height="${h - 2}" fill="none" stroke="${accent}" stroke-width="0.8" opacity="0.3"/>`;
      break;
    case "tech-rail":
    default:
      body = `<rect width="${w}" height="${h}" fill="${bg}" fill-opacity="0.85"/>
  <rect x="0" y="0" width="8" height="${h}" fill="${accent}" opacity="0.35"/>
  <rect x="12" y="24" width="2" height="${h - 48}" fill="${accent}" opacity="0.15"/>
  <rect x="${w - 8}" y="0" width="8" height="${h}" fill="${accent}" opacity="0.2"/>
  ${Array.from({ length: 5 }, (_, i) => `<circle cx="4" cy="${80 + i * 70}" r="2" fill="${accent}" opacity="0.5"/>`).join("\n  ")}
  ${cornerBrackets(20, 20, w - 40, h - 40, accent, 24, 1.5, 0.45)}
  ${renderMotif(motif, w - 48, h - 40, 14, accent, 0.4)}`;
      break;
  }

  return `${svgHeader(w, h, "none meet")}
  <defs>
    <linearGradient id="${id}-fade" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="${palette.baseTo}" stop-opacity="0.25"/>
      <stop offset="1" stop-opacity="0"/>
    </linearGradient>
  </defs>
  ${body}
  <rect width="${w}" height="${h}" fill="url(#${id}-fade)" pointer-events="none"/>
</svg>`;
}

function buildScreenHeaderSvg(style, colorKey, w = 1920, h = 100, { transparent = false } = {}) {
  const palette = DARK_PALETTES[colorKey];
  const accent = palette.accent;
  const bg = palette.baseFrom;
  const filterId = stableId(`screen-header-${style}-${colorKey}${transparent ? "-clear" : ""}`);
  const band = deSciFiHeaderBand(w, accent, palette, filterId, style, h, { transparent });
  const opaqueBg = transparent
    ? ""
    : `<rect width="${w}" height="${h}" fill="${bg}" fill-opacity="0.92"/>`;
  return `${svgHeader(w, h, "none meet")}
  ${opaqueBg}
  ${band}
</svg>`;
}

function buildTitleStripSvg(style, colorKey, w = 720, h = 64, { transparent = false } = {}) {
  const palette = DARK_PALETTES[colorKey];
  const accent = palette.accent;
  const bg = palette.baseFrom;
  const motif = palette.motif;
  const opaqueBg = transparent
    ? ""
    : `<rect width="${w}" height="${h}" fill="${bg}" fill-opacity="0.82"/>`;

  let body = "";
  switch (style) {
    case "diamond-flank":
      body = `${opaqueBg}
  <defs>
    <linearGradient id="fade-l" x1="0" y1="0" x2="1" y2="0"><stop stop-color="${accent}" stop-opacity="0"/><stop offset="1" stop-color="${accent}" stop-opacity="0.55"/></linearGradient>
    <linearGradient id="fade-r" x1="1" y1="0" x2="0" y2="0"><stop stop-color="${accent}" stop-opacity="0"/><stop offset="1" stop-color="${accent}" stop-opacity="0.55"/></linearGradient>
  </defs>
  ${iconDiamond(36, h / 2, 12, accent, 0.55)}
  ${iconDiamond(w - 36, h / 2, 12, accent, 0.55)}
  <rect x="72" y="${h / 2 - 0.5}" width="160" height="1" fill="url(#fade-l)"/>
  <rect x="${w - 232}" y="${h / 2 - 0.5}" width="160" height="1" fill="url(#fade-r)"/>
  <rect x="${w / 2 - 100}" y="10" width="200" height="${h - 20}" fill="${accent}" fill-opacity="0.06" rx="2"/>
  ${renderMotif(motif, w / 2, h / 2, 8, accent, 0.45)}`;
      break;
    case "shield-badge":
      body = `${opaqueBg}
  ${iconShield(32, h / 2, 18, accent, 0.6)}
  <rect x="56" y="8" width="4" height="${h - 16}" fill="${accent}" opacity="0.5"/>
  <line x1="72" y1="${h / 2}" x2="${w - 24}" y2="${h / 2}" stroke="${accent}" stroke-width="1" opacity="0.35"/>
  ${renderMotif(motif, w - 36, h / 2, 10, accent, 0.4)}`;
      break;
    case "hex-nodes":
    default:
      body = `${opaqueBg}
  ${iconHex(28, h / 2, 14, accent, 0.5)}
  ${iconHex(w - 28, h / 2, 14, accent, 0.5)}
  ${iconChevron(w / 2 - 120, h / 2, 10, accent, 0.4)}
  ${iconChevron(w / 2 + 120, h / 2, 10, accent, 0.4, true)}
  <line x1="56" y1="${h / 2}" x2="${w / 2 - 130}" y2="${h / 2}" stroke="${accent}" stroke-width="1" opacity="0.3"/>
  <line x1="${w / 2 + 130}" y1="${h / 2}" x2="${w - 56}" y2="${h / 2}" stroke="${accent}" stroke-width="1" opacity="0.3"/>
  <rect x="${w / 2 - 90}" y="12" width="180" height="${h - 24}" fill="${accent}" fill-opacity="0.07" rx="2"/>`;
      break;
  }

  return `${svgHeader(w, h, "none meet")}${body}</svg>`;
}

function buildThumbSvg(svgContent, tw = 320, th = 180, { darkBackdrop = false } = {}) {
  const viewMatch = svgContent.match(/viewBox="0 0 (\d+) (\d+)"/);
  const vw = viewMatch ? Number(viewMatch[1]) : 1920;
  const vh = viewMatch ? Number(viewMatch[2]) : 1080;
  const inner = svgContent.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  const backdrop = darkBackdrop
    ? `<rect width="${tw}" height="${th}" fill="#0f172a"/>`
    : "";
  return `${svgHeader(tw, th)}
  ${backdrop}
  <g transform="scale(${tw / vw} ${th / vh})">
  ${inner}
  </g>
</svg>`;
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(relPath, content) {
  const full = path.join(PACK_ROOT, relPath);
  ensureDir(path.dirname(full));
  fs.writeFileSync(full, content, "utf8");
  return full;
}

function cleanOutputDirs() {
  const subdirs = ["backgrounds/dark", "backgrounds/light", "panels", "title-strips", "screen-headers", "top-decor-clear", "thumbs"];
  for (const sub of subdirs) {
    const full = path.join(PACK_ROOT, sub);
    if (fs.existsSync(full)) {
      for (const file of fs.readdirSync(full)) {
        fs.unlinkSync(path.join(full, file));
      }
    }
  }
}

function generate() {
  ensureDir(PACK_ROOT);
  cleanOutputDirs();

  const items = [];
  const generatedAt = new Date().toISOString().slice(0, 10);

  for (const [paletteName, palette] of Object.entries(DARK_PALETTES)) {
    for (const pattern of DARK_PATTERNS) {
      const id = `canvas-dark-${paletteName}-${pattern}`;
      const rel = `backgrounds/dark/${id}.svg`;
      const svg = buildCanvasSvg(palette, pattern, "dark", paletteName);
      writeFile(rel, svg);
      items.push({
        id,
        category: "canvas-dark",
        path: `${PUBLIC_PREFIX}/${rel.replace(/\\/g, "/")}`,
        palette: paletteName,
        pattern,
        motif: palette.motif,
        tags: ["dark", "command-center", pattern, palette.motif],
      });
    }
  }

  for (const [paletteName, palette] of Object.entries(LIGHT_PALETTES)) {
    for (const pattern of CANVAS_PATTERNS) {
      const id = `canvas-light-${paletteName}-${pattern}`;
      const rel = `backgrounds/light/${id}.svg`;
      const svg = buildCanvasSvg(palette, pattern, "light", paletteName);
      writeFile(rel, svg);
      items.push({
        id,
        category: "canvas-light",
        path: `${PUBLIC_PREFIX}/${rel.replace(/\\/g, "/")}`,
        palette: paletteName,
        pattern,
        motif: palette.motif,
        tags: ["light", "report", pattern, palette.motif],
      });
    }
  }

  for (const style of PANEL_STYLES) {
    for (const color of PANEL_COLORS) {
      const id = `panel-${style}-${color}`;
      const rel = `panels/${id}.svg`;
      const svg = buildPanelSvg(style, color);
      writeFile(rel, svg);
      items.push({
        id,
        category: "component-panel",
        path: `${PUBLIC_PREFIX}/${rel.replace(/\\/g, "/")}`,
        palette: color,
        style,
        motif: DARK_PALETTES[color].motif,
        tags: ["panel", "component", style],
      });
    }
  }

  for (const style of TITLE_STYLES) {
    for (const color of TITLE_COLORS) {
      const id = `title-${style}-${color}`;
      const rel = `title-strips/${id}.svg`;
      const svg = buildTitleStripSvg(style, color);
      writeFile(rel, svg);
      items.push({
        id,
        category: "title-strip",
        path: `${PUBLIC_PREFIX}/${rel.replace(/\\/g, "/")}`,
        palette: color,
        style,
        motif: DARK_PALETTES[color].motif,
        tags: ["title", "header", style],
      });

      const idClear = `title-clear-${style}-${color}`;
      const relClear = `top-decor-clear/${idClear}.svg`;
      const svgClear = buildTitleStripSvg(style, color, 720, 64, { transparent: true });
      writeFile(relClear, svgClear);
      items.push({
        id: idClear,
        category: "top-decor-clear",
        path: `${PUBLIC_PREFIX}/${relClear.replace(/\\/g, "/")}`,
        palette: color,
        style,
        motif: DARK_PALETTES[color].motif,
        tags: ["title", "header", style, "transparent"],
      });
    }
  }

  for (const style of SCREEN_HEADER_STYLES) {
    for (const color of TITLE_COLORS) {
      const id = `screen-header-${style}-${color}`;
      const rel = `screen-headers/${id}.svg`;
      const svg = buildScreenHeaderSvg(style, color);
      writeFile(rel, svg);
      items.push({
        id,
        category: "screen-header",
        path: `${PUBLIC_PREFIX}/${rel.replace(/\\/g, "/")}`,
        palette: color,
        style,
        motif: DARK_PALETTES[color].motif,
        tags: ["screen-header", "de-style", style],
      });

      const idClear = `screen-header-clear-${style}-${color}`;
      const relClear = `top-decor-clear/${idClear}.svg`;
      const svgClear = buildScreenHeaderSvg(style, color, 1920, 100, { transparent: true });
      writeFile(relClear, svgClear);
      items.push({
        id: idClear,
        category: "top-decor-clear",
        path: `${PUBLIC_PREFIX}/${relClear.replace(/\\/g, "/")}`,
        palette: color,
        style,
        motif: DARK_PALETTES[color].motif,
        tags: ["screen-header", "de-style", style, "transparent"],
      });
    }
  }

  for (const item of items.filter((i) => i.category.startsWith("canvas-"))) {
    const rel = item.path.replace(PUBLIC_PREFIX + "/", "");
    const svg = fs.readFileSync(path.join(PACK_ROOT, rel), "utf8");
    writeFile(`thumbs/${item.id}.svg`, buildThumbSvg(svg));
  }

  for (const item of items.filter((i) => i.category === "top-decor-clear")) {
    const rel = item.path.replace(PUBLIC_PREFIX + "/", "");
    const svg = fs.readFileSync(path.join(PACK_ROOT, rel), "utf8");
    const viewMatch = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
    const vw = viewMatch ? Number(viewMatch[1]) : 720;
    const vh = viewMatch ? Number(viewMatch[2]) : 64;
    const tw = 320;
    const th = Math.max(72, Math.round((tw * vh) / vw));
    writeFile(`thumbs/${item.id}.svg`, buildThumbSvg(svg, tw, th, { darkBackdrop: true }));
  }

  const categories = {
    "canvas-dark": { count: items.filter((i) => i.category === "canvas-dark").length, defaultSize: [1920, 1080] },
    "canvas-light": { count: items.filter((i) => i.category === "canvas-light").length, defaultSize: [1920, 1080] },
    "component-panel": { count: items.filter((i) => i.category === "component-panel").length, defaultSize: [800, 480] },
    "title-strip": { count: items.filter((i) => i.category === "title-strip").length, defaultSize: [720, 64] },
    "screen-header": { count: items.filter((i) => i.category === "screen-header").length, defaultSize: [1920, 100] },
    "top-decor-clear": { count: items.filter((i) => i.category === "top-decor-clear").length, defaultSize: [1920, 100] },
  };

  const manifest = {
    id: PACK_ID,
    version: 6,
    generatedAt,
    total: items.length,
    categories,
    items,
  };

  writeFile("manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);

  const readme = `# 政企风模板素材包 \`${PACK_ID}\`

> 由 \`npm run generate:gov-assets\` 自动生成，请勿手改 SVG（可改脚本后重新生成）。

## 统计

| 类别 | 数量 | 尺寸 | 用途 |
|------|------|------|------|
| canvas-dark | ${categories["canvas-dark"].count} | 1920×1080 | 数据大屏整体背景 |
| canvas-light | ${categories["canvas-light"].count} | 1920×1080 | 看板/报表浅色背景 |
| component-panel | ${categories["component-panel"].count} | 800×480 | 组件卡片底图（可拉伸） |
| title-strip | ${categories["title-strip"].count} | 720×64 | 标题装饰条（半透明底） |
| screen-header | ${categories["screen-header"].count} | 1920×100 | 大屏顶栏（DE 梯形+电路翼） |
| top-decor-clear | ${categories["top-decor-clear"].count} | 720×64 / 1920×100 | **透明底**顶部装饰（叠加大屏画布） |
| **合计** | **${items.length}** | | |

## 视觉特性（v5）

- **screen-header / de-platform-header**：对标 DataEase workbranch 大屏顶栏——梯形标题牌、双侧电路翼、霓虹发光
- 深色 canvas 新增 \`de-platform-header\` / \`de-circuit-wing\` / \`de-cloud-center\` 整屏背景
- 政务模板默认 **clean-header**：浅灰底 + 顶栏细线，无图标/纹理
- 浅色 **pattern**：clean-header / header-band / card-float / watermark / corner-fold / dot-matrix / ribbon
- 深色 canvas 仍保留供选用，内置模板已切换为浅色

## 命名规则

- \`canvas-dark-{palette}-{pattern}.svg\`
- \`canvas-light-{palette}-{pattern}.svg\`
- \`panel-{style}-{color}.svg\`
- \`title-{style}-{color}.svg\`
- \`screen-header-{style}-{color}.svg\`

## 引用方式

\`\`\`python
# presets_gov_screens.py
bg_image="/template-assets/packs/gov-enterprise-v1/backgrounds/dark/canvas-dark-cyan-command.svg"
\`\`\`

\`\`\`typescript
canvasBackgroundImage: "/template-assets/packs/gov-enterprise-v1/backgrounds/dark/canvas-dark-indigo-hud-scan.svg"
\`\`\`

## 重新生成

\`\`\`bash
cd fe && npm run generate:gov-assets
\`\`\`
`;

  writeFile("README.md", readme);
  return { items, categories, manifest };
}

function verify(manifest) {
  const errors = [];
  if (manifest.total < 200) errors.push(`total ${manifest.total} < 200`);
  for (const [cat, meta] of Object.entries(manifest.categories)) {
    const actual = manifest.items.filter((i) => i.category === cat).length;
    if (actual !== meta.count) errors.push(`${cat}: expected ${meta.count}, got ${actual}`);
  }
  for (const item of manifest.items) {
    const rel = item.path.replace(PUBLIC_PREFIX + "/", "");
    const full = path.join(PACK_ROOT, rel);
    if (!fs.existsSync(full)) errors.push(`missing file: ${rel}`);
    else {
      const size = fs.statSync(full).size;
      if (size > 80 * 1024) errors.push(`oversized: ${rel} (${size} bytes)`);
      const content = fs.readFileSync(full, "utf8");
      if (!content.includes("viewBox")) errors.push(`no viewBox: ${rel}`);
    }
  }
  return errors;
}

const { manifest } = generate();
const errors = verify(manifest);

console.log(`Generated ${manifest.total} assets in ${PACK_ROOT}`);
for (const [cat, meta] of Object.entries(manifest.categories)) {
  console.log(`  ${cat}: ${meta.count}`);
}
console.log(`  thumbs: ${manifest.items.filter((i) => i.category.startsWith("canvas-")).length}`);

if (errors.length) {
  console.error("Verification failed:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log("Verification passed.");
