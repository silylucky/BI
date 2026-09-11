---
name: docs-reviewer
description: >
  文档完整性评审与生成/修复（技术栈无关）：对照标准 docs 分类检查 api / adr / domain /
  service / mock / ui / data 是否缺失、过时或格式不合规；api/domain 须达可消费深度（Postman /
  APISix / 业务流程测试）；扫描代码补齐或修正文档；校验并修正 .cursor/rules/prd-sync.mdc，
  确保后续生成文档符合规范。输出分级报告；用户确认后按域批量写文档。
  Use when reviewing docs completeness, generating or fixing API/ADR/domain/service/mock/UI/data docs,
  auditing documentation drift vs code, requiring Postman/APISix/process-test ready API or domain docs,
  syncing PRD/docs rules, fixing prd-sync.mdc, or when the user asks for docs review, documentation audit,
  missing docs, or docs graduation — any repo with or without an existing docs/ tree.
---

# Docs Reviewer（文档完整 · 可同步）

技术栈无关的**文档体系**评审与修复。Agent 已懂怎么写文档；本 Skill 补：**标准分类与命名**、**代码↔文档对账**、**每类标准模板**、**api/domain 可消费深度（Postman / APISix / 流程测试）**、**prd-sync 规则门禁**、**先报告后生成/修复**。

不假设仓里已有 `docs/`。先出 **Docs Card**（现有文档树 + 代码面），再按类型并行对账；不合规则生成或重写，并校正 `.cursor/rules/prd-sync.mdc`。

与姊妹 skill 分工：假绿/stub/硬编码 → [code-reviewer](../code-reviewer/SKILL.md)；页级视觉/CRUD/空态 → [ui-ux-reviewer](../ui-ux-reviewer/SKILL.md)；**文档缺失·漂移·模板·prd-sync** → 本 Skill；**终端用户帮助/手册可读写作** → [user-guide-writer](../user-guide-writer/SKILL.md)；**走查剧本** → [scenario-playbook](../scenario-playbook/SKILL.md)；**真机执行剧本** → [browser-reviewer](../browser-reviewer/SKILL.md)。`docs/mock/` 与 code-reviewer 的 stub 发现可交叉引用，本 Skill 只要求「清单诚实、路径可定位」，不替代码清 stub。

## 何时启用

| 场景 | 动作 |
|------|------|
| 上线前 / 里程碑「文档可毕业」 | 整仓 Docs Card → 并行对账 → 报告 → 确认后写文档 + 规则 |
| 新模块 / 新服务落地后补文档 | 范围=变更面；只扫触及模块与相关类型 |
| 「文档和代码对不上」 | 漂移对账为主；按 finding 修文档或标延期 |
| 初始化 docs 体系 + prd-sync | 落标准目录 + 模板 + 写/修 `.cursor/rules/prd-sync.mdc` |
| 只要检查规则是否合适 | 短跑：对照 [prd-sync-rule.md](references/prd-sync-rule.md) 出差分建议 |

**不要**：把营销站文案、对外博客当本 Skill 必扫对象；未确认就批量覆写已有精修文档；用文档「掩盖」code-reviewer 应报的假绿（mock 文档须诚实列出假能力，不能写成已交付）。

## 必读顺序（≤3 次）

1. 本文件「文档分类」+「流程」+「严重度」+「非问题」
2. [references/taxonomy.md](references/taxonomy.md) + [references/templates.md](references/templates.md)（**只读索引**，再按需取 `references/templates/<域>.md`，禁止整目录全读）+ [references/consumable-depth.md](references/consumable-depth.md) + [references/prd-sync-rule.md](references/prd-sync-rule.md)
3. 报告 [references/report-template.md](references/report-template.md)；扫描 [references/scan-workflow.md](references/scan-workflow.md)；确认后写文档 [references/batch-write-workflow.md](references/batch-write-workflow.md)

## 文档分类（标准树）

默认根目录 `docs/`。命名与何时必建见 [taxonomy.md](references/taxonomy.md)。每类标准正文按域拆分，索引见 [templates.md](references/templates.md)（域文件在 `references/templates/`，用哪个域读哪个）；api/domain 深度闸门见 [consumable-depth.md](references/consumable-depth.md)。

