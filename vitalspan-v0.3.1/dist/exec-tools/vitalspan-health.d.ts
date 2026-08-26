type ExecCtx = {
    signal?: AbortSignal;
};
type HealthParams = {
    apiBaseUrl?: string;
};
type HealthResponse = {
    ok: boolean;
    healthUrl?: string;
    apiBase?: string;
    error?: string;
};
export declare function run(params: HealthParams, ctx: ExecCtx): Promise<HealthResponse>;
export {};
