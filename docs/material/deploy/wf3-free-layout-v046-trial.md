# wf3 自由编排试验（v0.4.6）

> 下线 Agent 可见的 `list_layout_templates`；wf3 默认 **create → get → write → upload**，由 DeepTalk 自行编排布局与审美。

## 安装

```
release/vitalspan-v0.4.6.zip          # 本地
release/vitalspan-v0.4.6-staging.zip  # 测试机 192.168.10.22:8088
```

DeepTalk → 安装 zip → 重启 → 系统提示词用 `deeptalk-product-sync/AGENT-SYSTEM-PROMPT.md`（v0.4.6）。

## 与 v0.4.5 差异

| v0.4.5 | v0.4.6 |
|--------|--------|
| `list_layout_templates` + `template=de-*` | **已移除/报错** |
| compose 可当交付 | **仅 upload 可当交付** |
| rhythm 默认路径 | **自由 layout JSON** 默认；rhythm 仅可选脚手架 |

## 验收对话（示例）

「用 4 个 KPI、地图、环图、明细表和我库里的 3 个 customViz，拼一块 1920 科技风驾驶舱。」

期望 Agent：

1. `create_dashboard` → `get_dashboard_layout`
2. **整文件 write** `examples/*.json`（styleConfig + widgets 坐标 + deStyle）
3. `upload_dashboard` → `completion_gate`

**不应**出现：`list_layout_templates`、`template=de-classic-cockpit`、`beautify.py` 未 upload 就交差。

## 插件内说明

`assets/WF3-FREE-LAYOUT.md`
