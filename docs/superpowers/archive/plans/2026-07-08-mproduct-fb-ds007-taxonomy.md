# M-PRODUCT · F-B — DS-007 DataEase 五类数据源展示 taxonomy 实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `backend/app/datasources/taxonomy.py`、`backend/app/datasources/registry.py`、`backend/app/datasources/schemas.py`、`tests/test_datasources_display_group_fb.py`、`docs/api/README.md`、`fe/src/lib/connector-taxonomy.ts`、`fe/src/pages/admin/connectors/ConnectorsPage.tsx`、`fe/src/pages/admin/connectors/ConnectorsPage.smoke.test.tsx`、`fe/src/components/datasources/ConnectorCategoryCard.tsx`、`fe/src/pages/admin/datasources/DatasourceFormPage.tsx`、`fe/src/pages/admin/datasources/datasource-form.smoke.test.tsx`、`docs/ui/layout.md`
> **子项：** DS-007（子项 1 displayGroup API · 子项 2 ConnectorsPage Tabs · 子项 3 DatasourceFormPage 三步向导）
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；后端预指定 fastapi + TDD；UI 预指定 b-design-system-tailadmin-radix）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；`backend-fastapi.mdc` 匹配 `backend/**` + `tests/**`；`fe-ui.mdc` 匹配 `fe/**`）

**Goal:** 在不修改方言 `category` 注册值与连接器执行链的前提下，为 `GET /api/v1/datasources/types` 增加 `displayGroup`/`categoryLabel` 展示 taxonomy，并在 ConnectorsPage 与 DatasourceFormPage 新建路径消费该分组（Tabs 目录 + 三步向导）。

**Architecture:** 后端单一真理源 `taxonomy.py` 映射引擎 `category` → 六类 `displayGroup` + 中文 `categoryLabel`；`export_type_catalog()` 同次序列化附加字段；FE 共享 `connector-taxonomy.ts` 做分组/图标；ConnectorsPage 用 Radix Tabs（`variant="line"`）；DatasourceFormPage 新建路径 `category → type → form` 状态机，编辑路径直达表单。

**Tech Stack:** Python 3.12 + FastAPI + Pydantic v2 + pytest；React 18 + TanStack Query + vitest + RTL + lucide-react；pnpm workspace。

## Global Constraints

- 不修改 `docs/automate/goal.md` / `docs/automate/plan.md` 结构；PRD 分片勾选留给 P5
- 不修改 `backend/app/datasources/dialects/*` 的 `category` 属性
- 不修改 `ConnectorRegistry` 注册逻辑、probe/SQL 执行链、`fe/src/routes.tsx`、`nav-manifest.tsx`
- 不实现 CONN-023/024 专用表单项、独立 taxonomy HTTP 端点、ConnectorsPage `React.lazy`
- 单 Python 业务文件 ≤ 200 行；单 FE 文件 ≤ 300 行
- `displayGroup` 枚举：`oltp` | `olap` | `warehouse` | `file` | `api` | `extension`
- 未知 `category` 回退 `extension`，不抛错
- 文档同步：`docs/api/README.md`（契约字段）、`docs/ui/layout.md` §3（`prd-sync.mdc`）
- 提交信息格式：`feat:` / `test:` / `docs:` 前缀 + 英文动词短语

---

## File Structure

| # | 路径 | 操作 | 职责 |
|---|------|------|------|
| 1 | `backend/app/datasources/taxonomy.py` | **新建** | `DisplayGroup`、映射表、`resolve_display_group`、`label_for_display_group` |
| 2 | `backend/app/datasources/registry.py` | **修改** | `export_type_catalog()` 附加 `displayGroup`/`categoryLabel` |
| 3 | `backend/app/datasources/schemas.py` | **修改** | `ConnectorTypeOut` 增 `display_group`/`category_label` |
| 4 | `tests/test_datasources_display_group_fb.py` | **新建** | schema + 六组映射 pytest |
| 5 | `docs/api/README.md` | **修改** | `/datasources/types` 响应字段登记 |
| 6 | `fe/src/lib/connector-taxonomy.ts` | **新建** | FE 类型、分组、图标映射 |
| 7 | `fe/src/pages/admin/connectors/ConnectorsPage.tsx` | **修改** | Tabs 分组 + 图标列 |
| 8 | `fe/src/pages/admin/connectors/ConnectorsPage.smoke.test.tsx` | **新建** | ≥2 组 mock 渲染断言 |
| 9 | `fe/src/components/datasources/ConnectorCategoryCard.tsx` | **新建** | 大类卡片 UI（≤80 行） |
| 10 | `fe/src/pages/admin/datasources/DatasourceFormPage.tsx` | **修改** | 新建三步向导状态机 |
| 11 | `fe/src/pages/admin/datasources/datasource-form.smoke.test.tsx` | **修改** | 新建 vs 编辑向导 ≥2 场景 |
| 12 | `docs/ui/layout.md` | **修改** | §3 数据分组文案与 taxonomy 对齐 |