| 目录 | 文件约定 | 内容 | 何时必建 |
|------|----------|------|----------|
| `docs/api/` | `<模块>.md`（可选配套 OpenAPI/Collection） | **可消费 API 说明书**：环境、鉴权、网关/APISix、逐端点参数+完整示例、错误码、冒烟清单；能直接支撑 Postman / 网关配路由 | 有对外/对内 HTTP·RPC·事件契约 |
| `docs/adr/` | `<主题>-<模块\|流程>.md` | 架构/方案决策：上下文、选项、结论、后果 | 有非显然技术选型或跨模块方案 |
| `docs/domain/` | `<业务流程>.md` | **可测业务域**：角色、夹具、主/异常逐步表、状态机、Given/When/Then 规则、**Process Test Pack**；能直接支撑业务流程测试 | 有清晰业务闭环或领域模型 |
| `docs/service/` | `<服务>.md` | 进程/命令：职责、配置、部署、健康、运维 | 每个可独立运行的服务/worker/CLI |
| `docs/mock/` | `<服务\|模块>.md` | **诚实**假能力/占位清单（路径+如何启用+计划） | 非测试主路径存在 stub/mock/假数据 |
| `docs/ui/` | `anchor.md`（**设计锚，有前端时必有**）+ `layout.md` + `<表面\|流程>-ia.md` | 设计锚（组件库/token 真源/外部参考锚/可信度）、壳层、信息架构、关键流、页菜谱 | 有 SPA/Console/Admin 等产品表面 |
| `docs/data/` | `<域\|存储>.md` | 数据模型、持久化、迁移、一致性与保留策略 | 有 DB/缓存/对象存储/队列持久化 |
| `docs/README.md` | 固定 | 文档索引：类型说明 + 目录表 + 维护约定 | 只要启用本体系就必有 |

**可选（按需，勿默认堆满）**：`docs/runbook/`（重大事故手册，可先写在对应 `service` 的运维节）、`docs/security/`（威胁模型；轻量可并入 ADR）、根 `README.md`（快速开始，链到 `docs/`）。

**不放进 docs 体系冒充源**：OpenAPI/proto **权威源**仍放契约源目录（如 `api/`、`proto/`）；禁止手改生成物冒充源。`docs/api/*.md` 是**可消费说明书**（Postman / APISix / 联调），须满足 [consumable-depth.md](references/consumable-depth.md)；可链契约源，但不得只剩链接而无环境·鉴权·网关·逐端点示例。

## 严重度

| 级 | 含义 | 典型 |
|----|------|------|
| **P0** | 文档不可毕业 / 误导交付 | 宣称已交付但无文档且无契约可循；`docs/mock` 把假能力写成正式能力；关键服务零运维文档导致无法部署；prd-sync 缺失导致 agent 持续生成错误路径 |
| **P1** | 上线前应补齐 | 有 API 无 `docs/api`；有服务无 `docs/service`；有前端无 `docs/ui`；有持久化无 `docs/data`；文档与代码明显漂移；**api/domain 薄文档（不可消费：过不了 Postman/APISix/流程测试闸门）**；模板缺必填节；prd-sync 与 taxonomy 不一致 |
| **P2** | 可跟踪 | 索引不全、交叉链接缺失、ADR 未补「后果」、文案风格不统一、可选 runbook 未拆 |

**置信度**：P0 须指出「谁会因文档缺失/错误做出错误决策或无法上线」。构不出场景 → 降 P1/P2。

## 非问题

1. **测试双 / Storybook**：测试 mock 不要求进 `docs/mock/`。
2. **实验分支未合并能力**：可不建文档；若主分支已挂入口或 README 宣称 → 升 P0/P1。
3. **巨型 JSON Schema 全文粘贴**：有 OpenAPI/proto 时可链出去，不要求 Markdown 再贴完整 schema——但**不是**免写环境/鉴权/网关/逐端点可复制示例的借口；缺示例仍报 P1。见 [consumable-depth.md](references/consumable-depth.md)。
4. **第三方 SaaS 原文**：链出去即可，勿复制整本 vendor 手册。
5. **用户书面延期的文档债**：总览登记即可，勿重复刷 P0（误导性 mock 文档除外）。
6. **内部调试-only 端点**：可在 api 文档标 `internal` 并缩短，但仍须有路径与鉴权说明。

## 硬规则

