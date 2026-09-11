# 数据源测试成功态误显示「操作失败」

## 症状

- 数据源详情页点击「测试连接」后，后端返回成功（绿底/成功图标）
- 文案却显示「操作失败，请稍后重试」

## 根因

| 层 | 原因 |
|----|------|
| **API 响应** | 成功时 `message` 为英文 `Connection successful` |
| **FE 本地化** | `localizeApiMessage` 将未知英文兜底为通用失败文案，未识别成功短语 |
| **组件** | `DatasourceTestStatus` 未区分成功默认文案与错误码剥离 |

## 修复

- `fe/src/lib/apiError.ts`：成功短语白名单；`stripErrorCode` 剥离错误码前缀
- `fe/src/pages/admin/datasources/components/DatasourceTestStatus.tsx`：成功态默认「数据库连接正常」

## 锚点

- `fe/src/lib/apiError.ts`
- `fe/src/pages/admin/datasources/components/DatasourceTestStatus.tsx`

## 回归

- `DatasourceTestStatus` 单测：成功 `Connection successful` → 中文成功文案
