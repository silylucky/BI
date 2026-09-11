# 项目规则与本地技能（go-fast 开工前）

实现 subagent **不继承** Cursor 主会话里「碰巧注入」的 rules。  
主编排必须在**真正干活前**盘点并**下传**到 [implementer-prompt.md](implementer-prompt.md)，否则等于未读。

本文件只管**目标业务仓**内的约定；**不要**把 `~/.agents/skills`（全局 SOP 仓）当成「项目技能」再扫一遍。

---

## 1. 扫描路径（有则列入清单）

| 类 | 路径 | 取什么 |
|----|------|--------|
| Rules | `.cursor/rules/**/*.{mdc,md}` | 全文或按 frontmatter `alwaysApply` / `globs` |
| Rules | 仓根 `AGENTS.md` · `CLAUDE.md` · `.cursorrules` | 全文摘要 + 红线原文 |
| Skills | `.cursor/skills/*/SKILL.md` | name + description；相关则 Read 全文 |
| Skills | `.agents/skills/*/SKILL.md`（**仓库内**，非 `$HOME/.agents`） | 同上 |
| Skills | 仓根 `skills/*/SKILL.md`（若团队约定） | 同上 |

无上述目录 → ledger / 回传记 `project_context: none`，**不** BLOCKED。

---

## 2. 加载策略（控 token）

1. **清单**：列 `id | 路径 | always|glob|skill | 一句话`。  
2. **Rules**  
   - `alwaysApply: true` / 无 glob 的仓规 → **必读**，红线摘进 implementer「项目红线」。  
   - 带 `globs` → 仅当与本批路径白名单 / 切片目录相交时 Read。  
3. **Skills**  
   - 先读各 `SKILL.md` 的 YAML `description`（或首段）。  
   - 与本批相关才全文 Read 并遵循（例：改 UI → 设计系统 / 组件 skill；改某域 → 域业务 skill）。  
   - 相关判定：description 关键词 ∩ 本批 scope/白名单/规格用语；拿不准 → 宁可多读 1 个窄 skill，勿假装「全不相关」。  
4. **冲突**：项目 rule/skill 与 go-fast 硬禁（假绿/stub/证据门/**go-zero goctl 产物禁手改**）冲突 → **go-fast 硬禁优先**，项目约定记入 `blockers` / concerns，禁止用项目 skill 授权 stub 或手改 `types.go`/`routes.go`。  
5. **下传**：摘要 + 必须遵守的条文 + 相关 skill 的「必读节路径」写进 implementer；**禁止**只写「请自行阅读 `.cursor/rules`」。  
6. **栈硬线**：认栈为 go-zero → 另遵 [go-zero-goctl.md](go-zero-goctl.md)，红线原文下传 implementer。

---

## 3. 回传字段（最小）

```yaml
project_context:
  rules: []          # {path, apply: always|glob|manual, loaded: true|false}
  skills: []         # {name, path, relevant: true|false, loaded: true|false}
  red_lines_excerpt: []   # 下传给实现者的红线短句
  none: false        # 仓内无任何规则/技能目录时 true
```

---

## 4. 禁止

- 假定 Cursor 已注入 rules，跳过本盘点  
- 把全局 `~/.agents/skills` 当项目技能扫完  
- 相关设计系统 / 业务 skill 存在却不 Read、不写进 implementer  
- 用项目 skill 覆盖 go-fast 假绿 / 证据 / 契约不明硬禁  
