import { BarChart3, History, Link2, RefreshCw } from "lucide-react";
import { Link } from "react-router";
import { PanelEmptyState, PanelEmptyStateSteps } from "@/components/ui/panel-empty-state";

const STEPS = [
  {
    step: 1,
    title: "连接管理登记业务源",
    description: "在连接管理登记可查询的业务源连接（关系型 / 文件 / 文档库等）。",
    icon: Link2,
  },
  {
    step: 2,
    title: "创建同步任务",
    description: "引用已登记连接，指定源表与目标表；创建时自动生成默认清洗规则。",
    icon: RefreshCw,
  },
  {
    step: 3,
    title: "运行并监控",
    description: "在编辑页或列表手动/定时触发同步，在历史记录查看结果。",
    icon: History,
  },
  {
    step: 4,
    title: "一键 Dataset 出图",
    description: "同步成功后一键创建 Dataset 并绑定，再在仪表板中选 Dataset 出图。",
    icon: BarChart3,
  },
] as const;

export function SyncJobsEmptyState() {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-sm dark:border-gray-800 dark:bg-gray-900">
      <PanelEmptyState
        icon={<RefreshCw className="size-7" aria-hidden />}
        title="暂无同步任务"
        description={
          <>
            推荐路径：
            <Link
              to="/admin/datasources"
              className="text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
            >
              连接管理
            </Link>
            登记业务源连接 → 新建同步任务 → 运行 → 一键 Dataset 出图。
          </>
        }
        size="lg"
        footer={
          <div className="border-t border-gray-200 px-6 pb-6 pt-2 dark:border-gray-800">
            <PanelEmptyStateSteps steps={STEPS} />
          </div>
        }
      />
    </div>
  );
}
