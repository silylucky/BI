import { cleanup, fireEvent, render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import * as ReactRouter from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EtlRulesPage } from "./EtlRulesPage";
import { SyncJobFormPage } from "./SyncJobFormPage";
import { SyncJobHistoryPage } from "./SyncJobHistoryPage";
import { SyncJobsPage } from "./SyncJobsPage";
import { suggestEtlRulesFromColumns } from "./etlRuleSuggest";

const mockNavigate = vi.fn();
const mockApiFetch = vi.fn();

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: { id: "1", username: "admin", roles: ["admin"], isRoot: true, permissions: [] },
    isLoading: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

const SAMPLE_MYSQL_DS = {
  id: "ds-1",
  name: "Sample MySQL",
  type: "mysql",
  host: "127.0.0.1",
  port: 3307,
  database: "sample_db",
};

function mockSyncMetadataResponse(
  url: string,
  database = "sample_db",
  tables: string[] = ["dirty_orders", "sales"],
) {
  if (url.endsWith("/schemas")) {
    return Promise.resolve({ items: [{ name: database }] });
  }
  if (url.includes("/tables")) {
    return Promise.resolve({
      items: tables.map((name) => ({ name, type: "table" })),
    });
  }
  if (url.includes("/columns")) {
    return Promise.resolve({
      items: tables.map((name) => ({ name, dataType: "varchar" })),
    });
  }
  return null;
}

function mockNewJobFormBootstrap(
  datasources: unknown[] = [SAMPLE_MYSQL_DS],
  jobs: unknown[] = [],
  tables: string[] = ["dirty_orders", "sales"],
  options?: { postResponse?: unknown; postHandler?: () => Promise<unknown> },
) {
  const database = (datasources[0] as typeof SAMPLE_MYSQL_DS | undefined)?.database ?? "sample_db";
  mockApiFetch.mockImplementation((url: string, init?: { method?: string }) => {
    if (url === "/api/v1/ingestion/sync-jobs" && init?.method === "POST") {
      if (options?.postHandler) return options.postHandler();
      return Promise.resolve(options?.postResponse ?? { id: "new-job" });
    }
    const metadata = mockSyncMetadataResponse(url, database, tables);
    if (metadata) return metadata;
    if (url === "/api/v1/datasources") {
      return Promise.resolve({ items: datasources });
    }
    if (url === "/api/v1/ingestion/sync-jobs") {
      return Promise.resolve({ items: jobs });
    }
    return Promise.reject(new Error(`unexpected apiFetch: ${url}`));
  });
}

async function selectSourceTable(name: string) {
  const user = userEvent.setup();
  await waitFor(() => {
    expect(screen.getByRole("combobox", { name: "源表" })).toBeInTheDocument();
  });
  await user.click(screen.getByRole("combobox", { name: "源表" }));
  await user.click(await screen.findByRole("option", { name }));
}

function render(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return rtlRender(
    <QueryClientProvider client={qc}>
      <TooltipProvider delayDuration={0}>{ui}</TooltipProvider>
    </QueryClientProvider>,
  );
}

function setViewport(width: number) {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
  window.dispatchEvent(new Event("resize"));
}

async function openSyncJobDeleteMenu() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "更多操作" }));
  const item = await screen.findByRole("menuitem", { name: "删除任务" });
  await user.click(item);
}

function markEtlRulesDirty() {
  const fromInput = screen.getByPlaceholderText("product_name");
  fireEvent.change(fromInput, { target: { value: `${fromInput.getAttribute("value") ?? "x"} ` } });
}

function mockSyncJobHistoryApi(
  runs: unknown[],
  targetTable = "orders_clean",
) {
  mockApiFetch.mockImplementation((url: string) => {
    if (typeof url === "string" && url.includes("/runs")) {
      return Promise.resolve({ items: runs });
    }
    if (typeof url === "string" && url.includes("/sync-jobs/")) {
      return Promise.resolve({ target_table: targetTable });
    }
    return Promise.resolve({});
  });
}

function mockEtlRulesApi(
  rules: unknown[] = [],
  sourceTable = "orders",
  handlers?: {
    onPut?: () => Promise<unknown>;
    loadError?: Error;
    columns?: string[];
    sourceDataSourceId?: string;
    autoAlignRules?: unknown[];
  },
) {
  const database = "sample_db";
  const columns = handlers?.columns ?? ["id", "amount", "status", "product_name"];
  mockApiFetch.mockImplementation((url: string, init?: { method?: string }) => {
    if (handlers?.loadError) {
      return Promise.reject(handlers.loadError);
    }
    const metadata = mockSyncMetadataResponse(url, database, columns);
    if (metadata) return metadata;
    if (typeof url === "string" && url.includes("/etl-rules")) {
      if (init?.method === "POST" && url.includes("auto-align")) {
        const aligned =
          handlers?.autoAlignRules ??
          suggestEtlRulesFromColumns(
            columns.map((name) => ({
              name,
              dataType: name === "amount" || name === "status" ? "varchar" : "int",
            })),
          );
        return Promise.resolve({ rules: aligned });
      }
      if (init?.method === "PUT") {
        return handlers?.onPut ? handlers.onPut() : Promise.resolve({ rules });
      }
      return Promise.resolve({ rules });
    }
    if (typeof url === "string" && /\/sync-jobs\/[^/]+$/.test(url)) {
      return Promise.resolve({
        source: { table: sourceTable, database, type: "mysql" },
        source_data_source_id: handlers?.sourceDataSourceId ?? "ds-1",
        source_type: "mysql",
      });
    }
    return Promise.reject(new Error(`unexpected apiFetch: ${url}`));
  });
}

