# HTML Deck 结构约定

由 `scripts/build-html-deck.mjs` 生成。视觉门槛见 [visual-quality.md](visual-quality.md)。

## slides.md

```markdown
## P01 · 封面标题

- kicker: 产品白皮书
- lead: 副标题一句

## P10 · 亮点总览

- layout: cards

- 权限一体：菜单到 API 同源
- 可观测：任务重试与审计
- 集成开放：标准 Webhook

## P24 · 场景 A · 端到端

- diagram: diagrams/scenario-a-overview.mmd

1. 用户触发
2. 系统校验
3. 落库并通知

## P27 · 异常、权限与边界

- layout: risks

| 症状 | 系统行为 | 用户下一步 |
|------|----------|------------|
| 无权限 | RBAC 拒绝 | 申请角色 |
```

元字段：`kicker` / `lead` / `subtitle` / `layout`（`table|cards|steps|risks`）/ `diagram`。

构建器会把 Markdown 表打成真正表格或风险卡片；**禁止**把管道符当正文输出。

## 设计令牌

- `paper`：冷白调研（默认）
- `deep-blue`：深蓝科技

1280×720 一页一屏；`@media print` 一页一 PDF 页。

## 章节标签

outline `section: E` 等字母会映射为「业务场景」等中文，不在页眉只显示 `E`。
