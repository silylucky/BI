export type PluginSnapshot = {
    id: string;
    version: string;
    templateId?: string;
    templateVersion?: string;
};
export type VitalSpanBinding = {
    mode: "demo" | "live";
    apiBaseUrl: string;
    feAdminUrl: string;
};
export type DomainBindingResult = {
    ok: true;
    plugin: PluginSnapshot;
    binding: VitalSpanBinding;
} | {
    ok: false;
    reason: string;
};
export declare function readDomainBinding(instanceConfig: Record<string, unknown> | undefined): DomainBindingResult;
export declare function buildDefaultInstanceConfig(binding: VitalSpanBinding): Record<string, unknown>;
