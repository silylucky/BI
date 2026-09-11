## 8. `docs/README.md`（索引）

```markdown
# 文档索引

## 体系说明
本仓采用 api / adr / domain / service / mock / ui / data 分类；约定见 `.cursor/rules/prd-sync.mdc`。

## 目录

| 类型 | 路径 | 说明 |
|------|------|------|
| API | [api/…](api/…) | … |
| … | … | … |

## 维护
- 代码变更触及契约/服务/领域时同步文档，并更新 `last_verified`
- Mock 清零后删除或标记 deprecated
- 新文档必须套对应模板必填节
```
