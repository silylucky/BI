import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TemplateField } from "./templatePanelUi";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { fetchAuthenticatedBlob } from "@/lib/apiUpload";
import { mapApiError } from "@/lib/apiError";
import { isExportBlobValid, readBlobBytes } from "@/lib/reportExportUtils";
import { cn } from "@/lib/utils";

type ExportOut = {
  exportId: string;
  status: string;
  downloadUrl?: string | null;
};

const EXPORT_STATUS_LABELS: Record<string, string> = {
  pending: "处理中",
  succeeded: "已完成",
  failed: "失败",
  ready: "就绪",
};

function localizeExportStatus(status: string): string {
  return EXPORT_STATUS_LABELS[status] ?? status;
}

function exportFileName(exportId: string, format: string): string {
  const ext = format === "excel" ? "xlsx" : format;
  return `report-${exportId}.${ext}`;
}

async function triggerBlobDownload(blob: Blob, fileName: string): Promise<void> {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export function ReportExportCard({
  defaultTemplateId,
  defaultFormat,
  showTemplateIdField = false,
  disabled = false,
  disabledHint,
  embedded = false,
  variant = "default",
}: {
  defaultTemplateId?: string;
  defaultFormat?: string;
  showTemplateIdField?: boolean;
  disabled?: boolean;
  disabledHint?: string;
  embedded?: boolean;
  variant?: "default" | "embedded" | "toolbar";
}) {
  const [templateId, setTemplateId] = useState(defaultTemplateId ?? "");
  const [format, setFormat] = useState(defaultFormat ?? "pdf");
  const [status, setStatus] = useState<string | null>(null);
  const [downloadPath, setDownloadPath] = useState<string | null>(null);
  const [exportId, setExportId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (defaultTemplateId) setTemplateId(defaultTemplateId);
  }, [defaultTemplateId]);

  useEffect(() => {
    if (defaultFormat) setFormat(defaultFormat);
  }, [defaultFormat]);

  const effectiveTemplateId = templateId.trim();
  const canExport = Boolean(effectiveTemplateId) && !disabled;
  const isToolbar = variant === "toolbar";

  const verifyExportBlob = async (path: string): Promise<boolean> => {
    try {
      const blob = await fetchAuthenticatedBlob(path);
      const data = await readBlobBytes(blob);
      if (!isExportBlobValid(data, format)) {
        toast.error("导出文件无效或过小，请检查模板配置后重试");
        return false;
      }
      return true;
    } catch (err) {
      toast.error(mapApiError(err));
      return false;
    }
  };

  const requestExport = async () => {
    if (!canExport) return;
    setLoading(true);
    setStatus(null);
    setDownloadPath(null);
    setExportId(null);
    try {
      const created = await apiFetch<ExportOut>(
        `/api/v1/reports/export?templateId=${encodeURIComponent(effectiveTemplateId)}&format=${encodeURIComponent(format)}`,
      );
      setStatus(created.status);
      setExportId(created.exportId);
      if (created.downloadUrl) setDownloadPath(created.downloadUrl);
      if (created.status === "pending") {
        await pollExport(created.exportId);
      } else if (created.downloadUrl) {
        const valid = await verifyExportBlob(created.downloadUrl);
        if (!valid) {
          setDownloadPath(null);
          setStatus("failed");
        }
      }
    } catch (err) {
      toast.error(mapApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const pollExport = async (id: string) => {
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 400));
      const out = await apiFetch<ExportOut>(`/api/v1/reports/export/${id}`);
      setStatus(out.status);
      setExportId(out.exportId);
      if (out.downloadUrl) {
        const valid = await verifyExportBlob(out.downloadUrl);
        if (valid) {
          setDownloadPath(out.downloadUrl);
        } else {
          setDownloadPath(null);
          setStatus("failed");
        }
        return;
      }
      if (out.status === "failed") return;
    }
  };

  const handleDownload = async () => {
    if (!downloadPath || !exportId) return;
    setDownloading(true);
    try {
      const blob = await fetchAuthenticatedBlob(downloadPath);
      const data = await readBlobBytes(blob);
      if (!isExportBlobValid(data, format)) {
        toast.error("导出文件无效或过小，请检查模板配置后重试");
        return;
      }
      await triggerBlobDownload(blob, exportFileName(exportId, format));
    } catch (err) {
      toast.error(mapApiError(err));
    } finally {
      setDownloading(false);
    }
  };

  if (!showTemplateIdField && !defaultTemplateId) {
    return null;
  }

  const toolbarBody = (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={format} onValueChange={setFormat}>
        <SelectTrigger className="h-9 w-[100px]" aria-label="导出格式">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="pdf">PDF</SelectItem>
          <SelectItem value="excel">Excel</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="button"
        className="h-9"
        variant="primary"
        disabled={loading || !canExport}
        onClick={() => void requestExport()}
      >
        {loading ? "导出中…" : "导出"}
      </Button>
      {downloadPath ? (
        <Button
          type="button"
          className="h-9"
          variant="outline"
          disabled={downloading}
          onClick={() => void handleDownload()}
        >
          <Download className="size-4" aria-hidden />
          {downloading ? "下载中…" : "下载"}
        </Button>
      ) : null}
      {disabled && disabledHint ? (
        <span className="max-w-xs text-theme-xs text-gray-500 dark:text-gray-400">{disabledHint}</span>
      ) : null}
      {status && !isToolbar ? (
        <span className="text-theme-xs text-gray-600 dark:text-gray-400">
          状态：{localizeExportStatus(status)}
        </span>
      ) : null}
    </div>
  );

  const body = (
    <div className={cn("grid gap-4", !isToolbar && "sm:grid-cols-2")}>
      {showTemplateIdField ? (
        <TemplateField id="export-template-id" label="模板 ID" className="sm:col-span-2">
          <Input
            id="export-template-id"
            className="h-11"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            placeholder="粘贴报表模板 UUID"
          />
        </TemplateField>
      ) : null}
      {!isToolbar ? (
        <TemplateField id="export-format" label="导出格式">
          <Select value={format} onValueChange={setFormat}>
            <SelectTrigger id="export-format" className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="excel">Excel</SelectItem>
            </SelectContent>
          </Select>
        </TemplateField>
      ) : null}
      {isToolbar ? (
        toolbarBody
      ) : (
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button
            type="button"
            className="h-11"
            variant="primary"
            disabled={loading || !canExport}
            onClick={() => void requestExport()}
          >
            {loading ? "导出中…" : "发起导出"}
          </Button>
          {disabled && disabledHint ? (
            <span className="text-theme-sm text-gray-500 dark:text-gray-400">{disabledHint}</span>
          ) : null}
          {status ? (
            <span className="text-theme-sm text-gray-600 dark:text-gray-400">
              状态：{localizeExportStatus(status)}
            </span>
          ) : null}
          {downloadPath ? (
            <Button
              type="button"
              className="h-11"
              variant="outline"
              disabled={downloading}
              onClick={() => void handleDownload()}
            >
              <Download className="size-4" aria-hidden />
              {downloading ? "下载中…" : "下载"}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );

  if (isToolbar) {
    return toolbarBody;
  }

  if (embedded) {
    return body;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.02]">
      <div className="border-b border-gray-100 bg-gray-50/60 px-5 py-3.5 dark:border-gray-800 dark:bg-white/[0.02]">
        <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white">报表导出</h3>
      </div>
      <div className="px-5 py-4">{body}</div>
    </div>
  );
}