1. **先 Docs Card，再扫**：禁止未盘点现有 `docs/` 与代码面就批量新建。
2. **代码为真源，文档对齐代码**：漂移时默认修文档；若代码是 stub，文档进 `mock/` 诚实写，**禁止**在 api/domain 写成已交付。
3. **标准模板必填节不可空**：见 [templates.md](references/templates.md) 索引 → 对应 `references/templates/<域>.md`；**api/domain 另过可消费深度闸门**（[consumable-depth.md](references/consumable-depth.md)）；未知写「待确认」并挂 P2，禁止臆造端点/表结构。
4. **命名与路径遵守 taxonomy**：修正 prd-sync 时与本表一致；禁止另起 `documentation/`、`doc/` 平行树（除非仓内已锁定且用户要求兼容）。
5. **先报告后写**：确认批次后再生成/覆盖；精修过的文档默认 **diff 修补**，非用户点名不整文件覆写。
6. **prd-sync 必检**：每次整仓跑完须给出规则「合适 / 需改」结论；需改则进入修复批次（通常优先）。
7. **与 code-reviewer 交叉**：发现未文档化的非测试 stub → 本 Skill 记 `docs/mock` 缺口；同时可建议另跑 code-reviewer，但不在本 Skill 内改业务代码清 stub。
8. **api/domain 须可测**：生成后自检——能否据此建 Postman、配 APISix、跑 Process Test Pack；不能则不得标「完整/可毕业」。

---

## 流程（必须）

### Phase 0 · Docs Card（主 agent，短）

| 探测 | 产出 |
|------|------|
| 文档根 | `docs/` 是否存在；若用别的根（`documentation/`）→ 记入 Card，默认迁移建议进 P1 |
| 现有文件 | 按类型列出路径；非标准命名单独标记 |
| 代码面 | 服务/进程入口、API 契约、领域包、前端根、数据层、stub/mock 痕迹 |
| 规则 | `.cursor/rules/prd-sync.mdc` 是否存在、与 taxonomy 是否一致 |
| 范围 | 整仓 / 模块·服务列表 / PR 变更面 |
| 宣称材料 | README / 对外 docs 中「已支持」清单（用于升 P0） |

写出 **Docs Card**（进报告）。模板见 [scan-workflow.md](references/scan-workflow.md)。

### Phase 1 · 并行对账（按文档类型 lane）

主 agent 按类型开多个 readonly explore subagent（提示词见 scan-workflow）。每条 lane：**代码清单 × 现有文档 × 模板合规**。

| Lane | 对账 |
|------|------|
| D1 api | 路由/OpenAPI/proto/handler ↔ `docs/api/*` + **可消费闸门 A1–A8** |
| D2 adr | 非显然选型（多存储、总线、权限模型…）↔ `docs/adr/*` |
| D3 domain | 业务流程/状态机/领域包 ↔ `docs/domain/*` + **可消费闸门 D1–D8（含 Process Test Pack）** |
| D4 service | 可运行二进制/部署单元 ↔ `docs/service/*` |
| D5 mock | 非测试 stub/mock/假数据 ↔ `docs/mock/*`（诚实性） |
| D6 ui | 路由/菜单/关键流 ↔ `docs/ui/*`（无前端则跳过并注明） |
| D7 data | schema/migration/ORM ↔ `docs/data/*`（无持久化则跳过） |
| D8 index+rule | `docs/README.md` + `.cursor/rules/prd-sync.mdc` |

**降级**：无 subagent 或仓极小 → 主 agent 按 lane 串行；须勾选进度，禁止假装已扫。

失败 lane：重试 1 次 → 主 agent 补扫 → 否则 **Blind spot**（有 Blind spot 不得写「文档可毕业」）。

### Phase 2 · 汇总报告

合并去重 → 稳定 ID → 套 [report-template.md](references/report-template.md) → **停等确认**。

去重键：`文档类型` + 目标路径（或应有路径）+ 根因一句话。级别冲突取更严。

### Phase 3 ·（确认后）批量写文档 + 修规则

见 [batch-write-workflow.md](references/batch-write-workflow.md)。

推荐顺序：**R0 prd-sync + docs/README** → 按域并行写 api/service/domain/… → 最后补交叉链接与索引表。

---

## 进度清单