---

### Task 1: 后端 `displayGroup` 展示 taxonomy + pytest + API 文档

**Files:**
- Create: `backend/app/datasources/taxonomy.py`
- Modify: `backend/app/datasources/registry.py`
- Modify: `backend/app/datasources/schemas.py`
- Create: `tests/test_datasources_display_group_fb.py`
- Modify: `docs/api/README.md`

**Interfaces:**
- Produces: `resolve_display_group(category: str) -> DisplayGroup`
- Produces: `label_for_display_group(group: DisplayGroup) -> str`
- Produces: `export_type_catalog()` 每项含 `displayGroup`、`categoryLabel`（camelCase JSON）
- Produces: `ConnectorTypeOut` 含 `display_group`（alias `displayGroup`）、`category_label`（alias `categoryLabel`）

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/fastapi/SKILL.md`

- [ ] **Step 1: 新建失败测试**

创建 `tests/test_datasources_display_group_fb.py`：

```python
"""DS-007 F-B: displayGroup / categoryLabel taxonomy companion."""
from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient
from jwt_auth import jwt_auth_headers

from app.core.config import get_settings
from app.datasources import register_builtin_dialects
from app.datasources.registry import export_type_catalog, registry
from app.main import app

AUTH = jwt_auth_headers()
_FB_SQLITE_URL = "sqlite+pysqlite:///file:ds_fb_taxonomy?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def fb_taxonomy_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _FB_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import get_meta_engine as auth_get_meta_engine
    from app.datasources.models import get_meta_engine

    get_meta_engine.cache_clear()
    auth_get_meta_engine.cache_clear()
    yield
    if previous is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_get_meta_engine.cache_clear()


@pytest.fixture(autouse=True)
def reset_registry():
    registry._connectors.clear()
    register_builtin_dialects()
    yield
    registry._connectors.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_types_response_includes_display_group_fields(client: TestClient):
    """FB-1-01: GET /types 每项含 displayGroup、categoryLabel。"""
    resp = client.get("/api/v1/datasources/types", headers=AUTH)
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert items, "builtin dialects should be registered"
    for item in items:
        assert "displayGroup" in item, item
        assert "categoryLabel" in item, item
        assert item["category"]  # 引擎 category 不变


def test_display_group_mapping_oltp():
    """FB-1-02: mysql relational → oltp + 关系型数据库。"""
    types = {t["type"]: t for t in export_type_catalog()}
    assert types["mysql"]["category"] == "relational"
    assert types["mysql"]["displayGroup"] == "oltp"
    assert types["mysql"]["categoryLabel"] == "关系型数据库"


def test_display_group_mapping_olap():
    """FB-1-03: starrocks → olap + OLAP。"""
    types = {t["type"]: t for t in export_type_catalog()}
    assert types["starrocks"]["displayGroup"] == "olap"
    assert types["starrocks"]["categoryLabel"] == "OLAP"


def test_display_group_mapping_warehouse():
    """FB-1-04: hive/trino → warehouse。"""
    types = {t["type"]: t for t in export_type_catalog()}
    assert types["hive"]["displayGroup"] == "warehouse"
    assert types["trino"]["displayGroup"] == "warehouse"
    assert types["hive"]["categoryLabel"] == "数仓/湖仓"


def test_display_group_mapping_file():
    """FB-1-05: excel → file。"""
    types = {t["type"]: t for t in export_type_catalog()}
    assert types["excel"]["displayGroup"] == "file"
    assert types["excel"]["categoryLabel"] == "文件"


def test_display_group_mapping_api():
    """FB-1-05: rest_api → api。"""
    types = {t["type"]: t for t in export_type_catalog()}
    assert types["rest_api"]["displayGroup"] == "api"
    assert types["rest_api"]["categoryLabel"] == "API"


