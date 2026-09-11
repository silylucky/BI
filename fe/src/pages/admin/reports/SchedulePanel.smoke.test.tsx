import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SchedulePanel } from "./components/SchedulePanel";

const mockApiFetch = vi.fn();
vi.mock("@/lib/api", () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <TooltipProvider delayDuration={0}>{ui}</TooltipProvider>
    </QueryClientProvider>
  );
}

describe("SchedulePanel smoke", () => {
  beforeEach(() => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("/schedules?") && !path.includes("/executions")) {
        return { items: [], total: 0 };
      }
      return {};
    });
  });
  afterEach(() => cleanup());

  it("renders create schedule form with recipients", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("/users")) {
        return { items: [{ id: "u1", username: "admin" }] };
      }
      if (path.includes("/schedules?")) {
        return { items: [], total: 0 };
      }
      return {};
    });
    render(wrap(<SchedulePanel catalogNodeId="node-1" readOnly={false} />));
    expect(await screen.findByText("新建调度")).toBeInTheDocument();
    expect(screen.getByText("接收人")).toBeInTheDocument();
    expect(screen.getByText("创建调度")).toBeInTheDocument();
  });

  it("shows retry for degraded history", async () => {
    const scheduleId = "sched-1";
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("/schedules?")) {
        return {
          items: [
            {
              id: scheduleId,
              catalogNodeId: "node-1",
              cron: "0 8 * * *",
              timezone: "Asia/Shanghai",
              status: "scheduled",
              allowedActions: ["pause", "cancel"],
            },
          ],
          total: 1,
        };
      }
      if (path.includes("/executions")) {
        return {
          items: [
            {
              executionId: "ex-1",
              scheduleId,
              status: "semi_real_delivery_degraded",
              artifactRef: "semi://x",
              executedAt: "2026-07-07T00:00:00Z",
              errorMessage: "delivery degraded",
            },
          ],
          total: 1,
        };
      }
      return {};
    });
    render(wrap(<SchedulePanel catalogNodeId="node-1" readOnly={false} />));
    await waitFor(() => expect(screen.getByText("重试")).toBeInTheDocument());
  });
});
