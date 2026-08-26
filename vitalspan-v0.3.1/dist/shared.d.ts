import { type ToolContext } from "@deeptalk/plugin-sdk";
export interface VitalSpanConfig {
    apiBase: string;
    feBase: string;
    username: string;
    password: string;
    vitalspanRoot?: string;
}
export declare function pluginRootDir(): string;
export declare function loadConfig(ctx: ToolContext): VitalSpanConfig;
export declare function requestJson<T>(method: string, url: string, body: unknown, token?: string, timeoutMs?: number): Promise<T>;
export declare function login(cfg: VitalSpanConfig): Promise<string>;
export declare function healthCheck(cfg: VitalSpanConfig): Promise<string>;
export declare function resolveBundlePath(ctx: ToolContext, fileArg: string): string;
export declare function copyFromOutput(ctx: ToolContext, fromArg: string): string;
export declare function readBundle(filePath: string): Record<string, unknown>;
export declare function tryPythonPublish(ctx: ToolContext, cfg: VitalSpanConfig, fileArg: string, artifactId?: string, options?: {
    validateOnly?: boolean;
}): string | null;
export declare function parseInput(callInput: unknown): import("@deeptalk/plugin-sdk").ParseToolInputResult;
export declare function relWorkspacePath(ctx: ToolContext, absPath: string): string;
export declare function loadEditorSaveBody(filePath: string): Record<string, unknown>;
