# DeepTalk 产品级对接 VitalSpan

> VitalSpan 仓内交付物：DeepTalk **插件 + 特殊工作区** 对接说明。  
> **产品对接真源**：[WORKSPACE-PLUGIN-CONTRACT.md](./WORKSPACE-PLUGIN-CONTRACT.md)  
> 无 DeepTalk 宿主 · 给接口即上传 → [../MVP-UPLOAD.md](../MVP-UPLOAD.md)  
> BI 铁律：[../IRON-RULES.md](../IRON-RULES.md) · 桌面包 MVP：[../START-HERE.md](../START-HERE.md)

## 产品最终形态（2026-08 定论）

```
安装 vitalspan 插件 zip
  → 新建「VitalSpan BI」特殊工作区（向导写入 instanceConfig）
  → 工作区视图：连接状态 / 跳转 5173
  → Agent 聊天调 components.tools 做 wf2/wf3
  → 正式 BI 编辑与验收：5173（artifactId / dashboardId）
```

**不是**向 DeepTalk 源码仓 sync `integrations/vitalspan/` 作为客户交付路径。

| 层 | 载体 |
|----|------|
| 插件 | `deeptalk-plugins/plugins/vitalspan/` → `release/vitalspan-v*.zip` |
| 特殊工作区 | 模板 `vitalspan.bi.default` + 视图 `vitalspan:home` |
| VitalSpan 平台 | `:8000` API · `:5173` 管理面 · DB |

实施清单：[SPECIAL-WORKSPACE-PLUGIN-TASK.md](./SPECIAL-WORKSPACE-PLUGIN-TASK.md)

## 安装插件

```bash
cd deeptalk-plugins/plugins/vitalspan && npm run build
# 或仓库根：npm run release  →  release/vitalspan-v0.3.0.zip
```

DeepTalk 设置 → 安装 zip → 新建工作区选 **VitalSpan BI**。

Agent 系统提示词：[AGENT-SYSTEM-PROMPT.md](./AGENT-SYSTEM-PROMPT.md) · 工具注册表：[agent-tools.schema.json](./agent-tools.schema.json)

## 配置优先级

| 场景 | 配置来源 |
|------|----------|
| **工作区 iframe 视图** | `instanceConfig.vitalspan`（向导写入）+ execTools 读 env 凭据 |
| **Agent components.tools** | 环境变量 → 工作区 `config.json` / `local.config.json` → `assets/defaults.json` |
| **全量 preflight / 金样 scaffold** | 可选 `VITALSPAN_ROOT` + `docs/api/vs-ai-spec/tools/*.py`（见 [PREFLIGHT-DUAL-TRACK.md](./PREFLIGHT-DUAL-TRACK.md)） |

`config.yaml.example` 与 `integrations/vitalspan/` 路径仅 **开发/CI 备用**，见下文。

## 开发备用（非产品交付描述）

以下用于 VitalSpan 仓内联调、CI、无 DeepTalk 插件宿主时的脚本验真：

```
deeptalk/integrations/vitalspan/          # sync 目标（可选）
  config.yaml
  vs-ai-spec/
  lib/                                    # completion_gate · route_request
```

在 VitalSpan 仓根：

```powershell
.\scripts\sync-vs-ai-spec-to-deeptalk-repo.ps1 -DeepTalkRoot C:\path\to\deeptalk
.\docs\api\vs-ai-spec\deeptalk-product\install-to-deeptalk.ps1 -DeepTalkRoot C:\path\to\deeptalk
```

桌面包 MVP：`.\scripts\sync-vs-ai-spec-pack.ps1` → `vs-ai-spec-deeptalk-test/`

## 版本同步

| 方式 | 命令 |
|------|------|
| 桌面 MVP | `.\scripts\sync-vs-ai-spec-pack.ps1` |
| DeepTalk 产品仓（备用） | `.\scripts\sync-vs-ai-spec-to-deeptalk-repo.ps1` |
| 插件 release | `deeptalk-plugins` 根 `npm run release` |
| **L3 sync → 插件** | `.\scripts\sync-vs-ai-spec-to-deeptalk-plugin.ps1 -PluginRoot C:\...\deeptalk-plugins\plugins\vitalspan` |
| 离线 zip | `.\scripts\pack-vs-ai-spec-deeptalk-test.ps1` |

## 验收

- 产品形态：[E2E-CHECKLIST.md](./E2E-CHECKLIST.md)
- VitalSpan CI：`backend/tests/test_deeptalk_product_integration.py` · `backend/tests/test_vs_ai_spec_tools.py`
