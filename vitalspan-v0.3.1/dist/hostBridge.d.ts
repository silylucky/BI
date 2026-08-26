import type { PluginViewData } from "./pluginRuntime";
export declare function readPluginViewData(): PluginViewData;
export declare function subscribePluginViewData(onChange: () => void): () => void;
export declare function navigateWorkspace(input: {
    viewId?: string;
    search?: string;
    target?: "experts" | "automation" | "marketplace" | "gallery" | "settings" | "workspace.home" | "chat.new";
}): void;
export declare function completeWorkspaceSetup(instanceConfig: Record<string, unknown>): void;
export declare function pluginExec<T = unknown>(toolName: string, params?: unknown): Promise<T>;
