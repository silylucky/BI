import fs from "node:fs";

const src = fs.readFileSync("fe/tmp-board.vue", "utf8");
const mapStart = src.indexOf("const borderMap = {");
const mapEnd = src.indexOf("\n}\n\ndefineProps", mapStart);
const body = src.slice(mapStart, mapEnd);

function extractBoard(id) {
  const marker = `board_${id}:`;
  const start = body.indexOf(marker);
  if (start < 0) return null;
  const from = start + marker.length;
  const next = body.indexOf("\n  board_", from);
  const chunk = (next < 0 ? body.slice(from) : body.slice(from, next)).trim();
  const parts = [...chunk.matchAll(/'((?:\\'|[^'])*)'/g)].map((m) =>
    m[1].replace(/\\n/g, "").replace(/\\'/g, "'"),
  );
  return parts.join("");
}

const lines = [
  "/** DataEase Board.vue (GPL) decorative frame SVGs — board_1..board_9 */",
  "export const DATAEASE_BOARD_SVGS: Record<string, string> = {",
];
for (let i = 1; i <= 9; i++) {
  const svg = extractBoard(i);
  if (!svg) throw new Error(`missing board_${i}`);
  lines.push(`  "frame-${i}": ${JSON.stringify(svg)},`);
}
lines.push("};", "");
fs.writeFileSync("fe/src/lib/chartFrameBorderSvgs.ts", lines.join("\n"));
console.log("wrote 9 svgs");
