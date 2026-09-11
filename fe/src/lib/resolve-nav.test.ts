import { describe, expect, it } from "vitest";
import { OPTIONAL_ROLE_CAPABILITY_MAP } from "./capabilities";
import { resolveNavGroups, resolveSidebarSections, ACTIVE_MILESTONES } from "./resolve-nav";
import {
  ACCOUNT_PROFILE_PATH,
  ACCOUNT_SECURITY_PATH,
  isAccountManagementPath,
  isDetachedFromWorkspacePath,
  SYSTEM_ADMIN_HOME_PATH,
} from "./workspace";
import { sessionUserFromAuth } from "./session";

describe("resolveNavGroups", () => {
  it("returns full admin nav for admin (系统已移出主侧栏)", () => {
    const groups = resolveNavGroups(sessionUserFromAuth("admin", ["admin"]));
    expect(groups.some((g) => g.title === "系统")).toBe(false);
    expect(groups.some((g) => g.title === "数据准备")).toBe(true);
  });

  it("returns analyst nav without system or data groups", () => {
    const groups = resolveNavGroups(sessionUserFromAuth("analyst", ["analyst"]));
    expect(groups.some((g) => g.title === "分析")).toBe(true);
    expect(groups.some((g) => g.title === "主题与实体")).toBe(false);
    expect(groups.some((g) => g.title === "系统")).toBe(false);
    expect(groups.some((g) => g.title === "数据准备")).toBe(false);
  });

  it("returns viewer nav with 分析 and 报表 sections only (no 系统/数据)", () => {
    const groups = resolveNavGroups(sessionUserFromAuth("viewer", ["viewer"]));
    const sectionTitles = groups.map((g) => g.title);
    expect(sectionTitles).toContain("分析");
    expect(sectionTitles).toContain("报表");
    expect(sectionTitles).not.toContain("系统");
    expect(sectionTitles).not.toContain("数据准备");
    const analysisSection = groups.find((g) => g.title === "分析");
    expect(analysisSection?.items.map((i) => i.name)).toContain("仪表板");
    expect(analysisSection?.items.map((i) => i.name)).toContain("AI 助手");
    const allItemNames = groups.flatMap((g) => g.items.map((i) => i.name));
    expect(allItemNames).not.toContain("数据源");
    const reportSection = groups.find((g) => g.title === "报表");
    expect(reportSection?.items.map((i) => i.name)).toContain("报表中心");
  });

  it("T-NAV-MF-01: viewer does not see M13 items", () => {
    const groups = resolveNavGroups(sessionUserFromAuth("viewer", ["viewer"]));
    const allItemNames = groups.flatMap((g) => g.items.map((i) => i.name));
    const allSubNames = groups.flatMap((g) =>
      g.items.flatMap((i) => i.subItems?.map((s) => s.name) ?? []),
    );
    expect(allItemNames).not.toContain("查询设计器");
    expect(allSubNames).not.toContain("治理工单");
    expect(allSubNames).not.toContain("发布流水线");
    expect(allSubNames).not.toContain("元数据");
    expect(allSubNames).not.toContain("Dataset");
  });

  it("T-NAV-MF-02: analyst does not see 查询设计器 in default IA", () => {
    const groups = resolveNavGroups(sessionUserFromAuth("analyst", ["analyst"]));
    const allItemNames = groups.flatMap((g) => g.items.map((i) => i.name));
    expect(allItemNames).not.toContain("查询设计器");
  });

  it("T-NAV-MF-03: admin sees M13 items without preview badge", () => {
    const groups = resolveNavGroups(sessionUserFromAuth("admin", ["admin"]), {
      govNavEnabled: true,
    });
    const allItems = groups.flatMap((g) => g.items);
    const designer = allItems.find((i) => i.name === "查询设计器");
    expect(designer).toBeDefined();
    expect(designer?.preview).toBeFalsy();
    const governanceFlow = allItems.find((i) => i.name === "治理流程");
    expect(governanceFlow?.subItems?.some((s) => s.name === "治理工单")).toBe(true);
    expect(governanceFlow?.preview).toBeFalsy();
  });

  it("T-NAV-MF-03b: admin sees M5 viz hub items without preview badge", () => {
    const groups = resolveNavGroups(sessionUserFromAuth("admin", ["admin"]));
    const analysis = groups.find((g) => g.title === "分析");
    const templates = analysis?.items.find((i) => i.name === "可视化模板");
    const components = analysis?.items.find((i) => i.name === "组件库");
    expect(templates?.preview).toBeFalsy();
    expect(components?.preview).toBeFalsy();
  });

  it("T-NAV-MF-04: capabilities override filters M7/M11/M13 for admin", () => {
    const groups = resolveNavGroups(sessionUserFromAuth("admin", ["admin"]), {
      activeMilestones: new Set(["M1"]),
      govNavEnabled: true,
    });
    const allItems = groups.flatMap((g) => g.items);
    const designer = allItems.find((i) => i.name === "查询设计器");
    expect(designer?.preview).toBe(true);
    expect(allItems.some((i) => i.name === "实体与主题")).toBe(false);
    const reportSection = groups.find((g) => g.title === "报表");
    const reportParent = reportSection?.items.find((i) => i.name === "报表中心");
    expect(reportParent?.subItems?.map((s) => s.name)).toEqual([
      "工作台",
      "标准分析",
      "文档模板",
      "调度与投递",
    ]);
  });

  it("T-NAV-MF-05: viewer with M1-only capabilities sees report hub sub-nav without manage items", () => {
    const groups = resolveNavGroups(sessionUserFromAuth("viewer", ["viewer"]), {
      activeMilestones: new Set(["M1"]),
    });
    const reportSection = groups.find((g) => g.title === "报表");
    expect(reportSection).toBeDefined();
    const reportParent = reportSection?.items.find((i) => i.name === "报表中心");
    expect(reportParent).toBeDefined();
    expect(reportParent?.subItems?.map((s) => s.name)).toEqual(["工作台", "标准分析"]);
  });

  it("T-NAV-MF-06: admin 数据 section has 数据连接与数据集（无实体与主题、元数据）", () => {
    const groups = resolveNavGroups(sessionUserFromAuth("admin", ["admin"]));
    const dataSection = groups.find((g) => g.title === "数据准备");
    expect(dataSection).toBeDefined();
    expect(dataSection?.defaultCollapsed).toBeFalsy();
    const dataConn = dataSection?.items.find((i) => i.name === "数据连接");
    expect(dataConn).toBeDefined();
    expect(dataConn?.subItems?.map((s) => s.name)).toEqual(["连接管理", "同步任务"]);
    const dataset = dataSection?.items.find((i) => i.name === "数据集");
    expect(dataset?.path).toBe("/admin/datasets");
    const allSubNames = dataSection?.items.flatMap((i) => i.subItems?.map((s) => s.name) ?? []) ?? [];
    expect(allSubNames).not.toContain("元数据");
    expect(dataSection?.items.some((i) => i.name === "语义建模")).toBe(false);
    expect(dataSection?.items.some((i) => i.name === "实体与主题")).toBe(false);
    expect(groups.some((g) => g.title === "语义层")).toBe(false);
    expect(groups.some((g) => g.title === "主题与实体")).toBe(false);
  });

  it("T-NAV-CAP-01: admin system admin nav has 资源授权 link", () => {
    const sections = resolveSidebarSections(
      sessionUserFromAuth("admin", ["admin"]),
      "/admin/system/roles",
    );
    const orgSection = sections.find((g) => g.title === "平台与组织");
    expect(orgSection).toBeDefined();
    expect(orgSection?.items.map((i) => i.name)).toContain("资源授权");
  });

  it("T-NAV-CAP-02: viewer does not see 系统 section", () => {
    const groups = resolveNavGroups(sessionUserFromAuth("viewer", ["viewer"]));
    expect(groups.some((g) => g.title === "系统")).toBe(false);
  });

  it("T-NAV-AUTHZ-01: permission-only user with dashboard:read sees 分析", () => {
    const groups = resolveNavGroups({
      ...sessionUserFromAuth("perm_user", []),
      permissions: ["dashboard:read", "report:read"],
    });
    const titles = groups.map((g) => g.title);
    expect(titles).toContain("分析");
    expect(titles).toContain("报表");
    expect(groups.find((g) => g.title === "分析")?.items.map((i) => i.name)).toContain(
      "仪表板",
    );
  });

  it("T-NAV-AUTHZ-02: root user with empty roles still sees admin nav without 系统", () => {
    const groups = resolveNavGroups({
      ...sessionUserFromAuth("root", []),
      permissions: [],
      isRoot: true,
    });
    expect(groups.some((g) => g.title === "系统")).toBe(false);
    expect(groups.some((g) => g.title === "数据准备")).toBe(true);
  });

  it("T-NAV-CAP-03: custom role with report:* sees 报表 only", () => {
    OPTIONAL_ROLE_CAPABILITY_MAP.reports_editor = ["report:*"];
    try {
      const groups = resolveNavGroups(
        sessionUserFromAuth("editor", ["viewer"]),
        { userCapabilities: new Set(["report:*"]) },
      );
      const titles = groups.map((g) => g.title);
      expect(titles).toContain("报表");
      expect(titles).not.toContain("系统");
      expect(titles).not.toContain("数据准备");
    } finally {
      delete OPTIONAL_ROLE_CAPABILITY_MAP.reports_editor;
    }
  });

  it("T-NAV-CAP-04: analyst sees 分析 and 报表, not 数据 or 系统", () => {
    const groups = resolveNavGroups(sessionUserFromAuth("analyst", ["analyst"]));
    const titles = groups.map((g) => g.title);
    expect(titles).toContain("分析");
    expect(titles).toContain("报表");
    expect(titles).not.toContain("数据准备");
    expect(titles).not.toContain("系统");
  });

  it("T-NAV-FC-01: analyst hides engineering sections", () => {
    const groups = resolveNavGroups(sessionUserFromAuth("analyst", ["analyst"]));
    const titles = groups.map((g) => g.title);
    expect(titles).not.toContain("数据准备");
    expect(titles).not.toContain("主题与实体");
    expect(titles).not.toContain("治理");
  });

  it("T-NAV-FC-02: viewer hides engineering sections", () => {
    const groups = resolveNavGroups(sessionUserFromAuth("viewer", ["viewer"]));
    const titles = groups.map((g) => g.title);
    expect(titles).not.toContain("数据准备");
    expect(titles).not.toContain("主题与实体");
    expect(titles).not.toContain("治理");
  });

  it("T-NAV-FC-03: admin sees engineering 数据; 治理 hidden by default (H1)", () => {
    const groups = resolveNavGroups(sessionUserFromAuth("admin", ["admin"]));
    const titles = groups.map((g) => g.title);
    expect(titles).toContain("数据准备");
    expect(titles).not.toContain("治理");
    expect(titles).not.toContain("系统");
    const data = groups.find((g) => g.title === "数据准备");
    expect(data?.defaultCollapsed).toBeFalsy();
    expect(data?.items.some((i) => i.name === "实体与主题")).toBe(false);
  });

  it("T-NAV-H1-01: resolveNavGroups without gov flag omits 治理", () => {
    const groups = resolveNavGroups(sessionUserFromAuth("admin", ["admin"]));
    expect(groups.some((g) => g.title === "治理")).toBe(false);
  });

  it("T-NAV-H1-02: govNavEnabled true shows 治理 for admin", () => {
    const groups = resolveNavGroups(sessionUserFromAuth("admin", ["admin"]), {
      govNavEnabled: true,
    });
    expect(groups.some((g) => g.title === "治理")).toBe(true);
    expect(groups.find((g) => g.title === "治理")?.defaultCollapsed).toBeFalsy();
  });

  it("T-VIZ-FC-01: analyst viewer nav excludes 图表类型目录", () => {
    for (const role of ["analyst", "viewer"] as const) {
      const groups = resolveNavGroups(sessionUserFromAuth(role, [role]));
      const names = groups.flatMap((g) => g.items.map((i) => i.name));
      expect(names).not.toContain("图表类型目录");
      expect(names).not.toContain("图表探索");
    }
  });

  it("T-VIZ-FC-02: admin analysis group includes core viz entries and AI assistant", () => {
    const groups = resolveNavGroups(sessionUserFromAuth("admin", ["admin"]));
    const analysis = groups.find((g) => g.title === "分析");
    expect(analysis?.items.map((i) => i.name)).toEqual([
      "仪表板",
      "数据大屏",
      "AI 助手",
      "可视化模板",
      "组件库",
    ]);
  });

  it("T-VIZ-FC-03: admin nav no longer lists 图表类型目录（Palette 深链保留）", () => {
    const groups = resolveNavGroups(sessionUserFromAuth("admin", ["admin"]));
    const names = groups.flatMap((g) => g.items.map((i) => i.name));
    expect(names).not.toContain("图表类型目录");
  });

  it("T-NAV-RPT-01: analyst 报表中心含工作台与标准分析子项", () => {
    const groups = resolveNavGroups(sessionUserFromAuth("analyst", ["analyst"]));
    const report = groups.find((g) => g.title === "报表");
    const center = report?.items.find((i) => i.name === "报表中心");
    expect(center?.subItems?.map((s) => s.path)).toEqual([
      "/admin/reports/center",
      "/admin/reports/standard/results",
    ]);
  });

  it("T-DESIGN-FC-01: admin governance group has 查询设计器 with badge when gov nav on", () => {
    const groups = resolveNavGroups(sessionUserFromAuth("admin", ["admin"]), {
      govNavEnabled: true,
    });
    const gov = groups.find((g) => g.title === "治理");
    const designer = gov?.items.find((i) => i.name === "查询设计器");
    expect(designer).toBeDefined();
    expect(designer?.badgeLabel).toBe("治理专用");
  });

  it("T-DESIGN-FC-02: analyst viewer nav excludes 查询设计器", () => {
    for (const role of ["analyst", "viewer"] as const) {
      const names = resolveNavGroups(sessionUserFromAuth(role, [role])).flatMap((g) =>
        g.items.map((i) => i.name),
      );
      expect(names).not.toContain("查询设计器");
    }
  });

  it("T-DESIGN-FC-03: admin analysis group excludes 查询设计器", () => {
    const analysis = resolveNavGroups(sessionUserFromAuth("admin", ["admin"])).find(
      (g) => g.title === "分析",
    );
    const names = analysis?.items.map((i) => i.name) ?? [];
    expect(names).not.toContain("查询设计器");
  });
});

