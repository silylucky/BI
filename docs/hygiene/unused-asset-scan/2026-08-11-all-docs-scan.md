# 无用资产扫描 — 全仓文档

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-11 |
| Skill | `~/.cursor/skills/unused-asset-scan/` |
| Scope | `docs/**/*.md`（全仓文档） |
| 侧面 | docs |
| 深度 | quick（hub BFS 5 跳 + 命名空间校正 + 全仓 `rg` 二次验证） |
| 删除执行 | **是**（2026-08-11 · D-001～D-012 已删除；断链已修） |

---

## 0. 范围与入口集

- **Entry Set**：`docs/README.md` · `docs/automate/prd.md` · `docs/services/README.md` · `docs/arch.md` · `docs/api/README.md` · `docs/ui/layout.md` · 根 `README.md` · `AGENTS.md`
- **排除**：`docs/srs/**`（合同权威，不标删除）· `.agents/skills/` · `.cursor/rules/`
- **体量**：文档 **519** 篇 · hub BFS 可达 **209** · 不可达 **366**

### 方法论说明

1. 从 hub 做 markdown 链接 BFS（≤5 跳）得 `ORPHAN_DOC` 候选。
2. `docs/README.md` 登记的命名空间（`feature-truth/`、`automate/plans/` 等）内孤儿文件**降级为 SUSPECT**——目录本身为有意归档区，不得仅凭「无链入」标 CONFIRMED。
3. 对 **LIKELY** 候选用全仓 `rg` 二次计数入站；零引用 + 未登记命名空间 → **CONFIRMED**。
4. 文内 `superseded` / `取代文档` 且取代文存在 → **LIKELY/CONFIRMED ARCHIVE**。

---

## 1. 摘要

| 级别 | 文档 | 说明 |
|------|------|------|
| **CONFIRMED** | **12** | 可归档/删除候选（仍须用户批准） |
| **LIKELY** | **22** | 未入 docs 索引但有少量全仓引用；建议归档或补索引 |
| **SUSPECT** | **307** | 登记命名空间内无链入（演化/真值/计划归档）；默认保留 |

**一句话**：全仓约 **70%** 文档无法从 hub 链达，主因是 `superpowers/archive/`（220）与 `automate/plans/archive/` 等**有意归档树**；真正可考虑清理的仅 **12** 篇（零全仓引用 + 1 篇 superseded）。

### 不可达文档按顶层目录

| 目录 | 不可达篇数 | 判定 |
|------|-----------|------|
| `superpowers/` | ~220 | SUSPECT — 演化归档，见 `superpowers/README.md` |
| `automate/` | ~42 | SUSPECT — `plans/archive/` 实施计划历史 |
| `feature-truth/` | ~28 | SUSPECT — 真值审计 + `per-type/` 矩阵 |
| `material/` | ~29 | 混合：7 篇 CONFIRMED（零引用） |
| `deliverable-gate/` | 4 | LIKELY — 毕业门禁，被 `features/` 引用 |
| `nfr/` | 4 | LIKELY — 被 PRD/服务文档引用（6–8 次） |
| `root-first/` | 2 | CONFIRMED — 零引用 |
| `doc-drift/` | 1 | LIKELY — 漂移审计，有 2 处引用 |

### 未在 `docs/README.md` 登记的顶层目录

`deliverable-gate/` · `doc-drift/` · `material/` · `nfr/` · `root-first/`

**建议**：在 `docs/README.md` 补一行索引（「交付门禁 / 评审材料 / NFR 附录」），或整体迁入 `docs/_archive/` 并更新 hub——**不建议直接删除**。

---

## 2. 代码候选

本扫描仅文档侧，无代码条目。

---

## 3. 文档候选

### 3.1 CONFIRMED（12）

| ID | 路径 | 标签 | 证据 | 建议 |
|----|------|------|------|------|
| D-001 | `docs/feature-truth/2026-08-03-report-center-delivery-recheck.md` | SUPERSEDED · ZERO_INBOUND | 文内 `status: superseded`；取代文 `…-g5-visual-pdf-truth-audit.md` 存在；全仓 `rg` 0 引用 | ARCHIVE |
| D-002 | `docs/material/blueprints/2026-08-09-three-tier-logging.md` | UNINDEXED · ZERO_INBOUND | 未入 docs 索引；hub 不可达；全仓 0 引用 | ARCHIVE |
| D-003 | `docs/material/browser-reviewer/2026-08-09-report-center.md` | UNINDEXED · ZERO_INBOUND | 同上 | ARCHIVE |
| D-004 | `docs/material/browser-reviewer/2026-08-09-system-admin-first-tenant-write-closed-loop.md` | UNINDEXED · ZERO_INBOUND | 同上 | ARCHIVE |
| D-005 | `docs/material/browser-reviewer/2026-08-09-system-admin-walkthrough-r2.md` | UNINDEXED · ZERO_INBOUND | 同上（r3 已取代） | ARCHIVE |
| D-006 | `docs/material/docs-reviewer/2026-08-07-change-surface.md` | UNINDEXED · ZERO_INBOUND | 同上 | ARCHIVE |
| D-007 | `docs/material/scenario-playbook/2026-08-09-system-admin-first-tenant.md` | UNINDEXED · ZERO_INBOUND | 同上 | ARCHIVE |
| D-008 | `docs/material/vitalspan-product-whitepaper/README.md` | UNINDEXED · ZERO_INBOUND | 白皮书草稿包，全仓 0 引用 | ARCHIVE |
| D-009 | `docs/material/vitalspan-product-whitepaper/_research.md` | UNINDEXED · ZERO_INBOUND | 同上 | ARCHIVE |
| D-010 | `docs/material/vitalspan-product-whitepaper/slides.md` | UNINDEXED · ZERO_INBOUND | 同上 | ARCHIVE |
| D-011 | `docs/root-first/2026-07-30-chart-background-opacity-gate.md` | UNINDEXED · ZERO_INBOUND | root-first 实验记录，全仓 0 引用 | ARCHIVE |
| D-012 | `docs/root-first/2026-07-30-dashboard-save-dimensions-field.md` | UNINDEXED · ZERO_INBOUND | 同上 | ARCHIVE |

