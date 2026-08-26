import { type SurfaceKind } from "./surface";
export declare function buildMixedDashboardLayout(chartTypes: string[], artifactIds: string[], surfaceKind?: SurfaceKind): Record<string, unknown>;
export declare function buildEmptySurfaceLayout(surfaceKind: SurfaceKind): Record<string, unknown>;
/** Agent 手写 layout 时 id 常非 UUID；保存前自动修正。 */
export declare function normalizeWidgetIds(layout: Record<string, unknown>): number;
export declare function alignLayoutToSurface(layout: Record<string, unknown>, surfaceKind: SurfaceKind): string[];
export declare function assertLayoutWithinCanvas(layout: Record<string, unknown>): void;