describe("resolveSidebarSections", () => {
  it("uses account nav on profile/settings paths", () => {
    const admin = sessionUserFromAuth("admin", ["admin"]);
    const sections = resolveSidebarSections(admin, ACCOUNT_PROFILE_PATH);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.title).toBe("个人中心");
    expect(sections[0]?.items.map((i) => i.name)).toEqual([
      "个人资料",
      "界面主题",
      "登录入口",
      "安全设置",
    ]);
    expect(isAccountManagementPath(ACCOUNT_SECURITY_PATH)).toBe(true);
  });

  it("uses workspace nav elsewhere", () => {
    const admin = sessionUserFromAuth("admin", ["admin"]);
    const sections = resolveSidebarSections(admin, "/admin/dashboards");
    expect(sections.some((g) => g.title === "数据准备")).toBe(true);
    expect(sections.some((g) => g.title === "系统")).toBe(false);
  });

  it("uses system admin nav on /admin/system/* paths", () => {
    const admin = sessionUserFromAuth("admin", ["admin"]);
    const sections = resolveSidebarSections(admin, "/admin/system/users");
    expect(sections.map((g) => g.title)).toEqual([
      "入门",
      "平台与组织",
      "集成与对接",
      "安全与审计",
    ]);
    const orgSection = sections.find((g) => g.title === "平台与组织");
    expect(orgSection?.items.map((i) => i.name)).toEqual([
      "组织架构",
      "用户管理",
      "角色管理",
      "资源授权",
    ]);
  });

  it("uses system admin nav on /admin/system home path", () => {
    const admin = sessionUserFromAuth("admin", ["admin"]);
    const sections = resolveSidebarSections(admin, SYSTEM_ADMIN_HOME_PATH);
    expect(sections[0]?.title).toBe("入门");
    expect(sections[0]?.items[0]?.name).toBe("配置向导");
    expect(isDetachedFromWorkspacePath(SYSTEM_ADMIN_HOME_PATH)).toBe(true);
  });
});

describe("ACTIVE_MILESTONES", () => {
  it("exports ACTIVE_MILESTONES containing M1, M7, M11, M13", () => {
    expect(ACTIVE_MILESTONES.has("M1")).toBe(true);
    expect(ACTIVE_MILESTONES.has("M7")).toBe(true);
    expect(ACTIVE_MILESTONES.has("M11")).toBe(true);
    expect(ACTIVE_MILESTONES.has("M13")).toBe(true);
  });
});