```
- [ ] 0. Docs Card + 范围 + 现有树 + 代码面 + prd-sync 状态
- [ ] 1. 并行（或串行）lane：api / adr / domain / service / mock / ui / data / index+rule
- [ ] 1b. Blind spots 已处理或标注
- [ ] 2. 合并去重 + 标准报告；停等确认
- [ ] 3. （确认后）R0 规则与索引 → 分类型写/修文档 → 交叉链接回归
```

## 标准报告（必须）

含 Docs Card + 文档覆盖矩阵 + P0→P2 + prd-sync 结论 + 待确认批次。模板见 report-template。

## 批量修复门闩

| 步骤 | 要求 |
|------|------|
| 报告已交 | 含覆盖矩阵与 P0/P1 |
| 用户确认 | 明确批次（如「R0+D1+D4」或「全部 P0」） |
| 再动手 | 按批写文档；禁止一次混改无关模块业务代码 |

## 落盘位置

报告统一落 `docs/material/docs-reviewer/<YYYY-MM-DD>-<slug>.md`（`slug` = 范围标识，如 `full-repo` / `order-service`）；被评审/生成的文档本体仍落各自 `docs/<type>/`，不进 material。

## 回传格式

```yaml
status: DONE | DONE_WITH_CONCERNS | BLOCKED
phase: docs-reviewer
mode: review | init | drift | rule-only
fix_mode: confirm | auto | none
scope: full_repo | change_surface | modules
report: ""                  # docs/material/docs-reviewer/<YYYY-MM-DD>-<slug>.md
domains:                    # 每个文档域一条；未适用也要列并写 skipped 理由
  - domain: api | adr | domain | service | mock | ui | data | index_rule
    lane: D1                # D1…D8
    state: ok | missing | stale | non_compliant | skipped
    severity: P0 | P1 | P2 | none
    findings: []            # finding ID
    paths: []               # 现有或应有的文档路径
    consumable: pass | fail | n/a   # api/domain 的 A1–A8 / D1–D8 闸门；其余 n/a
    note: ""                # skipped 必填理由（无前端 / 无持久化 …）
written: []                 # 已写/已修文档路径；confirm 未确认前 []
prd_sync: ok | needs_change | missing | not_checked
remaining: []               # 待确认 / 需裁定 / 盲区未修
coverage:
  blind_spots: []           # `lane | 未覆盖路径 | 原因`；非空 → status 禁止 DONE
  lanes_run: []             # 实跑 lane；与 domains 对账
blockers:
  - ""
```

**`status` 与覆盖度的绑定**：全 lane 已扫（含写明理由的合理 `skipped`）且无未消解盲区 → 可 `DONE`；盲区仅落在**边缘面**（无前端仓的 D6、无持久化的 D7、可选 runbook…）→ 最多 `DONE_WITH_CONCERNS`，盲区原样进 `remaining`；盲区落在**主路径**（对外 API 契约面 / 宣称已交付能力 / 关键服务运维文档 / prd-sync 规则）→ `BLOCKED`，此时「没发现 P0」不成立，更不得写「文档可毕业」。

## 禁止

- 未做 Docs Card 就整树生成
- 把 stub 写进 `docs/api` / `docs/domain` 当正式能力
- 臆造不存在的端点、表、配置项
- 生成「空壳」api/domain（仅目录表或散文，无法支撑 Postman / APISix / 流程测试）
- 未确认覆写用户精修文档
- Blind spot 未披露却写「文档可毕业」
- 修正 prd-sync 时引入与本 taxonomy 冲突的路径
- 用本 Skill 大改业务实现（那是 code-reviewer / 开发任务）

## 关联

- [taxonomy.md](references/taxonomy.md) · [templates.md](references/templates.md)（索引 → `references/templates/{api,adr,domain,service,mock,ui,data,readme-index}.md`）· [consumable-depth.md](references/consumable-depth.md)
- [prd-sync-rule.md](references/prd-sync-rule.md) · [scan-workflow.md](references/scan-workflow.md)
- [report-template.md](references/report-template.md) · [batch-write-workflow.md](references/batch-write-workflow.md)
- 姊妹：[code-reviewer](../code-reviewer/SKILL.md) · [ui-ux-reviewer](../ui-ux-reviewer/SKILL.md) · [browser-reviewer](../browser-reviewer/SKILL.md) · [user-guide-writer](../user-guide-writer/SKILL.md)
