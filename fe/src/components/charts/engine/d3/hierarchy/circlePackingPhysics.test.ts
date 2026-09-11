import { describe, expect, it } from "vitest";
import {
  blurPackNode,
  clampPackNodeToBounds,
  createPackPhysicsNodes,
  createPackPhysicsSimulation,
  fitPackLayoutToPlot,
  focusPackNode,
  hasPackOverlaps,
  isPackMotionActive,
  PACK_FOCUS_SCALE,
  PACK_MAX_DRIFT_RATIO,
  PACK_SCALE_LERP,
  packNodeVisualRadius,
  pickPackNodeAt,
  relaxPackOverlaps,
  resetPackNodesToTarget,
  resolvePackEdgeInset,
  resolvePackPlotCircle,
  settlePackOverlaps,
  stepPackMotionFrame,
} from "./circlePackingPhysics";

const STROKE = 1.5;
const PLOT_W = 200;
const PLOT_H = 200;

function hubClusterNodes(centerR = 22, neighborR = 16) {
  const cx = 100;
  const cy = 100;
  const dist = centerR + neighborR;
  const angles = [0, 60, 120, 180, 240, 300].map((deg) => (deg * Math.PI) / 180);
  const items = [{ name: "center", x: cx, y: cy, r: centerR }];
  angles.forEach((angle, i) => {
    items.push({
      name: `n${i}`,
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      r: neighborR,
    });
  });
  return createPackPhysicsNodes(items);
}

function simulateSoftHoverFrames(
  nodes: ReturnType<typeof createPackPhysicsNodes>,
  focusIndex: number,
  frames: number,
) {
  focusPackNode(nodes[focusIndex]!);
  for (let frame = 0; frame < frames; frame += 1) {
    stepPackMotionFrame(nodes, {
      width: PLOT_W,
      height: PLOT_H,
      strokeWidth: STROKE,
      interaction: "hover",
      dt: 1,
    });
  }
}

function simulateSoftIdleFrames(nodes: ReturnType<typeof createPackPhysicsNodes>, frames: number) {
  for (let frame = 0; frame < frames; frame += 1) {
    stepPackMotionFrame(nodes, {
      width: PLOT_W,
      height: PLOT_H,
      strokeWidth: STROKE,
      interaction: "idle",
      dt: 1,
    });
  }
}

