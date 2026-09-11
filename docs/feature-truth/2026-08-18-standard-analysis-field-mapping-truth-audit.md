# Feature Truth Audit: 标准分析 · 字段映射

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-18 |
| 核验范围 | `/admin/reports/standard/config` 字段映射区 + 保存 + 消费页出数 |
| 锚点 | `StandardAnalysisFieldMappingFields` · `PUT /api/v1/reports/standard/packs/{key}` · `theme_aggregate.aggregate_pack_theme` |
| 总体判定 | **PARTIAL** |
| **总分 / 档位** | **7/10 · B** |
| 状态 | draft |
| **sampling** | `full`（3 映射项 + 4 主题 + 保存/运行链） |

## 1. 核验标准与预期

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | 配置页三个下拉可选当前数据集列，写入 `fieldMapping` 草稿 | 对话 / 配置页 UI |
| T2 | 保存时：映射列须存在于数据集且满足已启用主题；错配拒绝并提示 | 后端 `capabilities` + 会话内修复 |
| T3 | 消费页运行/对比时，按映射列聚合（生命周期→status、分布→region、趋势/活跃→时间列） | `theme_aggregate.py` |
| T4 | 换官方示例地理表时，若仍映射 status/region/created_at 且启用生命周期，应明确失败而非静默 | 用户截图场景 |

- 非目标：数据集出图字段绑定（另域 `DatasetBindPanel`）

## 2. 完整链路图

