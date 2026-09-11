import { ApiRequestError } from "@/lib/api";

/** 仅在这些错误下清除本地 token；网络/超时/503 等瞬时故障应保留会话 */
const SESSION_INVALID_CODES = new Set([
  "UNAUTHORIZED",
  "TOKEN_REVOKED",
  "AUTH_USER_DISABLED",
  "AUTH_USER_LOCKED",
]);

export function shouldClearAuthSession(error: unknown): boolean {
  return error instanceof ApiRequestError && SESSION_INVALID_CODES.has(error.code ?? "");
}
