import { type VitalSpanConfig } from "./shared";
export type SurfaceKind = "dashboard" | "data-screen";
export declare const SURFACE_LABELS: Record<SurfaceKind, string>;
export declare function normalizeSurfaceKind(raw: string | undefined): SurfaceKind | null;
export declare function getSurfacePreset(kind: SurfaceKind): {
    kind: "data-screen";
    canvas: {
        width: number;
        height: number;
    };
    widgetWidth: number;
    widgetHeight: number;
    colWidth: number;
    rowHeight: number;
    styleConfig: {
        surfaceKind: string;
        colorScheme: string;
        scaleMode: string;
        gapPreset: string;
        widgetGap: number;
        pixelGutter: number;
        refreshIntervalSec: number;
    };
} | {
    kind: "dashboard";
    canvas: {
        width: number;
        height: number;
    };
    widgetWidth: number;
    widgetHeight: number;
    colWidth: number;
    rowHeight: number;
    styleConfig: {
        surfaceKind: string;
        colorScheme: string;
        scaleMode: string;
        gapPreset?: undefined;
        widgetGap?: undefined;
        pixelGutter?: undefined;
        refreshIntervalSec?: undefined;
    };
};
export declare function buildEditUrl(feBase: string, dashboardId: string, kind: SurfaceKind): string;
export declare function fetchDashboardSurfaceKind(cfg: VitalSpanConfig, token: string, dashboardId: string): Promise<{
    surfaceKind: SurfaceKind;
    name: string;
}>;
