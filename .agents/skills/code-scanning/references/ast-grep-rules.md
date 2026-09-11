# ast-grep 规则写法与坑

本文档的所有示例都在 ast-grep 0.45 上实跑验证过。

## CLI 速查

```bash
ast-grep run -p '<pattern>' -l <lang> [path]   # 一次性搜索，pattern 必须是完整 AST 节点
ast-grep scan [path]                            # 跑 sgconfig.yml 里 ruleDirs 的全部规则
ast-grep scan -r one-rule.yml [path]            # 只跑一条规则（调试规则时用）
ast-grep scan --json=compact                    # JSON 输出，给 subagent / 脚本消费
ast-grep run -p 'foo($A)' -r 'bar($A)' -l ts -U # 结构化重写并落盘（-U = update-all）
ast-grep test                                   # 跑规则自带的测试用例
```

**退出码**：有 `severity: error` 级 finding 时退出码为 **1**。这是正常结果，不是执行失败。脚本里别用 `set -e` 直接跑，靠 `--json` 判内容。

## 三种匹配方式

### 1. pattern —— 写得像代码

最常用。忽略空白与格式，天然不匹配注释和字符串里的同名文本。

```yaml
id: go-swallowed-error
language: go
severity: error
message: 错误被吞掉
rule:
  any:
    - pattern: |
        if $$$INIT; err != nil {
        }
    - pattern: |
        if err != nil {
        }
```

元变量：`$X` 匹配单个节点，`$$$ARGS` 匹配多个（列表）。同名元变量要求内容一致。

### 2. kind + regex —— 匹配"某类节点的文本内容"

pattern **不能**在字符串字面量内部用元变量。`$X := "192.168.$$$"` 是无效的。要匹配字符串内容，改用节点类型加正则：

```yaml
id: go-hardcoded-private-host
language: go
severity: error
message: 硬编码内网地址
rule:
  kind: interpreted_string_literal   # Go 的双引号字符串
  regex: '(192\.168\.|10\.\d+\.\d+\.\d+|localhost:\d)'
```

常用 kind：Go 字符串是 `interpreted_string_literal`，TS/JS 是 `string`。不确定时用 `ast-grep run -p '<一段代码>' --debug-query` 看 AST。

### 3. 关系子句 —— pattern 组合

```yaml
rule:
  pattern: panic($MSG)
  has:
    stopBy: end                       # ← 关键，见下
    kind: interpreted_string_literal
    regex: '(?i)not implemented|todo'
```

**坑：`has` 默认只看直接子节点。** `panic("x")` 的直接子节点是函数名和参数列表，字符串在参数列表**里面**，所以不加 `stopBy: end` 匹配不到。凡是"某节点的后代里含有 X"，都要写 `stopBy: end`。

其他关系：`inside`（在某节点内）、`follows` / `precedes`（前后相邻）、`not`、`all`、`any`。

## 坑：JSX 属性不是完整节点

`-p 'onClick={() => {}}'` 会直接报错 `Multiple AST nodes are detected`，因为属性片段本身不是一个可独立解析的节点。必须给它一个上下文，再用 selector 指定要匹配的那部分：

```yaml
id: tsx-noop-handler
language: tsx
severity: error
message: 点了没反应（空 handler）
rule:
  pattern:
    context: '<a onClick={() => {}} />'   # 提供可解析的完整元素
    selector: jsx_attribute                # 实际匹配的是属性节点
```

同一套写法适用于任何"代码片段不能单独成句"的场景（对象的单个属性、函数参数等）。

## 排除测试与依赖

**`files` / `ignores` 是规则级字段，不是 `sgconfig.yml` 的全局字段。** 写在 sgconfig 里不会生效（实测确认过，测试文件照样被扫）。正确写法是每条规则各自声明：

```yaml
id: go-unimplemented-panic
language: go
severity: error
message: 可激活 stub
files:
  - "**/*.go"
ignores:
  - "**/*_test.go"
  - "**/vendor/**"
rule:
  pattern: panic($MSG)
```

ast-grep 默认遵守 `.gitignore`，所以 `node_modules`、`dist` 这类通常不用再写。

前端规则的常用排除：

```yaml
ignores:
  - "**/*.test.*"
  - "**/*.spec.*"
  - "**/__mocks__/**"
  - "**/*.stories.*"
```

注意 code-reviewer 的判据：mock 掉**被测对象本身**的测试仍要报（假绿的背书者），所以别把整个测试目录从人工审查里排除，只是不让它污染自动规则的输出。

## 一个文件放多条规则

用 `---` 分隔多个 YAML 文档，已验证可用：

```yaml
id: rule-one
language: go
severity: error
message: ...
rule: { pattern: ... }
---
id: rule-two
language: go
severity: warning
message: ...
rule: { pattern: ... }
```

`id` 全局唯一，`language` 每条都要写。

## 给规则写测试

规则会误报，误报会消耗 reviewer 的信誉。重要规则应当配测试：

```yaml
# .ast-grep/rule-tests/go-stub-test.yml
id: go-unimplemented-panic
valid:
  - 'package m
func A() error { return doRealWork() }'
invalid:
  - 'package m
func A() error { panic("not implemented") }'
```

