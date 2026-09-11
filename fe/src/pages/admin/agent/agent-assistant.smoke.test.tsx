import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AgentAssistantPage } from "./AgentAssistantPage";

const mockApiFetch = vi.fn();

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => mockApiFetch(...args),
    fetchWithTimeout: vi.fn(),
    getAuthHeaders: vi.fn(() => ({})),
  };
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={0}>
        <AgentAssistantPage />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("AgentAssistantPage plugin management", () => {
  afterEach(() => {
    cleanup();
    mockApiFetch.mockReset();
  });

  it("keeps plugin mutation controls hidden for a user without management permission", async () => {
    mockApiFetch.mockImplementation((path: string) => {
      if (path === "/api/v1/agent/health") {
        return Promise.resolve({ status: "ok", model: "deepseek-chat", modelConfigured: true, tools: [] });
      }
      if (path === "/api/v1/agent/plugins") {
        return Promise.resolve({
          canManage: false,
          registeredTools: [],
          plugins: [{
            id: "plugin-1",
            display_name: "示例插件",
            version: "1.0.0",
            description: "只读可见",
            enabled: true,
            status: "ready",
            tools: [],
          }],
        });
      }
      if (path === "/api/v1/agent/uploads") return Promise.resolve({ files: [] });
      if (path === "/api/v1/agent/memories") return Promise.resolve({ memories: [] });
      return Promise.resolve({});
    });

    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: "助手工作区" }));

    await waitFor(() => {
      expect(screen.getByText("插件由管理员统一管理")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "上传 ZIP 插件包" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "停用插件" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("plugin-config")).not.toBeInTheDocument();
  });

  it("shows managed ZIP installation for a plugin manager", async () => {
    mockApiFetch.mockImplementation((path: string) => {
      if (path === "/api/v1/agent/health") {
        return Promise.resolve({ status: "ok", model: "deepseek-chat", modelConfigured: true, tools: [] });
      }
      if (path === "/api/v1/agent/plugins") {
        return Promise.resolve({ canManage: true, registeredTools: [], plugins: [] });
      }
      if (path === "/api/v1/agent/uploads") return Promise.resolve({ files: [] });
      if (path === "/api/v1/agent/memories") return Promise.resolve({ memories: [] });
      return Promise.resolve({});
    });

    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: "助手工作区" }));

    expect(await screen.findByRole("button", { name: "上传 ZIP 插件包" })).toBeInTheDocument();
    expect(screen.queryByText("从目录安装")).not.toBeInTheDocument();
  });
});