def test_display_group_mapping_extension():
    """FB-1-06: mongodb/elasticsearch/sqlite → extension + 更多。"""
    types = {t["type"]: t for t in export_type_catalog()}
    for key in ("mongodb", "elasticsearch", "sqlite"):
        assert types[key]["displayGroup"] == "extension", key
        assert types[key]["categoryLabel"] == "更多", key


def test_unknown_category_falls_back_to_extension():
    """防御：未知 category → extension。"""
    from app.datasources.taxonomy import resolve_display_group

    assert resolve_display_group("unknown_future_category") == "extension"
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /workspace/backend && python -m pytest ../tests/test_datasources_display_group_fb.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.datasources.taxonomy'` 或 `KeyError: 'displayGroup'`

- [ ] **Step 3: 实现 taxonomy 模块**

创建 `backend/app/datasources/taxonomy.py`：

```python
from __future__ import annotations

from typing import Literal

DisplayGroup = Literal["oltp", "olap", "warehouse", "file", "api", "extension"]

DISPLAY_GROUP_ORDER: tuple[DisplayGroup, ...] = (
    "oltp",
    "olap",
    "warehouse",
    "file",
    "api",
    "extension",
)

DISPLAY_GROUP_LABELS: dict[DisplayGroup, str] = {
    "oltp": "关系型数据库",
    "olap": "OLAP",
    "warehouse": "数仓/湖仓",
    "file": "文件",
    "api": "API",
    "extension": "更多",
}

_CATEGORY_TO_DISPLAY_GROUP: dict[str, DisplayGroup] = {
    "relational": "oltp",
    "olap": "olap",
    "lake": "warehouse",
    "file": "file",
    "api": "api",
    "timeseries": "extension",
    "search": "extension",
    "document": "extension",
    "embedded": "extension",
}


def resolve_display_group(category: str) -> DisplayGroup:
    return _CATEGORY_TO_DISPLAY_GROUP.get(category, "extension")


def label_for_display_group(group: DisplayGroup) -> str:
    return DISPLAY_GROUP_LABELS[group]
```

- [ ] **Step 4: 修改 registry 与 schema**

`backend/app/datasources/registry.py` — 在文件顶部增加 import，并替换 `export_type_catalog`：

```python
from app.datasources.taxonomy import label_for_display_group, resolve_display_group


def export_type_catalog() -> list[dict]:
    result: list[dict] = []
    for item in registry.list_types():
        group = resolve_display_group(item.category)
        result.append(
            {
                "type": item.type,
                "displayName": item.display_name,
                "category": item.category,
                "capabilities": list(item.capabilities),
                "displayGroup": group,
                "categoryLabel": label_for_display_group(group),
            }
        )
    return result
```

`backend/app/datasources/schemas.py` — 扩展 `ConnectorTypeOut`：

```python
class ConnectorTypeOut(BaseModel):
    type: str
    display_name: str = Field(validation_alias="displayName", serialization_alias="displayName")
    category: str
    capabilities: list[str]
    display_group: str = Field(serialization_alias="displayGroup")
    category_label: str = Field(serialization_alias="categoryLabel")

    model_config = {"populate_by_name": True}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd /workspace/backend && python -m pytest ../tests/test_datasources_display_group_fb.py -v`
Expected: 8 passed

Run: `cd /workspace/backend && ruff check app/datasources/taxonomy.py app/datasources/registry.py app/datasources/schemas.py`
Expected: exit 0

- [ ] **Step 6: 更新 API 登记簿**

在 `docs/api/README.md` 的 `GET /api/v1/datasources/types` 行，将说明字段扩展为：

```markdown
| GET | `/api/v1/datasources/types` | 已注册连接器类型清单（…；`type`、`displayName`、`category`、`capabilities`、**`displayGroup`**（`oltp`/`olap`/`warehouse`/`file`/`api`/`extension`）、**`categoryLabel`**（中文组名）） | …
```

- [ ] **Step 7: 提交**

```bash
git add backend/app/datasources/taxonomy.py backend/app/datasources/registry.py backend/app/datasources/schemas.py tests/test_datasources_display_group_fb.py docs/api/README.md
git commit -m "feat(datasources): add displayGroup taxonomy to types API"
```

---

### Task 2: FE taxonomy 模块 + ConnectorsPage Tabs 分组

