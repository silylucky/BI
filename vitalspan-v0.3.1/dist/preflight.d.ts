export type LocalPreflightResult = {
    ok: boolean;
    lines: string[];
};
export declare function localPreflightBundle(bundle: Record<string, unknown>): LocalPreflightResult;
export declare function formatHttpPublishError(status: number, body: string): string;
export declare function formatErrorBlock(code: string, message: string, httpStatus?: number): string[];
