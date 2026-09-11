# OCR Rules

本 Skill 将 OCR 规则分为不可覆盖协议与可配置语言/项目检查表。

## 优先级

1. `--rule <path>` 显式规则
2. 仓库根 `.opencodereview/rule.json`
3. 用户家目录 `~/.opencodereview/rule.json`
4. 随 Skill 内置的 OCR `system_rules.json` 与 `rule_docs/*`

每层内声明顺序 first match wins。用户规则默认替换系统规则；`merge_system_rule: true` 时先系统、后用户，两者都为 Mandatory。

示例：

```json
{
  "include": ["special/**/*.txt"],
  "exclude": ["vendor/**"],
  "rules": [
    {"path": "services/payment/**/*.go", "rule": "rules/payment.md", "merge_system_rule": true},
    {"path": "**/*.go", "rule": "Only report correctness defects"}
  ]
}
```

单行、无空格并以 `.md/.txt/.markdown` 结尾的 `rule` 被视为文件引用。仓库 `.opencodereview/rule.json` 的引用相对仓库根解析；显式与全局规则相对各自配置目录解析。绝对路径、越界路径、缺失文件、非 UTF-8 文件和超过 512 KiB 的引用返回 `INVALID_RULE`；其他内容为内联规则。这是 Skill 的本地安全加固，不改变 OCR 的优先级、first-match 与合并语义。

## 文件过滤

只有最高优先级且实际配置了 include/exclude 的用户层生效，层间不合并。匹配大小写不敏感，支持 `**` 与 `{a,b}`。

顺序与 OCR 一致：

1. provider 固定目录排除（如 `.git`、`vendor`、`node_modules`），以及安装到仓库内的 `.agents/.cursor/skills/ocr-code-review/**` 自身副本
2. 用户 exclude
3. 用户 include 命中时直接准入
4. 扩展名 allowlist
5. OCR 默认路径排除

注意：OCR 的 include 是“准入覆盖”，不是非命中文件全部排除的白名单。未命中 include 的文件仍按默认规则判断。

默认排除精确的测试目录组件 `test/tests/__tests__/spec/specs`，以及标准测试命名，例如 `test_*.py`、`*_test.py`、`*_test.go`、`*.test.ts`、`*.spec.ts`、`PaymentTest.java`。CamelCase 的 `Test/Tests/Spec` 后缀只对采用该惯例的语言做大小写敏感匹配，因此 `Contest.java` 不会被误伤；`contest.ts`、`latest.go`、`testimony.py` 等仅包含字母序列 `test` 的生产文件也不会被排除。

测试、snapshot、fixture、testdata 和常见 generated 文件可以被 reviewer 按需读取为 Context Evidence；用户 include 显式命中时直接准入为 Primary Target。

## 指纹

Session 分别记录规则、过滤器、协议、Requirement 的 hash。task input hash 包含模式、Primary Target 内容/diff、解析后的规则、协议、Requirement 和计划审查维度。任何输入变化使已完成任务 stale，必须重新审查；旧 Finding 保留审计但标为 superseded。
