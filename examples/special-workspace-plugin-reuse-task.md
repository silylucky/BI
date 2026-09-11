# VitalSpan 特殊工作区插件 — 实施计划（`examples/` 实例副本）

> **执行真源（优先维护）**：[`docs/api/vs-ai-spec/deeptalk-product/SPECIAL-WORKSPACE-PLUGIN-TASK.md`](../docs/api/vs-ai-spec/deeptalk-product/SPECIAL-WORKSPACE-PLUGIN-TASK.md)  
> **通用占位符模板**：DeepTalk 上游 `deeptalk/docs/examples/special-workspace-plugin-reuse-task.md`（勿当 VitalSpan 真源）  
> **插件仓**：`deeptalk-plugins/plugins/vitalspan/` · 契约：[WORKSPACE-PLUGIN-CONTRACT.md](../docs/api/vs-ai-spec/deeptalk-product/WORKSPACE-PLUGIN-CONTRACT.md)  
> **轨道：通用 SOP 全量对齐**（Task 7–8 含 `resources` + `loadInstance`） · **状态：Task 1–9 已闭合（v0.3.0）**

**不变范围（2026-08-25 确认）**

| 范围 | 说明 |
|------|------|
| **wf2 / wf3** | 仍经 `components.tools` + **5173** 验收；`artifactId` / `dashboardId` 铁律见 [IRON-RULES.md](../docs/api/vs-ai-spec/IRON-RULES.md) — **本文 Task 不改** |
| **组件库 / publish** | scaffold · validate · publish · compose 等 **14× Agent 工具** — **不随工作区壳 Task 改动** |
| **工作区壳** | `home` · **`resources`** · `workspace-setup` · `vitalspan_health` · **`loadInstance`**；compose/upload 仍 Agent tools |

> **执行者**：按任务顺序改目标插件仓库。每完成一节就勾选。  
> **底座**：`deeptalk` 只读，不改引擎、不加跨仓 alias、不申请专用 `window.*`。  
> **替换规则**：标识已在 Task 1 冻结（见 `docs/PLUGIN_IDS.md`）；禁止再改 plugin-id / template-id / view 名。

> **执行顺序**：[Phase 2 spike](../docs/reviews/grounded/2026-08-24-deeptalk-vitalspan-how-to-execute-adjudication.md) **通过后再做 Task 1–9**

**目标：** 做出一个可安装的专业工作区插件：能出现在「新建工作区」、能写入实例绑定、能用左侧导航打开全页业务视图、能在 **DeepTalk 插件壳 CSP** 内通过 `pluginExec` 取数并 **外链** 5173。

**做法：** 插件提供模板和视图；宿主负责安装、创建工作区、注入 `instanceConfig`、路由和 iframe 桥。业务语义只存在插件仓。

**Phase 门控（必守）**

| Phase | 内容 | 通过标准 |
|-------|------|----------|
| 0 | 轨道决策 | ✅ SOP 全量对齐（2026-08-25） |
| 1 | 契约 + 本文档对齐 | 契约 §3/§5 与本文一致 |
| **2** | **DeepTalk spike** | ✅ **10/10**（#4/#10 → Phase 4 闭合） |
| **3** | Task 1–9 | ✅ 全过 → [Task 9 验收](../docs/reviews/grounded/2026-08-25-deeptalk-vitalspan-task9-host-acceptance.md) |
| 4 | E2E | [E2E-CHECKLIST](../docs/api/vs-ai-spec/deeptalk-product/E2E-CHECKLIST.md) §1–§5 |

**Spike 10 条（Phase 2 · 用 v0.2.16 zip 或最小 mock）**

1. 插件 settings loaded  
2. 新建工作区列表有 **VitalSpan BI**  
3. 向导 `vitalspan:workspace-setup` 可加载  
4. `workspaceSetup.complete` → 磁盘 `instanceConfig.vitalspan`  
5. 导航打开 `vitalspan:home`  
6. iframe 无对 `:8000` 的 `fetch`  
7. `pluginExec('vitalspan_health')` 成功（需 execTool）  
8. 外链 5173 正常  
9. 未绑定显示横幅  
10. 连续切视图 20 次稳定  

