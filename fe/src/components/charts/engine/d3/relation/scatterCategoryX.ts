import * as d3 from "d3";

type ScatterRow = Record<string, string | number>;

/** 对标 DataEase：类目 X 轴锚定 band 中心，同类目多点横向散开 */
export function buildScatterCategoryXLayout(
  data: ScatterRow[],
  xField: string,
  categories: string[],
  innerW: number,
): { xBand: d3.ScaleBand<string>; xPositions: number[] } {
  const xBand = d3.scaleBand<string>().domain(categories).range([0, innerW]).padding(0.2);
  const groups = new Map<string, number[]>();
  data.forEach((d, i) => {
    const cat = String(d[xField]);
    const bucket = groups.get(cat);
    if (bucket) bucket.push(i);
    else groups.set(cat, [i]);
  });

  const xPositions = new Array<number>(data.length);
  for (const [cat, indices] of groups) {
    const bandX = xBand(cat) ?? 0;
    const bw = xBand.bandwidth();
    const center = bandX + bw / 2;
    const n = indices.length;
    indices.forEach((dataIdx, j) => {
      if (n <= 1) xPositions[dataIdx] = center;
      else {
        const spread = bw * 0.75;
        const offset = ((j / (n - 1)) - 0.5) * spread;
        xPositions[dataIdx] = center + offset;
      }
    });
  }

  return { xBand, xPositions };
}
