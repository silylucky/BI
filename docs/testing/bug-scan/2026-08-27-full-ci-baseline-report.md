# Bug 扫描报告 — 全仓 CI 基线

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-27 |
| Skill | `vitalspan-auto-test` |
| Scope | 全仓 CI 对齐基线 |
| Depth | ci |
| Mode | report-only |
| Anchor | 首次 skill 试跑 · `ci-gates.md` |

---

## 1. Verdict

**RED** — 全部门禁未通过。

| 套件 | 结果 | 计数 |
|------|------|------|
| backend/ruff | ❌ | 222 errors |
| backend/pytest | ❌ | 612 failed · 2309 passed · 25 errors |
| persistence-gate | ❌ | 6 passed · 8 errors |
| fe vitest (`pnpm test`) | ❌ | 181 failed · 3231 passed |
| fe build | ❌ | ~901 TS errors |
| fe check:design | ❌ | 硬编码色值等 |
| e2e | ⏭️ | 未跑 |
| script gates (node --test / chart-engine) | ⏭️ | vitest 段已红，未执行 |

---

## 2. 执行命令

```bash
cd backend && ruff check .
cd backend && pytest -v
# persistence-gate 块（见 ci-gates.md）
cd fe && pnpm test
cd fe && pnpm build
cd fe && pnpm run check:design
```

---

## 3. 失败聚类

### CLUST-PERSIST-0049 · P0

- **锚点**：`backend/migrations/versions/0049_email_smtp_dual_slots.py` `op.drop_constraint`
- **现象**：SQLite `NotImplementedError: No support for ALTER of constraints`
- **影响面**：persistence-gate 8 errors；依赖迁移 fixture 的 pytest 成片 ERROR
- **bug-case**：未命中
- **建议**：SQLite 用 `batch_alter_table` 或方言分支；修后单独复扫 persistence-gate

### CLUST-RUFF-E402 · P2

- **锚点**：backend 全仓 import 顺序
- **现象**：222 条，E402×177 · F401×42
- **建议**：与团队约定是否阻塞合入；可分批清理

### CLUST-CATALOG-DRIFT · P1

- **锚点**：图表 registry / smoke fixture
- **现象**：期望类型数与实际不符；`gis-map` icon 等
- **建议**：对齐 `listChartPluginTypes` 与 `CHART_CATALOG_SMOKE_CASES`

### CLUST-RENDER-SPEC · P1

- **锚点**：`resolveRenderSpec` / ChartRenderer smoke
- **现象**：期望 antv 得 d3 等契约漂移
- **建议**：核对 engine 路由变更是否未同步测试

### CLUST-IMPORT-RUNTIME · P0

- **锚点**：`sessionUserFromMe` · `PageErrorBanner` 未定义
- **现象**：ingestion 等页 vitest ReferenceError
- **建议**：补 export 或修 import；优先于 catalog 对齐

### CLUST-TS-BUILD · P1

- **锚点**：`pnpm build` tsc
- **现象**：~901 处类型错误（含源文件与测试）
- **建议**：与运行时 P0 分开批次修

---

## 4. 未扫描（刻意）

| 套件 | 原因 |
|------|------|
| Playwright e2e | CI 不跑；基线已红 |
| `pnpm test:chart-catalog` | 主 vitest 已红 |
| integration pytest | 未要求 deep |

---

## 6. 交接建议

1. **P0**：修 `0049` 迁移 SQLite 兼容 + 运行时缺 import
2. **P1**：catalog / render 契约 + TS build 分批
3. 绿后：`/vitalspan-auto-test scope=charts depth=quick` 或 `depth=ci` 复扫

---

> 历史路径：`docs/testing/auto-test/2026-08-27-full-ci-baseline-receipt.md`（旧「收据」命名，内容已迁入本报告格式）