**未过 spike → 禁止开始 Task 1。**

**做法：** 插件提供模板和视图；宿主负责安装、创建工作区、注入 `instanceConfig`、路由和 iframe 桥。业务语义只存在插件仓。

**技术栈：** `plugin.json` + workspace template JSON + 自包含 JS 视图 + 可选 `execTools`（`js-worker`）+ 可选 `components.tools`。

**全局约束：**

- 只改插件仓。
- 视图跑在宿主 iframe，CSP `connect-src 'none'`，外网 / 本机服务只能走 `window.pluginExec`。
- 实例绑定的唯一权威是 `instanceConfig.{plugin, vitalspan}`，禁止从文件名、对象库、模型参数反推。
- 只使用宿主已发布 action：`workspaceSetup.complete`、`workspace.navigate`。
- 工作区业务页高度模式必须是 `fill`。
- 安装物是构建后的插件目录（根上就是 `plugin.json`），不要把 `src/` 丢进宿主 plugins。

权威契约（执行时按当前代码核对，不要凭记忆发明字段）：

| 主题 | 文档 |
| --- | --- |
| 视图桥、权限、`sessions` / `experts` | `deeptalk/docs/features/plugin-views.md` |
| `pluginExec` / `execTools` | `deeptalk/docs/features/plugin-exec-bridge.md` |
| 创建向导插件步 | `deeptalk/docs/features/workspace-create-dialog/wizard-plugin-step-contract.md` |
| `instanceConfig` 浅合并 | `deeptalk/electron/main/workspaceProtocol.ts` |
| `workspace.navigate` | `deeptalk/src/features/workspace/workspaceViewActions.ts` |
| 导航项类型 | `deeptalk/src/features/workspace/workspaceNavigation.ts` |
| 视图注册名 | `deeptalk/electron/main/plugins/sub-loaders/view-loader.ts`（`vitalspan:{文件名不含扩展名}`） |

---

## 完成后的目录（与 `release.mjs` 打 zip 一致 · 根上即 `plugin.json`）

```text
deeptalk-plugins/plugins/vitalspan/
├── plugin.json                        # 根 manifest（非 plugin/ 子目录）
├── workspace-templates/
│   └── vitalspan.bi.default.workspace.json
├── views/
│   ├── home.js
│   ├── resources.js
│   └── workspace-setup.js
├── exec-tools/
│   ├── vitalspan-health.cjs
│   └── load-instance.cjs
├── dist/                              # components.tools（已有）
├── skills/
├── assets/
├── src/
│   ├── ids.ts
│   ├── pluginRuntime.ts
│   ├── instanceConfig.ts
│   ├── hostBridge.ts
│   ├── readWorkspaceMeta.ts
│   └── views/*-entry.ts               # esbuild → views/*.js
├── scripts/
│   ├── build-views.mjs
│   ├── assemble-plugin.mjs
│   ├── spike-host-verify.mjs
│   ├── task9-host-evidence.mjs
│   └── smoke.mjs
└── docs/PLUGIN_IDS.md
```

C 轨扩展 execTools（如 `list-artifacts`）放 **二期**，不在 B Task 8 必做范围。

---

## Task 1 — 冻结标识

**完成标准：** `src/ids.ts` 与 `docs/PLUGIN_IDS.md` 写出同一组值；后续文件只引用常量，不再手写字面量。

先填这张表，填完才能做 Task 2：

| 键 | 规则 | 示例（不要当真实值用） |
| --- | --- | --- |
| `vitalspan` | `plugin.json` 的 `name`，建议等于插件目录名 | `acme-audit` |
| `0.3.0` | SemVer | `0.1.0` |
| `vitalspan.bi.default` | 模板 `id` | `acme-audit.default` |
| `1.0.0` | 模板 `version` | `1.0.0` |
| `vitalspan` | `instanceConfig` 下的业务命名空间 | `audit` |
| `home` | 第一个业务视图文件名（不含扩展名） | `overview` |
| `home` | 模板 navigation 的 `id`，建议等于 `home` | `overview` |

