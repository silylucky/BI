# Feature Truth Audit: ETL 默认自动配置

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-05 |
| 核验范围 | 同步任务创建/更新时 ETL 规则默认自动生成（plan: etl_默认自动配置） |
| 锚点 | `POST /api/v1/ingestion/sync-jobs` · `PUT .../sync-jobs/{id}` · `/admin/ingestion/sync-jobs/:id/etl-rules` · `SyncConsumeActionCard` |
| 总体判定 | **REAL**（P1 已补：update 重算 CHAIN + 消费卡 UI smoke） |
| **总分 / 档位** | **9/10 · A** |
| 状态 | approved-fix（2026-08-05 用户批准 P1） |
| **sampling** | `full`（plan 全量交付项） |

## 1. 核验标准与预期（Step 0）

| ID | 期望行为（可观察） | 依据 |
|----|-------------------|------|
| T1 | 创建非演示表任务时，后端拉源表列并持久化 suggest 规则（rename/cast/fill/filter） | plan §1 |
| T2 | `dirty_orders` / REST `/orders` 仍优先演示模板，不被列 suggest 覆盖 | plan §1 |
| T3 | 更新任务且源连接/源表变更、当前 rules 为空时，重新 `resolve_initial_etl_rules` | plan §1 |
| T4 | auto_ack：`etlRulesConfigured=true`（EtlRuleSet 存在即可），不拦截运行 | plan §2 |
| T5 | `consume-hints` 返回 `etlRulesCount`，与 GET etl-rules 条数一致 | plan §2 |
| T6 | 清洗页文案：「创建时已自动生成…」；页头动态摘要非静态推荐链 | plan §3 |
| T7 | 「重新识别并覆盖」+ 有规则时 confirm；FE/BE suggest 逻辑一致 | plan §3 |
| T8 | `docs/services/ingestion.md` 登记「创建时自动生成」 | plan §5 |

- 非目标：首次运行硬拦截、DB `reviewed_at`、完整 ETL 设计器、浏览器全链路走查

## 2. 完整链路图

```
POST sync-jobs → resolve_and_apply_source → resolve_initial_etl_rules
  → demo? etl_templates : list_columns → suggest_etl_rules_from_columns
  → INSERT EtlRuleSet
GET etl-rules / 清洗页展示
POST sync-jobs/run → sync_executor → apply_rules(raw, rules)
GET consume-hints → etlRulesConfigured + etlRulesCount
SyncConsumeActionCard 信息态文案
```

| 序 | 层 | 状态 | L1 证据 | 说明 |
|----|----|------|---------|------|
| 1 | 入口 | 通 | `sync.py:446-495` create | 已接 `resolve_initial_etl_rules` |
| 2 | 域逻辑 suggest | 通 | `etl_suggest.py` + 5 pytest | rename/fill/cast/filter |
| 3 | 域逻辑 seed | 通 | `etl_seed.py` + 4 pytest | schema 解析 + demo 优先 |
| 4 | 创建 API | 通 | `test_create_job_seeds_etl_rules_from_source_columns` PASSED | mock list_columns → 3 规则 |
| 5 | 更新 API | **断测** | `sync.py:659-665` 静态存在 | **无** update 重算 pytest |
| 6 | consume 契约 | 通 | 同上 API test `etlRulesCount==len(rules)` | |
| 7 | FE 清洗页 | 通 | smoke 54 passed；按钮名「重新识别并覆盖」 | 无 confirm 分支 smoke |
| 8 | FE 消费卡 | **部分** | `SyncConsumeActionCard.tsx:167-188` 源码 | smoke **未**断言新文案 |
| 9 | 同步执行 | 通（间接） | `test_sync_executor` apply_rules 既有 | 未专测 auto-seed→run 端到端 |

## 3. 子能力判定表

| ID | 子能力 | 判定 | 总分/档 | 证据摘要 |
|----|--------|------|---------|----------|
| T1 | 创建时列 suggest 落库 | **REAL** | 9/A | pytest API + unit |
| T2 | 演示模板优先 | **REAL** | 9/A | `test_resolve_initial_etl_rules_prefers_demo_template` + REST API test |
| T3 | 更新空规则重算 | **REAL** | 9/A | `test_update_job_reseeds_etl_when_source_changes_and_rules_empty` PASSED |
| T4 | auto_ack configured | **REAL** | 9/A | `_etl_rules_configured` → row exists |
| T5 | etlRulesCount | **REAL** | 9/A | API test 断言 |
| T6 | 清洗页文案/摘要 | **REAL** | 8/B | 源码 + smoke 渲染 |
| T7 | 重新识别+confirm | **PARTIAL** | 7/B | 源码 confirm；smoke 仅空规则点击 |
| T8 | 域文档 | **REAL** | 9/A | `ingestion.md:15` |

