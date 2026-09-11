import {
  Building2,
  ClipboardList,
  KeyRound,
  Link2,
  ScrollText,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { NavSection } from "@/components/layout/app-sidebar";

/** 后台管理侧栏；从用户菜单进入时替换工作台导航 */
export const SYSTEM_ADMIN_NAV_SECTIONS: NavSection[] = [
  {
    title: "入门",
    items: [
      {
        name: "配置向导",
        icon: <ClipboardList className="size-5" aria-hidden />,
        path: "/admin/system",
      },
    ],
  },
  {
    title: "平台与组织",
    items: [
      {
        name: "组织架构",
        icon: <Building2 className="size-5" aria-hidden />,
        path: "/admin/system/orgs",
      },
      {
        name: "用户管理",
        icon: <Users className="size-5" aria-hidden />,
        path: "/admin/system/users",
      },
      {
        name: "角色管理",
        icon: <Shield className="size-5" aria-hidden />,
        path: "/admin/system/roles",
      },
      {
        name: "资源授权",
        icon: <KeyRound className="size-5" aria-hidden />,
        path: "/admin/system/grants",
      },
    ],
  },
  {
    title: "集成与对接",
    items: [
      {
        name: "平台对接",
        icon: <Link2 className="size-5" aria-hidden />,
        path: "/admin/system/platform-connect",
      },
      {
        name: "认证集成",
        icon: <ShieldCheck className="size-5" aria-hidden />,
        path: "/admin/system/auth-integration",
      },
    ],
  },
  {
    title: "安全与审计",
    items: [
      {
        name: "行级权限",
        icon: <ShieldAlert className="size-5" aria-hidden />,
        path: "/admin/system/rls",
      },
      {
        name: "审计日志",
        icon: <ScrollText className="size-5" aria-hidden />,
        path: "/admin/system/audit",
      },
    ],
  },
];