写入 `src/ids.ts`：

```ts
export const PLUGIN_ID = "vitalspan" as const;
export const PLUGIN_VERSION = "0.3.0" as const;
export const TEMPLATE_ID = "vitalspan.bi.default" as const;
export const TEMPLATE_VERSION = "1.0.0" as const;
export const DOMAIN_KEY = "vitalspan" as const;
export const VIEW_A = "home" as const;
```

单测断言：根目录 `plugin.json` 的 `name`/`version`、模板的 `id`/`version`、向导提交里的 `plugin` 快照，三处与 `ids.ts` 一致。

- [x] 标识表已填
- [x] `src/ids.ts` 已写
- [x] `docs/PLUGIN_IDS.md` 已写
- [x] 标识同步测试已写并绿（`tests/ids-sync.test.mjs`）

---

## Task 2 — 写出 `plugin.json`

**完成标准：** 宿主能加载该插件；设置页 `workspaceTemplates`、`views` 为 loaded。

创建根目录 `plugin.json`（路径相对于插件仓根，见上方目录树）：

```json
{
  "name": "vitalspan",
  "version": "0.3.0",
  "description": "VitalSpan BI：Agent 工具 + 特殊工作区",
  "displayName": "VitalSpan BI",
  "permissions": [],
  "components": {
    "workspaceTemplates": [
      "workspace-templates/vitalspan.bi.default.workspace.json"
    ],
    "views": [
      "views/home.js",
      "views/workspace-setup.js"
    ]
  },
  "viewOptions": {
    "height": {
      "mode": "fill"
    }
  },
  "deeptalk": {
    "minVersion": "0.1.0"
  }
}
```

规则：

- 无绑定则去掉 `views/workspace-setup.js`。
- `permissions` 先空。只有真正调用对应 API 时再加：
  - `workspace-objects` → `window.workspaceObjects`
  - `experts` → `window.experts.list`
  - `sessions` → `window.sessions.submit / get / send / cancel / observe`
- 未声明的权限不会注入对应 `window.*`。
- `components.tools` 是给聊天模型的；`components.execTools` 是给视图 `pluginExec` 的。不要混成一项。
- 视图注册名是 `vitalspan:{basename}`，例如 `views/overview.js` → `vitalspan:overview`。

- [x] 根目录 `plugin.json` 已写（非 `plugin/` 子目录）
- [x] `name` / `version` 引用 Task 1 的值
- [x] 有绑定向导 → 已声明 `views/workspace-setup.js`

---

## Task 3 — 写出工作区模板

**完成标准：** 「新建工作区」列表出现该模板；未安装插件时对应导航不可选，文案为「需要先安装并启用 vitalspan」。

创建 `workspace-templates/vitalspan.bi.default.workspace.json`：

```json
{
  "id": "vitalspan.bi.default",
  "version": "1.0.0",
  "displayName": "显示名",
  "description": "这个工作区给谁、解决什么连续任务",
  "scene": {
    "id": "vitalspan",
    "name": "显示名",
    "industry": "行业或领域",
    "description": "场景说明"
  },
  "ui": {
    "home": "workspace.home",
    "navigation": [
      {
        "id": "new-chat",
        "label": "新智能体",
        "type": "builtin",
        "target": "chat.new",
        "icon": "plus"
      },
      {
        "id": "workspace-home",
        "label": "工作区首页",
        "type": "builtin",
        "target": "workspace.home",
        "icon": "layout-dashboard"
      },
      {
        "id": "home",
        "label": "VitalSpan",
        "type": "builtinOrPlugin",
        "pluginView": "vitalspan:home",
        "fallbackBuiltin": "workspace.placeholder",
        "icon": "layout-dashboard"
      }
    ]
  },
  "capabilities": {
    "plugins": ["vitalspan"],
    "views": ["vitalspan:home"]
  },
  "suggestedDirectories": ["材料", "产物"],
  "wizardView": "vitalspan:workspace-setup"
}
```

