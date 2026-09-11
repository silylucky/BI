#!/usr/bin/env node
/**
 * Rebuild goal.json from theme07 defaultProps + minimal text patches.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DASHI_PROJECT = path.resolve(
  __dirname,
  "../../../.agents/skills/dashiai-ppt/project"
);
const metadataUrl = pathToFileURL(
  path.join(DASHI_PROJECT, "src/components/themes/theme07/metadata.js")
).href;
const { pages } = await import(metadataUrl);
const pageMap = new Map(pages.map((p) => [p.key, p]));

// 36 unique layouts — text/chapter/quote/compliance 优先，无媒体槽
const LAYOUTS = [
  "theme07_page003",
  "theme07_page015",
  "theme07_page007",
  "theme07_page048",
  "theme07_page059",
  "theme07_page016",
  "theme07_page026",
  "theme07_page008",
  "theme07_page068",
  "theme07_page009",
  "theme07_page006",
  "theme07_page051",
  "theme07_page025",
  "theme07_page032",
  "theme07_page070",
  "theme07_page065",
  "theme07_page047",
  "theme07_page066",
  "theme07_page042",
  "theme07_page044",
  "theme07_page061",
  "theme07_page057",
  "theme07_page058",
  "theme07_page036",
  "theme07_page027",
  "theme07_page013",
  "theme07_page063",
  "theme07_page035",
  "theme07_page024",
  "theme07_page031",
  "theme07_page033",
  "theme07_page064",
  "theme07_page041",
  "theme07_page040",
  "theme07_page067",
  "theme07_page069",
];

function parseSlidesMd(md) {
  const parts = md.split(/^##\s+(P\d+)\s*·\s*(.+)$/m);
  const map = {};
  for (let i = 1; i < parts.length; i += 3) {
    const id = parts[i].toUpperCase();
    const title = (parts[i + 1] || "").trim();
    let body = (parts[i + 2] || "").trim();
    const meta = {};
    for (const key of ["kicker", "lead"]) {
      const m = body.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
      if (m) {
        meta[key] = m[1].trim();
        body = body.replace(m[0], "").trim();
      }
    }
    map[id] = { title, body, ...meta };
  }
  return map;
}

function clip(s, max) {
  if (s == null || max == null) return s ?? "";
  const t = String(s).replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
  return t.length <= max ? t : t.slice(0, Math.max(0, max - 1)) + "…";
}

function bullets(body) {
  return body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[-*•\d]/.test(l))
    .map((l) =>
      l
        .replace(/^[-*•]\s*/, "")
        .replace(/^\d+\.\s*/, "")
        .replace(/\*\*/g, "")
        .trim()
    )
    .filter(Boolean);
}

function tableRows(body) {
  const rows = [];
  for (const line of body.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("|") || t.includes("---")) continue;
    const cols = t
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
    if (cols.length >= 2 && !/^(维度|困境|角色|场景|关切|文档|步骤)/.test(cols[0])) {
      rows.push(cols);
    }
  }
  return rows;
}

function numbered(body) {
  const out = [];
  for (const line of body.split("\n")) {
    const m = line.match(/^\d+\.\s+\*\*(.+?)\*\*\s*[—\-]?\s*(.*)$/);
    if (m) out.push({ title: m[1].trim(), note: m[2].trim() });
  }
  return out;
}

function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}

function walkStrings(obj, fn) {
  if (typeof obj === "string") return fn(obj);
  if (Array.isArray(obj)) return obj.map((x) => walkStrings(x, fn));
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = walkStrings(v, fn);
    return out;
  }
  return obj;
}

