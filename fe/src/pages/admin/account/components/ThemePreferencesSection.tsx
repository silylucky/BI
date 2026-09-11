import { Monitor, Moon, Sun } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTheme, type ThemeMode } from "@/context/theme-context";
import { cn } from "@/lib/utils";

const THEME_OPTIONS: Array<{
  value: ThemeMode;
  label: string;
  description: string;
  icon: typeof Sun;
}> = [
  {
    value: "light",
    label: "浅色",
    description: "始终使用浅色界面",
    icon: Sun,
  },
  {
    value: "dark",
    label: "深色",
    description: "始终使用深色界面",
    icon: Moon,
  },
  {
    value: "auto",
    label: "跟随系统",
    description: "根据操作系统外观自动切换",
    icon: Monitor,
  },
];

export function ThemePreferencesSection() {
  const { selectedTheme, setTheme } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-title-sm">界面主题</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-theme-sm text-gray-600 dark:text-gray-400">
          选择管理端界面的颜色模式，设置将保存在本浏览器中。
        </p>
        <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="界面主题">
          {THEME_OPTIONS.map(({ value, label, description, icon: Icon }) => {
            const active = selectedTheme === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setTheme(value)}
                className={cn(
                  "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors",
                  active
                    ? "border-brand-500 bg-brand-50/80 dark:border-brand-500/60 dark:bg-brand-500/10"
                    : "border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.02] dark:hover:bg-white/[0.04]",
                )}
              >
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-lg",
                    active
                      ? "bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400"
                      : "bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-400",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="text-theme-sm font-medium text-gray-800 dark:text-white/90">
                  {label}
                </span>
                <span className="text-theme-xs text-gray-500 dark:text-gray-400">{description}</span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