规则：

- **模板里不要写实例 ID、服务地址、token。** 绑定只允许向导写入 `instanceConfig`。
- 业务页用 `builtinOrPlugin` + `fallbackBuiltin: "workspace.placeholder"`，插件未装时走占位，不崩导航。
- 导航项 `id` 就是路由 `/workspace/view/:viewId` 的 `viewId`。`workspace.navigate` 传这个 id，不传 `vitalspan:home`。
- `capabilities.plugins` / `capabilities.views` 必须和真实视图一致。
- 无绑定则删除 `wizardView`。
- 需要工作区内本地对象类型时再加 `objects.types`；用不到就不要声明。

每加一个业务页，同时改四处：`plugin.json` 的 `views[]`、模板 `navigation[]`、模板 `capabilities.views[]`、构建入口。

- [x] 模板已写
- [x] `id` / `version` 与 `ids.ts` 一致
- [x] 有绑定 → 已设 `wizardView: vitalspan:workspace-setup`
- [x] 安装后能出现在新建工作区列表（spike #2 · Task 9 #2）

---

## Task 4 — 宿主桥与绑定读取

**完成标准：** 视图能读到 `__pluginViewData`，能监听更新，能安全解析 `vitalspan`；缺字段时返回明确错误，不抛未捕获异常。

### 4.1 桥类型 `src/pluginRuntime.ts`

```ts
export type PluginViewData = {
  workspaceRoot?: string;
  workspaceMode?: string;
  viewId?: string;
  routeSearch?: string;
  routeHash?: string;
  phase?: string;
  templateId?: string;
  workspacePath?: string;
  displayName?: string;
  scene?: unknown;
  instanceConfig?: Record<string, unknown>;
  authenticatedIdentity?: unknown;
};

declare global {
  interface Window {
    __pluginViewData?: PluginViewData;
    __pluginViewAction?: (action: string, payload?: unknown) => void;
    pluginExec?: (toolName: string, params?: unknown) => Promise<unknown>;
  }
}
```

只声明实际会用到的 API。未在 `permissions` 里声明的 `experts` / `sessions` / `workspaceObjects` 不要写进类型假装存在。

### 4.2 读 viewData `src/hostBridge.ts`

```ts
export function readPluginViewData(): PluginViewData {
  return window.__pluginViewData ?? {};
}

export function subscribePluginViewData(onChange: () => void): () => void {
  window.addEventListener("pluginview:data", onChange);
  return () => window.removeEventListener("pluginview:data", onChange);
}

export function navigateWorkspace(input: {
  viewId?: string;
  search?: string;
  target?: "experts" | "automation" | "marketplace" | "gallery" | "settings" | "workspace.home" | "chat.new";
}): void {
  window.__pluginViewAction?.("workspace.navigate", input);
}
```

禁止从 iframe 的 `window.location` / `hash` 猜父级路由。

### 4.3 校验绑定 `src/instanceConfig.ts`

按自己的业务定义类型，下面只规定结构，不规定字段含义：

```ts
export type PluginSnapshot = {
  id: string;
  version: string;
  templateId?: string;
  templateVersion?: string;
};

export type DomainBinding = {
  // 只放本插件需要的非敏感绑定，例如：
  // mode: "demo" | "live";
  // instanceId: string;
  // service: { baseUrl: string };
};

export function readDomainBinding(
  instanceConfig: Record<string, unknown> | undefined,
):
  | { ok: true; plugin: PluginSnapshot; binding: DomainBinding }
  | { ok: false; reason: string } {
  // 1. instanceConfig 必须是纯对象
  // 2. instanceConfig.plugin.id 必须等于 PLUGIN_ID
  // 3. instanceConfig[vitalspan] 必须通过本插件 schema
  // 4. 失败返回 reason，不要 throw 到 React 根
}
```