function patchTextFields(props, slide, idx) {
  const { title, kicker, lead, body } = slide;
  const b = bullets(body);
  const rows = tableRows(body);
  const steps = numbered(body);
  const shortLead = clip(lead || b[0] || title, 48);

  if (typeof props.eyebrow === "string") props.eyebrow = clip(kicker || "VitalSpan", 18);
  if (typeof props.kicker === "string") props.kicker = clip(kicker || title, 18);
  if (typeof props.logo === "string") props.logo = "VitalSpan";
  if (typeof props.phase === "string") props.phase = clip(kicker || "白皮书", 18);
  if (typeof props.title === "string") props.title = clip(title, 18);
  if (typeof props.titleL1 === "string") props.titleL1 = clip(title.split(/[·:]/)[0] || "VitalSpan", 18);
  if (typeof props.titleL2 === "string") props.titleL2 = clip(title.split(/[·:]/)[1] || "自研 BI 平台", 18);
  if (typeof props.sub === "string") props.sub = clip(shortLead, 36);
  if (typeof props.lead === "string") props.lead = clip(b[1] || shortLead, 48);
  if (typeof props.closing === "string")
    props.closing = clip(b.at(-1) || "详见正文", 22);
  if (typeof props.slogan === "string") props.slogan = clip("数据留在内网，分析触手可及", 24);
  if (typeof props.index === "string") props.index = String(idx).padStart(2, "0");
  if (typeof props.source === "string") props.source = clip("依据：产品目标与 PRD", 42);
  if (typeof props.tagline === "string") props.tagline = clip("让数据留在内网，让分析触手可及", 38);

  if (Array.isArray(props.lead)) {
    const items = b.length ? b : [shortLead, title, kicker || "VitalSpan"];
    props.lead = props.lead.map((_, i) => clip(items[i] || items[i % items.length], 36));
  }

  if (Array.isArray(props.crumbs)) {
    props.crumbs = ["BI", "白皮书", "VitalSpan"].map((s, i) => clip(s, 18));
  }

  if (Array.isArray(props.chapters) && props.chapters[0]?.zh) {
    const items = b.length ? b.slice(0, props.chapters.length) : props.chapters.map((c) => c.zh);
    props.chapters = props.chapters.map((ch, i) => ({
      ...ch,
      no: String(i + 1).padStart(2, "0"),
      zh: clip((items[i] || ch.zh).replace(/^\d+\.\s*/, "").split("—")[0], 8),
    }));
    if (props.cardCount != null) props.cardCount = props.chapters.length;
  }

  if (Array.isArray(props.conclusions) && props.conclusions[0]?.title) {
    const src = rows.length >= 3 ? rows : b;
    props.conclusions = props.conclusions.map((c, i) => ({
      ...c,
      idx: String(i + 1).padStart(2, "0"),
      title: clip(Array.isArray(src[i]) ? src[i][0] : (src[i] || c.title).split("—")[0], 18),
      note: clip(Array.isArray(src[i]) ? src[i][1] || src[i][0] : src[i] || c.note, 36),
    }));
    if (props.itemCount != null) props.itemCount = props.conclusions.length;
    if (props.conclusionCount != null) props.conclusionCount = props.conclusions.length;
  }

  if (typeof props.quoteLead === "string") {
    props.quoteLead = clip("政企数据团队需要", 18);
    if (typeof props.quoteEm1 === "string") props.quoteEm1 = clip("自研可控", 18);
    if (typeof props.quoteMid === "string") props.quoteMid = clip("的 BI", 18);
    if (typeof props.quoteEm2 === "string") props.quoteEm2 = clip("分析平台", 18);
    if (typeof props.quoteEm === "string") props.quoteEm = clip("POC 演示", 18);
    if (typeof props.quoteTail === "string") props.quoteTail = clip("。", 18);
  }

  if (Array.isArray(props.keywords)) {
    const kw = b.slice(0, props.keywords.length);
    props.keywords = props.keywords.map((k, i) => clip(kw[i] || k, 18));
    if (props.keywordCount != null) props.keywordCount = props.keywords.length;
  }

  if (Array.isArray(props.layers) && props.layers[0]?.zh) {
    const items = steps.length ? steps : b;
    props.layers = props.layers.map((layer, i) => ({
      ...layer,
      zh: clip(items[i]?.title || layer.zh, 8),
      desc: clip(items[i]?.note || items[i]?.title || layer.desc, 36),
    }));
    if (props.cardCount != null) props.cardCount = props.layers.length;
  }

  if (Array.isArray(props.rows) && props.rows[0]?.dim) {
    const src = rows.length ? rows : [
      ["身份冒用", "拒绝", "查账号"],
      ["越权读数", "过滤", "申权限"],
      ["凭证泄露", "加密", "轮换"],
    ];
    props.rows = props.rows.map((row, i) => ({
      ...row,
      dim: clip(src[i]?.[0] || row.dim, 18),
      note: clip(src[i]?.[2] || src[i]?.[1] || row.note, 36),
    }));
    if (props.rowCount != null) props.rowCount = props.rows.length;
  }

  if (Array.isArray(props.flow)) {
    const flow = steps.length ? steps.map((s) => s.title) : b;
    props.flow = props.flow.map((_, i) => clip(flow[i] || `步骤${i + 1}`, 18));
    if (props.flowStepCount != null) props.flowStepCount = props.flow.length;
  }

  if (Array.isArray(props.steps) && props.steps[0]?.name) {
    const items = steps.length ? steps : b.map((x) => ({ title: x, note: "" }));
    props.steps = props.steps.map((step, i) => ({
      ...step,
      name: clip(items[i]?.title || step.name, 18),
      note: clip(items[i]?.note || step.note, 36),
    }));
    if (props.stepCount != null) props.stepCount = props.steps.length;
  }

  // Remove renderSlot if accidentally in defaults
  delete props.renderSlot;

  return walkStrings(props, (s) =>
    s
      .replace(/AI Capital/gi, "VitalSpan")
      .replace(/融资/g, "数据")
      .replace(/估值/g, "能力")
  );
}

