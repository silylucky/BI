#!/usr/bin/env node
/**
 * Fill goal.json props from slides.md + goal.fill-plan.json (whitepaper bridge).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const materialDir = __dirname;
const slidesPath = path.join(materialDir, "slides.md");
const goalPath = path.join(materialDir, "goal.json");
const fillPlanPath = path.join(materialDir, "goal.fill-plan.json");

function parseSlidesMd(md) {
  const parts = md.split(/^##\s+(P\d+)\s*·\s*(.+)$/m);
  const map = {};
  for (let i = 1; i < parts.length; i += 3) {
    const id = parts[i].toUpperCase();
    const title = (parts[i + 1] || "").trim();
    const body = (parts[i + 2] || "").trim();
    const meta = {};
    let rest = body;
    for (const key of ["kicker", "lead"]) {
      const m = rest.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
      if (m) {
        meta[key] = m[1].trim();
        rest = rest.replace(m[0], "").trim();
      }
    }
    map[id] = { title, body: rest, ...meta };
  }
  return map;
}

function truncate(s, max) {
  if (!s || !max) return s || "";
  const t = String(s).replace(/\*\*/g, "").replace(/\|/g, " ").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

function splitTitle(title, max1 = 9, max2 = 9) {
  if (title.length <= max1) return { l1: title, l2: "" };
  const mid = Math.ceil(title.length / 2);
  let cut = title.indexOf(" ", mid - 3);
  if (cut < 0) cut = title.indexOf(" ", mid);
  if (cut < 0) cut = mid;
  return {
    l1: truncate(title.slice(0, cut), max1),
    l2: truncate(title.slice(cut).trim(), max2),
  };
}

function extractBullets(body) {
  return body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[-*•\d]/.test(l))
    .map((l) => l.replace(/^[-*•]\s*/, "").replace(/^\d+\.\s*/, "").replace(/\*\*/g, "").trim())
    .filter(Boolean);
}

function extractTableRows(body) {
  const lines = body.split("\n").map((l) => l.trim());
  const rows = [];
  for (const line of lines) {
    if (!line.startsWith("|") || line.includes("---")) continue;
    const cols = line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
    if (cols.length >= 2 && !cols[0].includes("维度") && !cols[0].includes("困境") && !cols[0].includes("角色")) {
      rows.push(cols);
    }
  }
  return rows;
}

function extractNumberedSteps(body) {
  const steps = [];
  for (const line of body.split("\n")) {
    const m = line.match(/^\d+\.\s+\*\*(.+?)\*\*\s*[—\-]\s*(.+)$/);
    if (m) steps.push({ title: m[1], note: m[2] });
    else {
      const m2 = line.match(/^\d+\.\s+\*\*(.+?)\*\*/);
      if (m2) steps.push({ title: m2[1], note: "" });
    }
  }
  return steps;
}

