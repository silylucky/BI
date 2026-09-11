import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  Brain,
  Check,
  ChevronDown,
  FileArchive,
  FileText,
  Gauge,
  HardDriveUpload,
  LoaderCircle,
  Paperclip,
  Plus,
  RefreshCw,
  SendHorizontal,
  Settings2,
  ShieldCheck,
  TerminalSquare,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeaderIcon, AdminPageShell } from "@/components/layout/admin-page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, ApiRequestError, fetchWithTimeout, getAuthHeaders } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import { resolveApiBaseUrl } from "@/lib/appBasePath";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";

type JsonRecord = Record<string, unknown>;

type AgentHealth = {
  status: string;
  model: string;
  modelConfigured: boolean;
  tools: string[];
};

type AgentToolCall = {
  id: string;
  tool: string;
  args: JsonRecord;
  result?: unknown;
};

type AgentConfirmation = {
  confirmationId: string;
  tool: string;
  args: JsonRecord;
  message: string;
};

type AgentRound = {
  id: string;
  userMessage: string;
  assistantMessage: string;
  toolCalls: AgentToolCall[];
  confirmation?: AgentConfirmation;
  status: "streaming" | "completed" | "awaiting-confirmation" | "failed" | "cancelled";
};

type AgentSseEvent =
  | { type: "tool_call"; tool: string; args: JsonRecord }
  | { type: "tool_result"; tool: string; result: unknown }
  | {
      type: "confirmation_required";
      confirmation_id: string;
      tool: string;
      args: JsonRecord;
      message: string;
    }
  | { type: "answer"; content: string };

type AgentMemory = {
  id: string;
  content: string;
  category: string;
  importance: number;
  created_at: string;
  metadata?: JsonRecord;
};

type AgentUpload = {
  id: string;
  name: string;
  contentType?: string | null;
  sizeBytes: number;
  createdAt: string;
};

type AgentPluginTool = {
  id: string;
  agent_name: string;
  description: string;
  enabled: boolean;
  requires_confirmation: boolean;
  compatibility_status: string;
  error_message?: string | null;
};

type AgentPlugin = {
  id: string;
  display_name: string;
  version: string;
  description: string;
  enabled: boolean;
  status: string;
  health_message?: string | null;
  tools: AgentPluginTool[];
};

type PluginListResponse = {
  plugins: AgentPlugin[];
  registeredTools: string[];
  canManage: boolean;
};

type PluginResourceResponse = {
  pluginId: string;
  resources: Record<string, Array<{ path: string; kind: string }>>;
};

const API_BASE = resolveApiBaseUrl();
const AGENT_SESSION_ID = "workspace";
const MAX_RESULT_PREVIEW_CHARS = 3_000;
const TOOL_LABELS: Record<string, string> = {
  vitalspan_list_dashboards: "查询可访问看板",
  vitalspan_get_dashboard: "读取看板详情",
  vitalspan_list_datasources: "查询可访问数据源",
  vitalspan_list_schemas: "读取 Schema",
  vitalspan_list_tables: "读取数据表",
  vitalspan_list_columns: "读取字段",
  vitalspan_execute_readonly_query: "执行只读查询",
  vitalspan_list_chart_types: "读取内置图表类型",
  vitalspan_create_dashboard: "创建仪表板",
  vitalspan_create_data_screen: "生成数据大屏",

  vitalspan_list_uploaded_files: "列出已上传附件",
  vitalspan_read_uploaded_file: "读取上传附件",
};

function makeRoundId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function safeJson(value: unknown, maxChars = MAX_RESULT_PREVIEW_CHARS): string {
  let serialized: string;
  try {
    serialized = JSON.stringify(value, null, 2);
  } catch {
    serialized = String(value);
  }
  return serialized.length > maxChars ? `${serialized.slice(0, maxChars)}\n…（内容已折叠）` : serialized;
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { hour12: false });
}

function statusLabel(status: AgentPlugin["status"]): string {
  if (status === "ready") return "就绪";
  if (status === "disabled") return "已停用";
  if (status === "unhealthy") return "预检失败";
  return status;
}

async function agentUpload(path: string, file: File): Promise<unknown> {
  const body = new FormData();
  body.append("file", file);
  const response = await fetchWithTimeout(`${API_BASE}${path}`, {
    method: "POST",
    body,
    headers: getAuthHeaders(),
    timeoutMs: 60_000,
  });
  if (!response.ok) {
    let detail = "上传失败，请稍后重试";
    try {
      const payload = (await response.json()) as { detail?: string; message?: string };
      detail = payload.detail ?? payload.message ?? detail;
    } catch {
      // 非 JSON 错误响应使用默认文案。
    }
    throw new ApiRequestError(detail, "HTTP_ERROR");
  }
  return response.json();
}

function updateRound(
  rounds: AgentRound[],
  roundId: string,
  updater: (round: AgentRound) => AgentRound,
): AgentRound[] {
  return rounds.map((round) => (round.id === roundId ? updater(round) : round));
}

