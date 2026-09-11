# `docs/ui` 分类与命名

对齐 docs-reviewer taxonomy 与 ark/nex 实践。

## 目录

目录树见 SKILL.md「产物树」。何时要哪篇：

| 文件 | 何时要 |
|------|--------|
| `anchor.md` | **总是**（含绿地）；缺它 = 无基准之基准，ui-ux-reviewer 判基准不可信 |
| `layout.md` | 有共享 App 壳 / 多域布局时**必写**；单页营销站可极简 |
| `*-ia.md` | 每个独立导航壳至少一篇 |
| `help-doc-matrix.md` | 仓内有站内 help 且需规划 slug 时 |

## 命名

- 小写 kebab-case：`console-ia.md`、`release-ia.md`
- 一文一主题；表面用 `*-ia`，壳层规格用 `layout`
- **不要**：`tokens.md`、`components-api.md` 塞进 `docs/ui/`

## 元信息表（每文文首）

```markdown
| 项 | 内容 |
|----|------|
| type | ui |
| module | anchor \| layout \| console-ia \| … |
| status | draft \| current \| deprecated |
| confidence | confirmed \| inferred \| assumed（`anchor.md` 必填，其余可选） |
| last_verified | YYYY-MM-DD |
| related | 其他 ui 文 · 代码锚点 · token 真源 |
```

## 与代码真源

代码真源对应表见 [scan-workflow.md](scan-workflow.md) §2–§5。规则：文档漂移时以代码为准修订文档，或先改代码再同步文档（用户裁定）；Token **只链接**不复制。
