import * as d3 from "d3";

/** 悬停放大倍率 */
export const PACK_FOCUS_SCALE = 1.18;

/** 半径插值速度（越大越快） */
export const PACK_SCALE_LERP = 0.22;

/** 软碰撞：overlap 转冲量比例 */
export const PACK_COLLISION_BLEND = 0.3;

/** 每帧碰撞子步 */
export const PACK_COLLISION_SUBSTEPS = 1;

/** 速度衰减（按 16.67ms 帧归一化） */
export const PACK_VELOCITY_DAMPING = 0.78;

/** 邻球相对 baseR 的最大位移比例 */
export const PACK_MAX_DRIFT_RATIO = 0.32;

/** 每帧最大速度（px，按 60fps 基准） */
export const PACK_MAX_SPEED = 5;

/** 悬停休眠速度阈值 */
export const PACK_HOVER_SLEEP_SPEED = 0.04;

/** 悬停弱锚定弹簧 */
export const PACK_SPRING_K_HOVER = 0.003;

/** 恢复/idle 弹簧强度 */
export const PACK_SPRING_K_IDLE = 0.075;

const PACK_FRAME_MS = 1000 / 60;

export type PackInteractionLevel = "idle" | "hover";

export function resolvePackEdgeInset(radiusHint: number, strokeWidth: number): number {
  return Math.ceil(Math.max(3, Math.min(6, radiusHint * 0.12)) + strokeWidth);
}

/** 圆形打包图绘图区：内切于 plot 矩形 */
export function resolvePackPlotCircle(width: number, height: number, inset = 0) {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.max(0, Math.min(width, height) / 2 - inset);
  return { cx, cy, radius };
}

export function resolvePackPlotRadiusScale(sizePercent = 1): number {
  return Math.max(0.35, Math.min(1, sizePercent));
}

/** 整体大小缩放后的绘图区圆（外圈 / 裁剪 / 物理边界一致） */
export function resolveScaledPackPlotCircle(
  width: number,
  height: number,
  sizePercent = 1,
  inset = 0,
) {
  const { cx, cy, radius } = resolvePackPlotCircle(width, height, inset);
  const scale = resolvePackPlotRadiusScale(sizePercent);
  return { cx, cy, radius: radius * scale };
}

export type PackPhysicsNode = d3.SimulationNodeDatum & {
  name: string;
  targetX: number;
  targetY: number;
  baseR: number;
  /** 目标缩放 */
  focusScale: number;
  /** 当前渲染缩放（向 focusScale 平滑过渡） */
  renderScale: number;
};

export type PackPhysicsSimulation = d3.Simulation<PackPhysicsNode, undefined> & {
  setInteraction: (level: PackInteractionLevel) => void;
  reheat: () => void;
};

export function packNodeRadius(node: PackPhysicsNode): number {
  return node.baseR * node.renderScale;
}

export function packNodeVisualRadius(node: PackPhysicsNode, strokeWidth: number): number {
  return packNodeRadius(node) + strokeWidth / 2;
}

export function stepPackRenderScales(
  nodes: ReadonlyArray<PackPhysicsNode>,
  lerp = PACK_SCALE_LERP,
): void {
  for (const node of nodes) {
    const delta = node.focusScale - node.renderScale;
    if (Math.abs(delta) < 0.002) {
      node.renderScale = node.focusScale;
      continue;
    }
    node.renderScale += delta * lerp;
  }
}

export function fitPackLayoutToPlot(
  items: ReadonlyArray<{ name: string; x: number; y: number; r: number }>,
  plotW: number,
  plotH: number,
  margin: number,
  sizePercent = 1,
): Array<{ name: string; x: number; y: number; r: number }> {
  if (items.length === 0) return [];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const item of items) {
    minX = Math.min(minX, item.x - item.r);
    maxX = Math.max(maxX, item.x + item.r);
    minY = Math.min(minY, item.y - item.r);
    maxY = Math.max(maxY, item.y + item.r);
  }

  const bboxW = Math.max(maxX - minX, 1);
  const bboxH = Math.max(maxY - minY, 1);
  const sizeScale = Math.max(0.35, Math.min(1, sizePercent));
  const usable = Math.max(1, Math.min(plotW, plotH) - margin * 2) * sizeScale;
  const scale = usable / Math.max(bboxW, bboxH);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  return items.map((item) => ({
    name: item.name,
    x: (item.x - cx) * scale + plotW / 2,
    y: (item.y - cy) * scale + plotH / 2,
    r: item.r * scale,
  }));
}

