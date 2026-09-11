import type React from "react";
import {
  Bot,
  Boxes,
  Database,
  FileBarChart,
  LayoutDashboard,
  LayoutTemplate,
  Layers,
  Monitor,
  Server,
  SlidersHorizontal,
  Workflow,
} from "lucide-react";
import type { SessionRole } from "@/lib/session";

type IaTier = "core" | "engineering";
type IaPriority = "primary" | "advanced";

type NavManifestSubItem = {
  name: string;
  path: string;
  milestone?: string;
  capability?: string;
};

type NavManifestItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: NavManifestSubItem[];
  milestone?: string;
  roles?: SessionRole[];
  capability?: string;
  iaPriority?: IaPriority;
  badgeLabel?: string;
};

type NavManifestSection = {
  title: string;
  items: NavManifestItem[];
  roles: SessionRole[];
  capability?: string;
  iaTier?: IaTier;
  /** admin 侧栏默认折叠（工程/系统分组） */
  defaultCollapsed?: boolean;
  /**
   * H1：固定隐藏；仅 resolveNav 传入 `govNavEnabled: true`（测试专用）时显示。
   * 避免治理/总线 InMemory 冒充客户主路径能力。
   */
  requiresGovNav?: boolean;
};

export const NAV_MANIFEST: NavManifestSection[] = [
  {
    title: "数据准备",
    roles: ["admin"],
    iaTier: "engineering",
    items: [
      {
        name: "数据连接",
        icon: <Database className="size-5" aria-hidden />,
        milestone: "M1",
        capability: "datasource:*",
        subItems: [
          {
            name: "连接管理",
            path: "/admin/datasources",
            milestone: "M1",
            capability: "datasource:*",
          },
          {
            name: "同步任务",
            path: "/admin/ingestion/sync-jobs",
            milestone: "M1",
            capability: "ingestion:read",
          },
        ],
      },
      {
        name: "数据集",
        icon: <Layers className="size-5" aria-hidden />,
        path: "/admin/datasets",
        milestone: "M13",
        capability: "dataset:*",
      },
    ],
  },
  {
    title: "分析",
    roles: ["admin", "analyst", "viewer"],
    items: [
      {
        name: "仪表板",
        icon: <LayoutDashboard className="size-5" aria-hidden />,
        path: "/admin/dashboards",
        milestone: "M1",
      },
      {
        name: "数据大屏",
        icon: <Monitor className="size-5" aria-hidden />,
        path: "/admin/data-screens",
        milestone: "M1",
      },
      {
        name: "AI 助手",
        icon: <Bot className="size-5" aria-hidden />,
        path: "/admin/agent",
      },
      {
        name: "可视化模板",
        icon: <LayoutTemplate className="size-5" aria-hidden />,
        path: "/admin/viz-templates",
        milestone: "M5",
        capability: "dashboard:read",
      },
      {
        name: "组件库",
        icon: <Boxes className="size-5" aria-hidden />,
        path: "/admin/viz-components",
        milestone: "M5",
        capability: "dashboard:read",
      },
    ],
  },
  {
    title: "报表",
    roles: ["admin", "analyst", "viewer"],
    items: [
      {
        name: "报表中心",
        icon: <FileBarChart className="size-5" aria-hidden />,
        milestone: "M1",
        capability: "report:read",
        subItems: [
          {
            name: "工作台",
            path: "/admin/reports/center",
            milestone: "M1",
            capability: "report:read",
          },
          {
            name: "标准分析",
            path: "/admin/reports/standard/results",
            milestone: "M1",
            capability: "report:read",
          },
          {
            name: "文档模板",
            path: "/admin/reports/templates",
            milestone: "M1",
            capability: "report:manage",
          },
          {
            name: "调度与投递",
            path: "/admin/reports/schedules",
            milestone: "M1",
            capability: "report:manage",
          },
        ],
      },
    ],
  },
  {
    title: "治理",
    roles: ["admin"],
    iaTier: "engineering",
    capability: "governance:*",
    requiresGovNav: true,
    items: [
      {
        name: "治理流程",
        icon: <Workflow className="size-5" aria-hidden />,
        subItems: [
          { name: "接口目录", path: "/admin/governance/catalog", milestone: "M1" },
          { name: "治理工单", path: "/admin/governance/tickets", milestone: "M13" },
          { name: "发布流水线", path: "/admin/governance/publish", milestone: "M13" },
        ],
      },
      {
        name: "查询服务",
        icon: <Server className="size-5" aria-hidden />,
        path: "/admin/services",
        milestone: "M13",
        capability: "governance:*",
      },
      {
        name: "查询设计器",
        icon: <SlidersHorizontal className="size-5" aria-hidden />,
        path: "/admin/designer",
        milestone: "M13",
        capability: "governance:*",
        badgeLabel: "治理专用",
      },
    ],
  },
];
