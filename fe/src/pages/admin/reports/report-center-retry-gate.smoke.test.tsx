import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScheduleRecentFailuresPanel } from "./components/ScheduleRecentFailuresPanel";

const mockApiFetch = vi.fn();
vi.mock("@/lib/api", () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
}

describe("Report center retry gating", () => {
  beforeEach(() => {
    mockApiFetch.mockResolvedValue({
      items: [
        {
          executionId: "ex-1",
          scheduleId: "sched-1",
          status: "failed",
          executedAt: "2026-08-09T08:00:00Z",
          errorMessage: "SMTP failed",
        },
      ],
      total: 1,
    });
  });
  afterEach(() => cleanup());

  it("hides retry when Hub does not pass onRetry", async () => {
    render(
      wrap(
        <ScheduleRecentFailuresPanel
          onSelectSchedule={() => undefined}
        />,
      ),
    );
    expect(await screen.findByText(/近期失败/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重试" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "查看调度" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId("schedule-recent-failures-toggle"));
    expect(screen.getByRole("button", { name: "查看调度" })).toBeInTheDocument();
  });

  it("shows retry when Hub passes onRetry", async () => {
    render(
      wrap(
        <ScheduleRecentFailuresPanel
          onSelectSchedule={() => undefined}
          onRetry={() => undefined}
        />,
      ),
    );
    await userEvent.click(await screen.findByTestId("schedule-recent-failures-toggle"));
    expect(await screen.findByRole("button", { name: "重试" })).toBeInTheDocument();
  });
});
