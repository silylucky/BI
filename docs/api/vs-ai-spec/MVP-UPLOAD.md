# 无 DeepTalk 源码 · MVP 上传（给接口即用）

> **不需要 DeepTalk 发版。** DeepTalk 写组件 → 你跑一条命令 → 5173 可用。  
> 产品内嵌见 [deeptalk-product/README.md](./deeptalk-product/README.md)。

## 前提

| 项 | 要求 |
|----|------|
| VitalSpan 后端 | `http://127.0.0.1:8000/health` → ok |
| 本包位置 | 桌面 `vs-ai-spec-deeptalk-test` 或 zip 解压目录 |
| 密码 | 环境变量 `VITALSPAN_DEV_ADMIN_PASSWORD`（未设默认 `changeme`） |

可选：复制 `local.config.json.example` → `local.config.json`，改 `api_base` / `vitalspan_root`。

## 三步上传（工作流 ②）

### 1. DeepTalk 写组件

- 草稿保存到 **`examples/你的组件.json`**
- 若 DeepTalk 写到 **`output/`**，不要紧 — 用下面 `--from` 即可

### 2. 一键上传

在本包根目录（与 `tools/` 同级）：

```powershell
python tools\mvp-upload.py --file examples\你的组件.json
```

DeepTalk 写在 output 时：

```powershell
python tools\mvp-upload.py --from output\deeptalk生成的.json
```

或双击 / 运行：

```powershell
.\upload-component.ps1 -From output\deeptalk生成的.json
```

### 3. 看结果

成功必须出现：

```
ok artifactId=<uuid>
styleComplianceTier=full
```

然后打开 **http://127.0.0.1:5173/admin** → 图表盘 → **自定义** → 拖拽使用。

## 其他命令

```powershell
python tools\mvp-upload.py --list
python tools\mvp-upload.py --file examples\x.json --validate-only
python tools\list-ai-viz-artifacts.py
python tools\delete-ai-viz-artifact.py <uuid> --yes
```

## 给 DeepTalk 的提示词（粘贴即可）

用 [DEEPTALK-AGENT-PROMPT.md](./DEEPTALK-AGENT-PROMPT.md) 或 [deeptalk-product/AGENT-SYSTEM-PROMPT.md](./deeptalk-product/AGENT-SYSTEM-PROMPT.md)。

补充一句：

> 组件 JSON 请写到 **examples/**；若只能写 output/，用户会用 `mvp-upload.py --from output/xxx.json` 入库。

## 接口真源（DeepTalk 无需改 VitalSpan 代码）

| 操作 | HTTP |
|------|------|
| 入库 | `POST /api/v1/ai-viz/artifacts` |
| 更新 | `PUT /api/v1/ai-viz/artifacts/{id}` |
| 列表 | `GET /api/v1/ai-viz/artifacts` |
| 删除 | `DELETE /api/v1/ai-viz/artifacts/{id}` |

`mvp-upload.py` 内部调用上述接口（Bearer JWT），**不依赖 DeepTalk 产品发版**。

## 工作流 ③ · 复用已有组件拼大屏（不需重新上传）

**可以。** 组件一旦在库里（`artifactId`），任意大屏通过 layout **引用** 即可，同一组件可复用多次。

### 1. 查库里有哪些组件

```powershell
python tools\mvp-dashboard.py --list-artifacts
# 或
python tools\mvp-upload.py --list
```

记下 `artifactId`（uuid）。

### 2. 拼 layout 并保存到大屏

**方式 A — 用现成样例**（改 json 里的 `artifactId` 后）：

```powershell
python tools\mvp-dashboard.py --dashboard-id <大屏uuid> --file examples\e2e-mixed-screen.json
```

**方式 B — 只给 uuid，自动生成横排 layout**：

```powershell
python tools\mvp-dashboard.py --dashboard-id <大屏uuid> --artifact-ids uuid1,uuid2
```

成功 = 终端 **`ok dashboardId=...`** → 打开 5173 对应大屏编辑页。

### layout 里怎么引用（DeepTalk 写 JSON 时）

```json
{
  "type": "customViz",
  "customVizConfig": {
    "artifactId": "<组件库已有 uuid>",
    "dataBinding": { "status": "manual" }
  }
}
```

**禁止**在大屏 JSON 里内联写组件 HTML；只填 `artifactId`。

### 三条线分工（DeepTalk 需遵守）

| 线 | 做什么 | 完成标志 |
|----|--------|----------|
| ② 新组件 | 开发并 upload | `artifactId` |
| ③ 拼大屏 | **只引用** ② 或库中已有 uuid | `dashboardId` |
| ① 内置图 | `chartConfig` 写在 layout 里 | validate 200 |

DeepTalk **无源码**时：② 用 `mvp-upload.py`，③ 用 `mvp-dashboard.py`；**不等发版**。

---

## 与 DeepTalk 产品发版的关系

| 能力 | MVP（现在） | 产品发版后 |
|------|-------------|------------|
| POST 入库 | ✅ 你跑 `mvp-upload.py` | ✅ Agent 自动调工具 |
| 5173 可用 | ✅ 有 artifactId 即可 | ✅ 同左 |
| 不问「存 output/」 | ⚠️ 靠提示词 + 你手动上传 | ✅ 产品内置 Gate |
