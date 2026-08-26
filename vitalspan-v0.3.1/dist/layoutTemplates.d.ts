import { type ScreenShellConfig } from "./screenShell";
import type { SurfaceKind } from "./surface";
export interface LayoutTemplateSlot {
    type: "chart" | "customViz";
    title: string;
    x: number;
    y: number;
    width: number;
    height: number;
    defaultChartType?: string;
}
export interface LayoutTemplateDef {
    id: string;
    name: string;
    description?: string;
    surfaceKind: SurfaceKind;
    canvas: {
        width: number;
        height: number;
    };
    styleConfig: Record<string, unknown>;
    slots: LayoutTemplateSlot[];
    shell?: ScreenShellConfig | false;
    tags?: string[];
}
export interface LayoutTemplateCatalogItem {
    id: string;
    name: string;
    surfaceKind: SurfaceKind;
    tags?: string[];
    chartSlots: number;
    customVizSlots: number;
    description?: string;
}
export declare function listLayoutTemplateCatalog(): LayoutTemplateCatalogItem[];
export declare function listLayoutTemplateIds(): string[];
export declare function resolveLayoutTemplateId(raw: string | undefined): string | null;
export declare function buildLayoutFromTemplate(templateId: string, chartTypes: string[], artifactIds: string[], expectedSurface?: SurfaceKind): {
    layout: Record<string, unknown>;
    notes: string[];
};
export declare function validateAllLayoutTemplates(): string[];
