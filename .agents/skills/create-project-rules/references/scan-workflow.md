# Phase 0 · 扫仓工作流

在目标仓库根执行（只读）。产出 **Project Rules Card**，再决定新建 / 体检 / 修订。

## 1. 真理源

```text
docs/arch.md
docs/automate/goal.md
docs/automate/prd.md          # 若存在，只读产品边界
README.md
```

摘录填入 Card：产品名、一句话定位、进程列表、技术栈、部署形态、目录约定。

## 2. 目录与栈（先判定框架）

完整判定表：[stack-detect.md](stack-detect.md)。至少扫：

```text
ls 顶层
go.mod（require: go-zero? gogf/gf?）
pyproject.toml / requirements*.txt（fastapi? flask?）
package.json（express? hono?）
**/api/*.api · OpenAPI · main.py · src/index.*
fe/ 或 web/ 或 apps/*
cmd/* · services/* · app/
db/migrations 或 alembic/ 或 prisma/migrations
etc/*.yaml · manifest/config
.cursor/rules/* · AGENTS.md · docs/ui/
```

**输出**：后端框架枚举 + 置信度；将产哪些框架 mdc（可为空，须写理由）。

## 3. 已有 rules 快照

对每个 `.mdc` 记：`description`、`alwaysApply`、`globs`、是否覆盖 [redlines.md](redlines.md) 各条。

## 4. Project Rules Card（输出模板）

```markdown
# Project Rules Card

| 项 | 值 |
|----|-----|
| 产品 | |
| 定位（goal 一句） | |
| 后端框架 | go-zero / goframe / fastapi / flask / express / hono / 其他 |
| 框架置信 | confirmed / inferred |
| 将产框架 mdc | 列表或「无」 |
| 进程 | |
| FE | 有/无 · 路径 · docs/ui 有/无 |
| DB | sqlite/mysql/postgres 线索 |
| 认证 | local/ldap/oauth 线索 |
| arch/goal | 齐 / 缺 |
| 已有 rules | 列表 |
| 模式 | 新建 / 体检 / 修订 |
| 红线缺口 | R? … |
```

## 5. 模式判定

| 条件 | 模式 |
|------|------|
| 无 `.cursor/rules/` 或无 `project.mdc`+`production.mdc` | **新建** |
| 已有 rules，用户要检查 / 再跑本 skill | **体检**（默认不写，先报告） |
| 用户确认按缺口修补 | **修订**（最小 diff） |

## 6. 写入前

1. 按 [rule-catalog.md](rule-catalog.md) 列出将创建/修改文件
2. 预览每文件摘要（或关键 diff）
3. 用户明确确认后再写盘
4. 占位符全部替换为**本仓事实**；未知标 `（待确认）` 并一次一问（或体检里列为缺口）
