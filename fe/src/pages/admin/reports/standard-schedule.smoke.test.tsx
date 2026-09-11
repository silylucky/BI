import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StandardSchedulePanel } from "./components/StandardSchedulePanel";

const mockApiFetch = vi.fn();
vi.mock("@/lib/api", () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <TooltipProvider delayDuration={0}>{ui}</TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("StandardSchedulePanel smoke", () => {
  beforeEach(() => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("/users")) {
        return { items: [{ id: "u1", username: "admin" }] };
      }
      if (path.includes("/schedules?") && !path.includes("/executions")) {
        return { items: [], total: 0 };
      }
      if (path.includes("/delivery-health")) {
        return { status: "reachable" };
      }
      if (path.includes("/export-health")) {
        return { status: "available" };
      }
      return {};
    });
  });
  afterEach(() => cleanup());

  it("renders email-only delivery form", async () => {
    render(wrap(<StandardSchedulePanel sourceKey="equipment-overview" packName="设备标准分析" />));
    expect(await screen.findByText("定时投递")).toBeInTheDocument();
    expect(screen.getByText("新建定时投递")).toBeInTheDocument();
    expect(screen.getByText("邮件投递")).toBeInTheDocument();
    expect(screen.getByText("发信通道")).toBeInTheDocument();
    expect(screen.getByText("创建定时投递")).toBeInTheDocument();
    expect(screen.queryByText("钉钉")).not.toBeInTheDocument();
    expect(screen.queryByText("飞书")).not.toBeInTheDocument();
    expect(screen.queryByText("同时发到群")).not.toBeInTheDocument();
    expect(screen.queryByText(/Playwright/i)).not.toBeInTheDocument();
  });
});
