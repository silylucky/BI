# Implementer 派发模板（go-fast）

主编排用 Task/subagent **实现一片**时套用。实现 agent **不继承**长对话；须粘贴全文，勿让其自行读总计划凑上下文。

> **唯一信息通道。** 开工前读到的 `docs/ui/`、项目 rules/skills、外部契约、仓内抽象，**不写进模板 = 没读**。  
> 标 **【条件】** 的节：不命中则整节只写 **`N/A`**，**禁止**粘贴长禁令凑篇幅。

**模型**：派发时 **禁止**传 `model`；继承主会话。失败 → 拆片/补上下文，不换模型。

参见：[parallel.md](parallel.md) · [evidence.md](evidence.md) · [project-context.md](project-context.md) · [frontend-ui-contract.md](frontend-ui-contract.md) · [go-zero-goctl.md](go-zero-goctl.md)

---

## 条件省略（强制）

| 条件 | 整节 |
|------|------|
| 非前端（不改页面/组件/样式/文案壳） | UI 契约 → `N/A` |
| 非 go-zero | goctl 绝对红线 → `N/A` |
| 无第三方 API/SaaS/SDK | 外部契约卡 → `N/A` |
| 仓内无 rules/skills 且无 AGENTS/CLAUDE | 项目红线段保留一行「仓内无」即可 |

---

## 模板

```text
Task（实现 subagent）:
  description: "Implement <slice-id>: <短名>"
  # 禁止传 model
  prompt: |
    你在实现切片 <slice-id>：<短名>

    ## 工作区
    worktree: <ABS>
    分支: go-fast/<slice-id>
    只改本目录、只跑下方验证；禁止 push / 改远程。

    ## 规格摘要
    <3～8 行：意图、本片位置、用语>

    ## 本片全文
    <工单或 Slice 原文>

    ## Seam
    <经何 API / UI / 协议观察行为>

    ## 【条件】项目红线与本地技能
    （无则：仓内无 rules/skills）
    rules: <已加载路径>
    红线:
      - <本片相关条文，逐条；勿贴整份 rule 文件>
    skills: <路径 + 3～5 条要点 | 无>
    冲突: go-fast 假绿/stub/证据/goctl 硬禁 > 项目约定

    ## 【条件·go-zero】绝对红线
    （非 go-zero：N/A）
    - 一定要遵守 goctl 的使用规范
    - 严禁手动修改 goctl 产物 types.go、routes.go
    - 不能给 goctl 产物打补丁；改 *.api → 重新 goctl；只在 logic/自定义层写业务
    - 白名单不得以修补 types.go/routes.go 为验收 → 否则 NEEDS_CONTEXT / BLOCKED

    ## 【条件·前端】UI 契约
    （非前端：N/A）
    共性禁令: 遵守 frontend-ui-contract 硬清单（主编排已对齐 craft / page-recipes）
    设计锚: <组件库/token/外部锚>
    锚可信度: <confirmed|inferred|assumed>；assumed: <列表|无>
    壳/菜谱/标杆: <layout 形态> / <A–F> / <标杆路径>
    必须复用: <组件路径列表>
    本页填空:
      详情: <只读描述 + 编辑入口 | /new 直接表单>
      编辑载体: 新建=<Dialog|Sheet|独立页>；编辑=<…>；删除=AlertDialog
      操作列: ghost · 间距紧凑 · ≤4 平铺 · >4→… · 删除红
      色彩: 主 CTA solid×1；危险 destructive；禁满屏品牌色 / 色块过密
      表面: 一层；禁套卡（列表勿外卡再套表格内框；步骤勿大卡套小卡）
      本片相关红线（≤5 条）:
        - <只写本页会碰到的；例：详情勿直接表单；列表勿双层描边框>
    文案: craft §8 用户向人话；禁字段名/工程黑话/甲方上屏（细节见 frontend-ui-contract）

    ## 【条件·外部依赖】外部契约卡
    （无第三方：N/A）
    方案: <SDK/版本>（简报 docs/integrations/…）
    要点: <鉴权/端点/参数/返回>
    凭据: <env 名>；沙箱: <…>
    失败语义（须进代码）: <超时/401/429/幂等>
    smoke: <contracts/… | 本片产出>
    硬禁: 不明则真接或 BLOCKED，禁止 stub 顶替

    ## 【必填】仓内已有抽象
    <本片会用到的工具/类型/错误处理/请求封装路径>
    缺公共逻辑且别片也要 → NEEDS_CONTEXT「建议提取到 …」，勿白名单内复制

    ## 路径白名单
    <globs>

    ## 纪律
    - 红→绿；一刀一测；禁假绿/stub；禁越白名单；禁停问「是否继续」
    - 舰队禁全量：只跑下方命令；禁 pnpm test / 裸 vitest watch / go test ./...

    ## 【必填】验证与证据
    EV=~/.agents/skills/_bin/evidence-run
    红: $EV --slice <id> --phase red --expect-fail --cwd <ABS> --label "…" -- <cmd>
    绿: $EV --slice <id> --phase green --cwd <ABS> --label "…" -- <cmd>
    片: $EV --slice <id> --phase slice --cwd <ABS> --label "slice done" -- <cmd>
    cmd（须带路径）: <…>
    纪律: 红绿配对；禁缩路径换绿；禁补跑无关 evidence；无测基建 → slice 记实际所跑并说明

    ## 提交
    本 worktree 本地 commit；禁止 push / PR。

    ## 不清就停
    需求/验收/依赖不清 → NEEDS_CONTEXT 或 BLOCKED，勿猜。

    ## 自审（按片勾选）
    通用:
      [ ] 字面验收覆盖、无多余范围
      [ ] seam 行为可观察；diff 未越白名单
      [ ] 未复制别片也要的公共逻辑
    前端（UI≠N/A 时）:
      [ ] 详情默认只读；编辑载体已按契约
      [ ] 操作列 ghost、间距紧、删除红；色彩未过密
      [ ] 文案人话；无字段名/工程黑话/甲方
    go-zero（≠N/A 时）:
      [ ] 未手改/打补丁 types.go、routes.go；契约走 goctl
    外部（≠N/A 时）:
      [ ] 失败语义在代码里；smoke 有工件或已说明

    ## 回传（必须）
    Status: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED
    - 做了什么 / 卡在何处
    - 改了哪些文件
    - 证据: red/green/slice 路径（无红绿须说明）
    - 复用了何抽象 / 建议提取何共享
    - 实际采用的 assumed 锚取值（若有）
    - concerns / 所需上下文
```