function packNodeCollideRadius(node: PackPhysicsNode, strokeWidth: number): number {
  return packNodeVisualRadius(node, strokeWidth);
}

function resolveAnchorStrength(node: PackPhysicsNode, interaction: PackInteractionLevel): number {
  if (node.fx != null || node.fy != null) return 0;
  return interaction === "hover" ? 0.008 : 0.045;
}

function isPackNodeFixed(node: PackPhysicsNode): boolean {
  return node.fx != null || node.fy != null;
}

function restoreFixedPackNodes(nodes: ReadonlyArray<PackPhysicsNode>): void {
  for (const node of nodes) {
    if (node.fx != null) node.x = node.fx;
    if (node.fy != null) node.y = node.fy;
  }
}

/** 检测任意两圆是否仍重叠（用于回归测试） */
export function hasPackOverlaps(
  nodes: ReadonlyArray<PackPhysicsNode>,
  strokeWidth: number,
  epsilon = 0.5,
): boolean {
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i]!;
      const b = nodes[j]!;
      const ax = a.x ?? a.targetX;
      const ay = a.y ?? a.targetY;
      const bx = b.x ?? b.targetX;
      const by = b.y ?? b.targetY;
      const ra = packNodeVisualRadius(a, strokeWidth);
      const rb = packNodeVisualRadius(b, strokeWidth);
      const dist = Math.hypot(ax - bx, ay - by);
      if (dist < ra + rb - epsilon) return true;
    }
  }
  return false;
}

/** 位置级重叠消解：悬停圆固定圆心，邻圆被推开 */
export function relaxPackOverlaps(
  nodes: PackPhysicsNode[],
  width: number,
  height: number,
  strokeWidth: number,
  iterations = 10,
): void {
  for (let iter = 0; iter < iterations; iter += 1) {
    let moved = false;
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        let ax = a.x ?? a.targetX;
        let ay = a.y ?? a.targetY;
        let bx = b.x ?? b.targetX;
        let by = b.y ?? b.targetY;
        const ra = packNodeVisualRadius(a, strokeWidth);
        const rb = packNodeVisualRadius(b, strokeWidth);
        let dx = bx - ax;
        let dy = by - ay;
        let dist = Math.hypot(dx, dy);
        const minDist = ra + rb;

        if (dist < 1e-6) {
          dx = (j - i) * 0.01 + 0.001;
          dy = 0.001;
          dist = Math.hypot(dx, dy);
        }

        const overlap = minDist - dist;
        if (overlap <= 0) continue;

        const nx = dx / dist;
        const ny = dy / dist;
        const aFixed = isPackNodeFixed(a);
        const bFixed = isPackNodeFixed(b);
        if (aFixed && bFixed) continue;

        if (aFixed && !bFixed) {
          bx += nx * overlap;
          by += ny * overlap;
          b.x = bx;
          b.y = by;
          moved = true;
        } else if (!aFixed && bFixed) {
          ax -= nx * overlap;
          ay -= ny * overlap;
          a.x = ax;
          a.y = ay;
          moved = true;
        } else {
          const half = overlap / 2;
          ax -= nx * half;
          ay -= ny * half;
          bx += nx * half;
          by += ny * half;
          a.x = ax;
          a.y = ay;
          b.x = bx;
          b.y = by;
          moved = true;
        }
      }
    }
    restoreFixedPackNodes(nodes);
    enforcePackBounds(nodes, width, height, strokeWidth);
    restoreFixedPackNodes(nodes);
    if (!moved) break;
  }
}

