import { isInsideGlobeDisc, type GlobeScreenBounds } from "@/components/charts/engine/maplibre/gisGlobeLayout";

export type Meteor = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  width: number;
};

type MeteorOptions = {
  width: number;
  height: number;
  globe: GlobeScreenBounds;
  intensity: number;
};

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isOutsideGlobeDisc(
  x: number,
  y: number,
  globe: GlobeScreenBounds,
): boolean {
  return !isInsideGlobeDisc(x, y, globe, 1.02);
}

export function spawnMeteor(opts: MeteorOptions, rand = Math.random): Meteor | null {
  const { width, height, globe, intensity } = opts;
  if (intensity < 0.2) return null;

  let x = 0;
  let y = 0;
  for (let i = 0; i < 24; i += 1) {
    x = rand() * width;
    y = rand() * height;
    if (isOutsideGlobeDisc(x, y, globe)) break;
  }
  if (!isOutsideGlobeDisc(x, y, globe)) return null;

  const angle = (-Math.PI / 4) + (rand() - 0.5) * 0.5;
  const speed = 280 + rand() * 220;
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 0,
    maxLife: 0.55 + rand() * 0.35,
    width: 1.2 + rand() * 1.2,
  };
}

export function createMeteorSpawner(intensity: number, seed = 77) {
  const rand = mulberry32(seed);
  let cooldown = 1.5 + rand() * 2;

  return (opts: MeteorOptions, dt: number, active: Meteor[]): Meteor[] => {
    cooldown -= dt;
    const next = active
      .map((meteor) => ({ ...meteor, life: meteor.life + dt, x: meteor.x + meteor.vx * dt, y: meteor.y + meteor.vy * dt }))
      .filter((meteor) => meteor.life < meteor.maxLife);

    if (cooldown <= 0 && next.length < 2) {
      const spawned = spawnMeteor(opts, rand);
      if (spawned) next.push(spawned);
      cooldown = (intensity > 0.7 ? 1.4 : 3.2) + rand() * (intensity > 0.7 ? 1.8 : 3);
    }
    return next;
  };
}

export function drawMeteors(
  ctx: CanvasRenderingContext2D,
  meteors: Meteor[],
  intensity: number,
) {
  for (const meteor of meteors) {
    const t = meteor.life / meteor.maxLife;
    const fade = (1 - t) * intensity;
    if (fade <= 0) continue;

    const tail = 36 + meteor.width * 18;
    const nx = meteor.vx / Math.hypot(meteor.vx, meteor.vy);
    const ny = meteor.vy / Math.hypot(meteor.vx, meteor.vy);
    const x2 = meteor.x - nx * tail;
    const y2 = meteor.y - ny * tail;

    const gradient = ctx.createLinearGradient(meteor.x, meteor.y, x2, y2);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${0.95 * fade})`);
    gradient.addColorStop(0.35, `rgba(190, 220, 255, ${0.45 * fade})`);
    gradient.addColorStop(1, "rgba(120, 160, 255, 0)");

    ctx.strokeStyle = gradient;
    ctx.lineWidth = meteor.width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(meteor.x, meteor.y);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.fillStyle = `rgba(255, 255, 255, ${0.85 * fade})`;
    ctx.beginPath();
    ctx.arc(meteor.x, meteor.y, meteor.width * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
}
