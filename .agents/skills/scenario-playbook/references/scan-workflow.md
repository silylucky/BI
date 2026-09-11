# Scenario Playbook · 执行细节

## Playbook Card 模板

```markdown
### Playbook Card
- 模式：auto | specified
- 指定原文/要点：（specified 必填）
- 前端根 / 路由入口 / 菜单配置：…
- docs/domain：有 PT n 条 / 无
- docs/ui：有/无
- .dev：有（allow_writes=… · roles=…）/ 无
- 宣称已支持：…
- 产出目录：`.dev/playbooks/<date>/` 或 `docs/qa/playbooks/<date>/`
```

## 自动模式搜法种子（按栈改写）

```bash
# 菜单 / 路由
rg -n -i 'path:|children:|menu|sidebar|createBrowserRouter|routes\s*=' \
  --glob '!**/node_modules/**' --glob '!**/*.test.*'

# 领域流程 / 状态
rg -n -i 'Process Test Pack|状态机|status.*enum|useCase|workflow' \
  docs/domain domain src --glob '!**/node_modules/**'

# 宣称
rg -n -i '已支持|features?|capabilities' README.md docs/*.md 2>/dev/null | head
```

## 指定模式展开算法

1. 把用户描述拆成场景（一条闭环 = 一个 Sx；用户列多条则多 S）。  
2. 补全：登录共享前置、入口路由、表单字段名（从页面/组件读）、期望状态。  
3. 用户步骤过粗（「测一下订单」）→ 按 discovery 在**该域内**展开主路径 + 1 条主要失败/非法，仍算指定域，不扩散到其他域。  
4. 写出后与用户原文对照：不得丢失用户点名的断言。

## 与 browser-reviewer 交接话术（回传末尾）

```markdown
## 交接
- 主剧本：`.dev/playbooks/<date>/critical.md`
- 建议下一步：启用 **browser-reviewer**，Dev Card 后 Phase 1 加载上述剧本
- blocked / 待确认：…
```

若用户消息已包含「并走查/并验证」→ 本 Skill 写完后**同一会话继续** browser-reviewer，勿再问是否继续（除非缺 `.dev` 或应用不可达）。

## 质量抽检（写完必做）

1. 打开 `critical.md`，任选一场景：外人能否只靠表格点完？  
2. 对照 playbook-format 步骤闸门 P1–P5。  
3. 场景数：自动模式 critical 是否 ≤8+ S0？过多则移 optional。  
4. 指定模式 critical 是否仅含用户范围？