`sgconfig.yml` 里加：

```yaml
testConfigs:
  - testDir: .ast-grep/rule-tests
```

然后 **先跑一次 `ast-grep test --update-all` 生成快照**，之后 `ast-grep test` 才会 PASS。不生成快照会看到 `FAIL ... .W`——那是缺快照，不是规则错。

代码片段要能独立解析（Go 片段需带 `package m`），否则用例本身解析失败。

## Vue SFC

ast-grep 不内置 Vue。在 `sgconfig.yml` 做扩展名映射，`.vue` 会按 TypeScript 解析：

```yaml
languageGlobs:
  typescript:
    - "*.vue"
```

**只有 `<script>` 段能扫到。** `<template>` 不是合法 TS，解析成垃圾节点——实测 `@click="() => {}"` 匹配不到。模板层的产品表面问题（空 handler、死链、假数据渲染）交给 ui-ux-reviewer 和 browser-reviewer，别指望规则。

规则要覆盖 `.vue` 时，`files` 里要显式加 `"**/*.vue"`。

## 常见坑清单

这些都是实测撞出来的，按危险程度排序。

**1. 规则写错不会报错，只会静默零命中。** 最危险的一类。`field` 名写错、`kind` 用了该语言不存在的节点类型、`has` 少了 `stopBy`——都不报错，规则永远不匹配，你以为扫干净了。**每条规则必须有正例 fixture 兜底。**

**2. 一个坏规则文件让整个目录哑火。** `ruleDirs` 是整体加载，任何一个 yml 解析失败会让整次 `ast-grep scan` 一条规则都不跑。改完规则跑一次加载冒烟：

```bash
ast-grep scan --json=compact /dev/null   # 有输出即为加载错误
```

**3. 各语言的字符串节点 kind 名都不一样，而且常有内外两层。**

| 语言 | 外层 | 内层（纯内容） |
|---|---|---|
| Go | `interpreted_string_literal` | — |
| TS / JS | `string` | `string_fragment` |
| Python | `string` | `string_content` |
| Java | `string_literal` | `string_fragment` |
| PHP | `encapsed_string`（双引号）/ `string`（单引号） | `string_content` |
| Rust | `string_literal` | — |

`regex` 打在外层时文本**含引号**，想锚定内容开头要写 `^"`。Python 的 f-string 也是 `string`，但多一个 `interpolation` 子节点。

**4. `kind: _` 通配不存在。** 想表达「块里什么都没有」时 `not: {has: {kind: _}}` 会报 `Kind '_' is invalid`。改用对节点本身加 `regex`：

```yaml
has:
  field: body
  kind: block
  regex: '^\{\s*\}$'
```

`\s` 跨行有效，多行空块也能命中，而**只含注释的块不会命中**——这恰好是想要的语义：开发者写一行注释说明理由就能合规消音。

**5. 注释是真实 AST 节点，会破坏「函数体只有一条语句」类的 pattern。** 带 TODO 注释的 stub 反而匹配不上，正常函数却命中了，和意图完全相反。这类判定要用 `all` + `has` 组合，不能用整体 pattern。另外 Rust 的注释 kind 是 `line_comment` / `block_comment`，**没有 `comment`**；C/C++ 才叫 `comment`。

**6. pattern 对修饰符不宽容。** Java 的 `$RET $NAME($$$P) {}` 匹配得到 `void b() {}`，但匹配不上 `public static void f() {}`——修饰符在 pattern 里没有对应槽位。Python 同理，`def $N($$$A):` 匹配不到带返回注解的 `def f(x) -> dict:`，也匹配不到 `async def`。**遇到修饰符/注解/注释就改用 `kind` + `has` 的结构写法。**

**7. `$$$` 不是在所有语言都工作。** C/C++ 的 `argument_list` 里 `strcpy($$$)` 匹配不到任何东西，而 `strcpy($A, $B)` 正常。绕法是 `kind: call_expression` + `has: {field: function, regex: ...}`。

**8. `not: {has: {field: body}}` 会报「must have one positive matcher」。** `has` / `inside` 内部光有 `field` 不算 matcher，必须补一个 `kind`。

**9. regex 里的常见词要加 `\b`。** 不加词边界的 `todo` 会把 `"todos must not be empty"` 这种正常业务消息报出来。

**10. `severity: hint` 不影响退出码**，适合当探针——用来确认某个文件确实进了扫描范围，而不是被 ignores 静默跳过了。

## 从 rg 迁移的判断

| rg 种子长这样 | 该不该换 |
|---|---|
| 靠一串 `--glob '!...'` 排除测试，仍然误报注释 | **换**，这是 ast-grep 的主场 |
| 跨行的形状（空分支、空函数体、多行 JSX） | **换**，正则本来就不可靠 |
| 找 env 变量名、配置键、文案字符串 | **不换**，rg 更快更直接 |
| 找文件是否存在、目录结构 | **不换** |

迁移时保留 rg 版本做一次对照跑，确认新规则没有漏掉真 finding——降误报的同时不能降召回。
