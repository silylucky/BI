import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReportExportCard } from "./ReportExportCard";
import { decodeExportSample, exportMagicMatches, MIN_EXPORT_BYTES } from "@/lib/reportExportUtils";

const mockApiFetch = vi.fn();
vi.mock("@/lib/api", () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));
const mockFetchAuthenticatedBlob = vi.fn();
vi.mock("@/lib/apiUpload", () => ({
  fetchAuthenticatedBlob: (...args: unknown[]) => mockFetchAuthenticatedBlob(...args),
}));

function makePdfBlob(): Blob {
  const bytes = new Uint8Array(MIN_EXPORT_BYTES);
  bytes.set([0x25, 0x50, 0x44, 0x46], 0);
  return new Blob([bytes], { type: "application/pdf" });
}

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient();
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
}

describe("ReportExportCard smoke", () => {
  afterEach(() => {
    cleanup();
    mockApiFetch.mockReset();
    mockFetchAuthenticatedBlob.mockReset();
  });

  it("polls export and shows download button", async () => {
    const user = userEvent.setup();
    mockFetchAuthenticatedBlob.mockResolvedValue(makePdfBlob());
    mockApiFetch
      .mockResolvedValueOnce({ exportId: "ex-1", status: "pending", downloadUrl: null })
      .mockResolvedValueOnce({
        exportId: "ex-1",
        status: "succeeded",
        downloadUrl: "/api/v1/reports/export/ex-1/download",
      });

    render(wrap(<ReportExportCard defaultTemplateId="tpl-1" />));
    await user.click(screen.getByRole("button", { name: "发起导出" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "下载" })).toBeInTheDocument());
    expect(screen.getByText(/状态：/)).toBeInTheDocument();
    expect(mockApiFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/reports/export?templateId=tpl-1"),
    );
  });

  it("marks export failed when blob verification fails", async () => {
    const user = userEvent.setup();
    mockFetchAuthenticatedBlob.mockResolvedValue(new Blob(["bad"], { type: "application/pdf" }));
    mockApiFetch.mockResolvedValueOnce({
      exportId: "ex-2",
      status: "succeeded",
      downloadUrl: "/api/v1/reports/export/ex-2/download",
    });

    render(wrap(<ReportExportCard defaultTemplateId="tpl-1" />));
    await user.click(screen.getByRole("button", { name: "发起导出" }));

    await waitFor(() => expect(screen.getByText(/状态：失败/)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "下载" })).not.toBeInTheDocument();
  });

  it("validates export magic bytes for pdf", () => {
    const bytes = decodeExportSample("", "pdf");
    expect(exportMagicMatches(bytes, "pdf")).toBe(true);
  });
});