## 填模板时的检查

| 片碰了什么 | 必须填 | 不填的后果 |
|------------|--------|------------|
| 任何片 | 项目红线段（或「仓内无」） | 踩仓规 / 漏设计系统 skill |
| 前端页面/组件 | UI 契约（填空+≤5 红线；禁贴全文 craft） | 各片自造壳与页头 |
| go-zero | goctl 绝对红线 | 手改 types/routes、给生成物打补丁 |
| 第三方 API/SaaS/SDK | 外部契约卡 | 猜接或假通 |
| 任何片 | 已有抽象 | 白名单内复制 |
| 任何片 | 验证与证据 | 自证闭环，前门失效 |

条件节不命中 → 整节 **`N/A`**，禁止粘贴长禁令。UI 共性真源：[frontend-ui-contract.md](frontend-ui-contract.md)。**读了不传等于没读。**

## 状态约定

| Status | 含义 | 主编排 |
|--------|------|--------|
| DONE | 本片完成且自测绿 | 进合并门（先 `gate-check slice`） |
| DONE_WITH_CONCERNS | 做完但有正确性/范围疑虑 | 先读 concerns 再决定合并 |
| NEEDS_CONTEXT | 缺信息；或该提取共享 | 补上下文重派，或先 `refactor-shared` |
| BLOCKED | 环境/设计/过大/契约不明 | 拆片、补上下文或升人；禁换模型空转 |

回传 `DONE` 但 `gate-check slice` FAIL → 按 FAIL，不得合并。

## 精简版（调研 / 只读）

无 worktree 时仍须：范围、只读约束、期望产出、禁止改白名单外文件；若调研涉及项目约定，带上相关 rule/skill 路径。
