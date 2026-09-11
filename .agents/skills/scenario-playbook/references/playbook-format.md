# 剧本格式（browser-reviewer 契约）

本文件是 **scenario-playbook → browser-reviewer** 的交接格式。两边都必须遵守；字段缺失则走查 agent 须先补剧本或标 Blind spot，不得瞎点。

## 文件约定

| 文件 | 用途 |
|------|------|
| `README.md` | 索引：模式、日期、场景表、主入口相对路径 |
| `critical.md` | **主剧本**（browser-reviewer Phase 1 默认加载） |
| `optional.md` | 可选场景 / 指定模式下的「建议增补」 |

路径示例：`.dev/playbooks/2026-07-14/critical.md`

## critical.md 骨架

```markdown
# 走查剧本 · <产品或仓库名>

| 项 | 内容 |
|----|------|
| mode | auto \| specified |
| created | YYYY-MM-DD |
| source | scenario-playbook |
| .dev | 有 / 无（路径） |
| allow_writes | true \| false \| unknown |
| allow_destructive | true \| false \| unknown |
| handoff | browser-reviewer |

## 场景索引

| 场景 ID | 标题 | 优先级 | 角色 | 写操作 | 状态 |
|---------|------|--------|------|--------|------|
| S0 | 预检与登录 | P0 | admin | 否 | ready |
| S1 | … | P0 | admin | 是/否/needs_confirm | ready \| blocked \| draft |

## 共享前置（全场景默认）

| ID | 步骤 | 路由/入口 | 操作 | 期望 | 截图 |
|----|------|-----------|------|------|------|
| G0.1 | 打开应用 | `base_url` | 导航 | 非连接拒绝 | 是 |
| G0.2 | 登录 | `/login` | 使用 `.dev` 账号 | 进入壳；无 console error | 是 |

（多角色时另表列出切换步骤。）

## 场景 S1 · <标题>

| 项 | 内容 |
|----|------|
| 优先级 | P0 \| P1 \| P2 |
| 业务价值 | 一句话 |
| 角色 | `.dev` 角色名或权限说明 |
| 前置夹具 | 数据/配置要求；无则写「无」 |
| 关联 | `docs/domain/…` PT-xx；路由；API 若有 |
| 写操作 | none \| form_submit \| needs_confirm \| destructive |
| blocked 原因 | （仅 status=blocked） |

### 步骤

| 步 | 入口（菜单文案或路由） | 操作 | 期望（可见结果/状态） | 失败貌 | 截图 | Console |
|----|------------------------|------|----------------------|--------|------|---------|
| 1 | 侧栏「订单」→ `/orders` | 点击 | 列表或诚实空态；非永久 Skeleton | 白屏/5xx | 是 | 查 |
| 2 | 页头「新建」 | 点击 | Dialog/Sheet/独立页打开 | 无响应 | 是 | 查 |
| 3 | 表单 | 填必填…（写出字段名与示例值） | 校验通过可点提交 | 字段错误不明确 | 否 | — |
| 4 | 提交 | 点击主 CTA | toast/成功；列表出现记录 | 静默失败 | 是 | 查 |

### 通过判据（场景级）

- [ ] 所有 `ready` 步期望满足
- [ ] 过程无未捕获 console error（白名单外）
- [ ] 主路径无意外 5xx

### 跳过规则

- `allow_writes=false` → 标 `form_submit` 的步改为「打开承载后关闭」，不提交
- `allow_destructive=false` → 删除只开确认框，不点确认
```

## 步骤质量闸门（写剧本自检）

| # | 检查 | 不合格 |
|---|------|--------|
| P1 | 每步有**可定位入口**（菜单文案或路由） | 「进入相关页面」 |
| P2 | 每步有**具体操作**（点击/输入/选择） | 「验证功能正常」 |
| P3 | 每步有**可观察期望** | 「成功即可」 |
| P4 | 写字段给出**示例值**或「用列表已有第一条」 | 「随便填」 |
| P5 | 破坏性步有边界标记 | 默认真删 |

任一失败 → 回炉，不得标 `ready`。

## 场景状态

| 状态 | 含义 | browser-reviewer |
|------|------|------------------|
| `ready` | 可执行 | 必跑 |
| `blocked` | 缺功能/stub/缺夹具 | 记 Blind 或 P1「剧本 blocked」，不假装通过 |
| `draft` | 步骤尚有 `待确认` | 能跑则跑；待确认步跳过并披露 |

## README.md 最小索引

```markdown
# Playbooks · YYYY-MM-DD

- 模式：auto | specified
- 主剧本：[critical.md](./critical.md)
- 可选：[optional.md](./optional.md)（若有）
- 场景数：S0…Sn（ready n / blocked n / draft n）
- 下一步：browser-reviewer，剧本目录本路径
```

## browser-reviewer 加载顺序

1. 用户或交接消息指定的剧本路径  
2. 否则 `.dev/playbooks/` 下**最新日期**目录的 `critical.md`  
3. 否则 `docs/qa/playbooks/` 最新 `critical.md`  
4. 皆无 → **先调 scenario-playbook**，或降级用通用 [walkthrough-playbook](../../browser-reviewer/references/walkthrough-playbook.md) 并在报告写明「无业务剧本」
