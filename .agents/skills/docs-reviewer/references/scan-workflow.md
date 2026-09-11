# 扫描工作流与提示词

## Docs Card 模板（Phase 0 产出）

```markdown
### Docs Card

| 项 | 内容 |
|----|------|
| 文档根 | `docs/` 存在 / 缺失 / 别名 `…` |
| 范围 | 整仓 / 模块… / PR 变更面（主根…） |
| 现有文档数 | api n / adr n / domain n / service n / mock n / ui n / data n / 其他 n |
| 非标准路径 | …（或无） |
| 代码面 · API | 契约路径…；模块列表… |
| 代码面 · 服务 | 进程/compose 服务… |
| 代码面 · 领域 | 包/目录… |
| 代码面 · UI | 前端根…；路由入口…（或无前端） |
| 代码面 · 数据 | migration/ORM…（或无） |
| 代码面 · mock 痕迹 | 有/无；热区路径… |
| prd-sync | 存在且合适 / 需改（摘要）/ 缺失 |
| 宣称材料 | README 要点… |
| 建议 lane | D1–D8 中启用列表；跳过项+原因 |
```

## 覆盖矩阵（报告必含）

对每个应有文档目标填一行：

| 应有路径 | 类型 | 代码依据 | 文档状态 | 模板合规 | 漂移 | 建议动作 |
|----------|------|----------|----------|----------|------|----------|
| `docs/api/foo.md` | api | `paths…` | 缺失/过时/OK | 缺节…/OK | 有/无 | 新建/修补/迁移 |

## Lane 提示词模板（explore subagent）

复制时替换 `{{…}}`。要求 **只读**、回传结构化结果，不写文件。

```
你是文档对账 agent。只读，不修改文件。

项目根：{{ROOT}}
范围：{{SCOPE}}
Docs Card 摘要：{{DOCS_CARD_SUMMARY}}
本 lane：{{LANE_ID}} — {{LANE_GOAL}}

任务：
1. 从代码列出本 lane 的「应有文档」清单（路径按 docs/{{TYPE}}/ 命名约定）。
2. 对照现有 docs 树：缺失 / 存在但命名不合规 / 存在。
3. 对已存在文档：检查是否含类型模板必填节；抽查与代码是否漂移（端点、服务名、状态机、配置键等）。
4. **api / domain lane 额外**：按 consumable-depth.md 打勾（api: A1–A8；domain: D1–D8）。薄文档（不可 Postman/APISix/流程测试）→ P1「不可消费」。
5. mock lane：若文档把假能力写成正式交付 → 标 P0。
6. 禁止臆造代码中不存在的符号；不确定标「待确认」。

排除：node_modules、dist、vendor、*_test.*、*.spec.*、__mocks__（测试双不要求进 docs/mock）。

回传 Markdown：
## Lane {{LANE_ID}} 结果
### 应有清单
| 应有路径 | 代码依据 | 文档状态 | 严重度建议 | 说明 |
### 模板/漂移问题
| 路径 | 问题 | 严重度建议 |
### 可消费深度（仅 D1 api / D3 domain）
| 路径 | 闸门勾选（A1–A8 或 D1–D8） | 结论 |
### Blind spot
若无法完成某块，明确写出原因。
```

### 各 lane 目标与搜法种子

| Lane | GOAL | 搜法种子（按栈改写） |
|------|------|----------------------|
| D1 api | 模块↔docs/api + 可消费 A1–A8（Postman/APISix） | OpenAPI/proto；`router`/`@Get`/`HandleFunc`/`rpc `；抽查能否建请求 |
| D2 adr | 非显然选型↔docs/adr | `docs/adr` 现有；架构注释；双写/outbox/多库痕迹 |
| D3 domain | 流程↔docs/domain + D1–D8（Process Test Pack） | `domain/`/`usecase/`/`workflow`；状态枚举；场景表可否执行 |
| D4 service | 进程↔docs/service | `cmd/`、`main.go`、Dockerfile、compose `services:` |
| D5 mock | stub↔docs/mock | `stub`/`mockData`/`TODO implement`/`ForceStub`（排除测试） |
| D6 ui | 路由↔docs/ui | `routes`/`createBrowserRouter`/菜单配置 |
| D7 data | 模型↔docs/data | `migrations/`、`schema.prisma`、ORM models |
| D8 index+rule | 索引+prd-sync | 读 `docs/README.md`、`.cursor/rules/prd-sync.mdc`；对照 taxonomy/prd-sync-rule |

## PR / 变更面模式

1. 以 diff 触及目录为主根。
2. 仍向上追一层：路由表、compose 服务名、领域包入口。
3. 只对触及类型开 lane；未触及类型在报告写「范围外跳过」。
4. prd-sync：若范围含「初始化文档体系」或规则本身在 diff 中 → 必跑 D8；否则至少快速检查规则是否存在。

## 回归（写文档后）

- 覆盖矩阵中本批目标均为「已写/已修」
- `docs/README.md` 含新路径
- 抽查链接可解析
- mock 文档无「已交付」措辞
- prd-sync 分类表与仓库实树一致
- **api**：任选 1 端点，3 分钟内能按文档在 Postman 发出（或 Import OpenAPI 成功且鉴权/环境写清）
- **domain**：任选 1 条 PT 场景，步骤含 API 触点与断言，可交给 QA 执行
- 有网关的仓：api 文档含 APISix/网关 uri·methods·upstream·鉴权插件要点