function sanitize(layoutKey, props) {
  if (Array.isArray(props.rows) && props.rowCount != null) {
    props.rows = props.rows.slice(0, props.rowCount);
  }
  if (Array.isArray(props.nodes) && props.nodeCount != null) {
    props.nodes = props.nodes.slice(0, props.nodeCount);
  }
  if (Array.isArray(props.layers) && props.layerCount != null) {
    props.layers = props.layers.slice(0, props.layerCount);
  }
  if (Array.isArray(props.extremes) && props.calloutCount != null) {
    props.extremes = props.extremes.slice(0, props.calloutCount);
  }
  if (Array.isArray(props.steps)) {
    props.steps = props.steps.map(({ embed, ...rest }) => rest);
    if (props.stepCount != null) props.steps = props.steps.slice(0, props.stepCount);
  }
  if (Array.isArray(props.cards)) {
    props.cards = props.cards.map(({ w, h, x, y, ...rest }) => rest);
  }
  if (Array.isArray(props.gauge)) {
    props.gauge = props.gauge.map(({ tone, ...rest }) => rest);
  }
  if (Array.isArray(props.months) && props.months[0] && typeof props.months[0] === "object") {
    props.months = props.months.map(({ kind, tone, ...rest }) => rest);
  }
  if (Array.isArray(props.stages)) {
    props.stages = props.stages.map((st) => ({
      ...st,
      conv: typeof st.conv === "string" ? st.conv : String(st.conv ?? ""),
    }));
  }
  if (Array.isArray(props.metrics)) {
    props.metrics = props.metrics.map(({ badge, ...rest }) => rest);
  }
  if (layoutKey === "theme07_page050" || layoutKey === "theme07_page044") {
    props.imageCount = 0;
    if (Array.isArray(props.images)) props.images = [];
  }
  if (props.imageCount > 0 && (!Array.isArray(props.images) || props.images.length === 0)) {
    props.imageCount = 0;
  }
  return props;
}

function main() {
  const slidesMap = parseSlidesMd(
    fs.readFileSync(path.join(__dirname, "slides.md"), "utf8")
  );
  const slides = LAYOUTS.map((layoutKey, idx) => {
    const page = pageMap.get(layoutKey);
    if (!page) throw new Error(`Missing ${layoutKey}`);
    const key = `P${String(idx + 1).padStart(2, "0")}`;
    const content = slidesMap[key] || { title: `第 ${idx + 1} 页`, body: "" };
    const props = sanitize(
      layoutKey,
      patchTextFields(deepClone(page.defaultProps || {}), content, idx + 1)
    );
    return { layout: layoutKey, props };
  });

  const goal = {
    title: "VitalSpan 产品白皮书",
    goal: "VitalSpan 自研可配置 BI 平台产品白皮书",
    audience: "政企/行业客户 IT 与数据团队、技术决策者",
    randomSeed: "vitalspan-whitepaper-20260714-b2",
    pageCount: 36,
    themePack: "theme07",
    slides,
  };

  fs.writeFileSync(
    path.join(__dirname, "goal.json"),
    JSON.stringify(goal, null, 2) + "\n",
    "utf8"
  );
  console.log(`Rebuilt ${slides.length} slides`);
}

main();