function ToolActivity({ calls }: { calls: AgentToolCall[] }) {
  const [expanded, setExpanded] = useState(false);
  if (calls.length === 0) return null;

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-gray-50/70 dark:border-gray-800 dark:bg-white/[0.025]">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-theme-sm font-medium text-gray-700 hover:bg-gray-100/80 dark:text-gray-200 dark:hover:bg-white/[0.04]"
        onClick={() => setExpanded((current) => !current)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Wrench className="size-4 shrink-0 text-brand-500" aria-hidden />
          已调用 {calls.length} 个工具
        </span>
        <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} aria-hidden />
      </button>
      {expanded ? (
        <div className="space-y-2 border-t border-gray-200 px-3.5 py-3 dark:border-gray-800">
          {calls.map((call) => (
            <div key={call.id} className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-gray-800 dark:text-white/90">
                  {TOOL_LABELS[call.tool] ?? call.tool}
                </p>
                <Badge size="sm" variant="light" color={call.result === undefined ? "warning" : "success"}>
                  {call.result === undefined ? "执行中" : "已完成"}
                </Badge>
              </div>
              <details className="mt-2 group">
                <summary className="cursor-pointer text-theme-xs text-gray-500 marker:content-[''] dark:text-gray-400">
                  <span className="inline-flex items-center gap-1 group-open:text-brand-500">
                    <TerminalSquare className="size-3.5" aria-hidden />参数与结果
                  </span>
                </summary>
                <pre className="custom-scrollbar mt-2 max-h-64 overflow-auto rounded-lg bg-gray-950 p-3 text-xs leading-relaxed text-gray-100">
                  {safeJson({ 参数: call.args, ...(call.result === undefined ? {} : { 结果: call.result }) })}
                </pre>
              </details>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AgentMessage({
  round,
  onResolveConfirmation,
}: {
  round: AgentRound;
  onResolveConfirmation: (roundId: string, confirmation: AgentConfirmation, approved: boolean) => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-brand-500 px-4 py-3 text-sm leading-6 text-white shadow-theme-xs sm:max-w-[78%]">
        {round.userMessage}
      </div>

      <div className="max-w-[94%] sm:max-w-[84%]">
        <div className="flex items-start gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <Bot className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-gray-200 bg-white px-4 py-3 text-sm leading-6 text-gray-700 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-200">
            {round.assistantMessage ? (
              <p className="whitespace-pre-wrap">{round.assistantMessage}</p>
            ) : round.status === "streaming" ? (
              <span className="inline-flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <LoaderCircle className="size-4 animate-spin text-brand-500" aria-hidden />
                正在思考并调用所需工具…
              </span>
            ) : null}
            <ToolActivity calls={round.toolCalls} />
            {round.confirmation ? (
              <ConfirmationCard
                confirmation={round.confirmation}
                roundId={round.id}
                onResolveConfirmation={onResolveConfirmation}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmationCard({
  confirmation,
  roundId,
  onResolveConfirmation,
}: {
  confirmation: AgentConfirmation;
  roundId: string;
  onResolveConfirmation: (roundId: string, confirmation: AgentConfirmation, approved: boolean) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolve = async (approved: boolean) => {
    setPending(true);
    setError(null);
    try {
      await onResolveConfirmation(roundId, confirmation, approved);
    } catch (reason) {
      setError(mapApiError(reason));
    } finally {
      setPending(false);
    }
  };

  return (
    <Alert severity="warning" appearance="subtle" showIcon className="mt-3 p-3.5">
      <AlertTitle>需要确认写入操作</AlertTitle>
      <AlertDescription className="mt-1 leading-5">{confirmation.message}</AlertDescription>
      <pre className="custom-scrollbar mt-3 max-h-36 overflow-auto rounded-lg bg-white/70 p-2.5 text-xs text-gray-700 dark:bg-gray-950/30 dark:text-gray-300">
        {safeJson(confirmation.args, 1_000)}
      </pre>
      {error ? <p className="mt-2 text-theme-xs text-error-600 dark:text-error-400">{error}</p> : null}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => void resolve(false)}>
          取消
        </Button>
        <Button type="button" variant="primary" size="sm" loading={pending} loadingText="执行中…" onClick={() => void resolve(true)}>
          <Check className="size-4" aria-hidden />
          确认执行
        </Button>
      </div>
    </Alert>
  );
}

function EmptyChat({ onPrompt }: { onPrompt: (prompt: string) => void }) {
  const prompts = [
    "列出我可以查看的仪表板",
    "我有哪些可访问的数据源？",
    "基于销售数据生成一个数据大屏，先给我完整方案再执行",
    "帮我分析刚上传的 CSV 文件",
  ];

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-10 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 shadow-theme-xs dark:bg-brand-500/15 dark:text-brand-400">
        <Brain className="size-7" aria-hidden />
      </span>
      <h2 className="mt-4 text-title-sm font-semibold text-gray-900 dark:text-white">开始和 VitalSpan AI 助手对话</h2>
      <p className="mt-2 max-w-md text-theme-sm leading-6 text-gray-500 dark:text-gray-400">
        我会在您的现有数据权限范围内检索平台信息、执行只读查询，并在变更平台内容前请求确认。
      </p>
      <div className="mt-6 flex max-w-2xl flex-wrap justify-center gap-2">
        {prompts.map((prompt) => (
          <Button key={prompt} type="button" variant="surface" size="sm" onClick={() => onPrompt(prompt)}>
            {prompt}
          </Button>
        ))}
      </div>
    </div>
  );
}

function ChatWorkspace() {
  const queryClient = useQueryClient();
  const [rounds, setRounds] = useState<AgentRound[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const healthQuery = useQuery({
    queryKey: queryKeys.agent.health,
    queryFn: () => apiFetch<AgentHealth>("/api/v1/agent/health"),
    staleTime: 30_000,
  });

  const scrollToEnd = useCallback(() => {
    window.setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 50);
  }, []);

  const send = useCallback(
    async (prompt?: string) => {
      const message = (prompt ?? input).trim();
      if (!message || streaming) return;

      const roundId = makeRoundId();
      setInput("");
      setStreaming(true);
      setRounds((current) => [
        ...current,
        {
          id: roundId,
          userMessage: message,
          assistantMessage: "",
          toolCalls: [],
          status: "streaming",
        },
      ]);
      scrollToEnd();

      try {
        const response = await fetchWithTimeout(`${API_BASE}/api/v1/agent/chat`, {
          method: "POST",
          body: JSON.stringify({ sessionId: AGENT_SESSION_ID, message }),
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          timeoutMs: 180_000,
        });
        if (!response.ok || !response.body) {
          const detail = await response.text().catch(() => "");
          throw new ApiRequestError(detail || `AI 助手请求失败（HTTP ${response.status}）`, "HTTP_ERROR");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() ?? "";
          for (const chunk of chunks) {
            const dataLine = chunk
              .split("\n")
              .find((line) => line.startsWith("data:"));
            if (!dataLine) continue;
            try {
              const event = JSON.parse(dataLine.slice(5).trim()) as AgentSseEvent;
              setRounds((current) =>
                updateRound(current, roundId, (round) => {
                  if (event.type === "tool_call") {
                    return {
                      ...round,
                      toolCalls: [
                        ...round.toolCalls,
                        { id: makeRoundId(), tool: event.tool, args: event.args },
                      ],
                    };
                  }
                  if (event.type === "tool_result") {
                    const position = [...round.toolCalls]
                      .reverse()
                      .findIndex((call) => call.tool === event.tool && call.result === undefined);
                    const index = position < 0 ? -1 : round.toolCalls.length - 1 - position;
                    if (index < 0) {
                      return {
                        ...round,
                        toolCalls: [
                          ...round.toolCalls,
                          { id: makeRoundId(), tool: event.tool, args: {}, result: event.result },
                        ],
                      };
                    }
                    return {
                      ...round,
                      toolCalls: round.toolCalls.map((call, callIndex) =>
                        callIndex === index ? { ...call, result: event.result } : call,
                      ),
                    };
                  }
                  if (event.type === "confirmation_required") {
                    return {
                      ...round,
                      confirmation: {
                        confirmationId: event.confirmation_id,
                        tool: event.tool,
                        args: event.args,
                        message: event.message,
                      },
                      status: "awaiting-confirmation",
                    };
                  }
                  if (event.type === "answer") {
                    return {
                      ...round,
                      assistantMessage: event.content,
                      status: round.confirmation ? "awaiting-confirmation" : "completed",
                    };
                  }
                  return round;
                }),
              );
              scrollToEnd();
            } catch {
              // 忽略服务端网络分片造成的不完整事件。
            }
          }
        }
      } catch (reason) {
        setRounds((current) =>
          updateRound(current, roundId, (round) => ({
            ...round,
            assistantMessage: `对话请求失败：${mapApiError(reason)}`,
            status: "failed",
          })),
        );
      } finally {
        setStreaming(false);
      }
    },
    [input, scrollToEnd, streaming],
  );

  const resolveConfirmation = useCallback(
    async (roundId: string, confirmation: AgentConfirmation, approved: boolean) => {
      const response = await apiFetch<{
        status: "executed" | "cancelled";
        tool: string;
        result?: unknown;
        answer?: string;
      }>(`/api/v1/agent/tool-confirmations/${confirmation.confirmationId}/${approved ? "approve" : "cancel"}`, {
        method: "POST",
      });
      setRounds((current) =>
        updateRound(current, roundId, (round) => ({
          ...round,
          confirmation: undefined,
          toolCalls: approved
            ? round.toolCalls.map((call) =>
                call.tool === confirmation.tool && call.result === undefined
                  ? { ...call, result: response.result }
                  : call,
              )
            : round.toolCalls,
          assistantMessage: approved ? (response.answer ?? "已执行确认的操作。") : "已取消该操作。",
          status: approved ? "completed" : "cancelled",
        })),
      );
      if (approved) {
        toast.success("已执行确认的操作");
        await queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all });
      } else {
        toast.message("已取消该操作");
      }
    },
    [queryClient],
  );

  const clearSession = async () => {
    setClearing(true);
    try {
      await apiFetch(`/api/v1/agent/sessions/${AGENT_SESSION_ID}`, { method: "DELETE" });
      setRounds([]);
      setClearDialogOpen(false);
      toast.success("对话已清空");
    } catch (reason) {
      toast.error(mapApiError(reason));
    } finally {
      setClearing(false);
    }
  };

  return (
    <>
      <AdminPageShell
        layout="fill"
        title="AI 助手"
        description="基于您当前的数据权限，协助查询、分析与操作 VitalSpan。"
        icon={
          <AdminPageHeaderIcon>
            <Bot className="size-5" aria-hidden />
          </AdminPageHeaderIcon>
        }
        actions={
          <div className="flex items-center gap-2">
            <Badge
              size="sm"
              variant="light"
              color={healthQuery.data?.modelConfigured ? "success" : "warning"}
              startIcon={<span className="size-1.5 rounded-full bg-current" aria-hidden />}
            >
              {healthQuery.data?.modelConfigured ? healthQuery.data.model : "模型未配置"}
            </Badge>
            <Button type="button" variant="ghost" size="sm" onClick={() => setClearDialogOpen(true)} disabled={rounds.length === 0 || streaming}>
              <Trash2 className="size-4" aria-hidden />
              清空对话
            </Button>
          </div>
        }
      >
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden" variant="outlined">
          {healthQuery.isError ? (
            <Alert severity="error" appearance="subtle" className="m-4 mb-0">
              <AlertTitle>无法连接 AI 助手</AlertTitle>
              <AlertDescription>{mapApiError(healthQuery.error)}</AlertDescription>
            </Alert>
          ) : null}
          {!healthQuery.isLoading && healthQuery.data && !healthQuery.data.modelConfigured ? (
            <Alert severity="warning" appearance="subtle" className="m-4 mb-0">
              <AlertTitle>尚未配置 DeepSeek 模型</AlertTitle>
              <AlertDescription>请在后端设置 `DEEPSEEK_API_KEY` 后重启服务，再开始对话。</AlertDescription>
            </Alert>
          ) : null}

          <div className="custom-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
            {rounds.length === 0 ? <EmptyChat onPrompt={(prompt) => void send(prompt)} /> : (
              <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6">
                {rounds.map((round) => (
                  <AgentMessage key={round.id} round={round} onResolveConfirmation={resolveConfirmation} />
                ))}
                <div ref={endRef} />
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900 sm:px-6">
            <div className="mx-auto flex max-w-4xl items-end gap-2">
              <Textarea
                autosize
                minRows={1}
                maxRows={6}
                value={input}
                disabled={streaming}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                placeholder="输入问题，例如“列出我可以查看的仪表板”"
                aria-label="向 AI 助手输入消息"
                className="min-h-11 flex-1 py-2.5"
              />
              <IconButton
                type="button"
                aria-label="发送消息"
                tooltip="发送（Enter）"
                variant="primary"
                size="md"
                disabled={!input.trim() || streaming}
                onClick={() => void send()}
              >
                {streaming ? <LoaderCircle className="animate-spin" aria-hidden /> : <SendHorizontal aria-hidden />}
              </IconButton>
            </div>
            <p className="mx-auto mt-2 max-w-4xl text-theme-xs text-gray-500 dark:text-gray-400">
              Enter 发送，Shift + Enter 换行。涉及创建或写入操作时，助手会先请求您的确认。
            </p>
          </div>
        </Card>
      </AdminPageShell>

      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>清空当前对话？</AlertDialogTitle>
            <AlertDialogDescription>这会删除当前会话历史和未确认的操作请求，但不会清除长期记忆与附件。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={clearing} onClick={() => void clearSession()}>
              {clearing ? "清空中…" : "清空对话"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function UploadsPanel() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [contentDialog, setContentDialog] = useState<{ name: string; content: string } | null>(null);

  const uploadsQuery = useQuery({
    queryKey: queryKeys.agent.uploads,
    queryFn: () => apiFetch<{ files: AgentUpload[] }>("/api/v1/agent/uploads"),
  });

  const upload = async (file: File) => {
    setUploading(true);
    try {
      await agentUpload("/api/v1/agent/uploads", file);
      await queryClient.invalidateQueries({ queryKey: queryKeys.agent.uploads });
      toast.success(`已上传「${file.name}」`);
    } catch (reason) {
      toast.error(mapApiError(reason));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const readContent = async (file: AgentUpload) => {
    try {
      const data = await apiFetch<{ file: AgentUpload; content: string }>(`/api/v1/agent/uploads/${file.id}/content`);
      setContentDialog({ name: data.file.name, content: data.content });
    } catch (reason) {
      toast.error(mapApiError(reason));
    }
  };

  const remove = async (file: AgentUpload) => {
    setDeletingId(file.id);
    try {
      await apiFetch(`/api/v1/agent/uploads/${file.id}`, { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: queryKeys.agent.uploads });
      toast.success(`已删除「${file.name}」`);
    } catch (reason) {
      toast.error(mapApiError(reason));
    } finally {
      setDeletingId(null);
    }
  };

  const files = uploadsQuery.data?.files ?? [];

  return (
    <Card variant="outlined">
      <CardHeader className="gap-3 sm:items-start">
        <div>
          <CardTitle>附件</CardTitle>
          <CardDescription className="mt-1 whitespace-normal">上传后可在对话中让助手分析文件。单个文件最大 10 MB。</CardDescription>
        </div>
        <Button type="button" variant="primary" size="sm" loading={uploading} loadingText="上传中…" onClick={() => fileInputRef.current?.click()}>
          <HardDriveUpload className="size-4" aria-hidden />
          上传附件
        </Button>
        <input
          ref={fileInputRef}
          className="sr-only"
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </CardHeader>
      <CardContent>
        {uploadsQuery.isLoading ? <p className="text-theme-sm text-gray-500">正在读取附件…</p> : null}
        {uploadsQuery.isError ? <p className="text-theme-sm text-error-600 dark:text-error-400">{mapApiError(uploadsQuery.error)}</p> : null}
        {!uploadsQuery.isLoading && !uploadsQuery.isError && files.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <Paperclip className="size-6 text-gray-400" aria-hidden />
            <p className="mt-2 text-theme-sm font-medium text-gray-700 dark:text-gray-300">还没有上传附件</p>
            <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">支持文本、CSV、JSON、SQL 和常见代码文件的内容读取。</p>
          </div>
        ) : null}
        {files.length > 0 ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {files.map((file) => (
              <div key={file.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400">
                  <FileText className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">{file.name}</p>
                  <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">{formatBytes(file.sizeBytes)} · {formatDate(file.createdAt)}</p>
                </div>
                <Button type="button" variant="ghost" size="xs" onClick={() => void readContent(file)}>查看</Button>
                <IconButton type="button" variant="ghost" size="xs" aria-label={`删除 ${file.name}`} disabled={deletingId === file.id} onClick={() => void remove(file)}>
                  <Trash2 aria-hidden />
                </IconButton>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>

      <Dialog open={Boolean(contentDialog)} onOpenChange={(open) => !open && setContentDialog(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{contentDialog?.name ?? "附件内容"}</DialogTitle>
            <DialogDescription>仅展示已上传的文本类附件内容。</DialogDescription>
          </DialogHeader>
          <pre className="custom-scrollbar max-h-[60vh] overflow-auto rounded-xl bg-gray-950 p-4 text-xs leading-relaxed text-gray-100">
            {contentDialog?.content ?? ""}
          </pre>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setContentDialog(null)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function MemoryPanel() {
  const queryClient = useQueryClient();
  const [newMemory, setNewMemory] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const memoryQuery = useQuery({
    queryKey: queryKeys.agent.memories,
    queryFn: () => apiFetch<{ memories: AgentMemory[] }>("/api/v1/agent/memories?limit=100"),
  });

  const createMemory = async () => {
    const content = newMemory.trim();
    if (!content) return;
    setSaving(true);
    try {
      await apiFetch("/api/v1/agent/memories", {
        method: "POST",
        body: JSON.stringify({ content, sessionId: AGENT_SESSION_ID, category: "manual", importance: 0.8 }),
      });
      setNewMemory("");
      await queryClient.invalidateQueries({ queryKey: queryKeys.agent.memories });
      toast.success("已保存长期记忆");
    } catch (reason) {
      toast.error(mapApiError(reason));
    } finally {
      setSaving(false);
    }
  };

  const deleteMemory = async (memory: AgentMemory) => {
    setRemovingId(memory.id);
    try {
      await apiFetch(`/api/v1/agent/memories/${memory.id}`, { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: queryKeys.agent.memories });
      toast.success("已删除长期记忆");
    } catch (reason) {
      toast.error(mapApiError(reason));
    } finally {
      setRemovingId(null);
    }
  };

  const clearMemories = async () => {
    setClearing(true);
    try {
      await apiFetch("/api/v1/agent/memories", { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: queryKeys.agent.memories });
      setClearDialogOpen(false);
      toast.success("已清空长期记忆");
    } catch (reason) {
      toast.error(mapApiError(reason));
    } finally {
      setClearing(false);
    }
  };

  const memories = memoryQuery.data?.memories ?? [];

  return (
    <Card variant="outlined">
      <CardHeader>
        <div>
          <CardTitle>长期记忆</CardTitle>
          <CardDescription className="mt-1 whitespace-normal">仅对当前登录用户可见，用于让后续对话理解您的偏好与上下文。</CardDescription>
        </div>
        <Button type="button" variant="ghost" size="sm" disabled={memories.length === 0 || clearing} onClick={() => setClearDialogOpen(true)}>
          <Trash2 className="size-4" aria-hidden />
          清空
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Textarea
            autosize
            minRows={2}
            maxRows={5}
            value={newMemory}
            onChange={(event) => setNewMemory(event.target.value)}
            placeholder="例如：后续分析优先按自然周汇总 GMV。"
            aria-label="新增长期记忆"
          />
          <div className="flex justify-end">
            <Button type="button" size="sm" loading={saving} loadingText="保存中…" disabled={!newMemory.trim()} onClick={() => void createMemory()}>
              <Plus className="size-4" aria-hidden />
              保存记忆
            </Button>
          </div>
        </div>
        {memoryQuery.isLoading ? <p className="mt-5 text-theme-sm text-gray-500">正在读取长期记忆…</p> : null}
        {memoryQuery.isError ? <p className="mt-5 text-theme-sm text-error-600 dark:text-error-400">{mapApiError(memoryQuery.error)}</p> : null}
        {!memoryQuery.isLoading && !memoryQuery.isError && memories.length === 0 ? (
          <p className="mt-5 text-theme-sm text-gray-500 dark:text-gray-400">暂无长期记忆。对话摘要也会自动按用户隔离保存。</p>
        ) : null}
        {memories.length > 0 ? (
          <div className="custom-scrollbar mt-5 max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {memories.map((memory) => (
              <div key={memory.id} className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                <div className="flex items-start gap-2">
                  <p className="min-w-0 flex-1 whitespace-pre-wrap text-theme-sm leading-5 text-gray-700 dark:text-gray-300">{memory.content}</p>
                  <IconButton type="button" variant="ghost" size="xs" aria-label="删除记忆" disabled={removingId === memory.id} onClick={() => void deleteMemory(memory)}>
                    <X aria-hidden />
                  </IconButton>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-theme-xs text-gray-500 dark:text-gray-400">
                  <Badge size="sm" variant="light" color="light">{memory.category === "manual" ? "手动" : "对话"}</Badge>
                  <span>{formatDate(memory.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>清空所有长期记忆？</AlertDialogTitle>
            <AlertDialogDescription>此操作不可恢复，但不会影响平台数据、会话附件或已安装插件。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={clearing} onClick={() => void clearMemories()}>
              {clearing ? "清空中…" : "清空记忆"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function PluginPanel() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [configText, setConfigText] = useState("{}");
  const [resources, setResources] = useState<PluginResourceResponse["resources"] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [uninstallTarget, setUninstallTarget] = useState<AgentPlugin | null>(null);

  const pluginQuery = useQuery({
    queryKey: queryKeys.agent.plugins,
    queryFn: () => apiFetch<PluginListResponse>("/api/v1/agent/plugins"),
  });
  const plugins = pluginQuery.data?.plugins ?? [];
  const selected = useMemo(() => plugins.find((plugin) => plugin.id === selectedId) ?? null, [plugins, selectedId]);
  const canManage = pluginQuery.data?.canManage === true;

  useEffect(() => {
    if (selectedId && !plugins.some((plugin) => plugin.id === selectedId)) setSelectedId(null);
    if (!selectedId && plugins[0]) setSelectedId(plugins[0].id);
  }, [plugins, selectedId]);

  useEffect(() => {
    if (!selected || !canManage) {
      setConfigText("{}");
      setResources(null);
      return;
    }
    let active = true;
    void Promise.all([
      apiFetch<AgentPlugin & { config?: JsonRecord }>(`/api/v1/agent/plugins/${selected.id}`),
      apiFetch<PluginResourceResponse>(`/api/v1/agent/plugins/${selected.id}/resources`),
    ])
      .then(([plugin, result]) => {
        if (!active) return;
        setConfigText(JSON.stringify(plugin.config ?? {}, null, 2));
        setResources(result.resources);
      })
      .catch(() => {
        if (!active) return;
        setConfigText("{}");
        setResources(null);
      });
    return () => {
      active = false;
    };
  }, [canManage, selected]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.agent.plugins });
    await queryClient.invalidateQueries({ queryKey: queryKeys.agent.health });
  };

  const run = async (key: string, action: () => Promise<unknown>, message: string) => {
    setBusy(key);
    try {
      await action();
      await refresh();
      toast.success(message);
    } catch (reason) {
      toast.error(mapApiError(reason));
    } finally {
      setBusy(null);
    }
  };

  const uploadPackage = (file: File) => {
    void run("install-upload", () => agentUpload("/api/v1/agent/plugins/install/upload", file), "插件包已安装并完成预检");
  };

  const saveConfig = () => {
    if (!selected) return;
    let config: JsonRecord;
    try {
      const parsed: unknown = JSON.parse(configText);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
        throw new Error("配置必须是 JSON 对象");
      }
      config = parsed as JsonRecord;
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "配置 JSON 无效");
      return;
    }
    void run(
      `config-${selected.id}`,
      () => apiFetch(`/api/v1/agent/plugins/${selected.id}/config`, { method: "PUT", body: JSON.stringify({ config }) }),
      "插件配置已保存",
    );
  };

  return (
    <Card variant="outlined">
      <CardHeader className="sm:items-start">
        <div>
          <CardTitle>插件管理</CardTitle>
          <CardDescription className="mt-1 whitespace-normal">第三方插件为所有用户共享；所有调用均需明确确认，并仅可安装受控 ZIP 包。</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {canManage ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-3.5 dark:border-gray-700">
            <Label>受控 ZIP 插件包</Label>
            <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">安装包会进行路径、体积与符号链接校验，并复制至服务器受控目录。</p>
            <div className="mt-3 flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" loading={busy === "install-upload"} onClick={() => fileInputRef.current?.click()}>
                <FileArchive className="size-4" aria-hidden />
                上传 ZIP 插件包
              </Button>
              <input
                ref={fileInputRef}
                className="sr-only"
                type="file"
                accept=".zip"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) uploadPackage(file);
                  event.target.value = "";
                }}
              />
            </div>
          </div>
        ) : (
          <Alert severity="info" appearance="subtle">
            <AlertTitle>插件由管理员统一管理</AlertTitle>
            <AlertDescription>您可以查看已启用的插件；安装、配置、启停与卸载需要“管理 AI 助手插件”权限。</AlertDescription>
          </Alert>
        )}

        {pluginQuery.isLoading ? <p className="text-theme-sm text-gray-500">正在读取插件列表…</p> : null}
        {pluginQuery.isError ? <p className="text-theme-sm text-error-600 dark:text-error-400">{mapApiError(pluginQuery.error)}</p> : null}
        {!pluginQuery.isLoading && !pluginQuery.isError && plugins.length === 0 ? (
          <div className="rounded-xl bg-gray-50 px-4 py-8 text-center dark:bg-white/[0.03]">
            <Wrench className="mx-auto size-6 text-gray-400" aria-hidden />
            <p className="mt-2 text-theme-sm font-medium text-gray-700 dark:text-gray-300">暂无第三方插件</p>
            <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">VitalSpan 的数据和看板操作已作为内置工具提供。</p>
          </div>
        ) : null}

        {plugins.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
            <div className="space-y-2">
              {plugins.map((plugin) => (
                <button
                  key={plugin.id}
                  type="button"
                  className={cn(
                    "w-full rounded-xl border p-3 text-left transition-colors",
                    plugin.id === selected?.id
                      ? "border-brand-300 bg-brand-50 dark:border-brand-700 dark:bg-brand-500/10"
                      : "border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/[0.03]",
                  )}
                  onClick={() => setSelectedId(plugin.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 truncate font-medium text-gray-800 dark:text-white/90">{plugin.display_name}</span>
                    <Badge size="sm" variant="light" color={plugin.status === "unhealthy" ? "error" : plugin.enabled ? "success" : "light"}>{statusLabel(plugin.status)}</Badge>
                  </div>
                  <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">v{plugin.version}</p>
                </button>
              ))}
            </div>
            {selected ? (
              <div className="min-w-0 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-gray-900 dark:text-white">{selected.display_name}</h3>
                    <p className="mt-1 text-theme-sm leading-5 text-gray-500 dark:text-gray-400">{selected.description || "暂无描述"}</p>
                  </div>
                  <Badge size="sm" variant="light" color={selected.status === "unhealthy" ? "error" : selected.enabled ? "success" : "light"}>{statusLabel(selected.status)}</Badge>
                </div>
                {selected.health_message ? <p className="mt-3 text-theme-xs text-gray-500 dark:text-gray-400">预检：{selected.health_message}</p> : null}
                {canManage ? <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={selected.enabled ? "outline" : "primary"}
                    size="sm"
                    loading={busy === `toggle-${selected.id}`}
                    disabled={selected.status === "unhealthy"}
                    onClick={() => void run(
                      `toggle-${selected.id}`,
                      () => apiFetch(`/api/v1/agent/plugins/${selected.id}/${selected.enabled ? "disable" : "enable"}`, { method: "POST" }),
                      selected.enabled ? "插件已停用" : "插件已启用",
                    )}
                  >
                    {selected.enabled ? "停用插件" : "启用插件"}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" loading={busy === `health-${selected.id}`} onClick={() => void run(
                    `health-${selected.id}`,
                    () => apiFetch(`/api/v1/agent/plugins/${selected.id}/health-check`, { method: "POST" }),
                    "插件预检已完成",
                  )}>
                    <RefreshCw className="size-4" aria-hidden />
                    重新预检
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="text-error-600 hover:text-error-700 dark:text-error-400" onClick={() => setUninstallTarget(selected)}>
                    <Trash2 className="size-4" aria-hidden />
                    卸载
                  </Button>
                </div> : null}
                {canManage ? <div className="mt-5">
                  <Label htmlFor="plugin-config">运行配置（JSON）</Label>
                  <Textarea id="plugin-config" value={configText} onChange={(event) => setConfigText(event.target.value)} className="mt-2 font-mono text-xs" rows={6} spellCheck={false} />
                  <div className="mt-2 flex justify-end">
                    <Button type="button" size="sm" variant="outline" loading={busy === `config-${selected.id}`} onClick={saveConfig}>保存配置</Button>
                  </div>
                </div> : null}
                <div className="mt-5">
                  <h4 className="text-theme-sm font-medium text-gray-800 dark:text-white/90">Agent 工具</h4>
                  <div className="mt-2 space-y-2">
                    {selected.tools.map((tool) => (
                      <div key={tool.id} className="rounded-lg bg-gray-50 p-3 dark:bg-white/[0.03]">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <code className="text-theme-xs text-gray-700 dark:text-gray-300">{tool.agent_name}</code>
                          <Badge size="sm" variant="light" color={tool.compatibility_status === "compatible" && tool.enabled ? "success" : "warning"}>
                            {tool.requires_confirmation ? "需确认" : tool.enabled ? "可用" : "已关闭"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-theme-xs leading-5 text-gray-500 dark:text-gray-400">{tool.description}</p>
                        {tool.error_message ? <p className="mt-1 text-theme-xs text-error-600 dark:text-error-400">{tool.error_message}</p> : null}
                      </div>
                    ))}
                  </div>
                </div>
                {canManage ? <div className="mt-5">
                  <h4 className="text-theme-sm font-medium text-gray-800 dark:text-white/90">插件资源</h4>
                  {resources ? (
                    <div className="mt-2 space-y-1">
                      {Object.entries(resources).flatMap(([category, entries]) => entries.map((entry) => (
                        <p key={`${category}-${entry.path}`} className="truncate text-theme-xs text-gray-500 dark:text-gray-400">{category} · {entry.path}</p>
                      )))}
                    </div>
                  ) : <p className="mt-2 text-theme-xs text-gray-500">暂无可展示资源。</p>}
                </div> : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>

      <AlertDialog open={canManage && Boolean(uninstallTarget)} onOpenChange={(open) => !open && setUninstallTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>卸载插件？</AlertDialogTitle>
            <AlertDialogDescription>将卸载「{uninstallTarget?.display_name}」并删除其受控副本与运行配置。此操作会影响所有使用该插件的用户。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === `uninstall-${uninstallTarget?.id ?? ""}`}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy === `uninstall-${uninstallTarget?.id ?? ""}`}
              onClick={() => {
                if (!uninstallTarget) return;
                const target = uninstallTarget;
                void run(
                  `uninstall-${target.id}`,
                  () => apiFetch(`/api/v1/agent/plugins/${target.id}`, { method: "DELETE" }),
                  "插件已卸载",
                ).then(() => setUninstallTarget(null));
              }}
            >
              卸载
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export function AgentAssistantPage() {
  return (
    <Tabs defaultValue="chat" className="flex min-h-0 flex-1 flex-col gap-0">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3 px-1">
        <TabsList variant="enclosed" size="sm">
          <TabsTrigger value="chat" variant="enclosed" size="sm">
            <Bot className="size-4" aria-hidden />
            对话
          </TabsTrigger>
          <TabsTrigger value="workspace" variant="enclosed" size="sm">
            <Settings2 className="size-4" aria-hidden />
            助手工作区
          </TabsTrigger>
        </TabsList>
        <p className="hidden items-center gap-1.5 text-theme-xs text-gray-500 md:flex dark:text-gray-400">
          <ShieldCheck className="size-3.5 text-success-500" aria-hidden />
          工具调用继承当前账号的数据权限
        </p>
      </div>
      <TabsContent value="chat" className="mt-0 flex min-h-0 flex-1 flex-col">
        <ChatWorkspace />
      </TabsContent>
      <TabsContent value="workspace" className="custom-scrollbar mt-0 min-h-0 flex-1 overflow-y-auto pb-5">
        <AdminPageShell
          title="助手工作区"
          description="管理个人附件与长期记忆；插件变更会影响所有登录用户。"
          icon={
            <AdminPageHeaderIcon>
              <Gauge className="size-5" aria-hidden />
            </AdminPageHeaderIcon>
          }
        >
          <div className="grid gap-4 xl:grid-cols-2">
            <UploadsPanel />
            <MemoryPanel />
          </div>
          <div className="mt-4">
            <PluginPanel />
          </div>
          <Alert severity="info" appearance="subtle" className="mt-4">
            <AlertTitle>使用说明</AlertTitle>
            <AlertDescription>上传附件后，可切换回“对话”并直接说“分析刚上传的文件”。助手会先定位当前账户的附件，再在内容支持范围内读取分析。</AlertDescription>
          </Alert>
        </AdminPageShell>
      </TabsContent>
    </Tabs>
  );
}