```
配置页选列 → draft.fieldMapping → 保存 PUT pack
  → _validate_pack / evaluate_capabilities → DB field_mapping JSON
消费页选主题 → POST run → execute_dataset_section → aggregate_pack_theme(mapping)
  → renderSpec sections
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|----|------|---------|------|
| 1 | FE 下拉 | 通 | `StandardAnalysisFieldMappingFields.tsx` | 列选项来自 `boundConfigId` 的 columns |
| 2 | FE 保存校验 | 通 | `standardAnalysisValidation.ts` + `useStandardAnalysisEditor.ts` | 错列预检 + toast |
| 3 | API 持久化 | 通 | `tests/test_standard_analysis.py::test_std_pack_dataset_binding_upsert_and_run` 8 passed | fieldMapping 写入并读出 |
| 4 | API 拒绝错配 | 通 | 本地 probe：`RPT_STD_THEME_DISABLED` | 地理表示图 + equipment 列名 → 422 |
| 5 | 运行聚合 | 通 | `aggregate_pack_theme` 单测输出 + mock run 测试 | 映射列参与 groupby |
| 6 | 浏览器 UI | 未验 | — | 本次无 BROWSER 走查 |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T1 | 配置 UI | PARTIAL | 6/C | 下拉可用；未标明「哪主题用哪列」 |
| T2 | 保存与校验 | REAL | 8/B | 前后端双校验；错误中文已补 |
| T3 | 运行消费 | REAL | 9/A | pytest + aggregate 直调一致 |
| T4 | 官方示例地理表场景 | PARTIAL | 5/C | 字段能列出；错主题+错映射保存被拒（正确）但易误解为「不生效」 |

## 3b. 前端控件下钻表

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|
| B1 | 状态字段下拉 | `StandardAnalysisFieldMappingFields` | 选列写入 status | 静态：onChange 更新 draft | 2 | 2 | 2 | 1 | 2 | 9 | REAL | 代码审阅 |
| B2 | 区域字段下拉 | 同上 region | 同上 | 同上 | 2 | 2 | 2 | 1 | 2 | 9 | REAL | 代码审阅 |
| B3 | 时间字段下拉 | 同上 createdAt | 同上 | 同上 | 2 | 2 | 2 | 1 | 2 | 9 | REAL | 代码审阅 |
| B4 | 保存 | `useStandardAnalysisEditor.onSave` | 映射合法则持久化 | pytest + DB probe 成功/失败符合预期 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | 见 §4 |
| B5 | 分析主题勾选 | `StandardAnalysisThemeGrid` | 与映射联动校验 | 启用无列主题 → 保存被拒 | 2 | 2 | 2 | 2 | 1 | 9 | REAL | validation + API |

功能块映射：T1→B1–B3；T2→B4,B5；T3→后端 run（无独立 B）；T4→B4 错配路径。

## 3d. 覆盖矩阵

| 实体 ID | 类型 | GATE | CHAIN | UI | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|-----|------|---|---|------|------|
| map-status | lifecycle↔status | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | aggregate + test run |
| map-region | distribution↔region | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | aggregate + compare test |
| map-createdAt | activity/trend↔createdAt | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | aggregate 直调 |
| save-valid | 合法映射保存 | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | probe GOOD SAVE |
| save-invalid | 错列+启用生命周期 | ✅ | ✅ | ❌ | CHAIN | 2 | 2 | REAL | probe BAD SAVE blocked |
| ui-config-page | 配置页整页 | ❌ | ❌ | ❌ | NONE | 0 | 0 | UNVERIFIED | 未浏览器走查 |
| demo-geo-mismatch | 官方地理表示图 | ✅ | ✅ | ❌ | CHAIN | 2 | 1 | PARTIAL | 列可显示；业务上不应配 lifecycle |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 7 |
| GATE only | 0 |
| CHAIN | 6 |
| UI / BROWSER | 0 |
| NONE（未验） | 1（整页 UI） |
| REAL 达标 | 5 / 7（不含 NONE） |
| **逐一校验** | **是** — 7 行均有 CHAIN 或 NONE 标注 |
| **总体可否 REAL** | **否** — 缺 UI 深度 + T4 用户场景 PARTIAL |

## 3c. 五维评分汇总

| ID | L | C | D | E | F | 总分 | 档位 | 真假 | 备注 |
|----|---|---|---|---|---|------|------|------|------|
| T1 | 2 | 1 | 2 | 1 | 2 | 8 | B | PARTIAL | 缺主题-字段说明 |
| T2 | 2 | 2 | 2 | 2 | 2 | 10 | A | REAL | |
| T3 | 2 | 2 | 2 | 1 | 1 | 8 | B | REAL | 无 UI 运行走查 |
| T4 | 2 | 1 | 2 | 2 | 1 | 8 | B | PARTIAL | 官方表列与设备映射不兼容 |

**打通但不对**：T4（地理表 + status/region 映射 + 生命周期主题）  
**假功能**：无

## 4. 动态验证记录（期望 vs 实际）

| 步骤 | 操作 | **期望** | **实际** | 一致？ | 证据 |
|------|------|----------|----------|--------|------|
| 1 | `aggregate_pack_theme(lifecycle, …, status=status)` | 按 status 分组 | `[['A',2],['B',1]]` | ✅ | Python 直调 |
| 2 | `pytest tests/test_standard_analysis.py` | 8 passed | 8 passed | ✅ | 命令输出 |
| 3 | equipment_clean + 正确映射 PUT | 200 | 200，`field_mapping` 落库 | ✅ | `_probe_mapping_persist` |
| 4 | demo-v-sales-geo + status/region 映射 PUT | 422 RPT_STD_THEME_DISABLED | 422 同码 | ✅ | `_probe_mapping_persist` |
| 5 | `vitest standardAnalysisValidation.test.ts` | 3 passed | 3 passed | ✅ | 命令输出 |

## 5. 修复文档（P1，非阻断「生效」）

### T1 / T4 — 字段映射说明不足

**判定**：PARTIAL，C=1  
**期望 vs 实际**：用户期望选官方地理表即可用；实际须按列语义配置且关闭不适用的主题。  
**根因**：`StandardAnalysisFieldMappingFields` 仅通用文案，无「生命周期→状态列」联动提示。  
**修复方向**：在映射区旁按 `enabledThemes` 显示必填列清单；官方示例表旁提示推荐主题（distribution→province）。  
**修后验收**：C≥2，T4 标 REAL。  
**优先级**：P1

### ui-config-page — 未浏览器走查

**判定**：UNVERIFIED  
**修复方向**：browser-reviewer 走查配置页保存+消费页图表。  
**优先级**：P2

## 6. 修复优先级汇总

| 优先级 | ID | 一句话 |
|--------|-----|--------|
| P1 | T4 | 映射区增加「已启用主题所需列」提示，避免官方地理表误配 |
| P2 | ui-config-page | 补浏览器 L1 走查 |

## 7. 交接

- **结论（用户问「生效吗」）**：**生效**，但有条件——映射列必须存在于当前数据集，且与已勾选主题匹配；否则保存/运行会正确拒绝，不是功能坏了。
- 设备表（`equipment_clean`）：`status` / `region` / `created_at` + 生命周期/区域分布 → **真通**。
- 官方销售地理（`province`…）：不能填设备的 status/region/created_at；应 **区域字段→province**，并 **关闭生命周期**。
- 建议：批准修 P1 文案/联动提示；或交接 `root-first-solve`。
- 用户批准修复：**否**
