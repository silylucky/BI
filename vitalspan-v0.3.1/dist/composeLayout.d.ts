export declare function resolveComposeLayout(chartTypes: string[], artifactIds: string[], surfaceKind: "dashboard" | "data-screen", templateRaw: string | undefined): {
    layout: Record<string, unknown>;
    notes: string[];
    templateId?: string;
};