/** 非悬停时缓慢回到 pack 目标位置（测试/兼容保留） */
export function stepPackPositionsTowardTarget(
  nodes: ReadonlyArray<PackPhysicsNode>,
  lerp = 0.12,
): void {
  for (const node of nodes) {
    if (isPackNodeFixed(node)) continue;
    const x = node.x ?? node.targetX;
    const y = node.y ?? node.targetY;
    const dx = node.targetX - x;
    const dy = node.targetY - y;
    if (Math.hypot(dx, dy) < 0.4) {
      node.x = node.targetX;
      node.y = node.targetY;
      node.vx = 0;
      node.vy = 0;
      continue;
    }
    node.x = x + dx * lerp;
    node.y = y + dy * lerp;
  }
}

export type PackMotionFrameOptions = {
  width: number;
  height: number;
  strokeWidth: number;
  interaction: PackInteractionLevel;
  plotRadiusScale?: number;
  dt?: number;
};

/** 将帧间隔归一化到 60fps 基准 */
export function normalizePackDt(deltaMs: number): number {
  return Math.max(0.48, Math.min(1.92, deltaMs / PACK_FRAME_MS));
}

function resolvePackSpringK(interaction: PackInteractionLevel): number {
  return interaction === "hover" ? PACK_SPRING_K_HOVER : PACK_SPRING_K_IDLE;
}

function resolvePackSpringDamping(k: number): number {
  return Math.sqrt(k) * 2;
}

/** 限制自由球相对 pack 目标的最大漂移，防止整团扩散 */
export function clampPackNodeDrift(node: PackPhysicsNode): void {
  if (isPackNodeFixed(node)) return;

  const x = node.x ?? node.targetX;
  const y = node.y ?? node.targetY;
  const dx = x - node.targetX;
  const dy = y - node.targetY;
  const dist = Math.hypot(dx, dy);
  const maxDrift = node.baseR * PACK_MAX_DRIFT_RATIO;
  if (dist <= maxDrift || dist < 1e-6) return;

  const nx = dx / dist;
  const ny = dy / dist;
  node.x = node.targetX + nx * maxDrift;
  node.y = node.targetY + ny * maxDrift;

  const vx = node.vx ?? 0;
  const vy = node.vy ?? 0;
  const outward = vx * nx + vy * ny;
  if (outward > 0) {
    node.vx = vx - outward * nx;
    node.vy = vy - outward * ny;
  }
}

function clampPackNodeDriftAll(nodes: ReadonlyArray<PackPhysicsNode>): void {
  for (const node of nodes) clampPackNodeDrift(node);
}

function applyPackSpringForces(
  nodes: ReadonlyArray<PackPhysicsNode>,
  interaction: PackInteractionLevel,
  dt: number,
): void {
  const k = resolvePackSpringK(interaction);
  const c = resolvePackSpringDamping(k);
  for (const node of nodes) {
    if (isPackNodeFixed(node)) {
      node.vx = 0;
      node.vy = 0;
      continue;
    }
    const x = node.x ?? node.targetX;
    const y = node.y ?? node.targetY;
    const vx = node.vx ?? 0;
    const vy = node.vy ?? 0;
    const ax = (node.targetX - x) * k - vx * c;
    const ay = (node.targetY - y) * k - vy * c;
    node.vx = vx + ax * dt;
    node.vy = vy + ay * dt;
  }
}

