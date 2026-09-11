---
name: prd-bootstrap
description: >-
  当目标项目缺少 docs/automate/prd.md 时，按标准流程扫描代码库生成规范化 PRD，含功能清单与 8 维初评。
  配合 prd-scoring 技能使用。
---

# PRD Bootstrap（从代码生成规范文档）

## 何时使用

- `docs/automate/prd.md` **不存在**
- 或 prd 严重过时（仅 hub+分片结构；与代码结构偏差大，由编排器判定）

## 前置

- 须已有或同时生成 `docs/automate/goal.md`（只读锚点）
- 由 **subagent `doc-bootstrap`** 执行，主 agent 只收产出路径

## 扫描流程（有界、标准化）

### 1. 结构发现

按项目类型定向扫描（**禁止**无差别全库读）：

| 步骤 | 动作 | 产出 |
|------|------|------|
| 1 | 读 `package.json` / `go.mod` / `pyproject.toml` 等判断栈 | 技术栈 |
| 2 | 列 `src/`、`app/`、`internal/` 一级目录 | 模块地图 |
| 3 | Grep 路由：`router|Route|HandleFunc|@app\.(get\|post)` 等 | API 面 |
| 4 | Grep 页面：`pages/|routes/|\.tsx` 入口 | UI 面 |
| 5 | 读现有 README / 注释中的功能描述 | 意图补充 |

目录预算：最多 **3 个**一级模块深入；其余记入 `docs/automate/evolution-state.md` 模块地图。

### 2. 功能项抽取

每个可辨识的用户能力 → 一个 prd 功能项：

- ID 规则：`<域>-<序号>`（如 `AUTH-001`、`UI-003`）
- 从代码反推：路由 + handler + 页面 + 测试文件
- 验收标准从现有测试用例或行为反写（可测试句式）

### 3. 写入 hub + 分片

| 文件 | 模板 | 内容 |
|------|------|------|
| `docs/automate/prd.md` | `.cursor/automate/templates/prd-hub.md` | YAML 元数据、系统薄弱项汇总、8 维总表、功能索引、修订记录 |
| `docs/automate/prd/F<NN>-<域>.md` | `.cursor/automate/templates/prd-feature.md` | 每域一文件：状态、goal_ref、验收标准、代码锚点 |
| `docs/automate/prd/README.md` | — | 一行索引：分片 → ID 域 |

每个功能项须填 `goal_ref`（goal.md 终极目标编号；无法判断时标 `待确认`）。

### 4. 8 维初评

对每个功能项调用 **prd-scoring** 评分流程（初次评分）。

### 5. 产出

- `docs/automate/prd.md`（hub）
- `docs/automate/prd/F<NN>-<域>.md` + `prd/README.md`
- 更新 `docs/automate/evolution-state.md` 模块地图
- 回传编排器：`status`、`artifact`、`功能项数量`、`薄弱项 Top3`

## 质量闸门

- [ ] 每个功能项有 ID、状态、验收标准、代码锚点、8 维评分
- [ ] 无 TBD 验收标准
- [ ] 系统薄弱项汇总已填
- [ ] 与 `docs/automate/goal.md` 无定位冲突（冲突以 goal 为准删项或标「待确认」）
- [ ] hub 不含功能明细正文（明细全部在分片）
- [ ] 每个功能项有 goal_ref（或标「待确认」）
