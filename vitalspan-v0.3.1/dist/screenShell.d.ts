export declare const SCREEN_CLOCK_MARKER = "__vs_screen_clock__";
export type ScreenShellConfig = {
    title?: string;
    accent?: string;
    clock?: boolean;
};
export declare function buildScreenTitleBar(title: string, accent: string, order: number, canvasWidth?: number): Record<string, unknown>;
export declare function buildScreenClock(order: number, canvasWidth?: number): Record<string, unknown>;
export declare function buildInsightTextPlaceholder(slot: {
    title: string;
    x: number;
    y: number;
    width: number;
    height: number;
}, order: number): Record<string, unknown>;
export declare function resolveShellAccent(styleConfig: Record<string, unknown>): string;
export declare function buildDataScreenShellWidgets(tpl: {
    name: string;
    canvas: {
        width: number;
    };
    styleConfig: Record<string, unknown>;
}, shell: ScreenShellConfig | undefined, startOrder: number): Record<string, unknown>[];