function applyPackSoftCollisions(
  nodes: PackPhysicsNode[],
  strokeWidth: number,
  dt: number,
): void {
  const blend = PACK_COLLISION_BLEND * dt;
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i]!;
      const b = nodes[j]!;
      const ax = a.x ?? a.targetX;
      const ay = a.y ?? a.targetY;
      const bx = b.x ?? b.targetX;
      const by = b.y ?? b.targetY;
      const ra = packNodeVisualRadius(a, strokeWidth);
      const rb = packNodeVisualRadius(b, strokeWidth);
      let dx = bx - ax;
      let dy = by - ay;
      let dist = Math.hypot(dx, dy);
      const minDist = ra + rb;

      if (dist < 1e-6) {
        dx = (j - i) * 0.01 + 0.001;
        dy = 0.001;
        dist = Math.hypot(dx, dy);
      }

      const overlap = minDist - dist;
      if (overlap <= 0) continue;

      const nx = dx / dist;
      const ny = dy / dist;
      const impulse = overlap * blend;
      const aFixed = isPackNodeFixed(a);
      const bFixed = isPackNodeFixed(b);
      if (aFixed && bFixed) continue;

      if (aFixed && !bFixed) {
        b.vx = (b.vx ?? 0) + nx * impulse;
        b.vy = (b.vy ?? 0) + ny * impulse;
      } else if (!aFixed && bFixed) {
        a.vx = (a.vx ?? 0) - nx * impulse;
        a.vy = (a.vy ?? 0) - ny * impulse;
      } else {
        a.vx = (a.vx ?? 0) - nx * impulse * 0.5;
        a.vy = (a.vy ?? 0) - ny * impulse * 0.5;
        b.vx = (b.vx ?? 0) + nx * impulse * 0.5;
        b.vy = (b.vy ?? 0) + ny * impulse * 0.5;
      }
    }
  }
}

function integratePackVelocities(nodes: ReadonlyArray<PackPhysicsNode>, dt: number): void {
  const damping = Math.pow(PACK_VELOCITY_DAMPING, dt);
  for (const node of nodes) {
    if (isPackNodeFixed(node)) {
      if (node.fx != null) node.x = node.fx;
      if (node.fy != null) node.y = node.fy;
      node.vx = 0;
      node.vy = 0;
      continue;
    }
    let vx = (node.vx ?? 0) * damping;
    let vy = (node.vy ?? 0) * damping;
    const speed = Math.hypot(vx, vy);
    if (speed > PACK_MAX_SPEED) {
      const scale = PACK_MAX_SPEED / speed;
      vx *= scale;
      vy *= scale;
    }
    node.vx = vx;
    node.vy = vy;
    node.x = (node.x ?? node.targetX) + vx * dt;
    node.y = (node.y ?? node.targetY) + vy * dt;
  }
}

function softEnforcePackBounds(
  nodes: ReadonlyArray<PackPhysicsNode>,
  width: number,
  height: number,
  strokeWidth: number,
  plotRadiusScale = 1,
): void {
  for (const node of nodes) {
    if (isPackNodeFixed(node)) {
      if (node.fx != null) node.x = node.fx;
      if (node.fy != null) node.y = node.fy;
      continue;
    }
    clampPackNodeToBounds(node, width, height, strokeWidth, plotRadiusScale);
  }
}

/** 运行时统一软物理帧 */
export function stepPackMotionFrame(
  nodes: PackPhysicsNode[],
  options: PackMotionFrameOptions,
): void {
  const dt = options.dt ?? 1;
  stepPackRenderScales(nodes);
  applyPackSpringForces(nodes, options.interaction, dt);
  for (let sub = 0; sub < PACK_COLLISION_SUBSTEPS; sub += 1) {
    applyPackSoftCollisions(nodes, options.strokeWidth, dt);
  }
  integratePackVelocities(nodes, dt);
  clampPackNodeDriftAll(nodes);
  softEnforcePackBounds(
    nodes,
    options.width,
    options.height,
    options.strokeWidth,
    options.plotRadiusScale ?? 1,
  );
  restoreFixedPackNodes(nodes);
}

