import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ColorScheme } from "./dashboardStyleConfig";

type ThemePreviewCardProps = {
  label: string;
  selected: boolean;
  variant: "light" | "dark";
  onSelect: () => void;
};

function ThemePreviewCard({
  label,
  selected,
  variant,
  onSelect,
  className,
}: ThemePreviewCardProps & { className?: string }) {
  const isDark = variant === "dark";
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-2 rounded-xl border p-2.5 text-left transition-all",
        "focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-brand-500/30",
        selected
          ? "border-brand-500 bg-brand-50/40 shadow-theme-xs ring-1 ring-brand-500/20 dark:border-brand-500 dark:bg-brand-500/10"
          : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-white/[0.02] dark:hover:border-gray-600",
        className,
      )}
      aria-pressed={selected}
      aria-label={label}
    >
      <div
        className={cn(
          "overflow-hidden rounded-lg border p-2",
          isDark ? "border-gray-700 bg-gray-950" : "border-gray-200 bg-gray-100",
        )}
        aria-hidden
      >
        <div className={cn("mb-1.5 h-1.5 w-10 rounded-full", isDark ? "bg-gray-600" : "bg-gray-300")} />
        <div className="flex gap-1.5">
          <div
            className={cn(
              "h-10 flex-1 rounded-md border",
              isDark ? "border-gray-800 bg-gray-900" : "border-gray-200 bg-white",
            )}
          />
          <div className="flex flex-1 flex-col gap-1">
            <div
              className={cn(
                "h-4 flex-1 rounded-md",
                isDark ? "bg-brand-400/70" : "bg-brand-400/80",
              )}
            />
            <div
              className={cn("h-4 flex-1 rounded-md", isDark ? "bg-sky-400/60" : "bg-sky-400/70")}
            />
          </div>
        </div>
      </div>
      <span
        className={cn(
          "text-center text-theme-xs font-medium",
          selected ? "text-brand-600 dark:text-brand-300" : "text-gray-600 dark:text-gray-400",
        )}
      >
        {label}
      </span>
    </button>
  );
}

type Props = {
  colorScheme: ColorScheme;
  onSwitchColorScheme?: (scheme: ColorScheme) => void;
  onPatchColorScheme?: (scheme: ColorScheme) => void;
  onResetColorsToTheme?: () => void;
};

/** DataEase「仪表板风格」：浅色/深色主题预览卡片 */
export function DashboardThemeStylePanel({
  colorScheme,
  onSwitchColorScheme,
  onPatchColorScheme,
  onResetColorsToTheme,
}: Props) {
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const patchColorScheme = (scheme: ColorScheme) => {
    if (onSwitchColorScheme) onSwitchColorScheme(scheme);
    else onPatchColorScheme?.(scheme);
  };

  const confirmReset = () => {
    onResetColorsToTheme?.();
    setResetDialogOpen(false);
  };

  return (
    <div className="space-y-3" data-testid="dashboard-theme-style-body">
      <div className="flex gap-3">
        <ThemePreviewCard
          label="浅色主题"
          variant="light"
          selected={colorScheme === "light"}
          onSelect={() => patchColorScheme("light")}
        />
        <ThemePreviewCard
          label="深色主题"
          variant="dark"
          selected={colorScheme === "dark"}
          onSelect={() => patchColorScheme("dark")}
        />
      </div>
      {onResetColorsToTheme ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-full text-theme-xs"
            data-testid="dashboard-theme-reset-colors"
            onClick={() => setResetDialogOpen(true)}
          >
            重置为当前主题默认
          </Button>
          <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>重置为当前主题默认？</AlertDialogTitle>
                <AlertDialogDescription>
                  将恢复当前浅色/深色主题的默认配色，并清除自定义画布背景、装饰图与组件背景/透明度等样式覆盖。此操作不可撤销，请确认后继续。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={confirmReset}>确认重置</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </div>
  );
}