### 3.2 LIKELY（22，节选）

| ID | 路径 | 标签 | 全仓引用数 | 建议 |
|----|------|------|-----------|------|
| D-101 | `docs/deliverable-gate/2026-08-05-report-center-graduation.md` | UNINDEXED | 1 | ARCHIVE 或补 README 索引 |
| D-102 | `docs/doc-drift/2026-07-30-component-style-per-type-drift.md` | UNINDEXED | 2 | ARCHIVE 或交接 doc-code-drift-audit |
| D-103 | `docs/nfr/browser-compatibility.md` | UNINDEXED | 8 | KEEP — 补 `docs/README.md` 索引 |
| D-104 | `docs/nfr/dashboard-availability.md` | UNINDEXED | 6 | KEEP — 补索引 |
| D-105 | `docs/nfr/xinchuang-deployment.md` | UNINDEXED | 6 | KEEP — 补索引 |
| D-106 | `docs/nfr/zero-de-ss-deployment.md` | UNINDEXED | 6 | KEEP — 补索引 |
| D-107–122 | `docs/material/**`（16 篇） | UNINDEXED | 1–3 | ARCHIVE 候选；与 `deliverable-gate/`、`feature-truth/` 证据链仍有关联 |

完整列表见 `.tmp/doc-scan-final.json` 中 `level=LIKELY` 条目。

### 3.3 SUSPECT（307，按目录聚合）

| 目录 | 篇数 | 复核条件 |
|------|------|----------|
| `superpowers/archive/` | ~200+ | 演化 design/plan 历史；删前须核对 `superpowers/README.md` 与对应 PR 追溯 |
| `automate/plans/archive/` | ~35 | 已完成实施计划；hub 经 `docs/README.md → automate/plans/` 登记 |
| `feature-truth/per-type/` | 44 | 图表逐型真值；测试计划 `2026-07-21-chart-per-type-verification.md` 引用 |
| `feature-truth/*.md`（审计主文） | ~28 | 部分被 PRD/closure 引用；无链入≠无用 |
| `feature-design/` · `ux-critique/` 等 | 少量 | 登记命名空间内历史 backlog |

**DUPLICATE_SLUG（SUSPECT）示例**：

| 旧文 | 新文 | 建议 |
|------|------|------|
| `feature-truth/2026-07-31-report-center-full-truth-audit.md` | `…/2026-08-05-report-center-full-truth-audit.md` | MERGE — 旧版标 superseded 或归档 |

---

## 4. 断链锚点（附录）

| 文档 | 锚点 | 状态 |
|------|------|------|
| `docs/automate/prd.md` | `plans/archive/2026-07-08-account-self-service.md` | **已修复**（2026-08-11） |
| `docs/automate/prd/F02-AUTH.md` | 同上 | **BROKEN** |
| `docs/services/auth.md` | 同上 | **BROKEN** |
| `docs/bugs/BUG-001_*.md` | 同上 | **BROKEN** |

**修复建议（FIX_LINK）**：将链接改为 `plans/archive/2026-07-08-account-self-service.md`，或在 `plans/` 放 stub 重定向说明。

---

## 5. 建议执行顺序（若用户批准清理）

1. **ARCHIVE** D-001（superseded 真值复评）
2. **ARCHIVE** D-002–D-012（零引用材料/白皮书/root-first）
3. **FIX_LINK** account-self-service 计划路径（4 处 hub 文档）
4. 评估是否在 `docs/README.md` 登记 `material/` · `deliverable-gate/` · `nfr/`
5. **不删** `superpowers/archive/` 与 `feature-truth/per-type/`（SUSPECT，需专项复核）
6. 清理后复跑：`python .tmp/doc-unused-scan.py`

---

## 6. 交接

| 类型 | Skill |
|------|-------|
| 文档与实现不一致 | doc-code-drift-audit |
| `doc-drift/` 条目 | doc-code-drift-audit |
| 架构重复非死代码 | arch-reviewer |

---

## 7. 验证命令

```bash
# 复现 hub 不可达计数
python .tmp/doc-scan-final.py

# 全仓引用某文档
rg -l "docs/feature-truth/2026-08-03-report-center-delivery-recheck.md"

# 断链锚点
rg "2026-07-08-account-self-service" docs/

# superseded 文档
rg -i "superseded|取代文档|已作废" docs/ --glob "*.md"
```

---

*生成工具：`.tmp/doc-scan-final.py` · 原始数据：`.tmp/doc-scan-final.json`*