**Files:**
- Create: `fe/src/lib/connector-taxonomy.ts`
- Modify: `fe/src/pages/admin/connectors/ConnectorsPage.tsx`
- Create: `fe/src/pages/admin/connectors/ConnectorsPage.smoke.test.tsx`

**Interfaces:**
- Consumes: `GET /api/v1/datasources/types` 响应含 `displayGroup`、`categoryLabel`
- Produces: `groupTypesByDisplayGroup(items) -> Map<DisplayGroup, ConnectorTypeItem[]>`
- Produces: `connectorTypeIcon(type, group) -> LucideIcon`
- Produces: `ConnectorsPage` 按非空组渲染 `Tabs`（`variant="line"`），表格含图标列，移除「分类」列

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI Acceptance:**
- 复用 `AdminPageShell`、`Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`、`Badge`、`Skeleton`、`ErrorBanner` 模式；图标 `lucide-react` + `size-5 text-brand-500`
- desktop 与 mobile 截图无明显错位、重叠、文本溢出、空白失衡；`TabsList` 小屏 `overflow-x-auto`
- loading Skeleton 4 行；error 保留 `ErrorBanner`+重试；空组 Tab 不渲染
- 通过 `pnpm run check:design`（语义 token、无硬编码 hex）

- [ ] **Step 1: 新建 connector-taxonomy 模块**

创建 `fe/src/lib/connector-taxonomy.ts`：

```typescript
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Database,
  FileSpreadsheet,
  Globe,
  Layers,
  Puzzle,
} from "lucide-react";

export type DisplayGroup = "oltp" | "olap" | "warehouse" | "file" | "api" | "extension";

export const DISPLAY_GROUP_ORDER: readonly DisplayGroup[] = [
  "oltp",
  "olap",
  "warehouse",
  "file",
  "api",
  "extension",
] as const;

export const DISPLAY_GROUP_META: Record<DisplayGroup, { label: string; description: string }> = {
  oltp: { label: "关系型数据库", description: "MySQL、PostgreSQL、信创关系型等 OLTP 引擎" },
  olap: { label: "OLAP", description: "ClickHouse、Doris、StarRocks 等分析型引擎" },
  warehouse: { label: "数仓/湖仓", description: "Hive、Impala、Trino 等湖仓查询引擎" },
  file: { label: "文件", description: "Excel、CSV 等文件数据源" },
  api: { label: "API", description: "REST API 等接口型数据源" },
  extension: { label: "更多", description: "时序、搜索、文档库等扩展类型" },
};

export type ConnectorTypeItem = {
  type: string;
  displayName: string;
  category: string;
  capabilities: string[];
  displayGroup: DisplayGroup;
  categoryLabel: string;
};

const TYPE_ICON: Partial<Record<string, LucideIcon>> = {
  mysql: Database,
  postgresql: Database,
  starrocks: BarChart3,
  clickhouse: BarChart3,
  hive: Layers,
  trino: Layers,
  excel: FileSpreadsheet,
  csv: FileSpreadsheet,
  rest_api: Globe,
};

const GROUP_FALLBACK_ICON: Record<DisplayGroup, LucideIcon> = {
  oltp: Database,
  olap: BarChart3,
  warehouse: Layers,
  file: FileSpreadsheet,
  api: Globe,
  extension: Puzzle,
};

export function groupTypesByDisplayGroup(
  items: ConnectorTypeItem[],
): Map<DisplayGroup, ConnectorTypeItem[]> {
  const map = new Map<DisplayGroup, ConnectorTypeItem[]>();
  for (const group of DISPLAY_GROUP_ORDER) {
    map.set(group, []);
  }
  for (const item of items) {
    const bucket = map.get(item.displayGroup) ?? map.get("extension")!;
    bucket.push(item);
  }
  return map;
}

export function connectorTypeIcon(type: string, group: DisplayGroup): LucideIcon {
  return TYPE_ICON[type] ?? GROUP_FALLBACK_ICON[group];
}

export function firstNonEmptyGroup(map: Map<DisplayGroup, ConnectorTypeItem[]>): DisplayGroup {
  for (const group of DISPLAY_GROUP_ORDER) {
    if ((map.get(group)?.length ?? 0) > 0) return group;
  }
  return "oltp";
}
```

- [ ] **Step 2: 重写 ConnectorsPage**

`fe/src/pages/admin/connectors/ConnectorsPage.tsx` 核心结构（完整替换页面主体逻辑）：