测试最少覆盖：

1. 缺 `instanceConfig` → `ok: false`
2. `plugin.id` 不匹配 → `ok: false`
3. `vitalspan` 缺必填字段 → `ok: false`
4. 合法对象 → `ok: true`，字段类型保持（不要把数字改成字符串）

- [x] `pluginRuntime.ts` / `hostBridge.ts` / `instanceConfig.ts` 已写
- [x] `instanceConfig` 测试全绿（`tests/instanceConfig.test.mjs`）
- [x] 视图源码（`src/views/*`）无 `fetch(`；Agent/execTool 侧 fetch 不在 iframe

---

## Task 5 — 第一个业务视图

**完成标准：** 打开 `/workspace/view/home` 时 iframe 显示本页；未绑定有横幅；已绑定能读到 `instanceId`（或等价字段）并展示。

`src/views/home-entry.ts` 启动逻辑（esbuild → `views/home.js`）：

1. `subscribePluginViewData` 触发重读。
2. `readDomainBinding(readPluginViewData().instanceConfig)`。
3. `ok === false`：醒目横幅，文案用 `reason`，不要改用另一套演示数据冒充已绑定。
4. `ok === true`：展示绑定摘要；本阶段可以还没有真实取数。
5. 根节点 `height: 100%` + 内部滚动。不要上报 `plugin-view:resize`（`fill` 模式会被忽略）。

构建出 `views/home.js`（自包含 bundle）。`assemble-plugin` 校验产物，不拷 `src/`。

本阶段允许页面只有绑定状态和标题。不要先做复杂业务 UI。

- [x] 视图能被宿主加载（spike #5 · Task 9 #3）
- [x] 未绑定显示横幅（spike #9 · Task 9 #8）
- [x] 已绑定显示绑定字段（Phase 4 手测）
- [x] 页面为 fill，无宿主双滚动条（`viewOptions.height.mode: fill`）

---

## Task 6 — 创建向导（有绑定时必做）

无「一个工作区一份绑定」则跳过本任务，并确认模板没有 `wizardView`。

**完成标准：** 向导第三步出现本插件页；合法配置后宿主解锁「创建」；创建后磁盘 `.deeptalk/workspace.json` 的 `instanceConfig` 与运行时视图读到的一致。

宿主下发：

```ts
{
  phase: "workspace-create";
  templateId: string;
  workspacePath: string;
  displayName: string;
  scene?: unknown;
  instanceConfig: Record<string, unknown>;
}
```

插件提交（只能用这个 action）：

```ts
window.__pluginViewAction("workspaceSetup.complete", {
  instanceConfig: {
    plugin: {
      id: PLUGIN_ID,
      version: PLUGIN_VERSION,
      templateId: TEMPLATE_ID,
      templateVersion: TEMPLATE_VERSION,
    },
    [DOMAIN_KEY]: binding, // 已通过本插件 schema
  },
});
```

规则：

- `phase !== "workspace-create"`：只显示等待或错误，不提交。
- `instanceConfig` 必须是纯对象；数组 / `null` 会被宿主拒绝，创建按钮不解锁。
- 形状校验在插件侧做完再 complete。宿主只浅合并。
- 不能用 complete 改 `displayName`。
- 向导步没有 `workspaceObjects`。需要查外部系统时用 `pluginExec`。
- 按约 360px 高排版，列表在 iframe 内滚动。
- `__pluginViewAction` 不存在时显示「宿主桥接不可用」，不要假装已创建。

`src/views/workspace-setup-entry.ts` 的确认按钮：绑定非法时拦截 submit。

- [x] `wizardView` 指向 `vitalspan:workspace-setup`（spike #3）
- [x] 非法配置不能解锁创建（向导按钮 disabled + schema 校验）
- [x] 合法 complete 后工作区 meta 含 `plugin` + `vitalspan`（Phase 4 / spike #4 手测）
- [x] 打开业务页读到的绑定与磁盘一致（Phase 4 手测）

---

## Task 7 — 页内导航与深链

