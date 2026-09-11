# 确认后批量写文档 / 修规则

仅在用户确认批次后执行。默认 **修补优于整文件覆写**；新建文件套对应域模板（索引 [templates.md](templates.md) → `templates/<域>.md`，只读本批命中的域）。

## 执行顺序

```
R0  prd-sync.mdc + docs/README.md（串行，先于一切）
 ↓
按确认批次并行：api | service | domain | data | ui | mock | adr
 ↓
交叉链接 + 索引表最终对齐
 ↓
回归勾选
```

## R0 · 规则与索引

1. 若缺失或不合格：按 [prd-sync-rule.md](prd-sync-rule.md) 创建或合并；填入**本仓真实**契约源路径。
2. 确保 `docs/` 目录存在。
3. 写或更新 `docs/README.md`：体系说明 + 目录表（可先列已有与本批将建路径）。
4. 不在此步写业务长文。

## 分类型写入规则

| 规则 | 说明 |
|------|------|
| 一套模板 | 只使用 templates 中对应类型；必填节保留 |
| **可消费深度** | **api / domain 必须过** [consumable-depth.md](consumable-depth.md)：能支撑 Postman、APISix/网关、Process Test Pack；禁止空壳摘要 |
| 真源 | 端点/配置/表名从代码或契约抄录；抄不到写 `待确认` |
| mock 诚实 | 动词用「模拟/占位/固定返回」；清零条件写清 |
| 不改业务代码 | 发现 stub 只文档化；清 stub 交给 code-reviewer 确认流 |
| 精修保护 | 已有长文：按 finding 做小节级 diff；用户说「重写」才整篇替换 |
| 并行安全 | 不同文件可并行；同一文件只一个 agent 写 |
| 元信息 | 写入当日 `last_verified`；`related` 尽量互链；api/domain 建议填 `consumers` |

## Subagent 提示词（写文档）

```
你在用户已确认的文档修复批次中工作。只改文档与规则文件，不改业务源码（除非用户批次明确要求）。

项目根：{{ROOT}}
批次：{{BATCH_ID}}
本任务目标文件：{{PATHS}}
对应 finding：{{FINDING_IDS}}
类型模板：docs-reviewer references/templates/{{TYPE}}.md（+ 索引 templates.md 的「共用元信息」；只读本域，勿全读 templates/）
prd-sync：已与 taxonomy 对齐（R0 已完成 / 若未完成先停）

要求：
1. 新建或修补上述路径；命名遵守 docs/<type>/<kebab>.md
2. 从代码/契约提取事实；禁止臆造
3. 类型为 api / domain 时：严格套 templates 深模板 + 自检 consumable-depth 闸门；写完须能建 Postman / 配网关 / 跑流程场景
4. 更新 docs/README.md 中本文件条目（若 R0 已建表则追加行）
5. 回传：写入路径列表、可消费自检结果（A1–A8 / D1–D8）、未解决的「待确认」项、偏离 finding 的原因
```

## 回归清单

```
- [ ] 本批覆盖矩阵目标已达「已写/已修」
- [ ] prd-sync 分类与实树一致（若做了 R0）
- [ ] docs/README.md 含新/改路径
- [ ] mock 无「已交付/已支持」误导措辞
- [ ] api 文档链到契约源（若仓有契约）且过可消费闸门 A1–A8
- [ ] domain 含 Process Test Pack 且过闸门 D1–D8
- [ ] 抽查：按 api 文档能在 Postman 发出 1 个请求；按 domain 场景能执行主路径
- [ ] 交叉 related 链接可解析
- [ ] 完成摘要列出关闭的 finding ID
```

## 完成摘要模板

```markdown
## 文档修复完成 · {{DATE}}

| 批次 | 关闭 finding | 写入/修改路径 |
|------|--------------|---------------|
| R0 | … | `.cursor/rules/prd-sync.mdc`, `docs/README.md` |
| … | … | … |

待确认遗留：…
建议下一步：再跑 docs-reviewer 短回归 / 或 code-reviewer 清 mock 对应 stub
```

## 禁止

- 未确认执行
- R0 未完成就开始到处建错路径的文档
- 并行改同一 Markdown 文件
- 为「好看」编造 KPI/端点
- 生成空壳 api/domain（只有目录表或散文，无法 Postman / APISix / 流程测试）
- 借文档任务重构业务代码