```tsx
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminPageShell } from "@/components/layout/admin-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import {
  connectorTypeIcon,
  DISPLAY_GROUP_ORDER,
  firstNonEmptyGroup,
  groupTypesByDisplayGroup,
  type ConnectorTypeItem,
} from "@/lib/connector-taxonomy";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";

type ConnectorTypeListResponse = { items: ConnectorTypeItem[] };

// ErrorBanner 保持不变 …

function ConnectorTable({ items }: { items: ConnectorTypeItem[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-theme-sm dark:border-gray-800 dark:bg-gray-900">
      <table className="min-w-[720px] w-full text-left text-theme-sm">
        <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-white/[0.02]">
          <tr>
            <th className="w-12 px-4 py-3" />
            <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">显示名称</th>
            <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">类型标识</th>
            <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">能力</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const Icon = connectorTypeIcon(item.type, item.displayGroup);
            return (
              <tr key={item.type} className="border-b border-gray-100 dark:border-gray-800">
                <td className="px-4 py-3">
                  <Icon className="size-5 text-brand-500" aria-hidden />
                </td>
                <td className="px-4 py-3 font-medium text-gray-800 dark:text-white/90">{item.displayName}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{item.type}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {item.capabilities.map((cap) => (
                      <Badge key={cap} variant="light" color="primary">{cap}</Badge>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ConnectorsPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.connectorTypes,
    queryFn: () => apiFetch<ConnectorTypeListResponse>("/api/v1/datasources/types"),
  });

  const grouped = useMemo(
    () => groupTypesByDisplayGroup(data?.items ?? []),
    [data?.items],
  );

  const visibleGroups = useMemo(
    () => DISPLAY_GROUP_ORDER.filter((g) => (grouped.get(g)?.length ?? 0) > 0),
    [grouped],
  );

  const defaultTab = useMemo(() => firstNonEmptyGroup(grouped), [grouped]);

  return (
    <AdminPageShell title="连接器类型" description="查看平台已注册的连接器类型与能力清单（只读）。">
      {isError ? <ErrorBanner message={mapApiError(error)} onRetry={() => void refetch()} /> : null}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : null}

      {!isLoading && data?.items.length === 0 ? (
        <p className="text-center text-theme-sm text-gray-500 dark:text-gray-400">暂无已注册连接器类型</p>
      ) : null}

      {!isLoading && visibleGroups.length > 0 ? (
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList variant="line" className="w-full overflow-x-auto">
            {visibleGroups.map((group) => {
              const items = grouped.get(group) ?? [];
              const label = items[0]?.categoryLabel ?? group;
              return (
                <TabsTrigger
                  key={group}
                  value={group}
                  aria-label={`${label}，${items.length} 种连接器`}
                >
                  {label} ({items.length})
                </TabsTrigger>
              );
            })}
          </TabsList>
          {visibleGroups.map((group) => (
            <TabsContent key={group} value={group}>
              <ConnectorTable items={grouped.get(group) ?? []} />
            </TabsContent>
          ))}
        </Tabs>
      ) : null}
    </AdminPageShell>
  );
}
```

- [ ] **Step 3: 新建 ConnectorsPage smoke 测试**

创建 `fe/src/pages/admin/connectors/ConnectorsPage.smoke.test.tsx`：

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectorsPage } from "./ConnectorsPage";

const mockApiFetch = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, apiFetch: (...args: unknown[]) => mockApiFetch(...args) };
});
vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: { id: "1", username: "admin", roles: ["admin"] },
    isLoading: false,
    isAuthenticated: true,
    logout: vi.fn(),
    refresh: vi.fn(async () => {}),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const MOCK_MULTI_GROUP = {
  items: [
    { type: "mysql", displayName: "MySQL", category: "relational", capabilities: ["sql"], displayGroup: "oltp", categoryLabel: "关系型数据库" },
    { type: "postgresql", displayName: "PostgreSQL", category: "relational", capabilities: ["sql"], displayGroup: "oltp", categoryLabel: "关系型数据库" },
    { type: "starrocks", displayName: "StarRocks", category: "olap", capabilities: ["sql"], displayGroup: "olap", categoryLabel: "OLAP" },
  ],
};