**完成标准：** 左侧导航、页内入口、父级 URL、iframe 内容四者一致；带 query 的地址能定位。

页内跳转：

```ts
navigateWorkspace({ viewId: "resources", search: "?id=item-001" });
```

跳宿主内置页必须用已发布 `target`，例如专家页：

```ts
navigateWorkspace({ target: "experts" });
```

`viewId: "experts"` **不会**改道到 `/experts`。

深链：

- 读 `readPluginViewData().routeSearch`（例如 `"?id=item-001"`）。
- 监听 `pluginview:data`：同一 `viewId` 下 query 变化不重建 iframe，只更新数据。
- 换 `viewId` 时宿主会重建 iframe，不必自己清旧页状态。

每新增一页：

1. 增加 `views/resources.js` 和页面组件
2. 模板 navigation 增加一项，`id` 等于 `resources`
3. `capabilities.views` 加上 `vitalspan:resources`
4. `plugin.json` 的 `views` 加上该文件

- [x] 左侧切换后 URL、选中态、内容一致（home ↔ resources ↔ builtin）
- [x] 页内入口会改父级 URL（home → resources · resources 行点击）
- [x] `/workspace/view/resources?id=...` 能定位（`routeSearch` + `pluginview:data`）
- [x] 连续切换 20 次无「页面加载失败」，无上一页残留（Phase 4 / Task 9 #6）

---

## Task 8 — 视图取数（execTools）

iframe 不能 `fetch` 外部地址。外连 VitalSpan 须声明 `execTools` + `pluginExec`。

### 必做 execTools（SOP 对齐）

| 名称 | 模块 | 用途 |
|------|------|------|
| `vitalspan_health` | `exec-tools/vitalspan-health.cjs` | home 检测 `/health` |
| `loadInstance` | `exec-tools/load-instance.cjs` | resources 只读快照 |

compose / upload / publish — **仍 Agent tools**，不在 iframe execTools 范围。

```json
{
  "name": "loadInstance",
  "runtime": "js-worker",
  "module": "exec-tools/load-instance.cjs",
  "export": "run",
  "load": "lazy",
  "keepAlive": "plugin",
  "concurrency": "serial"
}
```

模块 ABI：

```js
exports.run = async function run(params, ctx) {
  ctx.signal.throwIfAborted();
  return { /* 纯 JSON */ };
};
```

视图调用：

```ts
const snapshot = await window.pluginExec("loadInstance", {
  instanceId: binding.mode,
  baseUrl: binding.apiBaseUrl,
  apiBaseUrl: binding.apiBaseUrl,
  feAdminUrl: binding.feAdminUrl,
});
```

凭据：`VITALSPAN_USERNAME` · `VITALSPAN_DEV_ADMIN_PASSWORD` 由 worker 读 env；**不进** instanceConfig。

规则：

- 只能调本插件注册的名字。
- 参数和返回值必须是 JSON。超过 5MB 是物理边界，工具内不要再做业务截断。
- Worker 不继承宿主密钥环境。凭据用插件自己的环境变量，并在插件文档写优先级。
- 向导步和运行时视图都能调用。
- 不要向宿主申请 `window.{业务名}`。
- 外部失败时页面展示可读错误；禁止静默改用演示数据。

若还要给聊天模型提供工具，另加 `components.tools`，并遵守：

- 模型不能填写实例 ID、服务地址、token；这些只来自当前工作区 `instanceConfig`。
- 查询工具只返回事实；加工 / 总结工具只消费查询结果，不要做成又读又判的单一工具。
- 用户可见回复不展示内部哈希、token、证件号。

不要用 `components.mcp` 冒充必须常驻、与插件装卸无关的独立服务器。  
不要把 `workspace-objects` 当成外部权威库。

- [x] 业务页取数只走 `pluginExec`（home health · resources loadInstance）
- [x] iframe 视图无外部 `fetch`（`views/*.js` 探针）
- [x] 失败态可见、可重试（health / resources 错误行 + 重试）
- [x] Agent 工具不接受模型传入的地址和凭据（`shared.ts` 读工作区 binding / env）