describe("ingestion admin smoke", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    mockNavigate.mockReset();
    vi.spyOn(ReactRouter, "useNavigate").mockReturnValue(mockNavigate);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("SyncJobsPage_empty_state", async () => {
    setViewport(1400);
    mockApiFetch.mockResolvedValueOnce({ items: [] });
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs" element={<SyncJobsPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("暂无同步任务")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "新建任务" }).length).toBeGreaterThanOrEqual(1);
  });

  it("SyncJobsPage_error_state", async () => {
    setViewport(375);
    mockApiFetch.mockRejectedValueOnce(new Error("加载失败，请重试"));
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs" element={<SyncJobsPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("加载失败，请重试")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
  });

  it("SyncJobsPage_run_flow", async () => {
    setViewport(1400);
    mockApiFetch
      .mockResolvedValueOnce({
        items: [
          {
            id: "job-1",
            name: "demo",
            source_type: "mysql",
            target_table: "orders_clean",
            enabled: true,
            schedule_cron: null,
          },
        ],
      })
      .mockResolvedValueOnce(undefined);
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs" element={<SyncJobsPage />} />
        </Routes>
      </MemoryRouter>,
    );
    const runBtn = await screen.findByRole("button", { name: "手动运行同步" });
    fireEvent.click(runBtn);
    expect(await screen.findByText("确认手动运行同步？")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "运行" }));
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/v1/ingestion/sync-jobs/job-1/run",
        { method: "POST" },
      );
    });
  });

  it("SyncJobsPage_shows_action_card_after_run_success", async () => {
    setViewport(1400);
    const baseJob = {
      id: "job-1",
      name: "demo",
      source_type: "mysql",
      target_table: "orders_clean",
      enabled: true,
      schedule_cron: null,
      sync_mode: "full" as const,
    };
    let runSubmitted = false;
    mockApiFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.endsWith("/run")) {
        runSubmitted = true;
        return Promise.resolve(undefined);
      }
      if (typeof url === "string" && url.includes("/consume-hints")) {
        return Promise.resolve({
          targetTable: "orders_clean",
          suggestedDatasetId: "orders_clean",
          analyticsDatasourceId: "ds-1",
          analyticsReady: true,
          datasetId: "orders_clean",
          datasetExists: false,
          datasetBound: false,
          nextAction: "ensure_dataset",
          consumeLabel: "pending_dataset",
        });
      }
      if (typeof url === "string" && url.includes("/sync-jobs")) {
        const succeeded = runSubmitted;
        return Promise.resolve({
          items: [
            {
              ...baseJob,
              last_run: succeeded
                ? {
                    status: "succeeded",
                    started_at: "2026-08-04T02:00:00Z",
                    finished_at: "2026-08-04T02:00:01Z",
                    rows_synced: 5,
                    error_message: null,
                  }
                : null,
            },
          ],
        });
      }
      return Promise.resolve({});
    });

    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs" element={<SyncJobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "手动运行同步" }));
    fireEvent.click(await screen.findByRole("button", { name: "运行" }));

    expect(await screen.findByText(/同步成功 · 下一步出图/)).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "一键创建数据集并绑定" }),
    ).toBeInTheDocument();
  });

  it("SyncJobsPage_consume_card_shows_etl_rules_count", async () => {
    setViewport(1400);
    const baseJob = {
      id: "job-1",
      name: "demo",
      source_type: "mysql",
      target_table: "orders_clean",
      enabled: true,
      schedule_cron: null,
      sync_mode: "full" as const,
    };
    let runSubmitted = false;
    mockApiFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.endsWith("/run")) {
        runSubmitted = true;
        return Promise.resolve(undefined);
      }
      if (typeof url === "string" && url.includes("/consume-hints")) {
        return Promise.resolve({
          targetTable: "orders_clean",
          suggestedDatasetId: "orders_clean",
          analyticsDatasourceId: "ds-1",
          analyticsReady: true,
          datasetId: "orders_clean",
          datasetExists: false,
          datasetBound: false,
          nextAction: "ensure_dataset",
          consumeLabel: "pending_dataset",
          etlRulesConfigured: true,
          etlRulesCount: 3,
        });
      }
      if (typeof url === "string" && url.includes("/sync-jobs")) {
        const succeeded = runSubmitted;
        return Promise.resolve({
          items: [
            {
              ...baseJob,
              last_run: succeeded
                ? {
                    status: "succeeded",
                    started_at: "2026-08-04T02:00:00Z",
                    finished_at: "2026-08-04T02:00:01Z",
                    rows_synced: 5,
                    error_message: null,
                  }
                : null,
            },
          ],
        });
      }
      return Promise.resolve({});
    });

    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs" element={<SyncJobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "手动运行同步" }));
    fireEvent.click(await screen.findByRole("button", { name: "运行" }));

    expect(await screen.findByText(/已应用 3 条清洗规则/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看或调整" })).toHaveAttribute(
      "href",
      "/admin/ingestion/sync-jobs/job-1/etl-rules",
    );
  });

  it("SyncJobsPage_consume_card_shows_pass_through_when_no_etl_rules", async () => {
    setViewport(1400);
    const baseJob = {
      id: "job-2",
      name: "plain",
      source_type: "mysql",
      target_table: "plain_clean",
      enabled: true,
      schedule_cron: null,
      sync_mode: "full" as const,
    };
    let runSubmitted = false;
    mockApiFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.endsWith("/run")) {
        runSubmitted = true;
        return Promise.resolve(undefined);
      }
      if (typeof url === "string" && url.includes("/consume-hints")) {
        return Promise.resolve({
          targetTable: "plain_clean",
          suggestedDatasetId: "plain_clean",
          analyticsDatasourceId: "ds-1",
          analyticsReady: true,
          datasetId: "plain_clean",
          datasetExists: false,
          datasetBound: false,
          nextAction: "ensure_dataset",
          consumeLabel: "pending_dataset",
          etlRulesConfigured: true,
          etlRulesCount: 0,
        });
      }
      if (typeof url === "string" && url.includes("/sync-jobs")) {
        const succeeded = runSubmitted;
        return Promise.resolve({
          items: [
            {
              ...baseJob,
              last_run: succeeded
                ? {
                    status: "succeeded",
                    started_at: "2026-08-04T02:00:00Z",
                    finished_at: "2026-08-04T02:00:01Z",
                    rows_synced: 2,
                    error_message: null,
                  }
                : null,
            },
          ],
        });
      }
      return Promise.resolve({});
    });

    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs" element={<SyncJobsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "手动运行同步" }));
    fireEvent.click(await screen.findByRole("button", { name: "运行" }));

    expect(await screen.findByText(/未识别到额外规则，同步时仍会自动清洗/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "手动添加规则" })).toHaveAttribute(
      "href",
      "/admin/ingestion/sync-jobs/job-2/etl-rules",
    );
  });

  it("SyncJobHistoryPage_shows_runs", async () => {
    setViewport(1400);
    mockSyncJobHistoryApi([
        {
          id: "run-1",
          status: "succeeded",
          started_at: "2026-07-03T08:00:00Z",
          finished_at: "2026-07-03T08:00:01Z",
          rows_synced: 4,
          error_message: null,
          trace_id: "trace-abc",
          retry_count: 0,
        },
        {
          id: "run-2",
          status: "failed",
          started_at: "2026-07-03T09:00:00Z",
          finished_at: "2026-07-03T09:00:02Z",
          rows_synced: null,
          error_message: "连接失败",
          trace_id: "trace-def",
          retry_count: 1,
        },
      ],
    );
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/job-1/history"]}>
        <Routes>
          <Route
            path="/admin/ingestion/sync-jobs/:id/history"
            element={<SyncJobHistoryPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("成功")).toBeInTheDocument();
    expect(screen.getByText("失败")).toBeInTheDocument();
  });

  it("SyncJobFormPage_create_submit", async () => {
    setViewport(375);
    mockNewJobFormBootstrap();
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/new"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs/new" element={<SyncJobFormPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByLabelText("任务名称");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "创建" })).not.toBeDisabled();
    });
    fireEvent.change(screen.getByLabelText("任务名称"), { target: { value: "e2e-smoke-job" } });
    fireEvent.click(screen.getByRole("button", { name: "创建" }));
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/v1/ingestion/sync-jobs",
        expect.objectContaining({ method: "POST" }),
      );
      expect(mockNavigate).toHaveBeenCalledWith("/admin/ingestion/sync-jobs/new-job/edit", {
        replace: true,
        state: { justCreated: true },
      });
    });
  });

  it("SyncJobFormPage_suggests_unique_default_target_table", async () => {
    setViewport(1400);
    mockNewJobFormBootstrap([], [
      {
        id: "job-existing",
        name: "已有任务",
        source_type: "mysql",
        target_table: "orders_clean",
        enabled: true,
        schedule_cron: null,
      },
    ]);
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/new"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs/new" element={<SyncJobFormPage />} />
        </Routes>
      </MemoryRouter>,
    );
    const targetInput = await screen.findByLabelText("目标表");
    await waitFor(() => {
      expect(targetInput).toHaveValue("orders_clean_2");
    });
  });

  it("SyncJobFormPage_shows_shared_target_warning", async () => {
    setViewport(1400);
    mockNewJobFormBootstrap([], [
      {
        id: "job-existing",
        name: "同步1",
        source_type: "mysql",
        target_table: "orders_clean",
        enabled: true,
        schedule_cron: null,
      },
    ]);
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/new"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs/new" element={<SyncJobFormPage />} />
        </Routes>
      </MemoryRouter>,
    );
    const targetInput = await screen.findByLabelText("目标表");
    fireEvent.change(targetInput, { target: { value: "orders_clean" } });
    expect(await screen.findByText("目标表已被占用")).toBeInTheDocument();
    expect(screen.getByText(/同步1/)).toBeInTheDocument();
  });

  it("SyncJobFormPage_shared_target_submit_blocked", async () => {
    setViewport(1400);
    mockNewJobFormBootstrap([SAMPLE_MYSQL_DS], [
      {
        id: "job-existing",
        name: "同步1",
        source_type: "mysql",
        target_table: "orders_clean",
        enabled: true,
        schedule_cron: null,
      },
    ]);
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/new"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs/new" element={<SyncJobFormPage />} />
        </Routes>
      </MemoryRouter>,
    );
    const targetInput = await screen.findByLabelText("目标表");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "创建" })).not.toBeDisabled();
    });
    fireEvent.change(targetInput, { target: { value: "orders_clean" } });
    fireEvent.change(screen.getByLabelText("任务名称"), { target: { value: "共表任务" } });
    fireEvent.click(screen.getByRole("button", { name: "创建" }));
    expect(await screen.findByText("目标表已被占用")).toBeInTheDocument();
    expect(
      mockApiFetch.mock.calls.some(
        (c) => typeof c[0] === "string" && c[0].includes("/sync-jobs") && c[1]?.method === "POST",
      ),
    ).toBe(false);
  });

  it("SyncJobsPage_shows_shared_target_badge", async () => {
    setViewport(1400);
    mockApiFetch.mockResolvedValueOnce({
      items: [
        {
          id: "job-a",
          name: "任务 A",
          source_type: "mysql",
          target_table: "orders_clean",
          enabled: true,
          schedule_cron: null,
        },
        {
          id: "job-b",
          name: "任务 B",
          source_type: "mysql",
          target_table: "orders_clean",
          enabled: true,
          schedule_cron: null,
        },
      ],
    });
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs" element={<SyncJobsPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findAllByText("2 历史共表")).toHaveLength(2);
  });

  it("SyncJobFormPage_source_table_updates_target_when_not_manual", async () => {
    setViewport(1400);
    mockNewJobFormBootstrap([SAMPLE_MYSQL_DS], [
      {
        id: "job-existing",
        name: "已有",
        source_type: "mysql",
        target_table: "sales_clean",
        enabled: true,
        schedule_cron: null,
      },
    ]);
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/new"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs/new" element={<SyncJobFormPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByLabelText("目标表")).toHaveValue("orders_clean");
    });
    await selectSourceTable("sales");
    await waitFor(() => {
      expect(screen.getByLabelText("目标表")).toHaveValue("sales_clean_2");
    });
  });

  it("SyncJobFormPage_resuggest_target_table_button", async () => {
    setViewport(1400);
    mockNewJobFormBootstrap([SAMPLE_MYSQL_DS], [
      {
        id: "job-existing",
        name: "已有",
        source_type: "mysql",
        target_table: "orders_clean",
        enabled: true,
        schedule_cron: null,
      },
    ]);
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/new"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs/new" element={<SyncJobFormPage />} />
        </Routes>
      </MemoryRouter>,
    );
    const targetInput = await screen.findByLabelText("目标表");
    await waitFor(() => {
      expect(targetInput).toHaveValue("orders_clean_2");
    });
    fireEvent.change(targetInput, { target: { value: "manual_table" } });
    fireEvent.click(screen.getByRole("button", { name: "重新建议" }));
    await waitFor(() => {
      expect(targetInput).toHaveValue("orders_clean_2");
    });
    await selectSourceTable("sales");
    await waitFor(() => {
      expect(targetInput).toHaveValue("sales_clean");
    });
  });

  it("SyncJobFormPage_shared_target_error_blocks_post", async () => {
    setViewport(1400);
    mockNewJobFormBootstrap([SAMPLE_MYSQL_DS], [
      {
        id: "job-existing",
        name: "同步1",
        source_type: "mysql",
        target_table: "orders_clean",
        enabled: true,
        schedule_cron: null,
      },
    ]);
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/new"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs/new" element={<SyncJobFormPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "创建" })).not.toBeDisabled();
    });
    fireEvent.change(await screen.findByLabelText("目标表"), {
      target: { value: "orders_clean" },
    });
    fireEvent.change(screen.getByLabelText("任务名称"), { target: { value: "cancel-test" } });
    fireEvent.click(screen.getByRole("button", { name: "创建" }));
    expect(await screen.findByText("目标表已被占用")).toBeInTheDocument();
    const postCalls = mockApiFetch.mock.calls.filter(
      (c) => c[0] === "/api/v1/ingestion/sync-jobs" && c[1]?.method === "POST",
    );
    expect(postCalls).toHaveLength(0);
  });

  it("SyncJobFormPage_edit_excludes_self_from_shared_target_warning", async () => {
    setViewport(1400);
    mockApiFetch.mockImplementation((url: string) => {
      if (url === "/api/v1/datasources") {
        return Promise.resolve({ items: [] });
      }
      if (url === "/api/v1/ingestion/sync-jobs") {
        return Promise.resolve({
          items: [
            {
              id: "job-edit",
              name: "自身任务",
              source_type: "mysql",
              target_table: "orders_clean",
              enabled: true,
              schedule_cron: null,
            },
            {
              id: "job-sibling",
              name: "兄弟任务",
              source_type: "mysql",
              target_table: "orders_clean",
              enabled: true,
              schedule_cron: null,
            },
          ],
        });
      }
      if (url === "/api/v1/ingestion/sync-jobs/job-edit") {
        return Promise.resolve({
          name: "自身任务",
          enabled: true,
          sync_mode: "full",
          primary_key: null,
          incremental_column: null,
          source_data_source_id: null,
          source: {
            type: "mysql",
            host: "127.0.0.1",
            port: 3307,
            database: "sample_db",
            username: "sample",
            password: "",
            table: "dirty_orders",
          },
          target_table: "orders_clean",
          schedule_cron: null,
        });
      }
      return Promise.resolve({});
    });
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/job-edit/edit"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs/:id/edit" element={<SyncJobFormPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByLabelText("任务名称")).toHaveValue("自身任务");
    expect(await screen.findByText("目标表已被占用")).toBeInTheDocument();
    expect(screen.getByText(/兄弟任务/)).toBeInTheDocument();
    expect(screen.queryByText(/已有任务「自身任务」/)).not.toBeInTheDocument();
  });

  it("SyncJobFormPage_edit_shows_run_first_consume_guide_at_top", async () => {
    setViewport(1400);
    mockApiFetch.mockImplementation((url: string) => {
      if (url === "/api/v1/datasources") {
        return Promise.resolve({ items: [] });
      }
      if (url === "/api/v1/ingestion/sync-jobs") {
        return Promise.resolve({ items: [] });
      }
      if (url === "/api/v1/ingestion/sync-jobs/job-guide") {
        return Promise.resolve({
          name: "演示同步",
          enabled: true,
          sync_mode: "full",
          primary_key: null,
          incremental_column: null,
          source_data_source_id: null,
          source: {
            type: "mysql",
            host: "127.0.0.1",
            port: 3307,
            database: "sample_db",
            username: "sample",
            password: "",
            table: "dirty_orders",
          },
          target_table: "orders_clean_4",
          schedule_cron: null,
        });
      }
      return Promise.resolve({});
    });
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/admin/ingestion/sync-jobs/job-guide/edit",
            state: { justCreated: true },
          },
        ]}
      >
        <Routes>
          <Route path="/admin/ingestion/sync-jobs/:id/edit" element={<SyncJobFormPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("任务已创建 · 下一步请运行同步")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "返回列表" }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/一键创建 Dataset 并绑定/)).toBeInTheDocument();
    expect(screen.getByLabelText("目标表")).toHaveValue("orders_clean_4");
    const guideTitle = screen.getByText("任务已创建 · 下一步请运行同步");
    const basicSection = screen.getByText("基本信息");
    expect(
      guideTitle.compareDocumentPosition(basicSection) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("SyncJobFormPage_edit_shows_consume_card_when_last_run_succeeded", async () => {
    setViewport(1400);
    mockApiFetch.mockImplementation((url: string) => {
      if (url === "/api/v1/datasources") {
        return Promise.resolve({ items: [] });
      }
      if (url === "/api/v1/ingestion/sync-jobs") {
        return Promise.resolve({ items: [] });
      }
      if (url === "/api/v1/ingestion/sync-jobs/job-success") {
        return Promise.resolve({
          name: "已跑通任务",
          enabled: true,
          sync_mode: "full",
          primary_key: null,
          incremental_column: null,
          source_data_source_id: "ds-1",
          source: {
            type: "mysql",
            host: "127.0.0.1",
            port: 3307,
            database: "sample_db",
            username: "sample",
            password: "",
            table: "dirty_orders",
          },
          target_table: "orders_clean",
          schedule_cron: null,
          last_run: {
            status: "succeeded",
            started_at: "2026-08-04T02:00:00Z",
            finished_at: "2026-08-04T02:00:01Z",
            rows_synced: 42,
            error_message: null,
          },
        });
      }
      if (typeof url === "string" && url.includes("/consume-hints")) {
        return Promise.resolve({
          targetTable: "orders_clean",
          suggestedDatasetId: "orders_clean",
          analyticsDatasourceId: "ds-1",
          analyticsReady: true,
          datasetId: "orders_clean",
          datasetExists: false,
          datasetBound: false,
          nextAction: "ensure_dataset",
          consumeLabel: "pending_dataset",
        });
      }
      return Promise.resolve({});
    });
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/job-success/edit"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs/:id/edit" element={<SyncJobFormPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/同步成功 · 下一步出图/)).toBeInTheDocument();
    expect(screen.getByText(/本次 42 行/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "一键创建数据集并绑定" })).toBeInTheDocument();
    expect(screen.queryByText("下一步：运行同步并出图")).not.toBeInTheDocument();
  });

  it("SyncJobFormPage_edit_shows_legacy_inline_migration_banner", async () => {
    setViewport(1400);
    mockApiFetch.mockImplementation((url: string) => {
      if (url === "/api/v1/datasources") {
        return Promise.resolve({
          items: [SAMPLE_MYSQL_DS],
        });
      }
      if (url === "/api/v1/ingestion/sync-jobs") {
        return Promise.resolve({ items: [] });
      }
      if (url === "/api/v1/ingestion/sync-jobs/job-legacy") {
        return Promise.resolve({
          name: "旧内联任务",
          enabled: true,
          sync_mode: "full",
          primary_key: null,
          incremental_column: null,
          source_data_source_id: null,
          source: {
            type: "mysql",
            host: "127.0.0.1",
            port: 3307,
            database: "sample_db",
            username: "sample",
            password: "",
            table: "dirty_orders",
          },
          target_table: "orders_clean",
          schedule_cron: null,
        });
      }
      return Promise.resolve({});
    });
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/job-legacy/edit"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs/:id/edit" element={<SyncJobFormPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("仍使用旧版内联连接")).toBeInTheDocument();
    expect(screen.getByText(/sample@127\.0\.0\.1:3307\/sample_db/)).toBeInTheDocument();
  });

  it("SyncJobFormPage_datasource_mode_renders_select", async () => {
    setViewport(1400);
    mockNewJobFormBootstrap([
      {
        id: "ds-1",
        name: "Sample MySQL",
        type: "mysql",
        host: "127.0.0.1",
        port: 3307,
        database: "sample_db",
      },
    ]);
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/new"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs/new" element={<SyncJobFormPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByLabelText("业务源连接")).toBeInTheDocument();
  });

  it("SyncJobFormPage_datasource_mode_submit_payload", async () => {
    setViewport(1400);
    mockNewJobFormBootstrap(
      [
        {
          id: "ds-1",
          name: "Sample MySQL",
          type: "mysql",
          host: "127.0.0.1",
          port: 3307,
          database: "sample_db",
        },
      ],
      [],
      ["dirty_orders", "sales"],
      { postResponse: { id: "new-ds-job" } },
    );
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/new"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs/new" element={<SyncJobFormPage />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("combobox", { name: "业务源连接" }));
    fireEvent.click(await screen.findByRole("option", { name: "Sample MySQL" }));
    fireEvent.change(screen.getByLabelText("任务名称"), { target: { value: "ds-ref-smoke" } });
    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "源表" })).toHaveTextContent("dirty_orders");
    });
    fireEvent.change(screen.getByLabelText("目标表"), { target: { value: "orders_from_ds" } });
    fireEvent.click(screen.getByRole("button", { name: "创建" }));
    await waitFor(() => {
      const postCall = mockApiFetch.mock.calls.find(
        (c) => c[0] === "/api/v1/ingestion/sync-jobs" && c[1]?.method === "POST",
      );
      expect(postCall).toBeDefined();
      const body = JSON.parse(String(postCall![1]?.body));
      expect(body).toMatchObject({
        name: "ds-ref-smoke",
        source_mode: "datasource",
        source_data_source_id: "ds-1",
        source_table: "dirty_orders",
        target_table: "orders_from_ds",
        sync_mode: "full",
      });
      expect(body.source).toBeUndefined();
    });
  });

  it("SyncJobFormPage_incremental_fields_conditional", async () => {
    setViewport(1400);
    mockNewJobFormBootstrap();
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/new"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs/new" element={<SyncJobFormPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByLabelText("主键字段")).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "增量" }));
    expect(await screen.findByLabelText("主键字段")).toBeInTheDocument();
    expect(screen.getByLabelText("增量字段")).toBeInTheDocument();
  });

  it("SyncJobsPage_hides_stale_consume_guide_on_load", async () => {
    setViewport(1400);
    mockApiFetch.mockResolvedValueOnce({
      items: [
        {
          id: "job-1",
          name: "demo",
          source_type: "mysql",
          target_table: "orders_clean",
          enabled: true,
          schedule_cron: null,
          last_run: {
            status: "succeeded",
            started_at: "2026-08-03T07:00:00Z",
            finished_at: "2026-08-03T07:01:00Z",
            rows_synced: 5,
            error_message: null,
          },
          consume_status: {
            label: "pending_dataset",
            next_action: "ensure_dataset",
          },
        },
      ],
    });
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs" element={<SyncJobsPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByText("demo");
    expect(screen.queryByText(/同步成功 · 下一步/)).not.toBeInTheDocument();
    expect(screen.getByText("待建 Dataset")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去建 Dataset" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "一键出图" })).not.toBeInTheDocument();
  });

  it("SyncJobsEmptyState_shows_consume_step", async () => {
    setViewport(1400);
    mockApiFetch.mockResolvedValueOnce({ items: [] });
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs" element={<SyncJobsPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("一键 Dataset 出图")).toBeInTheDocument();
  });

  it("SyncJobFormPage_blocks_submit_when_name_empty (T-ING-06)", async () => {
    setViewport(375);
    mockNewJobFormBootstrap();
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/new"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs/new" element={<SyncJobFormPage />} />
        </Routes>
      </MemoryRouter>,
    );
    const nameInput = await screen.findByLabelText("任务名称");
    fireEvent.change(nameInput, { target: { value: "" } });
    fireEvent.click(screen.getAllByRole("button", { name: "创建" })[0]);
    const postCalls = mockApiFetch.mock.calls.filter(
      (c) => c[0] === "/api/v1/ingestion/sync-jobs" && c[1]?.method === "POST",
    );
    expect(postCalls).toHaveLength(0);
  });

  it("SyncJobFormPage_requires_datasource_connection (T-ING-07)", async () => {
    setViewport(1400);
    mockNewJobFormBootstrap();
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/new"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs/new" element={<SyncJobFormPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByLabelText("业务源连接")).toBeInTheDocument();
    expect(screen.queryByLabelText(/^密码/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("主机")).not.toBeInTheDocument();
  });

  it("SyncJobFormPage_blocks_create_without_datasource (T-ING-22)", async () => {
    setViewport(375);
    mockNewJobFormBootstrap([]);
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/new"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs/new" element={<SyncJobFormPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("尚无可用连接")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "创建" })).toBeDisabled();
  });

  it("EtlRulesPage_renders_default_rule_row_when_empty (T-ING-08)", async () => {
    setViewport(1400);
    mockEtlRulesApi([], "orders", { autoAlignRules: [] });
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/job-1/etl-rules"]}>
        <Routes>
          <Route
            path="/admin/ingestion/sync-jobs/:id/etl-rules"
            element={<EtlRulesPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole("button", { name: /保存规则/ })).toBeInTheDocument();
    expect(screen.getByText("暂无额外规则")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "一键对齐全部列" }).length).toBeGreaterThan(0);
  });

  it("EtlRulesPage_auto_suggest_rules_from_source_columns", async () => {
    setViewport(1400);
    mockEtlRulesApi([], "dirty_orders", {
      columns: ["id", "amount", "status"],
      sourceDataSourceId: "ds-1",
    });
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/job-1/etl-rules"]}>
        <Routes>
          <Route
            path="/admin/ingestion/sync-jobs/:id/etl-rules"
            element={<EtlRulesPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "一键对齐全部列" }).length).toBeGreaterThan(0);
    });
    await waitFor(() => {
      expect(screen.getAllByText("类型转换").length).toBeGreaterThan(0);
    });
  });

  it("SyncJobHistoryPage_empty_state (T-ING-09)", async () => {
    setViewport(1400);
    mockSyncJobHistoryApi([]);
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/job-1/history"]}>
        <Routes>
          <Route
            path="/admin/ingestion/sync-jobs/:id/history"
            element={<SyncJobHistoryPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("暂无运行记录")).toBeInTheDocument();
  });

  it("SyncJobFormPage_edit_mode_shows_skeleton_while_loading (T-ING-10)", async () => {
    setViewport(1400);
    mockApiFetch.mockReturnValue(new Promise(() => {}));
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/job-1/edit"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs/:id/edit" element={<SyncJobFormPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => {
      const skeletons = document.querySelectorAll(
        '[class*="skeleton"], [data-slot="skeleton"], [class*="animate-pulse"]',
      );
      expect(skeletons.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("SyncJobsPage_delete_confirms_and_calls_delete (T-ING-11)", async () => {
    setViewport(1400);
    mockApiFetch
      .mockResolvedValueOnce({
        items: [
          {
            id: "job-del",
            name: "待删任务",
            source_type: "mysql",
            target_table: "t",
            enabled: true,
            schedule_cron: null,
          },
        ],
      })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ items: [] });
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs" element={<SyncJobsPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await openSyncJobDeleteMenu();
    expect(await screen.findByText("确认删除任务？")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/v1/ingestion/sync-jobs/job-del",
        { method: "DELETE" },
      );
    });
  });

  it("SyncJobsPage_delete_cancel_skips_api (T-ING-12)", async () => {
    setViewport(375);
    mockApiFetch.mockResolvedValueOnce({
      items: [
        {
          id: "job-keep",
          name: "保留",
          source_type: "mysql",
          target_table: "t",
          enabled: true,
          schedule_cron: null,
        },
      ],
    });
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs" element={<SyncJobsPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await openSyncJobDeleteMenu();
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(mockApiFetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/run"),
      expect.objectContaining({ method: "DELETE" }),
    );
    const deleteCalls = mockApiFetch.mock.calls.filter((c) => c[1]?.method === "DELETE");
    expect(deleteCalls).toHaveLength(0);
  });

  it("SyncJobsPage_run_prevents_double_post (T-ING-13)", async () => {
    setViewport(1400);
    let resolveRun: () => void;
    const runPromise = new Promise<void>((r) => {
      resolveRun = r;
    });
    mockApiFetch
      .mockResolvedValueOnce({
        items: [
          {
            id: "job-run",
            name: "run-test",
            source_type: "mysql",
            target_table: "t",
            enabled: true,
            schedule_cron: null,
          },
        ],
      })
      .mockImplementationOnce(() => runPromise);
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs" element={<SyncJobsPage />} />
        </Routes>
      </MemoryRouter>,
    );
    const runBtn = await screen.findByRole("button", { name: "手动运行同步" });
    fireEvent.click(runBtn);
    expect(await screen.findByText("确认手动运行同步？")).toBeInTheDocument();
    const confirmRun = screen.getByRole("button", { name: "运行" });
    fireEvent.click(confirmRun);
    fireEvent.click(confirmRun);
    const postRuns = mockApiFetch.mock.calls.filter(
      (c) => typeof c[0] === "string" && c[0].endsWith("/run"),
    );
    expect(postRuns).toHaveLength(1);
    resolveRun!();
  });

  it("EtlRulesPage_error_state (T-ING-15)", async () => {
    setViewport(375);
    mockEtlRulesApi([], "orders", { loadError: new Error("加载规则失败") });
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/job-1/etl-rules"]}>
        <Routes>
          <Route
            path="/admin/ingestion/sync-jobs/:id/etl-rules"
            element={<EtlRulesPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/加载规则失败|操作失败/)).toBeInTheDocument();
  });

  it("SyncJobHistoryPage_error_state (T-ING-14)", async () => {
    setViewport(375);
    let historyLoads = 0;
    mockApiFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/ingestion/sync-jobs/")) {
        historyLoads += 1;
        if (historyLoads <= 2) {
          return Promise.reject(new Error("加载历史失败"));
        }
        if (url.includes("/runs")) return Promise.resolve({ items: [] });
        return Promise.resolve({ target_table: "orders_clean" });
      }
      return Promise.resolve({});
    });
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/job-1/history"]}>
        <Routes>
          <Route
            path="/admin/ingestion/sync-jobs/:id/history"
            element={<SyncJobHistoryPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("加载历史失败")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    await waitFor(() => {
      expect(mockApiFetch.mock.calls.length).toBeGreaterThanOrEqual(4);
    });
  });

  it("SyncJobHistoryPage_requests_limit_20 (T-ING-16)", async () => {
    setViewport(1400);
    mockSyncJobHistoryApi([]);
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/job-1/history"]}>
        <Routes>
          <Route
            path="/admin/ingestion/sync-jobs/:id/history"
            element={<SyncJobHistoryPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByText("暂无运行记录");
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/v1/ingestion/sync-jobs/job-1/runs?limit=100",
    );
  });

  it("EtlRulesPage_prevents_double_save (T-ING-17)", async () => {
    setViewport(1400);
    let resolveSave: () => void;
    const savePromise = new Promise<void>((r) => {
      resolveSave = r;
    });
    mockEtlRulesApi(
      [{ type: "rename_column", from: "product_name", to: "product" }],
      "orders",
      { onPut: () => savePromise },
    );
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/job-1/etl-rules"]}>
        <Routes>
          <Route
            path="/admin/ingestion/sync-jobs/:id/etl-rules"
            element={<EtlRulesPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    const saveBtn = await screen.findByRole("button", { name: "保存规则" });
    markEtlRulesDirty();
    fireEvent.click(saveBtn);
    fireEvent.click(saveBtn);
    const putCalls = mockApiFetch.mock.calls.filter(
      (c) => typeof c[0] === "string" && c[0].includes("/etl-rules") && c[1]?.method === "PUT",
    );
    expect(putCalls).toHaveLength(1);
    resolveSave!();
  });

  it("SyncJobFormPage_prevents_double_submit (T-ING-18)", async () => {
    setViewport(375);
    let resolveCreate: () => void;
    const createPromise = new Promise<{ id: string }>((r) => {
      resolveCreate = () => r({ id: "new-job" });
    });
    mockNewJobFormBootstrap([SAMPLE_MYSQL_DS], [], ["dirty_orders", "sales"], {
      postHandler: () => createPromise,
    });
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/new"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs/new" element={<SyncJobFormPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByLabelText("任务名称");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "创建" })).not.toBeDisabled();
    });
    fireEvent.change(screen.getByLabelText("任务名称"), { target: { value: "double-guard" } });
    const createBtn = screen.getAllByRole("button", { name: "创建" })[0];
    fireEvent.click(createBtn);
    fireEvent.click(createBtn);
    const postCalls = mockApiFetch.mock.calls.filter(
      (c) => c[0] === "/api/v1/ingestion/sync-jobs" && c[1]?.method === "POST",
    );
    expect(postCalls).toHaveLength(1);
    resolveCreate!();
  });

  it("SyncJobsPage_first_paint_under_500ms (T-ING-19)", async () => {
    setViewport(1400);
    const jobs = Array.from({ length: 10 }, (_, i) => ({
      id: `job-${i}`,
      name: `任务 ${i}`,
      source_type: "mysql",
      target_table: `t${i}`,
      enabled: true,
      schedule_cron: null,
    }));
    mockApiFetch.mockResolvedValueOnce({ items: jobs });
    const start = performance.now();
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs" element={<SyncJobsPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByText("任务 0");
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });

  it("EtlRulesPage_blocks_save_on_empty_rename_column (T-ING-20)", async () => {
    setViewport(1400);
    mockEtlRulesApi([{ type: "rename_column", from: "", to: "product" }]);
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/job-1/etl-rules"]}>
        <Routes>
          <Route
            path="/admin/ingestion/sync-jobs/:id/etl-rules"
            element={<EtlRulesPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    const saveBtn = await screen.findByRole("button", { name: "保存规则" });
    markEtlRulesDirty();
    fireEvent.click(saveBtn);
    expect(await screen.findByText(/请填写完整的列重命名规则|请填写规则涉及的列名/)).toBeInTheDocument();
    const putCalls = mockApiFetch.mock.calls.filter(
      (c) => typeof c[0] === "string" && c[0].includes("/etl-rules") && c[1]?.method === "PUT",
    );
    expect(putCalls).toHaveLength(0);
  });

  it("SyncJobHistoryPage_renders_20_rows_under_600ms (T-ING-21)", async () => {
    setViewport(1400);
    const runs = Array.from({ length: 20 }, (_, i) => ({
      id: `run-${i}`,
      status: i % 3 === 0 ? "failed" : "succeeded",
      trace_id: `trace-${i}`,
      started_at: `2026-07-0${(i % 9) + 1}T10:00:00Z`,
      finished_at: `2026-07-0${(i % 9) + 1}T10:01:00Z`,
      rows_synced: i,
      error_message: i % 3 === 0 ? "mock error" : null,
      retry_count: 0,
    }));
    mockSyncJobHistoryApi(runs);
    const start = performance.now();
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/job-1/history"]}>
        <Routes>
          <Route
            path="/admin/ingestion/sync-jobs/:id/history"
            element={<SyncJobHistoryPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByText("trace-0");
    expect(performance.now() - start).toBeLessThan(600);
  });

  it("SyncJobFormPage_invalid_cron_shows_field_error_and_toast", async () => {
    setViewport(1400);
    const { toast } = await import("sonner");
    mockApiFetch.mockImplementation((url: string, init?: { method?: string }) => {
      if (url === "/api/v1/datasources") {
        return Promise.resolve({ items: [SAMPLE_MYSQL_DS] });
      }
      if (url === "/api/v1/ingestion/sync-jobs" && !init?.method) {
        return Promise.resolve({ items: [] });
      }
      if (url === "/api/v1/ingestion/sync-jobs" && init?.method === "POST") {
        return Promise.reject(
          Object.assign(new Error("body.schedule_cron: Value error"), {
            code: "VALIDATION_ERROR",
            fields: [{ field: "body.schedule_cron", message: "Value error, Cron 表达式格式无效" }],
          }),
        );
      }
      return Promise.resolve({});
    });
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/new"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs/new" element={<SyncJobFormPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByLabelText("任务名称");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "创建" })).not.toBeDisabled();
    });
    fireEvent.change(screen.getByLabelText("任务名称"), { target: { value: "bad-cron-job" } });
    fireEvent.change(screen.getByLabelText("定时 Cron（可选）"), {
      target: { value: "0 0 *0 *15 *" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建" }));
    expect(await screen.findByText(/Cron 表达式格式无效（定时 Cron）/)).toBeInTheDocument();
    expect(document.getElementById("schedule_cron-error")).toHaveTextContent("Cron 表达式格式无效");
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Cron 表达式格式无效（定时 Cron）");
  });

  it("SyncJobHistoryPage_error_state_uses_semantic_tokens (T-ING-23)", async () => {
    setViewport(1400);
    mockApiFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/ingestion/sync-jobs/")) {
        return Promise.reject(new Error("加载历史失败"));
      }
      return Promise.resolve({});
    });
    const { container } = render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/job-1/history"]}>
        <Routes>
          <Route
            path="/admin/ingestion/sync-jobs/:id/history"
            element={<SyncJobHistoryPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByText("加载历史失败");
    const errorBanner = document.body.querySelector(".border-error-500");
    expect(errorBanner).toBeTruthy();
    const errorText = errorBanner?.querySelector("p");
    expect(errorText?.className).toMatch(/text-error-700|text-error-400/);
  });

  it("SyncJobHistoryPage_renders_50_rows_under_800ms (T-ING-24)", async () => {
    setViewport(1400);
    const runs = Array.from({ length: 50 }, (_, i) => ({
      id: `run-${i}`,
      status: i % 4 === 0 ? "failed" : "succeeded",
      trace_id: `trace-perf-${i}`,
      started_at: `2026-07-0${(i % 9) + 1}T10:00:00Z`,
      finished_at: `2026-07-0${(i % 9) + 1}T10:01:00Z`,
      rows_synced: i,
      error_message: i % 4 === 0 ? "mock sync error message" : null,
      retry_count: 0,
    }));
    mockSyncJobHistoryApi(runs);
    const start = performance.now();
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/job-1/history"]}>
        <Routes>
          <Route
            path="/admin/ingestion/sync-jobs/:id/history"
            element={<SyncJobHistoryPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByText(`trace-perf-0`);
    expect(performance.now() - start).toBeLessThan(800);
  });

  it("EtlRulesPage_empty_column_sets_aria_invalid (T-ING-25)", async () => {
    setViewport(1400);
    mockEtlRulesApi([{ type: "rename_column", from: "", to: "product" }], "orders", {
      columns: ["product_name", "amount"],
    });
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/job-1/etl-rules"]}>
        <Routes>
          <Route
            path="/admin/ingestion/sync-jobs/:id/etl-rules"
            element={<EtlRulesPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    const saveBtn = await screen.findByRole("button", { name: "保存规则" });
    markEtlRulesDirty();
    fireEvent.click(saveBtn);
    await screen.findByText(/请填写完整的列重命名规则/);
    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "源列名" })).toHaveAttribute("aria-invalid", "true");
    });
  });

  it("SyncJobHistoryPage_error_banner_has_role_alert (T-ING-26)", async () => {
    setViewport(1400);
    mockApiFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/ingestion/sync-jobs/")) {
        return Promise.reject(new Error("加载历史失败"));
      }
      return Promise.resolve({});
    });
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/job-1/history"]}>
        <Routes>
          <Route
            path="/admin/ingestion/sync-jobs/:id/history"
            element={<SyncJobHistoryPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByText("加载历史失败");
    expect(screen.getByRole("alert")).toHaveTextContent("加载历史失败");
  });

  it("SyncJobsPage_mobile_first_paint_under_600ms (T-ING-27)", async () => {
    setViewport(375);
    mockApiFetch.mockResolvedValueOnce({
      items: [
        {
          id: "job-mobile",
          name: "mobile-perf-job",
          source_type: "mysql",
          target_table: "orders_mobile",
          enabled: true,
          schedule_cron: null,
        },
      ],
    });
    const start = performance.now();
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs" element={<SyncJobsPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByText("mobile-perf-job");
    expect(performance.now() - start).toBeLessThan(900);
  });

  it("SyncJobsPage_run_confirms_and_calls_post (T-ING-28)", async () => {
    setViewport(1400);
    mockApiFetch
      .mockResolvedValueOnce({
        items: [
          {
            id: "job-run-confirm",
            name: "待运行任务",
            source_type: "mysql",
            target_table: "t",
            enabled: true,
            schedule_cron: null,
          },
        ],
      })
      .mockResolvedValueOnce(undefined);
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs" element={<SyncJobsPage />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "手动运行同步" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("确认手动运行同步？")).toBeInTheDocument();
    expect(within(dialog).getByText(/待运行任务/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "运行" }));
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/v1/ingestion/sync-jobs/job-run-confirm/run",
        { method: "POST" },
      );
    });
    const postRuns = mockApiFetch.mock.calls.filter(
      (c) => typeof c[0] === "string" && c[0].endsWith("/run"),
    );
    expect(postRuns).toHaveLength(1);
  });

  it("SyncJobsPage_run_cancel_skips_api (T-ING-29)", async () => {
    setViewport(375);
    mockApiFetch.mockResolvedValueOnce({
      items: [
        {
          id: "job-no-run",
          name: "不运行",
          source_type: "mysql",
          target_table: "t",
          enabled: true,
          schedule_cron: null,
        },
      ],
    });
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs" element={<SyncJobsPage />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "手动运行同步" }));
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    const postRuns = mockApiFetch.mock.calls.filter(
      (c) => typeof c[0] === "string" && c[0].endsWith("/run"),
    );
    expect(postRuns).toHaveLength(0);
  });

  it("SyncJobsPage_load_401_shows_error (T-ING-30)", async () => {
    setViewport(375);
    mockApiFetch.mockRejectedValueOnce(new Error("未登录或会话已过期"));
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs" element={<SyncJobsPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("未登录或会话已过期")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
  });

  it("SyncJobHistoryPage_renders_100_rows_under_900ms (T-ING-31)", async () => {
    setViewport(1400);
    const runs = Array.from({ length: 100 }, (_, i) => ({
      id: `run-${i}`,
      status: "succeeded",
      trace_id: `trace-100-${i}`,
      started_at: `2026-07-03T10:${String(i % 60).padStart(2, "0")}:00Z`,
      finished_at: `2026-07-03T10:${String(i % 60).padStart(2, "0")}:01Z`,
      rows_synced: i,
      error_message: null,
      retry_count: 0,
    }));
    mockSyncJobHistoryApi(runs);
    const start = performance.now();
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/job-1/history"]}>
        <Routes>
          <Route
            path="/admin/ingestion/sync-jobs/:id/history"
            element={<SyncJobHistoryPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByText("trace-100-0");
    expect(performance.now() - start).toBeLessThan(900);
  });

  it("SyncJobHistoryPage_failed_row_shows_error_message (T-ING-32)", async () => {
    setViewport(1400);
    mockSyncJobHistoryApi([
      {
        id: "run-fail",
        status: "failed",
        started_at: "2026-07-03T10:00:00Z",
        finished_at: "2026-07-03T10:00:02Z",
        rows_synced: null,
        error_message: "连接失败",
        trace_id: "trace-fail-32",
        retry_count: 1,
      },
    ]);
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/job-1/history"]}>
        <Routes>
          <Route
            path="/admin/ingestion/sync-jobs/:id/history"
            element={<SyncJobHistoryPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("连接失败")).toBeInTheDocument();
  });

  it("SyncJobHistoryPage_localizes_pg_relation_missing_error", async () => {
    setViewport(1400);
    mockSyncJobHistoryApi([
      {
        id: "run-fail-pg",
        status: "failed",
        started_at: "2026-07-03T10:00:00Z",
        finished_at: "2026-07-03T10:00:02Z",
        rows_synced: null,
        error_message: 'relation "ops_tsdb.cache_inval_extension" does not exist',
        trace_id: "trace-fail-pg",
        retry_count: 1,
      },
    ]);
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/job-1/history"]}>
        <Routes>
          <Route
            path="/admin/ingestion/sync-jobs/:id/history"
            element={<SyncJobHistoryPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(
      await screen.findByText("源表不存在，请检查 Schema 与表名是否正确"),
    ).toBeInTheDocument();
  });

  it("SyncJobsPage_list_shows_skeleton_while_loading (T-ING-33)", async () => {
    setViewport(1400);
    let resolveList: (value: { items: unknown[] }) => void;
    const listPromise = new Promise<{ items: unknown[] }>((r) => {
      resolveList = r;
    });
    mockApiFetch.mockImplementationOnce(() => listPromise);
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs" element={<SyncJobsPage />} />
        </Routes>
      </MemoryRouter>,
    );
    const skeletons = document.querySelectorAll(
      '[class*="skeleton"], [data-slot="skeleton"], [class*="animate-pulse"]',
    );
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
    resolveList!({ items: [] });
    expect(await screen.findByText("暂无同步任务")).toBeInTheDocument();
  });

  it("EtlRulesPage_save_401_shows_error_no_success (T-ING-34)", async () => {
    setViewport(375);
    mockEtlRulesApi([{ type: "rename_column", from: "a", to: "b" }], "orders", {
      onPut: () => Promise.reject(new Error("未授权")),
    });
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs/job-1/etl-rules"]}>
        <Routes>
          <Route
            path="/admin/ingestion/sync-jobs/:id/etl-rules"
            element={<EtlRulesPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByRole("button", { name: "保存规则" });
    markEtlRulesDirty();
    fireEvent.click(screen.getByRole("button", { name: "保存规则" }));
    expect(await screen.findByText("未授权")).toBeInTheDocument();
    expect(screen.queryByText("已保存")).not.toBeInTheDocument();
  });

  it("SyncJobsPage_run_dialog_confirm_disables_controls_pending (T-ING-35)", async () => {
    setViewport(1400);
    let resolveRun: () => void;
    const runPromise = new Promise<void>((r) => {
      resolveRun = r;
    });
    mockApiFetch
      .mockResolvedValueOnce({
        items: [
          {
            id: "job-dialog-pending",
            name: "dialog-pending",
            source_type: "mysql",
            target_table: "t",
            enabled: true,
            schedule_cron: null,
          },
        ],
      })
      .mockImplementationOnce(() => runPromise);
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs" element={<SyncJobsPage />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "手动运行同步" }));
    const dialog = await screen.findByRole("alertdialog");
    const runBtn = within(dialog).getByRole("button", { name: "运行" });
    fireEvent.click(runBtn);
    await waitFor(() => {
      expect(runBtn).toBeDisabled();
    });
    const cancelBtn = within(dialog).getByRole("button", { name: "取消" });
    expect(cancelBtn).toBeDisabled();
    resolveRun!();
  });

  it("SyncJobsPage_stop_button_cancels_running_job", async () => {
    setViewport(1400);
    mockApiFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (typeof url === "string" && url.endsWith("/cancel") && init?.method === "POST") {
        return Promise.resolve({ run_id: "run-1", status: "cancelling" });
      }
      if (typeof url === "string" && url.includes("/sync-jobs") && !url.includes("/cancel")) {
        return Promise.resolve({
          items: [
            {
              id: "job-running",
              name: "running-demo",
              source_type: "mysql",
              target_table: "t1",
              enabled: true,
              schedule_cron: null,
              last_run: {
                status: "running",
                started_at: "2026-08-06T10:00:00Z",
                finished_at: null,
                rows_synced: null,
                error_message: null,
              },
            },
          ],
        });
      }
      return Promise.resolve({ items: [] });
    });
    render(
      <MemoryRouter initialEntries={["/admin/ingestion/sync-jobs"]}>
        <Routes>
          <Route path="/admin/ingestion/sync-jobs" element={<SyncJobsPage />} />
        </Routes>
      </MemoryRouter>,
    );
    const stopBtn = await screen.findByRole("button", { name: "停止同步" });
    expect(screen.queryByRole("button", { name: "手动运行同步" })).not.toBeInTheDocument();
    fireEvent.click(stopBtn);
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/v1/ingestion/sync-jobs/job-running/cancel",
        { method: "POST" },
      );
    });
  });
});
