import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PanelEmptyState } from "@/components/ui/panel-empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FILE_SIZE_WARN_BYTES,
  validateFileExtension,
  type FileSourceCompanionState,
  type FileSourceMode,
} from "./datasource-form-types";

type Props = {
  sourceType: "excel" | "csv";
  value: FileSourceCompanionState;
  onChange: (next: FileSourceCompanionState) => void;
};

export function FileSourceConnectionFields({ sourceType, value, onChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileSize, setSelectedFileSize] = useState(0);
  const accept = sourceType === "excel" ? ".xlsx,.xls" : ".csv";
  const selectLabel = sourceType === "excel" ? "选择 Excel 文件" : "选择 CSV 文件";

  const set = <K extends keyof FileSourceCompanionState>(key: K, v: FileSourceCompanionState[K]) =>
    onChange({ ...value, [key]: v });

  const handleModeChange = (mode: FileSourceMode) => set("mode", mode);

  const handleFileSelect = (file: File) => {
    const error = validateFileExtension(file.name, sourceType);
    if (error) {
      setSelectedFileSize(0);
      onChange({ ...value, fileError: error });
      return;
    }
    setSelectedFileSize(file.size);
    onChange({
      ...value,
      fileError: null,
      selectedFileName: file.name,
      serverPath: value.serverPath || `/data/uploads/${file.name}`,
    });
  };

  return (
    <Tabs value={value.mode} onValueChange={(v) => handleModeChange(v as FileSourceMode)}>
      <TabsList variant="line">
        <TabsTrigger value="remote">远程文件 URL</TabsTrigger>
        <TabsTrigger value="local">本地文件</TabsTrigger>
      </TabsList>

      <TabsContent value="remote" className="pt-4">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="file-remote-url">文件 URL</Label>
            <Input
              id="file-remote-url"
              value={value.remoteUrl}
              onChange={(e) => set("remoteUrl", e.target.value)}
              placeholder="https://example.com/data.xlsx"
              required={value.mode === "remote"}
            />
          </div>
          {sourceType === "excel" ? (
            <div className="grid gap-2">
              <Label htmlFor="file-sheet-name">Sheet 名（可选）</Label>
              <Input
                id="file-sheet-name"
                value={value.sheetName}
                onChange={(e) => set("sheetName", e.target.value)}
              />
            </div>
          ) : null}
        </div>
      </TabsContent>

      <TabsContent value="local" className="pt-4">
        <div className="grid gap-4">
          <Alert severity="info">
            <AlertDescription className="text-theme-sm">
              浏览器无法直接写入服务器路径。请将文件放到后端可访问目录，并填写服务端绝对路径。
            </AlertDescription>
          </Alert>

          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
          />

          {value.selectedFileName ? (
            <p className="text-theme-sm text-gray-500">{value.selectedFileName}</p>
          ) : (
            <PanelEmptyState
              icon={<Upload className="size-8 text-gray-400" aria-hidden />}
              title="请选择 Excel/CSV 文件"
              description="选择本地文件以校验格式并生成服务端路径提示"
              size="sm"
              variant="plain"
            />
          )}

          <Button
            type="button"
            variant="outline"
            aria-label={selectLabel}
            onClick={() => fileInputRef.current?.click()}
          >
            {selectLabel}
          </Button>

          {value.fileError ? (
            <p className="text-theme-sm text-error-600">{value.fileError}</p>
          ) : null}

          {selectedFileSize > FILE_SIZE_WARN_BYTES ? (
            <Alert severity="warning">
              <AlertDescription className="text-theme-sm">
                文件超过 50MB，解析可能较慢，建议使用远程 URL 或拆分文件。
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="file-server-path">服务端路径</Label>
            <Input
              id="file-server-path"
              value={value.serverPath}
              onChange={(e) => set("serverPath", e.target.value)}
              placeholder="/data/uploads/filename.xlsx"
              required={value.mode === "local"}
            />
          </div>

          {sourceType === "excel" ? (
            <div className="grid gap-2">
              <Label htmlFor="file-local-sheet">Sheet 名（可选）</Label>
              <Input
                id="file-local-sheet"
                value={value.sheetName}
                onChange={(e) => set("sheetName", e.target.value)}
              />
            </div>
          ) : null}
        </div>
      </TabsContent>
    </Tabs>
  );
}