function fillSlideProps(slideIdx, fillSlide, slideContent) {
  const props = {};
  const { title, kicker, lead, body } = slideContent;
  const fp = fillSlide.fillPlan || {};

  for (const t of fp.text || []) {
    const key = t.key;
    const max = t.maxChars || 36;
    if (key === "eyebrow" || key === "logo" || key === "phase" || key === "marker" || key === "segment") {
      props[key] = truncate(kicker || "VitalSpan", max);
    } else if (key === "kicker" || key === "barTitle" || key === "flowTitle") {
      props[key] = truncate(kicker || title, max);
    } else if (key === "title" || key === "quoteLead") {
      props[key] = truncate(title, max);
    } else if (key === "titleL1") {
      props[key] = splitTitle(title, max, max).l1;
    } else if (key === "titleL2") {
      props[key] = splitTitle(title, max, max).l2;
    } else if (key === "titleTail") {
      props[key] = truncate("白皮书", max);
    } else if (key === "sub" || key === "lead" || key === "note" || key === "closing" || key === "slogan") {
      props[key] = truncate(lead || extractBullets(body)[0] || body.split("\n")[0], max);
    } else if (key === "quoteEm1" || key === "quoteMid" || key === "quoteEm2" || key === "quoteTail") {
      const parts = title.split(/[，,：:]/);
      props[key] = truncate(parts[slideIdx % parts.length] || title, max);
    } else if (key === "source" || key === "statLine" || key === "numCaption") {
      props[key] = truncate(lead || "", max);
    } else if (key === "numLead" || key === "numTail") {
      props[key] = truncate(String(slideIdx), max);
    } else if (key.startsWith("colHeads.")) {
      if (!props.colHeads) props.colHeads = {};
      const sub = key.split(".")[1];
      const defaults = { dim: "关切", level: "保障", note: "说明" };
      props.colHeads[sub] = truncate(defaults[sub] || sub, max);
    } else {
      props[key] = truncate(title, max);
    }
  }

  for (const arr of fp.arrays || []) {
    const key = arr.key;
    const count = arr.visibleCount || 3;
    const bullets = extractBullets(body);
    const tableRows = extractTableRows(body);
    const steps = extractNumberedSteps(body);

    if (arr.itemShape === "string") {
      const items = bullets.length >= count ? bullets.slice(0, count) : [
        ...bullets,
        ...Array(count - bullets.length).fill(0).map((_, i) => `要点 ${i + 1}`),
      ].slice(0, count);
      props[key] = items.map((s) => truncate(s, arr.item?.maxChars || 18));
    } else if (key === "rows" && arr.itemShape?.dim) {
      const rows = tableRows.length ? tableRows.slice(0, count) : [
        ["身份冒用", "拒绝访问", "检查账号"],
        ["越权读数", "过滤数据", "申请权限"],
        ["凭证泄露", "加密存储", "轮换密码"],
        ["同步失败", "状态可见", "重试作业"],
      ];
      props[key] = rows.slice(0, count).map(([dim, level, note]) => ({
        dim: truncate(dim, 18),
        level: 70,
        note: truncate(note || level, 36),
      }));
      if (arr.countKey) props[arr.countKey] = Math.min(count, props[key].length);
    } else if (key === "conclusions" && arr.itemShape?.title) {
      const items = bullets.slice(0, count).map((b, i) => ({
        idx: String(i + 1),
        title: truncate(b.replace(/^\*\*|\*\*$/g, "").split("—")[0], 18),
        note: truncate(b.split("—")[1] || "", 36),
      }));
      props[key] = items.length ? items : Array.from({ length: count }, (_, i) => ({
        idx: String(i + 1),
        title: truncate(`结论 ${i + 1}`, 18),
        note: truncate(title, 36),
      }));
      if (arr.countKey) props[arr.countKey] = props[key].length;
    } else if (steps.length && (key === "flow" || key === "phases" || key === "steps" || key === "items")) {
      props[key] = steps.slice(0, count).map((s) => truncate(s.title, 18));
    } else if (arr.itemFields) {
      const fields = Object.keys(arr.itemShape || {});
      props[key] = bullets.slice(0, count).map((b, i) => {
        const obj = {};
        for (const f of fields) {
          if (f === "idx" || f === "v" || f === "level") obj[f] = i + 1;
          else if (f === "value") obj[f] = truncate(String(i + 1), 9);
          else obj[f] = truncate(b.split("—")[0] || b, arr.itemFields[f]?.maxChars || 18);
        }
        return obj;
      });
      if (!props[key].length) {
        props[key] = Array.from({ length: count }, (_, i) => {
          const obj = {};
          for (const f of fields) {
            if (f === "idx" || f === "v" || f === "level") obj[f] = i + 1;
            else obj[f] = truncate(`${title} ${i + 1}`, 18);
          }
          return obj;
        });
      }
      if (arr.countKey) props[arr.countKey] = props[key].length;
    }
  }

  return props;
}

function main() {
  const slidesMap = parseSlidesMd(fs.readFileSync(slidesPath, "utf8"));
  const goal = JSON.parse(fs.readFileSync(goalPath, "utf8"));
  const fillPlan = JSON.parse(fs.readFileSync(fillPlanPath, "utf8"));

  goal.slides = goal.slides.map((slide, idx) => {
    const n = idx + 1;
    const key = `P${String(n).padStart(2, "0")}`;
    const content = slidesMap[key] || { title: `第 ${n} 页`, body: "" };
    const fpSlide = fillPlan.slides[idx];
    return {
      ...slide,
      props: fillSlideProps(idx, fpSlide, content),
    };
  });

  fs.writeFileSync(goalPath, JSON.stringify(goal, null, 2) + "\n", "utf8");
  console.log(`Filled ${goal.slides.length} slides -> ${goalPath}`);
}

main();
