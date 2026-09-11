# DeepTalk × VitalSpan 测试环境快速上手

> 测试机：`http://192.168.10.22:8088/admin` · 地图见 `.dev/config.yaml` → `environments.staging`

## 1. 平台侧（VitalSpan staging）

确保测试机已部署**含 wf3/LRC v0.4.5** 的后端与前端：

```powershell
cd C:\Users\30381\Desktop\VitalSpan
$env:VITALSPAN_SUDO_PASSWORD = '<远端 sudo 密码>'
.\scripts\deploy_dev.ps1 -CodeOnly -Yes
```

验收：`curl http://192.168.10.22:8088/health` → `status: ok`

## 2. DeepTalk 插件（staging 专用 zip）

在 `deeptalk-plugins/plugins/vitalspan`：

```powershell
# 同步 VitalSpan 规范资产到插件
cd C:\Users\30381\Desktop\VitalSpan
.\scripts\sync-vs-ai-spec-to-deeptalk-plugin.ps1

cd C:\Users\30381\Desktop\deeptalk-plugins\plugins\vitalspan
npm run release:staging
# 产出：..\release\vitalspan-v0.4.5-staging.zip
```

DeepTalk → 设置 → 安装 **`vitalspan-v0.4.5-staging.zip`** → 重启。

## 3. 工作区

| 步骤 | 操作 |
|------|------|
| 模板 | 选 **「VitalSpan BI（测试环境）」**（非默认本地模板） |
| 向导 | API / 前端已预填 `192.168.10.22:8088`；确认绑定 |
| 首页 | `vitalspan:home` 点 health，应绿 |
| Agent | 系统提示词用 `docs/api/vs-ai-spec/deeptalk-product/AGENT-SYSTEM-PROMPT.md`（v0.4.5） |

可选：工作区根目录 `config.json` 参考插件内 `assets/config.staging.example.json`。

## 4. 与本地的差异

| 项 | 说明 |
|----|------|
| 数据隔离 | 本地 publish 的 `artifactId` **不在** staging；须对 staging API 重新 publish |
| 绑数 | wf3 仍 **manual**；customViz 在 8088/admin 手绑数据源 |
| 网络 | 客户端须能访问 `192.168.10.22:8088`（内网） |
| 密码 | staging 上 `admin` 密码以该机 `backend/.env` 为准，非必然 `changeme` |

## 5. 产物清单

| 文件 | 用途 |
|------|------|
| `release/vitalspan-v0.4.5-staging.zip` | DeepTalk 安装（Agent 工具默认连 staging） |
| `release/vitalspan-v0.4.5.zip` | 本地开发（默认 127.0.0.1） |
| `assets/config.staging.example.json` | 工作区 config 样例 |

部署详情：`docs/material/deploy/2026-08-04-vitalspan-staging-deploy-log.md`
