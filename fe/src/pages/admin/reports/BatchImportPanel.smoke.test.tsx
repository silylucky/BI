import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BatchImportPanel } from "./components/BatchImportPanel";

const mockApiFetch = vi.fn();
vi.mock("@/lib/api", () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient();
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
}

describe("BatchImportPanel smoke", () => {
  beforeEach(() => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === "/api/v1/reports/batch/dry-run") {
        return {
          items: [{ index: 0, name: "批量节点 A", status: "create" }],
          createCount: 1,
          conflictCount: 0,
          invalidCount: 0,
          canImport: true,
        };
      }
      return {
        batchId: "b1",
        createdNodeIds: ["n1"],
        rolledBackCount: 0,
        failures: [],
      };
    });
  });
  afterEach(() => cleanup());

  it("shows parse error for invalid json", async () => {
    const user = userEvent.setup();
    render(wrap(<BatchImportPanel readOnly={false} />));
    const input = screen.getByLabelText("选择批量导入 JSON 文件");
    const file = new File(["not-json"], "bad.json", { type: "application/json" });
    await user.upload(input, file);
    expect(await screen.findByText(/无法解析 JSON/)).toBeInTheDocument();
  });

  it("dry-runs then imports valid json", async () => {
    const user = userEvent.setup();
    render(wrap(<BatchImportPanel readOnly={false} />));
    const input = screen.getByLabelText("选择批量导入 JSON 文件");
    const payload = JSON.stringify({ items: [{ name: "批量节点 A", templateKind: "excel" }] });
    const file = new File([payload], "batch.json", { type: "application/json" });
    Object.defineProperty(file, "text", { value: async () => payload });
    await user.upload(input, file);
    expect(await screen.findByText("批量节点 A")).toBeInTheDocument();
    expect(await screen.findByText(/预检结果/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "确认导入" }));
    expect(await screen.findByText(/成功创建 1 项/)).toBeInTheDocument();
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/v1/reports/batch/dry-run",
      expect.objectContaining({ method: "POST" }),
    );
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/v1/reports/batch",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("blocks import when dry-run reports conflict", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === "/api/v1/reports/batch/dry-run") {
        return {
          items: [{ index: 0, name: "重复", status: "conflict", message: "同目录下已存在同名节点" }],
          createCount: 0,
          conflictCount: 1,
          invalidCount: 0,
          canImport: false,
        };
      }
      throw new Error("should not import");
    });
    const user = userEvent.setup();
    render(wrap(<BatchImportPanel readOnly={false} />));
    const input = screen.getByLabelText("选择批量导入 JSON 文件");
    const payload = JSON.stringify({ items: [{ name: "重复" }] });
    const file = new File([payload], "batch.json", { type: "application/json" });
    Object.defineProperty(file, "text", { value: async () => payload });
    await user.upload(input, file);
    expect(await screen.findByText(/冲突 1 项/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "确认导入" })).toBeDisabled();
  });
});