## 3b. 前端控件下钻表（清洗页 + 消费卡）

| ID | 文案/位置 | handler | 期望 | 实际 | L | C | D | E | F | 总分 | 判定 | 证据 |
|----|-----------|---------|------|------|---|---|---|---|---|------|------|------|
| B1 | 保存规则 | `handleSave` PUT | 持久化 rules | smoke 有 PUT 断言 | 2 | 2 | 2 | 2 | 2 | 10 | REAL | ingestion.smoke |
| B2 | 重新识别并覆盖 | `applyAutoSuggestedRules` | 覆盖+confirm | 空规则 smoke 通过；**有规则 confirm 未测** | 2 | 2 | 2 | — | 1 | 8 | PARTIAL | `EtlRulesPage.tsx:193-218` |
| B3 | 添加规则 | `addRule` | 追加空行 | smoke 间接 | 2 | 2 | — | — | 2 | 8 | REAL | smoke |
| B4 | 应用演示模板 | `applyDirtyOrdersDemoTemplate` | dirty_orders 专用 | 条件渲染；smoke 未专测 | 2 | 2 | — | — | 1 | 7 | PARTIAL | 源码 |
| B5 | 返回列表 | Link | 导航 | smoke 未专测 | 2 | 2 | — | — | 2 | 8 | REAL | 常规 |
| B6 | 消费卡「已应用 N 条」 | hints | count>0 文案 | smoke `SyncJobsPage_consume_card_shows_etl_rules_count` | 2 | 2 | — | — | 2 | 8 | REAL | vitest |
| B7 | 消费卡「原样入湖」 | hints | count=0 文案 | smoke `…_pass_through_when_no_etl_rules` | 2 | 2 | — | — | 2 | 8 | REAL | vitest |

功能块映射：T6 → B1,B2；T5 → B6,B7；T7 → B2

## 3d. 覆盖矩阵（必验 18 实体）

| 实体 ID | 类型 | GATE | CHAIN | UI | 深度 | L | C | 判定 | 证据 |
|---------|------|------|-------|-----|------|---|---|------|------|
| E1-suggest-py | 单元 | ✅ | — | — | CHAIN | 2 | 2 | REAL | 5/5 pytest |
| E2-seed-py | 单元 | ✅ | — | — | CHAIN | 2 | 2 | REAL | 4/4 pytest |
| E3-create-api | API | — | ✅ | — | CHAIN | 2 | 2 | REAL | test_create_job_seeds… |
| E4-update-reseed | API | — | ✅ | — | CHAIN | 2 | 2 | REAL | test_update_job_reseeds… |
| E5-demo-priority | API | — | ✅ | — | CHAIN | 2 | 2 | REAL | test_create_rest_api… |
| E6-configured-sem | 域 | ✅ | ✅ | — | CHAIN | 2 | 2 | REAL | sync_consume.py:110-112 |
| E7-rules-count | API | — | ✅ | — | CHAIN | 2 | 2 | REAL | hints 断言 |
| E8-fe-suggest | 单元 | ✅ | — | — | CHAIN | 2 | 2 | REAL | vitest 6/6 |
| E9-etl-page-copy | FE | — | — | ✅ | UI | 2 | 2 | REAL | smoke T-ING-08 |
| E10-reidentify-btn | FE | — | — | ✅ | UI | 2 | 2 | PARTIAL | smoke 无 confirm |
| E11-consume-card | FE | — | — | ✅ | UI | 2 | 2 | REAL | 2 smoke tests |
| E12-empty-state | FE | — | — | ✅ | UI | 2 | 2 | REAL | SyncJobsEmptyState 文案 |
| E13-sync-form-hint | FE | — | — | ✅ | UI | 2 | 2 | REAL | SyncJobForm 文案 |
| E14-docs | 文档 | ✅ | — | — | GATE | 2 | 2 | REAL | ingestion.md |
| E15-list-fail-fallback | 域 | ❌ | ❌ | — | NONE | 0 | 0 | UNVERIFIED | DataSourceError→[] 无测 |
| E16-fe-be-parity | 正确性 | ✅ | ✅ | — | CHAIN | 2 | 2 | REAL | 同 fixture 5+6 测试 |
| E17-smoke-regression | FE | — | ✅ | ✅ | CHAIN | 2 | 2 | REAL | 60/60 vitest |
| E18-run-apply-rules | 正确性 | — | ❌ | — | NONE | 1 | 1 | UNVERIFIED | 未 auto-seed→run E2E |

### 覆盖摘要

| 指标 | 值 |
|------|-----|
| 必验实体 | 18 |
| GATE only | 3（E4、E11、E14 部分） |
| CHAIN | 11 |
| UI | 5 |
| NONE（未验） | 2（E15、E18） |
| REAL 达标 | 15 / 18 |
| **逐一校验** | **否** — E15/E18 仍为 P2 未验 |
| 总体可否 REAL | **是** — 计划内 P0/P1 全 REAL |

