import * as d3 from "d3";

export function nearestCategory(
  mouseX: number,
  categories: string[],
  xScale: d3.ScalePoint<string>,
): string {
  let best = categories[0] ?? "";
  let bestDist = Infinity;
  for (const cat of categories) {
    const px = xScale(cat) ?? 0;
    const dist = Math.abs(px - mouseX);
    if (dist < bestDist) {
      bestDist = dist;
      best = cat;
    }
  }
  return best;
}