const MOCK_FILE_ONLY = {
  items: [
    { type: "excel", displayName: "Excel", category: "file", capabilities: ["file"], displayGroup: "file", categoryLabel: "文件" },
  ],
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ConnectorsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ConnectorsPage taxonomy smoke", () => {
  beforeEach(() => mockApiFetch.mockReset());
  afterEach(() => cleanup());

  it("FB-2-01/02: renders oltp and olap tabs with categoryLabel", async () => {
    mockApiFetch.mockResolvedValueOnce(MOCK_MULTI_GROUP);
    renderPage();
    await waitFor(() => expect(screen.getByRole("tab", { name: /关系型数据库/ })).toBeInTheDocument());
    expect(screen.getByRole("tab", { name: /OLAP/ })).toBeInTheDocument();
    expect(screen.getByText("MySQL")).toBeInTheDocument();
  });

  it("FB-2-03: tab switch shows olap types", async () => {
    mockApiFetch.mockResolvedValueOnce(MOCK_MULTI_GROUP);
    renderPage();
    const user = userEvent.setup();
    await waitFor(() => screen.getByRole("tab", { name: /OLAP/ }));
    await user.click(screen.getByRole("tab", { name: /OLAP/ }));
    expect(await screen.findByText("StarRocks")).toBeInTheDocument();
  });

  it("FB-2-04: single group hides other tabs", async () => {
    mockApiFetch.mockResolvedValueOnce(MOCK_FILE_ONLY);
    renderPage();
    await waitFor(() => expect(screen.getByText("Excel")).toBeInTheDocument());
    expect(screen.queryByRole("tab", { name: /OLAP/ })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /文件/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: 运行验证**

Run: `cd /workspace/fe && pnpm exec vitest run src/pages/admin/connectors/ConnectorsPage.smoke.test.tsx`
Expected: 3 passed

Run: `cd /workspace/fe && pnpm run check:design`
Expected: exit 0

- [ ] **Step 5: 提交**

```bash
git add fe/src/lib/connector-taxonomy.ts fe/src/pages/admin/connectors/ConnectorsPage.tsx fe/src/pages/admin/connectors/ConnectorsPage.smoke.test.tsx
git commit -m "feat(connectors): group connector types by displayGroup tabs"
```

---

### Task 3: DatasourceFormPage 三步向导 + ConnectorCategoryCard + layout 文档

**Files:**
- Create: `fe/src/components/datasources/ConnectorCategoryCard.tsx`
- Modify: `fe/src/pages/admin/datasources/DatasourceFormPage.tsx`
- Modify: `fe/src/pages/admin/datasources/datasource-form.smoke.test.tsx`
- Modify: `docs/ui/layout.md`

**Interfaces:**
- Consumes: `ConnectorTypeItem` from `@/lib/connector-taxonomy`
- Produces: `type WizardStep = "category" | "type" | "form"`
- Produces: create 模式 `category → type → form`；edit 模式固定 `form`
- Produces: `selectType()` 测试辅助：category 步点大类卡 → type 步点类型卡 → 断言表单

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI Acceptance:**
- 大类/类型卡使用 `Card` + `rounded-xl border shadow-theme-sm`；选中 `ring-2 ring-brand-500/20 border-brand-500`
- 卡片栅格 `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`；`role="button"` + Enter/Space 激活
- 表单步保留现有 `Input`/`Select`/`Alert`；「更改类型」`text-brand-600` 链接样式
- desktop/mobile 无错位；dark mode 卡片边框无漂移；`pnpm run check:design` exit 0

- [ ] **Step 1: 新建 ConnectorCategoryCard**

创建 `fe/src/components/datasources/ConnectorCategoryCard.tsx`：

```tsx
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ConnectorCategoryCardProps = {
  label: string;
  description: string;
  count: number;
  icon: LucideIcon;
  selected?: boolean;
  onSelect: () => void;
};

export function ConnectorCategoryCard({
  label,
  description,
  count,
  icon: Icon,
  selected,
  onSelect,
}: ConnectorCategoryCardProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  };

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={`${label}，${count} 种连接器`}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className={cn(
        "cursor-pointer rounded-xl border border-gray-200 bg-white shadow-theme-sm transition-colors hover:border-brand-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-500/40",
        selected && "border-brand-500 ring-2 ring-brand-500/20",
      )}
    >
      <CardHeader className="flex flex-row items-center gap-3 pb-2">
        <Icon className="size-6 text-brand-500" aria-hidden />
        <CardTitle className="text-theme-xl font-semibold">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">{description}</p>
        <p className="mt-2 text-theme-xs text-gray-400">{count} 种连接器</p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: 扩展 DatasourceFormPage 向导状态机**

在 `DatasourceFormPage.tsx` 顶部增加：

```tsx
import { ConnectorCategoryCard } from "@/components/datasources/ConnectorCategoryCard";
import {
  connectorTypeIcon,
  DISPLAY_GROUP_META,
  DISPLAY_GROUP_ORDER,
  groupTypesByDisplayGroup,
  type ConnectorTypeItem,
  type DisplayGroup,
} from "@/lib/connector-taxonomy";

type WizardStep = "category" | "type" | "form";
type ConnectorTypeListResponse = { items: ConnectorTypeItem[] };
```

在组件内增加状态（`mode === "create"` 时 `wizardStep` 初始 `"category"`，`edit` 时 `"form"`）：

```tsx
const [wizardStep, setWizardStep] = useState<WizardStep>(mode === "create" ? "category" : "form");
const [selectedGroup, setSelectedGroup] = useState<DisplayGroup | null>(null);

const groupedTypes = useMemo(
  () => groupTypesByDisplayGroup(typesQuery.data?.items ?? []),
  [typesQuery.data?.items],
);

const visibleGroups = useMemo(
  () => DISPLAY_GROUP_ORDER.filter((g) => (groupedTypes.get(g)?.length ?? 0) > 0),
  [groupedTypes],
);
```

在 `AdminPageShell` 内、`Card` 之前，按 `wizardStep` 条件渲染：

**Step category**（仅 create）：

```tsx
{mode === "create" && wizardStep === "category" ? (
  <div className="mx-auto grid max-w-3xl w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {visibleGroups.map((group) => {
      const items = groupedTypes.get(group) ?? [];
      const meta = DISPLAY_GROUP_META[group];
      const Icon = connectorTypeIcon(items[0]?.type ?? group, group);
      return (
        <ConnectorCategoryCard
          key={group}
          label={items[0]?.categoryLabel ?? meta.label}
          description={meta.description}
          count={items.length}
          icon={Icon}
          onSelect={() => {
            setSelectedGroup(group);
            setWizardStep("type");
          }}
        />
      );
    })}
  </div>
) : null}
```

**Step type**（仅 create）：

```tsx
{mode === "create" && wizardStep === "type" && selectedGroup ? (
  <div className="mx-auto max-w-3xl w-full space-y-4">
    <button type="button" className="text-theme-sm text-brand-600" onClick={() => setWizardStep("category")}>
      ← 返回选择大类
    </button>
    <div className="grid gap-3 sm:grid-cols-2">
      {(groupedTypes.get(selectedGroup) ?? []).map((t) => {
        const Icon = connectorTypeIcon(t.type, t.displayGroup);
        return (
          <ConnectorCategoryCard
            key={t.type}
            label={t.displayName}
            description={t.type}
            count={0}
            icon={Icon}
            onSelect={() => {
              const hints = CONNECTOR_FIELD_HINTS[t.type];
              setForm((prev) => ({
                ...prev,
                type: t.type,
                port: hints?.port ?? prev.port,
              }));
              setWizardStep("form");
            }}
          />
        );
      })}
    </div>
  </div>
) : null}
```

**Step form** — 将现有 `Card` 表单包裹为 `(mode === "edit" || wizardStep === "form")` 时渲染；create + form 步顶部增加：

```tsx
{mode === "create" && wizardStep === "form" ? (
  <div className="mx-auto mb-4 flex max-w-2xl items-center justify-between text-theme-sm text-gray-500">
    <span>选择类型 › 连接配置</span>
    <button type="button" className="text-brand-600" onClick={() => setWizardStep("type")}>
      更改类型
    </button>
  </div>
) : null}
```

create 模式下 **隐藏** 原 `Select` 类型下拉（`wizardStep === "form"` 时可保留只读展示或 hidden）；edit 模式保留现有 `Select`。

- [ ] **Step 3: 更新 smoke 测试**

扩展 `MOCK_TYPES.items` 每项增加 `category`、`capabilities`、`displayGroup`、`categoryLabel`（mysql → oltp，dm/tidb 等同组）。

替换 `selectType` 辅助函数：

```tsx
async function selectType(categoryLabel: string, typeLabel: string) {
  const user = userEvent.setup();
  await waitFor(() => screen.getByRole("button", { name: new RegExp(categoryLabel) }));
  await user.click(screen.getByRole("button", { name: new RegExp(categoryLabel) }));
  await user.click(screen.getByRole("button", { name: new RegExp(typeLabel) }));
}
```

将现有 `await selectType("达梦 DM")` 改为 `await selectType("关系型数据库", "达梦 DM")`；`selectType("TiDB")` → `selectType("关系型数据库", "TiDB")`；以此类推（REST API → `selectType("API", "REST API")`）。

新增测试：

```tsx
it("FB-3-01: create mode shows category cards first", async () => {
  renderForm();
  await waitFor(() => expect(screen.getByRole("button", { name: /关系型数据库/ })).toBeInTheDocument());
  expect(screen.queryByLabelText("名称")).not.toBeInTheDocument();
});

it("FB-3-02: OLTP → MySQL → form fields visible", async () => {
  renderForm();
  await selectType("关系型数据库", "MySQL");
  expect(await screen.findByLabelText("名称")).toBeInTheDocument();
  expect(screen.getByLabelText("主机")).toBeInTheDocument();
});

it("FB-3-03: edit mode skips wizard", async () => {
  mockApiFetch.mockImplementation(async (path: string) => {
    if (path === "/api/v1/datasources/types") return MOCK_TYPES;
    if (path === "/api/v1/datasources/ds-1") {
      return { id: "ds-1", name: "prod", code: "prod", type: "mysql", host: "h", port: 3306, database: "d", username: "u" };
    }
    throw new Error(path);
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/admin/datasources/ds-1/edit"]}>
        <Routes>
          <Route path="/admin/datasources/:id/edit" element={<DatasourceFormPage mode="edit" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getByLabelText("名称")).toHaveValue("prod"));
  expect(screen.queryByRole("button", { name: /关系型数据库/ })).not.toBeInTheDocument();
});
```

- [ ] **Step 4: 更新 layout.md §3**

在 `docs/ui/layout.md` §3「数据」分组说明（约 L150 侧栏表或 connectors 路由注释处）追加：

```markdown
> **F-B taxonomy（DS-007）**：`/admin/connectors` 按 **关系型数据库 / OLAP / 数仓·湖仓 / 文件 / API / 更多** 六类 Tab 展示（对标 DataEase）。`/admin/datasources/new` 新建向导 Step 1 大类选择与上述 `categoryLabel` 一致；编辑已有数据源跳过向导直达连接表单。
```

- [ ] **Step 5: 运行验证**

Run: `cd /workspace/fe && pnpm exec vitest run src/pages/admin/datasources/datasource-form.smoke.test.tsx`
Expected: 全部 passed（含 FB-3-01~03 与既有 R242/R249/R250 场景）

Run: `cd /workspace/fe && pnpm run check:design`
Expected: exit 0

Run: `cd /workspace/backend && python -m pytest ../tests/test_datasources_display_group_fb.py -v`
Expected: 8 passed（Task 1 回归）

- [ ] **Step 6: 提交**

```bash
git add fe/src/components/datasources/ConnectorCategoryCard.tsx fe/src/pages/admin/datasources/DatasourceFormPage.tsx fe/src/pages/admin/datasources/datasource-form.smoke.test.tsx docs/ui/layout.md
git commit -m "feat(datasources): add create wizard with displayGroup category cards"
```

---

## Self-Review

| 检查项 | 结果 |
|--------|------|
| round-target 3 子项覆盖 | Task 1→子项1 · Task 2→子项2 · Task 3→子项3 |
| 占位符扫描 | 无 TBD/TODO |
| 文件数 | 12（≤ round-target 上限 12） |
| 类型一致性 | `DisplayGroup`/`ConnectorTypeItem`/`WizardStep` 全 plan 一致 |
| UI 门控 | Task 2/3 含 Skills + UI Acceptance |
| 验证命令 | 每 Task 含 pytest/vitest/check:design |

## 执行说明

**Plan complete and saved to `docs/superpowers/plans/2026-07-08-mproduct-fb-ds007-taxonomy.md`.**

**执行模式（固定）：** subagent-driven-development (option 1) — 每 Task 派发独立 subagent，任务间 Spec review + Quality review。

**REQUIRED SUB-SKILL:** `.agents/skills/subagent-driven-development/SKILL.md`
