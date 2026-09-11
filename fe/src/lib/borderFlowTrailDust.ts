export type TrailDustParticle = {
  life: number;
  maxLife: number;
  ringT: number;
  floatT: number;
  wobbleSpeed: number;
  normalOff: number;
  size: number;
};

export const TRAIL_DUST_POOL_SIZE = 56;
const SPAWN_PER_SEC = 14;

export function createTrailDustPool(size = TRAIL_DUST_POOL_SIZE): TrailDustParticle[] {
  return Array.from({ length: size }, () => ({
    life: 0,
    maxLife: 1,
    ringT: 0,
    floatT: 0,
    wobbleSpeed: 1,
    normalOff: 0,
    size: 0,
  }));
}

export function trailDustEnvelope(p: TrailDustParticle): number {
  if (p.life <= 0) return 0;
  const fadeIn = Math.min(1, (1 - p.life / p.maxLife) * 4);
  const fadeOut = p.life / p.maxLife;
  return Math.min(fadeIn, fadeOut * fadeOut);
}

export function spawnTrailDustParticle(
  particles: TrailDustParticle[],
  phase: number,
  trailWidthNorm: number,
  driftAmp: number,
): void {
  const slot = particles.find((p) => p.life <= 0);
  if (!slot) return;
  const tail = Math.max(trailWidthNorm, 0.04);
  const offset = Math.random() * tail;
  slot.ringT = ((phase - offset) % 1 + 1) % 1;
  slot.floatT = Math.random() * Math.PI * 2;
  slot.wobbleSpeed = 0.7 + Math.random() * 1.1;
  slot.normalOff = (Math.random() - 0.5) * driftAmp * 0.35;
  slot.maxLife = 0.9 + Math.random() * 1.1;
  slot.life = slot.maxLife;
  slot.size = 0.65 + Math.random() * 0.75;
}

export type TrailDustTickOpts = {
  particles: TrailDustParticle[];
  phase: number;
  deltaSec: number;
  speed: number;
  trailWidthNorm: number;
  driftAmp: number;
  spawnAcc: { value: number };
};

export function tickTrailDustPool(opts: TrailDustTickOpts): void {
  const { particles, phase, deltaSec, speed, trailWidthNorm, driftAmp, spawnAcc } = opts;
  const rate = SPAWN_PER_SEC * (speed / 4);
  spawnAcc.value += rate * deltaSec;
  while (spawnAcc.value >= 1) {
    spawnAcc.value -= 1;
    spawnTrailDustParticle(particles, phase, trailWidthNorm, driftAmp);
  }
  for (const p of particles) {
    if (p.life <= 0) continue;
    p.life -= deltaSec;
    if (p.life > 0) p.floatT += deltaSec * p.wobbleSpeed;
  }
}

export function trailDustWobbleOffset(
  p: TrailDustParticle,
  driftAmp: number,
  liftAmp: number,
): { wobble: number; lift: number } {
  return {
    wobble: Math.sin(p.floatT) * driftAmp,
    lift: Math.sin(p.floatT * 0.55 + p.normalOff) * liftAmp,
  };
}
