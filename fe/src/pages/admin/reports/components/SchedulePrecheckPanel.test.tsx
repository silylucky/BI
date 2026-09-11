import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SchedulePrecheckPanel } from "./SchedulePrecheckPanel";

const mockApiFetch = vi.fn();
vi.mock("@/lib/api", () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));

function renderPanel(props: Partial<React.ComponentProps<typeof SchedulePrecheckPanel>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <SchedulePrecheckPanel sourceLabel="销售看板" widgetCount={3} {...props} />
    </QueryClientProvider>,
  );
}

describe("SchedulePrecheckPanel", () => {
  beforeEach(() => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("delivery-health")) {
        return { status: "reachable", host: "localhost", port: 1025, error: null };
      }
      if (path.includes("export-health")) {
        return { status: "available", error: null };
      }
      return {};
    });
  });
  afterEach(() => cleanup());

  it("shows all checks passed when dependencies ready", async () => {
    renderPanel();
    expect(await screen.findByText("创建前检查")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/PDF 导出服务就绪/)).toBeInTheDocument());
    expect(screen.getByText(/发信通道可用/)).toBeInTheDocument();
  });

  it("shows refresh control", async () => {
    renderPanel();
    expect(await screen.findByRole("button", { name: /重新检查/ })).toBeInTheDocument();
  });

  it("warns when export health unavailable", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("delivery-health")) {
        return { status: "reachable", host: "localhost", port: 1025, error: null };
      }
      if (path.includes("export-health")) {
        return { status: "unavailable", error: "Playwright 未安装" };
      }
      return {};
    });
    renderPanel();
    expect(await screen.findByText(/Playwright 未安装/)).toBeInTheDocument();
    expect(screen.getByText(/pip install/)).toBeInTheDocument();
  });

});
