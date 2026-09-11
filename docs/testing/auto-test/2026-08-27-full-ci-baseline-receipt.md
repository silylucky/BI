# 自动化测试收据 — 全仓 CI 基线扫描

> **已迁移**：本文件为旧格式。新格式见 [`docs/testing/bug-scan/2026-08-27-full-ci-baseline-report.md`](../bug-scan/2026-08-27-full-ci-baseline-report.md)（`vitalspan-auto-test` = bug 扫描，非写测试）。

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-27 |
| Skill | `vitalspan-auto-test` |
| Scope | 全仓 CI 对齐基线（无指定模块） |
| Mode | regression / gate |
| Depth | GATE + CHAIN |
| Domains | backend, frontend, persistence, chart（间接）, design |
| CI scope | full |
| Anchor | `ci-gates.md` · `coverage-matrix.md` §A |

---

## 1. 摘要

- 测试文件：本次**未新增/修改**测试；仅执行 CI 对齐命令
- 结果：**全部门禁红**（见下表）
- 200% 矩阵：§A 5 项全部未过；§B persistence 未过；e2e 未跑

**Verdict：当前主干未达合入门禁。GATE ≠ REAL。**

---

## 2. CI 对齐（必填）

| Job | 命令 | 结果 |
|-----|------|------|
| backend/ruff | `cd backend && ruff check .` | ❌ 222 errors（E402×177 · F401×42 · F841×3） |
| backend/pytest | `cd backend && pytest -v` | ❌ **612 failed · 2309 passed · 23 skipped · 25 errors**（581s） |
| persistence-gate | `VITALSPAN_TEST_FORCE_SQLITE=1` + 合同/roundtrip/entity/heads | ❌ **6 passed · 8 errors**；根因见 §3 |
| frontend/test | `cd fe && pnpm test` | ❌ **181 failed · 3231 passed**（56 files）；vitest 未到 node --test / check-chart-engine |
| frontend/build | `cd fe && pnpm build` | ❌ tsc：**~901** `error TS*` |
| frontend/design | `cd fe && pnpm run check:design` | ❌ 硬编码色值等设计门禁失败 |
| e2e | Playwright | ⏭️ 未跑（CI 不跑；基线已红） |
| script gates | check-chart-engine | ⏭️ 未执行（`pnpm test` 在 vitest 段失败） |

---

## 3. 失败聚类（根因候选）

### 3.1 persistence / 大量 pytest ERROR

- **锚点**：`backend/migrations/versions/0049_email_smtp_dual_slots.py` L24 `op.drop_constraint(...)`
- **现象**：SQLite 方言 `NotImplementedError: No support for ALTER of constraints`
- **影响**：`alembic upgrade head` 在测试用 SQLite 上失败 → persistence-gate 与依赖迁移 fixture 的用例成片 ERROR

### 3.2 后端 ruff

- 以 **E402**（import 不在文件顶）为主；另有未使用 import/变量
- CI `backend` job 在 ruff 阶段即会失败（本机跳过 ruff 后仍测了 pytest）

### 3.3 前端 vitest（样本）

| 聚类 | 示例 |
|------|------|
| 图表 catalog 漂移 | 期望 49/12 类型，实际 50/18；`gis-map` 缺 icon；smoke fixture mismatch |
| 渲染契约 | `resolveRenderSpec` 期望 antv 得 d3；ChartRenderer 大量 smoke 失败 |
| 运行时 ReferenceError | `sessionUserFromMe is not defined`；`PageErrorBanner is not defined`（ingestion） |
| 大屏/样式 | screen-title-bar、DashboardInlineTitle、palette 持久化等 |

### 3.4 前端 build

- 类型契约漂移：`ChartStyleContext`、`AdminPageShellProps`、`AnalysisPack.dataSourceId`、缺失模块路径等
- 含业务源文件与测试文件上的 TS 错误

---

## 4. 域 Playbook 勾选

- [ ] dashboard-pixel-canvas — N/A（未单独跑 e2e；相关 vitest 已红）
- [ ] embed / query / auth / nfr — 未做域增量；全量 pytest 已含但未绿
- [x] persistence — 已跑，**失败**
- [ ] chart catalog 追加门 — 未跑 `test:chart-catalog`（主 `pnpm test` 已红）
- [ ] ai-viz validate — N/A（本次非 AI viz scope）

---

## 5. 未自动化（刻意）

| ID | 原因 | 负责技能 |
|----|------|----------|
| 浏览器真铺满 / 拖拽 | JSDOM 无效；e2e 未跑 | feature-truth-verify / Playwright |
| 产品 REAL | 本技能只 GATE | feature-truth-verify |
| DataEase/Superset 练习环境 | 仓外对照，非 VitalSpan CI | — |

---

## 6. 执行记录

```text
# 2026-08-27 本机
cd backend && ruff check .          # 222 errors
cd backend && pytest -v             # 612 failed, 2309 passed, 25 errors
cd <root> && persistence-gate 块    # 6 passed, 8 errors (0049 SQLite drop_constraint)
cd fe && pnpm test                  # 181 failed, 3231 passed
cd fe && pnpm build                 # ~901 TS errors, exit 2
cd fe && pnpm run check:design      # exit 1
```

---

## 7. 交接

- [x] GATE ≠ REAL 已声明
- [ ] bug-case 未更新（本次仅扫描，未修）
- [ ] 建议下一步（需你确认后再改代码）：
  1. **优先**：修 `0049` 迁移对 SQLite 用 batch `drop_constraint`，恢复 persistence-gate
  2. 清 ruff E402/F401 或调整 CI 忽略策略（与团队约定一致）
  3. 前端：先修阻塞运行时的 `PageErrorBanner` / `sessionUserFromMe`，再对齐 catalog 期望值与 `pnpm build` 类型
  4. 绿后再跑 `pnpm test:chart-catalog` + 可选 e2e

---

## coverage-matrix §A

- [ ] ruff
- [ ] pytest
- [ ] pnpm test
- [ ] pnpm build
- [ ] check:design
