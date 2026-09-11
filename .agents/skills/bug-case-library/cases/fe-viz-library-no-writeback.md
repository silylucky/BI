# 看板改字段写回组件库导致版本冲突

## 症状

看板编辑页改 Dataset/字段后 toast「组件库版本冲突，请刷新后重试」。

## 根因

DASH-010 曾用活 `componentRef`：检查器每次 `onChange` 都 `PATCH` 组件库并带 `contentRevision`。两次绑定并行时两边都拿旧版本号，第二次 409。产品语义应为：库只下发快照，看板实例不写回。

## 修复

- 复用插入 `instantiateVizComponentWidget`：拷贝 payload，不挂活链接
- 检查器/画布/保存不再 `pushWidgetPayloadToLibrary`
- 持久化不再剥掉实例 `chartConfig` 等
- `resolveLayoutWidget`：实例已有配置时看板优先

## 回归

改库内组件不应改已插入看板；看板改绑定不应再出现 `VIZ_COMPONENT_REVISION_CONFLICT`。
