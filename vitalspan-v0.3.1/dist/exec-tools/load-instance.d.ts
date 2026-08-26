type ExecCtx = {
    signal?: AbortSignal;
};
type LoadInstanceParams = {
    baseUrl?: string;
    apiBaseUrl?: string;
    feAdminUrl?: string;
    instanceId?: string;
    limit?: number;
};
export type ArtifactRow = {
    id: string;
    name: string;
    tier?: string;
};
export type DashboardRow = {
    id: string;
    name: string;
    surfaceKind?: string;
};
export type LoadInstanceResult = {
    ok: boolean;
    error?: string;
    instanceId?: string;
    apiBaseUrl?: string;
    feAdminUrl?: string;
    artifacts?: ArtifactRow[];
    dashboards?: DashboardRow[];
};
export declare function run(params: LoadInstanceParams, ctx: ExecCtx): Promise<LoadInstanceResult>;
export {};
