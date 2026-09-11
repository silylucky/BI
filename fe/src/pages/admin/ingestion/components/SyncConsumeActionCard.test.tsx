import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import {
  ensureSyncDataset,
  fetchConsumeHints,
  prepareSyncConsume,
  type SyncJobConsumeHints,
} from "@/lib/syncConsumeApi";
import { SyncConsumeActionCard } from "./SyncConsumeActionCard";

vi.mock("@/lib/syncConsumeApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/syncConsumeApi")>();
  return {
    ...actual,
    fetchConsumeHints: vi.fn(),
    prepareSyncConsume: vi.fn(),
    ensureSyncDataset: vi.fn(),
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockFetchConsumeHints = vi.mocked(fetchConsumeHints);
const mockPrepareSyncConsume = vi.mocked(prepareSyncConsume);
const mockEnsureSyncDataset = vi.mocked(ensureSyncDataset);

function hints(overrides: Partial<SyncJobConsumeHints> = {}): SyncJobConsumeHints {
  return {
    targetTable: "orders_clean",
    suggestedDatasetId: "orders_clean",
    analyticsDatasourceId: "ds-analytics",
    analyticsReady: true,
    datasetId: "orders_clean",
    datasetExists: false,
    datasetBound: false,
    nextAction: "ensure_dataset",
    consumeLabel: "pending_dataset",
    ...overrides,
  };
}

function renderCard(props: Partial<React.ComponentProps<typeof SyncConsumeActionCard>> = {}) {
  return render(
    <MemoryRouter>
      <SyncConsumeActionCard
        jobId="job-1"
        jobName="同步2"
        targetTable="orders_clean"
        rowsSynced={5}
        canManage
        onDismiss={vi.fn()}
        onUpdated={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe("SyncConsumeActionCard", () => {
  beforeEach(() => {
    mockFetchConsumeHints.mockResolvedValue(hints());
    mockPrepareSyncConsume.mockResolvedValue({
      analyticsDatasourceId: "ds-analytics",
      analyticsReady: true,
      created: false,
    });
    mockEnsureSyncDataset.mockResolvedValue({
      datasetId: "orders_clean",
      boundConfigId: "cfg-1",
      created: true,
      bound: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows ensure_dataset button and calls ensureSyncDataset on click", async () => {
    const onUpdated = vi.fn();
    renderCard({ onUpdated });

    expect(await screen.findByRole("button", { name: "一键创建数据集并绑定" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "一键创建数据集并绑定" }));

    await waitFor(() => {
      expect(mockEnsureSyncDataset).toHaveBeenCalledWith("job-1");
    });
    expect(toast.success).toHaveBeenCalled();
    expect(onUpdated).toHaveBeenCalled();
  });

  it("shows open_dashboard actions when dataset is bound", async () => {
    mockFetchConsumeHints.mockResolvedValue(
      hints({
        datasetExists: true,
        datasetBound: true,
        nextAction: "open_dashboard",
        consumeLabel: "ready",
      }),
    );

    renderCard();

    expect(await screen.findByRole("link", { name: "创建看板" })).toHaveAttribute(
      "href",
      "/admin/dashboards",
    );
    expect(screen.getByRole("link", { name: "查看数据集" })).toHaveAttribute(
      "href",
      "/admin/datasets/orders_clean/edit",
    );
    expect(screen.queryByRole("button", { name: "一键创建数据集并绑定" })).not.toBeInTheDocument();
  });

  it("calls onDismiss when close button clicked", async () => {
    const onDismiss = vi.fn();
    renderCard({ onDismiss });

    await screen.findByRole("button", { name: "一键创建数据集并绑定" });
    fireEvent.click(screen.getByRole("button", { name: "关闭引导" }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("shows API error when fetchConsumeHints fails", async () => {
    mockFetchConsumeHints.mockRejectedValue({
      code: "ANALYTICS_DB_NOT_CONFIGURED",
      message: "托管分析库未配置或不可达",
    });

    renderCard();

    expect(await screen.findByText("操作失败，请稍后重试")).toBeInTheDocument();
  });

  it("auto prepare when nextAction is prepare and canManage", async () => {
    mockFetchConsumeHints
      .mockResolvedValueOnce(
        hints({
          analyticsReady: false,
          nextAction: "prepare",
          consumeLabel: "pending_prepare",
        }),
      )
      .mockResolvedValueOnce(
        hints({
          analyticsReady: true,
          nextAction: "ensure_dataset",
          consumeLabel: "pending_dataset",
        }),
      );

    const onUpdated = vi.fn();
    renderCard({ onUpdated });

    await waitFor(() => {
      expect(mockPrepareSyncConsume).toHaveBeenCalledWith("job-1");
    });
    expect(await screen.findByRole("button", { name: "一键创建数据集并绑定" })).toBeInTheDocument();
    expect(onUpdated).toHaveBeenCalled();
  });

  it("shows shared target warning when sibling job names provided", async () => {
    renderCard({ sharedTargetJobNames: ["同步1", "demo-orders"] });

    await screen.findByRole("button", { name: "一键创建数据集并绑定" });
    expect(screen.getByText(/2 个历史任务也写入/)).toBeInTheDocument();
    expect(screen.getByText(/新建任务已禁止共表/)).toBeInTheDocument();
  });
});
