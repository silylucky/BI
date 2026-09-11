import type { LayoutWidget, TextWidgetConfig } from "./layoutUtils";
import { textConfigToHtml } from "./richTextHtml";

type TextWidgetInspectorProps = {
  widget: LayoutWidget & { textConfig: TextWidgetConfig };
  embedded?: boolean;
};

export function TextWidgetInspector({ widget, embedded = false }: TextWidgetInspectorProps) {
  const html = textConfigToHtml(widget.textConfig);
  const document = new DOMParser().parseFromString(html, "text/html");
  const characters = (document.body.textContent ?? "").trim().length;
  const body = (
    <div className="space-y-3 p-4">
      <div className="rounded-lg border border-brand-100 bg-brand-50/60 p-3 dark:border-brand-500/20 dark:bg-brand-500/10">
        <p className="text-theme-sm font-medium text-gray-800 dark:text-white/90">
          双击画布中的文字进行编辑
        </p>
        <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
          点击外部或 Ctrl+Enter 保存，Esc 取消。
        </p>
      </div>
      <p className="text-theme-xs text-gray-500 dark:text-gray-400">
        当前内容：{characters} 个字符
      </p>
    </div>
  );
  if (embedded) return body;
  return <div className="rounded-xl border border-gray-200 dark:border-gray-800">{body}</div>;
}
