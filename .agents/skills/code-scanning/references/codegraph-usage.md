# codegraph 用法与查询配方

codegraph 用 tree-sitter 把仓库解析成符号 + 调用边 + 依赖，存进本地 SQLite（`.codegraph/`）。100% 本地，无 API key。

**它能答**：谁调用了 X、X 调用了谁、改 X 会影响哪些地方、符号定义在哪、某个流程怎么串起来。
**它答不了**：「找处理重试逻辑的代码」这类说不出符号名的模糊问题——它不做语义相似检索。

## 安装与初始化

```bash
# 装 CLI（优先 npm；bootstrap 脚本同此顺序）
npm install -g @colbymchenry/codegraph                                                     # 推荐
# 无 npm 时再回退官方脚本：
# curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh   # macOS/Linux
# irm https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.ps1 | iex        # Windows

# 每个仓库一次：建索引
cd your-repo && codegraph init
```

`codegraph install` 是另一回事——它把 MCP server 接进 agent 配置，**不索引任何代码**。默认不要跑它，理由见 SKILL.md。真要接时用 `codegraph install --yes --target=cursor`。

## CLI 速查（subagent 用这些，不要用 MCP）

```bash
codegraph status                # 索引统计 + 待同步文件（新鲜度门）
codegraph sync                  # 增量同步
codegraph index --force         # 全量重建

codegraph explore "<问题>"      # 万能入口：返回相关符号源码 + 调用路径 + 影响面
codegraph query <关键词>        # 搜符号（--kind, --limit, --json）
codegraph node <符号|文件>      # 单个符号的源码 + 调用方
codegraph callers <符号>        # 谁调用了它（--json）
codegraph callees <符号>        # 它调用了谁
codegraph impact <符号>         # 改动影响面（blast radius）
codegraph files [路径]          # 文件结构（--format, --filter, --max-depth, --json）
```

`--json` 适合喂给脚本或做机器判定；不带则是人读格式。

## 新鲜度门

图的答案来自快照，过期的图会给出**带权威感的错误答案**。查图前：

```bash
codegraph status   # 输出里出现 "### Pending sync:" 段 = 索引落后于工作树
```

MCP 模式下有文件监听 + 防抖自动同步（默认 2s，`CODEGRAPH_WATCH_DEBOUNCE_MS` 可调），响应里也会带 `⚠️` staleness banner。但 **CLI 单次调用不保证已同步**，无人值守流程必须自己验。

处置见 SKILL.md 的新鲜度门表格。核心一条：同步不了就降级回 rg/ast-grep 并标 Blind spot，不要用图的结论。

## 查询配方

### arch-reviewer：模块深度与缝泄漏

```bash
# 某个"内部"符号被多少外部调用方穿透 —— 扇入越大，封装越漏
codegraph callers <internal.Symbol> --json | jq '[.[].file] | unique | length'

# 一个模块对外依赖多广 —— 扇出大 = 浅包装嫌疑
codegraph callees <module.Entry> --json

# 跨层调用：handler 直接够到 repository，绕过 service
codegraph explore "handler 层如何访问数据库"
```

把「读几十个文件后的印象」换成可复核的数字。报告里引用具体的调用方文件列表，而不是「感觉耦合较重」。

### go-fast：并行波次冲突判定

白名单 glob 不相交只保证文件不冲突，保证不了语义不冲突。两片同波前额外验一次：

```bash
codegraph impact <片A要改的核心符号> --json > /tmp/a.json
codegraph impact <片B要改的核心符号> --json > /tmp/b.json
# 影响面有交集 → 不要同波，改串行
```

这补的是文档自述的「glob 不相交奖励复制粘贴共享逻辑」那个洞。

### code-reviewer L7：产品表面可达性

```bash
# 服务端有这个 handler，前端到底有没有入口
codegraph callers <HandlerFunc>
# 无调用方 + 无路由注册 → 「能力无入口」候选
```

**注意**：路由常靠字符串注册或反射装配，图可能看不见这条边。**图的"没找到"不能证明"不存在"**，要下 MISSING 结论必须用 rg 复核路由表。

### requirement-fit：需求锚点定位

```bash
codegraph query <业务术语的英文模块名> --json --limit 20
codegraph explore "<需求描述> 的实现路径"
```

比全仓通读快得多，但仍要按 requirement-fit 的判据打开「入口到持久化/外部调用」的最短路径确认能真完成。

## 故障处理

| 症状 | 处理 |
|---|---|
| `CodeGraph not initialized` | 在仓库根跑 `codegraph init` |
| 索引慢 | 确认 `node_modules`、`dist`、`vendor` 已被排除；加 `--quiet` |
| `database is locked` | `codegraph status` 看 `Journal:` 是否为 `wal`；非 wal 说明在网络盘/WSL2 `/mnt` 上，把仓库移到本地磁盘 |
| 符号缺失 | `codegraph sync`；确认文件语言受支持且不在 `.gitignore` 或默认排除目录里 |
| 索引被锁死 | `codegraph unlock` |
| WSL2 下 MCP `Transport closed` | 设 `CODEGRAPH_NO_DAEMON=1`，或把仓库移到 Linux 原生文件系统 |
| Windows 与 WSL 共用一个 checkout | 给其中一侧设 `CODEGRAPH_DIR=.codegraph-win`，两边不要共用同一个 `.codegraph/` |

## 收益预期（别照搬厂商数字）

厂商自测称大仓上 token 与工具调用大幅下降；第三方评测方向一致但幅度不同。可靠的判断只有：

- **收益随仓库规模和耦合度增长**，< 100 文件基本是负收益。
- **只在结构性问题上省**（调用链、影响面、符号定位）；模糊语义检索上它不如直接读文件。
- 索引维护有成本，无人值守流程还要加新鲜度门——**这是有代价的加速，不是免费的**。