describe("circlePackingPhysics", () => {
  it("reserves compact inset for plot edges", () => {
    expect(resolvePackEdgeInset(40, 1.5)).toBeLessThan(8);
    expect(resolvePackEdgeInset(40, 1.5)).toBeGreaterThanOrEqual(4);
  });

  it("fits pack layout inside plot with margin", () => {
    const fitted = fitPackLayoutToPlot(
      [
        { name: "a", x: 80, y: 60, r: 20 },
        { name: "b", x: 120, y: 60, r: 16 },
      ],
      200,
      120,
      6,
    );
    const { cx, cy, radius } = resolvePackPlotCircle(200, 120);
    for (const item of fitted) {
      const dist = Math.hypot(item.x - cx, item.y - cy) + item.r;
      expect(dist).toBeLessThanOrEqual(radius + 0.5);
    }
  });

  it("keeps enlarged nodes inside circular plot bounds", () => {
    const node = {
      name: "a",
      targetX: 4,
      targetY: 4,
      baseR: 12,
      focusScale: PACK_FOCUS_SCALE,
      renderScale: PACK_FOCUS_SCALE,
      x: -5,
      y: 90,
    };
    clampPackNodeToBounds(node, 120, 80, STROKE);
    const { cx, cy, radius } = resolvePackPlotCircle(120, 80);
    const dist = Math.hypot((node.x ?? 0) - cx, (node.y ?? 0) - cy) + packNodeVisualRadius(node, STROKE);
    expect(dist).toBeLessThanOrEqual(radius + 0.5);
  });

  it("pushes overlapping pack nodes apart", () => {
    const nodes = createPackPhysicsNodes([
      { name: "a", x: 50, y: 50, r: 16 },
      { name: "b", x: 52, y: 50, r: 16 },
    ]);
    relaxPackOverlaps(nodes, 120, 80, STROKE, 20);
    expect(hasPackOverlaps(nodes, STROKE)).toBe(false);
  });

  it("squeezes neighbors when hovered node enlarges in place", () => {
    const nodes = createPackPhysicsNodes([
      { name: "a", x: 70, y: 90, r: 18 },
      { name: "b", x: 90, y: 90, r: 18 },
      { name: "c", x: 110, y: 90, r: 18 },
    ]);
    focusPackNode(nodes[1]!);
    nodes[1]!.renderScale = PACK_FOCUS_SCALE;
    settlePackOverlaps(nodes, 180, 180, STROKE);
    expect(Math.abs((nodes[0]!.x ?? 0) - 70)).toBeGreaterThan(2);
    expect(Math.abs((nodes[2]!.x ?? 0) - 110)).toBeGreaterThan(2);
    expect(hasPackOverlaps(nodes, STROKE)).toBe(false);
  });

  it("repeats squeeze on every hover cycle", () => {
    const nodes = createPackPhysicsNodes([
      { name: "a", x: 70, y: 90, r: 18 },
      { name: "b", x: 90, y: 90, r: 18 },
      { name: "c", x: 110, y: 90, r: 18 },
    ]);

    const squeeze = () => {
      resetPackNodesToTarget(nodes);
      focusPackNode(nodes[1]!);
      nodes[1]!.renderScale = PACK_FOCUS_SCALE;
      settlePackOverlaps(nodes, 180, 180, STROKE);
      return Math.abs((nodes[0]!.x ?? 0) - 70) + Math.abs((nodes[2]!.x ?? 0) - 110);
    };

    const first = squeeze();
    const second = squeeze();
    expect(first).toBeGreaterThan(4);
    expect(second).toBeGreaterThan(4);
    expect(hasPackOverlaps(nodes, STROKE)).toBe(false);
  });

  it("picks topmost node under pointer", () => {
    const nodes = createPackPhysicsNodes([
      { name: "a", x: 40, y: 40, r: 20 },
      { name: "b", x: 50, y: 40, r: 12 },
    ]);
    expect(pickPackNodeAt(nodes, 45, 40)?.name).toBe("a");
    expect(pickPackNodeAt(nodes, 10, 10)).toBeNull();
  });

  it("keeps nodes inside plot after hover squeeze", () => {
    const nodes = createPackPhysicsNodes([
      { name: "a", x: 40, y: 80, r: 18 },
      { name: "b", x: 80, y: 80, r: 18 },
      { name: "c", x: 120, y: 80, r: 18 },
    ]);
    focusPackNode(nodes[1]!);
    nodes[1]!.renderScale = PACK_FOCUS_SCALE;
    settlePackOverlaps(nodes, 160, 160, STROKE);
    const { cx, cy, radius } = resolvePackPlotCircle(160, 160);
    for (const node of nodes) {
      const dist = Math.hypot((node.x ?? 0) - cx, (node.y ?? 0) - cy) + packNodeVisualRadius(node, STROKE);
      expect(dist).toBeLessThanOrEqual(radius + 0.5);
    }
    expect(hasPackOverlaps(nodes, STROKE)).toBe(false);
  });

  it("eliminates overlap for hub-and-spoke cluster", () => {
    const nodes = hubClusterNodes();
    simulateSoftHoverFrames(nodes, 0, 96);
    expect(nodes[0]!.renderScale).toBeCloseTo(PACK_FOCUS_SCALE, 2);
    expect(hasPackOverlaps(nodes, STROKE)).toBe(false);
  });

  it("clamps neighbor drift during hover", () => {
    const nodes = hubClusterNodes();
    simulateSoftHoverFrames(nodes, 0, 96);
    for (let i = 1; i < nodes.length; i += 1) {
      const node = nodes[i]!;
      const dx = (node.x ?? node.targetX) - node.targetX;
      const dy = (node.y ?? node.targetY) - node.targetY;
      expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(node.baseR * PACK_MAX_DRIFT_RATIO + 0.6);
    }
  });

  it("hover motion sleeps when settled", () => {
    const nodes = hubClusterNodes();
    simulateSoftHoverFrames(nodes, 0, 96);
    for (const node of nodes) {
      node.vx = 0;
      node.vy = 0;
    }
    expect(isPackMotionActive(nodes, "hover")).toBe(false);
  });

  it("incremental scale frames stay non-overlapping at end", () => {
    const nodes = hubClusterNodes();
    focusPackNode(nodes[0]!);
    const frames = Math.ceil(Math.log(0.002 / PACK_FOCUS_SCALE) / Math.log(1 - PACK_SCALE_LERP)) + 8;
    for (let frame = 0; frame < frames; frame += 1) {
      stepPackMotionFrame(nodes, {
        width: PLOT_W,
        height: PLOT_H,
        strokeWidth: STROKE,
        interaction: "hover",
        dt: 1,
      });
    }
    expect(nodes[0]!.renderScale).toBeCloseTo(PACK_FOCUS_SCALE, 2);
    expect(hasPackOverlaps(nodes, STROKE)).toBe(false);
  });

  it("restores smoothly after blur", () => {
    const nodes = hubClusterNodes();
    simulateSoftHoverFrames(nodes, 0, 96);
    expect(hasPackOverlaps(nodes, STROKE)).toBe(false);

    blurPackNode(nodes[0]!);
    simulateSoftIdleFrames(nodes, 72);

    for (const node of nodes) {
      const dx = (node.x ?? node.targetX) - node.targetX;
      const dy = (node.y ?? node.targetY) - node.targetY;
      expect(Math.hypot(dx, dy)).toBeLessThan(1.5);
      expect(node.renderScale).toBeCloseTo(1, 2);
    }
    expect(hasPackOverlaps(nodes, STROKE)).toBe(false);
  });

  it("still resolves overlaps via d3 simulation for free nodes", () => {
    const nodes = createPackPhysicsNodes([
      { name: "a", x: 50, y: 50, r: 16 },
      { name: "b", x: 52, y: 50, r: 16 },
    ]);
    const simulation = createPackPhysicsSimulation(nodes, 120, 80, STROKE);
    for (let i = 0; i < 90; i += 1) simulation.tick();
    simulation.stop();
    const dx = (nodes[0]!.x ?? 0) - (nodes[1]!.x ?? 0);
    const dy = (nodes[0]!.y ?? 0) - (nodes[1]!.y ?? 0);
    expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(30);
  });
});
