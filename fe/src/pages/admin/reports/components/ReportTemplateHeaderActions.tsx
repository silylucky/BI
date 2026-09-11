import { ChevronDown, FilePlus, FileSpreadsheet, FileText, FileType2, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TemplateKind } from "@/lib/reportCatalogProvision";
import { cn } from "@/lib/utils";

const FORMAT_OPTIONS: { id: TemplateKind; label: string; icon: typeof FileSpreadsheet }[] = [
  { id: "excel", label: "Excel", icon: FileSpreadsheet },
  { id: "pdf", label: "PDF", icon: FileType2 },
];

type ReportTemplateHeaderActionsProps = {
  onCreateFolder: () => void;
  onCreateTemplate: (kind: TemplateKind) => void;
  disabled?: boolean;
  className?: string;
  /** 侧栏窄列时纵向铺满按钮 */
  orientation?: "inline" | "stack";
};

export function ReportTemplateHeaderActions({
  onCreateFolder,
  onCreateTemplate,
  disabled = false,
  className,
  orientation = "inline",
}: ReportTemplateHeaderActionsProps) {
  const stacked = orientation === "stack";

  return (
    <div
      className={cn(
        "flex gap-2",
        stacked ? "w-full flex-col [&_button]:w-full" : "flex-wrap items-center",
        className,
      )}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9"
        disabled={disabled}
        onClick={onCreateFolder}
      >
        <FolderPlus className="size-4" aria-hidden />
        新建文件夹
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="primary"
            size="sm"
            className={cn("h-9 gap-1.5", stacked && "w-full justify-center")}
            disabled={disabled}
          >
            <FilePlus className="size-4" aria-hidden />
            新建模板
            <ChevronDown className="size-3.5 opacity-80" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuLabel>文档格式</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {FORMAT_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <DropdownMenuItem key={opt.id} onClick={() => onCreateTemplate(opt.id)}>
                <Icon className="size-4" aria-hidden />
                {opt.label} 模板
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
