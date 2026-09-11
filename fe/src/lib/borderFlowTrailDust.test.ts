import { describe, expect, it } from "vitest";
import {
  createTrailDustPool,
  spawnTrailDustParticle,
  tickTrailDustPool,
} from "./borderFlowTrailDust";

describe("borderFlowTrailDust", () => {
  it("spawns particles within the trail band behind phase", () => {
    const particles = createTrailDustPool(4);
    spawnTrailDustParticle(particles, 0.2, 0.1, 1);
    const active = particles.find((p) => p.life > 0);
    expect(active).toBeDefined();
    expect(active!.ringT).toBeGreaterThanOrEqual(0.1);
    expect(active!.ringT).toBeLessThanOrEqual(0.2);
  });

  it("ticks pool and reduces life over time", () => {
    const particles = createTrailDustPool(2);
    spawnTrailDustParticle(particles, 0.5, 0.12, 1);
    const p = particles.find((item) => item.life > 0)!;
    const startLife = p.life;
    tickTrailDustPool({
      particles,
      phase: 0.5,
      deltaSec: 0.2,
      speed: 4,
      trailWidthNorm: 0.12,
      driftAmp: 1,
      spawnAcc: { value: 0 },
    });
    expect(p.life).toBeLessThan(startLife);
  });
});
