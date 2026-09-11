# 视觉 · 像素 · 风格检查

在功能走查截图之上做视觉验收。真机证据优先于静态臆测。

## A. 读图检查（每张关键态截图）

用 Read 查看截图，寻找：

| 类 | 失败信号 | 默认级 |
|----|----------|--------|
| 布局 | 重叠、文字溢出盒子、控件对不齐、大面积空白失衡 | P1；导致不可点 → P0 |
| 裁切 | 主内容被裁、滚动陷阱、sticky 挡 CTA | P1/P0 |
| 层级 | 模态下仍可点背后；遮罩不全 | P1 |
| 状态 | 永久 Skeleton/假数据感；错误无壳 | P0/P1 |
| 对比 | 明显不可读（浅灰上浅灰） | P1 |
| 登录残留 | 截图含完整密码明文 | 不进报告图；重截 |

## B. 风格一致性矩阵

选 **1 张金样**（优先 baseline；否则最完整列表页截图），与同菜谱页对比：

| 维度 | 看什么 |
|------|--------|
| 页头 | 标题+说明+主按钮相对位置是否同构 |
| 工具栏 | 筛选行高度、间距、按钮顺序 |
| 表密度 | 行高、对齐、操作列 |
| 空态 | 插画/文案/CTA 是否同一家族 |
| 主色与圆角 | 明显另一套视觉语言 → P1 |
| 字体 | 脚手架默认风 vs 产品风混用 → P1 |

每条 finding 附：**金样截图路径** + **问题页截图路径**。

## C. 像素 / 感知 diff（有 baseline 时）

### Baseline 布局

```
.dev/baselines/
  login-desktop.png
  dashboard-desktop.png
  <route-slug>-desktop.png
  <route-slug>-mobile.png    # 仅当抽检 mobile
  _candidates/               # 本次新页自动收录的候选金样（未确认）
    <route-slug>-desktop.png
```

命名：`路由 slug` + `-` + `viewport 名`。与当次 `shots/` 中文件名对齐以便脚本/人工对比。

### 候选金样（新页自动收录）

无 baseline 的页：关键态截图**自动**复制进 `_candidates/`，并在报告出「待确认金样」清单（路由 / 路径 / viewport）。理由：批量看一次图的成本，远低于风格漂移到验收才发现的整批返工。

- 候选**不是**验收结论，**禁止**据此写「视觉已通过」或拿来做 diff 基准。
- 用户确认后移入 `.dev/baselines/` 转正；未确认的留在候选目录，下次走查继续列。
- 采集命令走证据层：`python3 ~/.agents/skills/_bin/evidence-run --slice <route-id> --phase screenshot --label "<路由/态>" -- <截图命令>`，工件路径进回传 `evidence.screenshots`。

### 模式（来自 `.dev` `walkthrough.pixel.mode`）

| mode | 行为 |
|------|------|
| `off` | 不跑自动 diff，仅读图 |
| `pixel` | 逐像素比（需尺寸一致）；差比 > threshold → 候选回归 |
| `perceptual` | 优先用仓内或系统可用的感知 diff（如 pixelmatch/odiff/playwright screenshot diff）；不可用则降级 pixel 或人工 |

### 阈值与分级

- 超过 threshold 且肉眼为布局/组件回归 → **P1**  
- 超过 threshold 但仅为时间戳/图表抖动 → 记备注或遮罩后复比；勿虚报 P0  
- 缺 baseline 的新页 → 走上面的候选金样流程（不是 finding，是待确认清单）；页面本身的问题照常按读图分级  

### 抖动处理

允许在 diff 前遮罩动态区（时钟、在线人数、图表）：在报告注明遮罩区域。无遮罩配置时，动态页以读图为主，自动 diff 结果降权为「待确认」。

## D. 「像素级」含义（本 Skill 定义）

1. **有 baseline**：自动 diff + 人工确认超阈值区域（真像素级回归闸门）。  
2. **无 baseline**：Agent 逐张读图，按网格检查对齐与间距，**不宣称**数字像素 diff、不写百分比差值 —— 报告必须写「无 baseline，读图判断」。  
3. **禁止**在无截图时写「像素级通过」；**禁止**把候选金样当 baseline 自比自过。

## E. 与 ui-ux-reviewer

分工见 SKILL.md 首表。风格漂移两边可报，**本 Skill 必须带截图对**；修 UI 时对齐 `docs/ui` 设计锚与本仓标杆页，禁止新 UI 库。
