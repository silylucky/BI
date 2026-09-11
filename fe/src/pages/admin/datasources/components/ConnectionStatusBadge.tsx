import { Badge } from "@/components/ui/badge";

export type ConnectionStatus = "untested" | "testing" | "ok" | "failed";

export function ConnectionStatusBadge({ status }: { status: ConnectionStatus }) {
  switch (status) {
    case "testing":
      return (
        <Badge variant="light" color="warning" size="sm">
          测试中
        </Badge>
      );
    case "ok":
      return (
        <Badge variant="light" color="success" size="sm">
          连接正常
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="light" color="error" size="sm">
          连接失败
        </Badge>
      );
    default:
      return (
        <Badge variant="light" color="light" size="sm">
          未测试
        </Badge>
      );
  }
}

export function deriveConnectionStatus(
  testing: boolean,
  error: string | null,
  result: { ok: boolean } | null,
): ConnectionStatus {
  if (testing) return "testing";
  if (error || (result != null && !result.ok)) return "failed";
  if (result?.ok) return "ok";
  return "untested";
}
