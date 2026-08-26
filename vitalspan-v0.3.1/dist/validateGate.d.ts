import type { ToolContext } from "@deeptalk/plugin-sdk";
export type ValidateStampMode = "local" | "python";
export declare function computeBundleFingerprint(bundle: Record<string, unknown>): string;
export declare function recordValidateStamp(ctx: ToolContext, relPath: string, fingerprint: string, mode: ValidateStampMode): void;
export declare function checkValidateGate(ctx: ToolContext, relPath: string, fingerprint: string): {
    ok: true;
} | {
    ok: false;
    lines: string[];
};
export declare const VALIDATE_STAMP_OK = "validate stamp ok";