---

## Task 9 — 打包、安装、宿主验收

**完成标准：** 构建产物安装进 DeepTalk 开发宿主后，下面清单全过；`deeptalk` 工作树没有本插件痕迹。

`scripts/assemble-plugin.mjs` + 仓库根 `scripts/release.mjs` 最低要求：

1. 拷贝 `plugin.json`、模板
2. 写入构建后的 `views/*.js`
3. 如有 execTools，写入 `exec-tools/*.cjs`
4. 不拷贝 `src/`、`.env`、token 文件

安装步骤：

```text
1. 运行插件仓构建 + assemble
2. 覆盖到 DeepTalk 开发插件目录：.../plugins/vitalspan/
3. 对 plugin.json、每个 views/*.js、每个 exec-tools/*.cjs 做安装目录与产物哈希对照
4. 完全退出并重启 DeepTalk（只热覆盖会留下旧 bundle）
```

在**真实 DeepTalk 窗口**验收，不要用浏览器单独打开 view 文件：

1. 设置页插件 loaded；停用后模板消失或导航不可选。
2. 用该模板新建工作区；有向导则走完向导后创建成功。
3. 打开 `home`，内容是本页。
4. 左侧切到下一页（若有），URL、选中态、iframe 三者一致。
5. 页内入口跳转会改父级 URL。
6. 连续切换 20 次，无「页面加载失败」。
7. 直接打开带 `?id=` 的地址，视图能定位。
8. 未绑定或外部服务不可达：可见错误，不把演示数据标成正式数据。
9. 开发者工具：iframe 无对外部 host 的 `fetch`；取数出现在 `pluginExec` 日志。
10. `deeptalk` 仓库 `git status` 干净。

宿主已保证：子帧 `about:srcdoc` / `ERR_ABORTED` 不弹主页面失败框；换 `viewId` 时 iframe 整页重挂；`routeSearch` 随父级 URL 更新。这些若复现，先核对本机 DeepTalk 版本，不要在插件里用 `location.hash` 打补丁。

- [x] assemble 产物根目录只有可安装文件
- [x] 安装哈希一致并已重启宿主（见 [Task 9 验收](../docs/reviews/grounded/2026-08-25-deeptalk-vitalspan-task9-host-acceptance.md)）
- [x] 上面 10 条全部勾过（含 #5/#7 · 证据见 `docs/TASK9-EVIDENCE.json`）
- [x] 引擎未被补丁污染（`Programs\DeepTalk` 无 vitalspan · 插件仅 `%APPDATA%`）

---

## 禁止

- 改 `deeptalk` 引擎给本插件加专用 IPC 或专用 `window.*`
- 发明未文档化的 `__pluginViewAction` 名称
- iframe 直连网络，或把放宽 CSP 当方案
- 把源码树、Vite dev URL 当作正式安装包
- 把实例 ID / token / 内网地址写进模板并提交
- 让 Agent 工具接受模型传入的服务地址和凭据
- 用对象库覆盖外部权威数据源
- 未确认绑定就静默展示另一套演示数据

---

## 给执行会话的提示词

> 真源：[`docs/api/vs-ai-spec/deeptalk-product/SPECIAL-WORKSPACE-PLUGIN-TASK.md`](../docs/api/vs-ai-spec/deeptalk-product/SPECIAL-WORKSPACE-PLUGIN-TASK.md) · 仓内副本：本文件。  
> wf2/wf3 与 14× Agent 组件工具 **不变**；只改工作区壳（Task 1–9）。只改插件仓，不改 deeptalk。  
> 宿主契约以 plugin-views.md、plugin-exec-bridge.md、wizard-plugin-step-contract.md 为准。  
> 验收：`npm run smoke` · [Task 9 十条](../docs/reviews/grounded/2026-08-25-deeptalk-vitalspan-task9-host-acceptance.md) · `docs/TASK9-EVIDENCE.json`。
