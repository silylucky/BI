export type PluginViewData = {
    workspaceRoot?: string;
    workspaceMode?: string;
    viewId?: string;
    routeSearch?: string;
    routeHash?: string;
    phase?: string;
    templateId?: string;
    workspacePath?: string;
    displayName?: string;
    scene?: unknown;
    instanceConfig?: Record<string, unknown>;
    authenticatedIdentity?: unknown;
};
declare global {
    interface Window {
        __pluginViewData?: PluginViewData;
        __pluginViewAction?: (action: string, payload?: unknown) => void;
        pluginExec?: (toolName: string, params?: unknown) => Promise<unknown>;
    }
}
export {};