export function isPackMotionActive(
  nodes: ReadonlyArray<PackPhysicsNode>,
  interaction: PackInteractionLevel,
): boolean {
  const scaling = nodes.some((n) => Math.abs(n.renderScale - n.focusScale) > 0.004);
  if (scaling) return true;

  if (interaction === "hover") {
    for (const node of nodes) {
      if (isPackNodeFixed(node)) continue;
      const speed = Math.hypot(node.vx ?? 0, node.vy ?? 0);
      if (speed > PACK_HOVER_SLEEP_SPEED) return true;
    }
    return false;
  }

  for (const node of nodes) {
    if (isPackNodeFixed(node)) continue;
    const dx = (node.x ?? node.targetX) - node.targetX;
    const dy = (node.y ?? node.targetY) - node.targetY;
    const dist = Math.hypot(dx, dy);
    const speed = Math.hypot(node.vx ?? 0, node.vy ?? 0);
    if (dist > 0.6 || speed > 0.08) return true;
  }
  return false;
}

export function clampPackNodeToBounds(
  node: PackPhysicsNode,
  width: number,
  height: number,
  strokeWidth: number,
  plotRadiusScale = 1,
): void {
  const r = packNodeVisualRadius(node, strokeWidth);
  const { cx, cy, radius: plotRadius } = resolveScaledPackPlotCircle(width, height, plotRadiusScale);
  const maxDist = Math.max(0, plotRadius - r);
  let x = node.x ?? node.targetX;
  let y = node.y ?? node.targetY;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.hypot(dx, dy);
  if (dist > maxDist && dist > 1e-6) {
    const scale = maxDist / dist;
    x = cx + dx * scale;
    y = cy + dy * scale;
    const nx = dx / dist;
    const ny = dy / dist;
    const vx = node.vx ?? 0;
    const vy = node.vy ?? 0;
    const outward = vx * nx + vy * ny;
    if (outward > 0) {
      node.vx = vx - outward * nx;
      node.vy = vy - outward * ny;
    }
  }
  node.x = x;
  node.y = y;
}

export function createPackBoundaryForce(
  width: number,
  height: number,
  strokeWidth: number,
  plotRadiusScale = 1,
): d3.Force<PackPhysicsNode, undefined> {
  const { cx, cy, radius: plotRadius } = resolveScaledPackPlotCircle(width, height, plotRadiusScale);
  let nodes: PackPhysicsNode[] = [];

  function force(alpha: number) {
    const push = 1.1 * alpha;
    for (const node of nodes) {
      const r = packNodeVisualRadius(node, strokeWidth);
      const x = node.x ?? node.targetX;
      const y = node.y ?? node.targetY;
      const maxDist = Math.max(0, plotRadius - r);
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.hypot(dx, dy);
      if (dist <= maxDist || dist < 1e-6) continue;
      const overflow = dist - maxDist;
      const nx = dx / dist;
      const ny = dy / dist;
      node.vx = (node.vx ?? 0) - nx * overflow * push * 8;
      node.vy = (node.vy ?? 0) - ny * overflow * push * 8;
    }
  }

  force.initialize = (next: PackPhysicsNode[]) => {
    nodes = next;
  };

  return force;
}

export function enforcePackBounds(
  nodes: ReadonlyArray<PackPhysicsNode>,
  width: number,
  height: number,
  strokeWidth: number,
  plotRadiusScale = 1,
): void {
  for (const node of nodes) clampPackNodeToBounds(node, width, height, strokeWidth, plotRadiusScale);
}

export function createPackPhysicsNodes(
  items: ReadonlyArray<{ name: string; x: number; y: number; r: number }>,
): PackPhysicsNode[] {
  return items.map((item) => ({
    name: item.name,
    targetX: item.x,
    targetY: item.y,
    baseR: item.r,
    focusScale: 1,
    renderScale: 1,
    x: item.x,
    y: item.y,
    vx: 0,
    vy: 0,
  }));
}

export function resetPackNodesToTarget(nodes: ReadonlyArray<PackPhysicsNode>): void {
  for (const node of nodes) {
    blurPackNode(node);
    node.renderScale = 1;
    node.x = node.targetX;
    node.y = node.targetY;
    node.vx = 0;
    node.vy = 0;
  }
}

