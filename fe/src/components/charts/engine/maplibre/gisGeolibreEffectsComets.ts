/** GeoLibre maplibre-effects.ts 流星层。 */
export type GeolibreComet = {
  x: number;
  y: number;
  len: number;
  speed: number;
  angle: number;
  alpha: number;
  life: number;
  maxLife: number;
};

function spawnComet(width: number, height: number): GeolibreComet {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    len: Math.random() * 200 + 150,
    speed: Math.random() * 8 + 6,
    angle: Math.random() * Math.PI * 2,
    alpha: 1,
    life: 0,
    maxLife: Math.random() * 40 + 80,
  };
}

export function drawGeolibreComets(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  comets: GeolibreComet[],
  frameScale: number,
): GeolibreComet[] {
  const spawnChance = 1 - Math.pow(1 - 0.005, frameScale);
  const active = comets.length === 0 && Math.random() < spawnChance ? [spawnComet(width, height)] : [...comets];
  const survivors: GeolibreComet[] = [];

  for (const comet of active) {
    comet.life += frameScale;
    comet.x += Math.cos(comet.angle) * comet.speed * frameScale;
    comet.y += Math.sin(comet.angle) * comet.speed * frameScale;
    comet.alpha = 1 - comet.life / comet.maxLife;

    const offscreen =
      comet.x < -comet.len ||
      comet.x > width + comet.len ||
      comet.y < -comet.len ||
      comet.y > height + comet.len;
    if (comet.life >= comet.maxLife || offscreen) continue;
    survivors.push(comet);

    const tailX = comet.x - Math.cos(comet.angle) * comet.len;
    const tailY = comet.y - Math.sin(comet.angle) * comet.len;
    const gradient = ctx.createLinearGradient(tailX, tailY, comet.x, comet.y);
    gradient.addColorStop(0, "rgba(255, 255, 255, 0)");
    gradient.addColorStop(1, `rgba(255, 255, 255, ${comet.alpha})`);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(comet.x, comet.y);
    ctx.stroke();

    ctx.fillStyle = `rgba(200, 220, 255, ${0.5 * comet.alpha})`;
    ctx.beginPath();
    ctx.arc(comet.x, comet.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  return survivors;
}