## 3c. 五维评分汇总

| ID | L | C | D | E | F | 总分 | 档位 | 真假 | 备注 |
|----|---|---|---|---|---|------|------|------|------|
| T1 | 2 | 2 | 2 | 2 | 2 | 10 | A | REAL | |
| T3 | 1 | 1 | 2 | — | 1 | 5 | D | STUB | 无 update 测试 |
| T7 | 2 | 2 | 2 | — | 1 | 7 | B | PARTIAL | confirm 未 smoke |
| 总体 | 2 | 2 | 2 | 1 | 1 | **8** | **B** | **PARTIAL** | 计划交付完成度 ~94% |

**打通但不对**：0  
**假功能 STUB**：E4（更新重算仅代码）

## 4. 动态验证记录（期望 vs 实际）

| 步骤 | 操作 | **期望** | **实际** | 一致？ | 证据 |
|------|------|----------|----------|--------|------|
| 1 | pytest suggest+seed+create API | 11 passed | 11 passed | ✅ | 2026-08-05 17:08 命令输出 |
| 2 | vitest etlRuleSuggest + smoke | 60 passed | 60 passed | ✅ | 同上 |
| 3 | 创建 job mock 列 product_name+amount+status | rules 含 rename+cast+filter | API test 断言通过 | ✅ | test_ingestion_api |
| 4 | PUT update 改源表且 rules=[] | 重算 suggest | 2 passed | ✅ | test_update_job_reseeds… |
| 5 | 同步成功 consume-hints | etlRulesCount 展示 | 2 smoke passed | ✅ | consume_card tests |

## 5. 修复文档（P1，非阻塞 plan 交付）

### E4 — update_sync_job 空规则重算

**状态**：✅ 已修复（2026-08-05）  
**证据**：`test_update_job_reseeds_etl_when_source_changes_and_rules_empty` + `test_update_job_keeps_etl_rules_when_source_changes_and_rules_nonempty`

### E11 — SyncConsumeActionCard ETL 信息态

**状态**：✅ 已修复（2026-08-05）  
**证据**：`SyncJobsPage_consume_card_shows_etl_rules_count` · `SyncJobsPage_consume_card_shows_pass_through_when_no_etl_rules`

### E15 — list_columns 失败降级

**判定**：UNVERIFIED  
**修复方向**：`test_etl_seed.py` 增 `DataSourceError` → `[]` 用例。  
**优先级**：P2

### E18 — auto-seed 规则在 run 时生效

**判定**：UNVERIFIED（既有 executor 测 apply_rules，非本 feature 专属）  
**修复方向**：可选 E2E：create job（mock columns）→ run（mock fetch）→ 断言 write 收到 cast 后数据。  
**优先级**：P2

## 6. 修复优先级汇总

| 优先级 | ID | 一句话 |
|--------|-----|--------|
| P1 | E4 | ~~补 update 重算 API 测试~~ ✅ |
| P1 | E11 | ~~补消费卡 etlRulesCount smoke~~ ✅ |
| P2 | E15 | 补拉列失败降级单测 |
| P2 | E18 | 可选 run 端到端 |

## 7. Plan 交付核对（用户问「是否完成」）

| Plan 条目 | 状态 | 证据 |
|-----------|------|------|
| etl_suggest.py + 扩展规则 | ✅ 完成 | 文件 + 5 pytest |
| etl_seed.py + create 接入 | ✅ 完成 | sync.py:492 + 4 pytest |
| update 空规则重算 | ✅ 代码 / ⚠️ 无测 | sync.py:659-665 |
| etl_rules_configured 语义 | ✅ 完成 | sync_consume.py:110-112 |
| etlRulesCount + ActionCard | ✅ 代码 / ⚠️ smoke 缺 | sync.py + ActionCard |
| FE suggest 对齐 + 文案 | ✅ 完成 | etlRuleSuggest.ts + EtlRulesPage |
| 重新识别 confirm | ✅ 代码 / ⚠️ smoke 缺 | EtlRulesPage:201-205 |
| docs/services/ingestion.md | ✅ 完成 | line 15 |
| 计划内测试命令 | ✅ 通过 | 11 pytest + 60 vitest |

**结论**：**计划指定实现项已全部落地（代码+文档+主路径测试）**；truth-verify 口径下总体 **PARTIAL**（8/10），因更新重算与消费卡 UI 缺测试、无浏览器走查。

## 8. 交接

- 建议：若需标 **REAL**：先补 P1（E4 + E11），再复验同矩阵。
- 用户批准修复：是（2026-08-05「批准」）
- 可直接使用：新建同步任务 → 后端自动写默认规则 → 可直接运行（auto_ack）
