/** CJK 按字号全宽；ASCII/数字按 0.65（日期串接近真实 UI 字体） */
const ASCII_WIDTH_RATIO = 0.65;

export function estimateLabelPixelWidth(text: string, fontSize: number): number {
  let width = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    width += code > 0xff ? fontSize : fontSize * ASCII_WIDTH_RATIO;
  }
  return width;
}
