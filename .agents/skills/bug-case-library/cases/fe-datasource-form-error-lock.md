# 数据源表单报错后无法继续输入

## 症状

- 新建数据源 `/admin/datasources/new` 提交后若返回 `DATASOURCE_CODE_CONFLICT`（409），顶部出现英文错误条
- 用户修改「标识」等字段时感觉表单「卡住」或无法继续操作

## 根因

1. 保存逻辑使用 `useMutation.isPending` 控制提交按钮；异常路径下若并发提交或状态未及时复位，按钮长期 `disabled`，用户误以为整表不可编辑
2. 报错后未在字段变更时清除错误态，交互反馈差
3. `apiError` 未映射 `DATASOURCE_CODE_CONFLICT`，直接展示英文后端 message

## 修复

- `DatasourceFormPage`：改用 `isSaving` + `try/finally`（与 `LoginPage` 一致），确保保存结束必复位
- `setField` / 类型切换时 `clearError()`
- `DATASOURCE_CODE_CONFLICT` / `DATASOURCE_NAME_CONFLICT` 中文文案 + 对应字段 `fieldState="error"`
- 标识冲突后自动 `focus` + `select` 标识输入框

## 预防

- 表单页优先 `isSaving` + `finally`，不要仅靠 `useMutation.isPending` 表达「整表锁定」
- 409 类业务错误应映射中文字段级提示，并在用户修改相关字段时清除错误

## 锚点

- `fe/src/pages/admin/datasources/DatasourceFormPage.tsx`
- `fe/src/lib/apiError.ts`
- `fe/src/pages/admin/datasources/datasource-form.smoke.test.tsx` · `T-CONN-FE-SAVE-01`