/** 悬停：固定当前圆心，仅放大半径 */
export function focusPackNode(node: PackPhysicsNode): void {
  node.focusScale = PACK_FOCUS_SCALE;
  node.fx = node.x ?? node.targetX;
  node.fy = node.y ?? node.targetY;
}

export function blurPackNode(node: PackPhysicsNode): void {
  node.focusScale = 1;
  node.fx = null;
  node.fy = null;
}

/** 命中检测：取指针下最上层（最大）的圆 */
export function pickPackNodeAt(
  nodes: ReadonlyArray<PackPhysicsNode>,
  x: number,
  y: number,
): PackPhysicsNode | null {
  let hit: PackPhysicsNode | null = null;
  let bestR = -1;
  for (const node of nodes) {
    const r = packNodeRadius(node);
    const dx = (node.x ?? node.targetX) - x;
    const dy = (node.y ?? node.targetY) - y;
    if (dx * dx + dy * dy <= r * r && r > bestR) {
      hit = node;
      bestR = r;
    }
  }
  return hit;
}

/** 悬停期间每帧驱动物理，使放大过程即产生挤压 */
export function tickPackPhysicsFrame(
  simulation: d3.Simulation<PackPhysicsNode, undefined>,
  alpha = 0.62,
  passes = 2,
): void {
  simulation.alpha(alpha);
  for (let i = 0; i < passes; i += 1) simulation.tick();
}

/** 测试用：同步消除重叠 */
export function settlePackOverlaps(
  nodes: PackPhysicsNode[],
  width: number,
  height: number,
  strokeWidth: number,
  ticks = 36,
): void {
  for (let i = 0; i < ticks; i += 1) {
    stepPackRenderScales(nodes, 1);
    relaxPackOverlaps(nodes, width, height, strokeWidth, 16);
  }
  enforcePackBounds(nodes, width, height, strokeWidth);
}

export function createPackPhysicsSimulation(
  nodes: PackPhysicsNode[],
  width: number,
  height: number,
  strokeWidth: number,
  plotRadiusScale = 1,
): PackPhysicsSimulation {
  let interaction: PackInteractionLevel = "idle";

  const simulation = d3
    .forceSimulation(nodes)
    .force(
      "x",
      d3.forceX<PackPhysicsNode>((d) => d.targetX).strength((d) => resolveAnchorStrength(d, interaction)),
    )
    .force(
      "y",
      d3.forceY<PackPhysicsNode>((d) => d.targetY).strength((d) => resolveAnchorStrength(d, interaction)),
    )
    .force(
      "collide",
      d3
        .forceCollide<PackPhysicsNode>((d) => packNodeCollideRadius(d, strokeWidth))
        .strength(0.92)
        .iterations(8),
    )
    .force("bounds", createPackBoundaryForce(width, height, strokeWidth, plotRadiusScale))
    .velocityDecay(0.28)
    .alphaDecay(0.014)
    .alphaMin(0.001) as PackPhysicsSimulation;

  simulation.on("tick", () => {
    enforcePackBounds(nodes, width, height, strokeWidth, plotRadiusScale);
  });

  simulation.setInteraction = (level: PackInteractionLevel) => {
    interaction = level;
    simulation.velocityDecay(level === "hover" ? 0.26 : 0.3);
    simulation
      .force(
        "x",
        d3.forceX<PackPhysicsNode>((d) => d.targetX).strength((d) => resolveAnchorStrength(d, interaction)),
      )
      .force(
        "y",
        d3.forceY<PackPhysicsNode>((d) => d.targetY).strength((d) => resolveAnchorStrength(d, interaction)),
      );
  };

  simulation.reheat = () => {
    simulation.force(
      "collide",
      d3
        .forceCollide<PackPhysicsNode>((d) => packNodeCollideRadius(d, strokeWidth))
        .strength(0.92)
        .iterations(8),
    );
    simulation.force("bounds", createPackBoundaryForce(width, height, strokeWidth, plotRadiusScale));
    simulation.alpha(0.72).alphaTarget(0.3).restart();
  };

  return simulation;
}
