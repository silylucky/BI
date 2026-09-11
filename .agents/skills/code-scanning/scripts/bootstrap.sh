#!/usr/bin/env bash
# code-scanning bootstrap (macOS / Linux)
# 幂等：可重复执行。安装 ast-grep + codegraph，并在当前仓库初始化。
set -uo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

WITH_CODEGRAPH=1
WITH_MCP=0
CHECK_ONLY=0
FORCE_INDEX=0

for arg in "$@"; do
  case "$arg" in
    --no-codegraph) WITH_CODEGRAPH=0 ;;
    --mcp)          WITH_MCP=1 ;;
    --check)        CHECK_ONLY=1 ;;
    --force-index)  FORCE_INDEX=1 ;;
    -h|--help)
      sed -n '2,6p' "${BASH_SOURCE[0]}"
      echo "参数: --no-codegraph | --mcp | --check | --force-index"
      exit 0 ;;
    *) echo "未知参数: $arg（用 --help 查看）" >&2; exit 2 ;;
  esac
done

say()  { printf '%s\n' "$*"; }
ok()   { printf '  [ok]   %s\n' "$*"; }
warn() { printf '  [warn] %s\n' "$*"; }
fail() { printf '  [FAIL] %s\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }

say "仓库: $REPO_ROOT"
cd "$REPO_ROOT" || exit 1

# ---------- 规模探测 ----------
SRC_COUNT=$(git ls-files 2>/dev/null | grep -Ec '\.(go|ts|tsx|js|jsx|vue|py|rs|java|kt|rb|php|cs|swift|c|cc|cpp|h|hpp|scala|dart|ex|exs)$' || true)
SRC_COUNT=${SRC_COUNT:-0}
say "源文件数: $SRC_COUNT"
if [ "$SRC_COUNT" -gt 0 ] && [ "$SRC_COUNT" -lt 100 ] && [ "$WITH_CODEGRAPH" -eq 1 ]; then
  warn "小仓（<100 源文件）：codegraph 索引维护成本可能高于收益，考虑 --no-codegraph"
fi

# ---------- 探测 ----------
say ""
say "== 探测 =="
have ast-grep  && ok "ast-grep  $(ast-grep --version 2>/dev/null)" || warn "ast-grep 未安装"
have codegraph && ok "codegraph $(codegraph --version 2>/dev/null)" || warn "codegraph 未安装"
[ -f sgconfig.yml ] && ok "sgconfig.yml 已存在" || warn "sgconfig.yml 缺失"
[ -d .codegraph ]   && ok ".codegraph/ 已存在" || warn ".codegraph/ 缺失"

if [ "$CHECK_ONLY" -eq 1 ]; then
  say ""
  say "--check：只探测，未做任何改动。"
  exit 0
fi

# ---------- 安装 ast-grep ----------
say ""
say "== 安装 ast-grep =="
if have ast-grep; then
  ok "已安装，跳过"
else
  if have brew; then
    brew install ast-grep
  elif have cargo; then
    cargo install ast-grep --locked
  elif have npm; then
    npm install -g @ast-grep/cli
  elif have pip3; then
    pip3 install --user ast-grep-cli
  else
    fail "找不到 brew / cargo / npm / pip3，无法自动安装 ast-grep"
    fail "手动安装: https://ast-grep.github.io/guide/quick-start.html"
  fi
  have ast-grep && ok "ast-grep 安装完成" || fail "ast-grep 安装失败"
fi

# ---------- 安装 codegraph ----------
# 优先 npm：registry 比 GitHub raw/install.sh 更稳（curl 常见 SSL/超时失败）
if [ "$WITH_CODEGRAPH" -eq 1 ]; then
  say ""
  say "== 安装 codegraph =="
  if have codegraph; then
    ok "已安装，跳过"
  else
    if have npm; then
      npm install -g @colbymchenry/codegraph
    elif have curl; then
      warn "无 npm，回退到官方 install.sh"
      curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh
    else
      fail "找不到 npm / curl，无法自动安装 codegraph"
    fi
    # npm 全局 bin 与 curl 安装器 (~/.local/bin) 当前 shell 未必已在 PATH
    if ! have codegraph; then
      NPM_BIN="$(npm prefix -g 2>/dev/null)/bin"
      export PATH="${NPM_BIN:+$NPM_BIN:}$HOME/.local/bin:$PATH"
    fi
    have codegraph && ok "codegraph 安装完成" || fail "codegraph 安装失败（可能需要重开终端让 PATH 生效）"
  fi
fi

# ---------- 落 ast-grep 配置与规则 ----------
say ""
say "== 初始化 ast-grep =="
mkdir -p .ast-grep/rules

# 只拷贝仓库实际用到的语言规则，避免噪音
copy_rule() {  # $1=规则文件名 $2..=触发用的文件后缀
  local rule="$1"; shift
  local hit=0 ext
  for ext in "$@"; do
    if git ls-files 2>/dev/null | grep -q "\\.${ext}\$"; then hit=1; break; fi
  done
  if [ "$hit" -eq 1 ]; then
    if [ -f ".ast-grep/rules/$rule" ]; then
      ok "$rule 已存在，保留（不覆盖你的改动）"
    else
      cp "$SKILL_DIR/rules/$rule" ".ast-grep/rules/$rule" && ok "$rule 已落地"
    fi
  fi
}

copy_rule go-stub.yml         go
copy_rule go-reliability.yml  go
copy_rule go-hardcode.yml     go
copy_rule python-stub.yml        py
copy_rule python-reliability.yml py
copy_rule python-hardcode.yml    py
copy_rule ts-stub.yml         ts tsx vue
copy_rule tsx-surface.yml     tsx
copy_rule js-stub.yml         js jsx mjs cjs
copy_rule jsx-surface.yml     jsx

if [ -z "$(ls -A .ast-grep/rules 2>/dev/null)" ]; then
  warn "起步规则包未覆盖本仓语言（当前带 Go / Python / TS / TSX / JS / JSX / Vue）"
  warn "参考 $SKILL_DIR/references/ast-grep-rules.md 为本仓语言写规则"
fi

HAS_VUE=0
git ls-files 2>/dev/null | grep -q '\.vue$' && HAS_VUE=1

if [ -f sgconfig.yml ]; then
  ok "sgconfig.yml 已存在，保留"
  grep -q '.ast-grep/rules' sgconfig.yml || warn "但它没有引用 .ast-grep/rules，请手工把该目录加进 ruleDirs"
  if [ "$HAS_VUE" -eq 1 ] && ! grep -q 'languageGlobs' sgconfig.yml; then
    warn "检测到 .vue 但 sgconfig.yml 没有 languageGlobs，.vue 不会被扫。手工补："
    warn "  languageGlobs:"
    warn "    typescript:"
    warn "      - \"*.vue\""
  fi
else
  cat > sgconfig.yml <<'YAML'
ruleDirs:
  - .ast-grep/rules
YAML
  if [ "$HAS_VUE" -eq 1 ]; then
    cat >> sgconfig.yml <<'YAML'

# .vue 按 TypeScript 解析。只覆盖 <script> 段——<template> 不是合法 TS，
# 解析成垃圾节点，模板里的问题请交给 ui-ux-reviewer / browser-reviewer。
languageGlobs:
  typescript:
    - "*.vue"
YAML
    ok "sgconfig.yml 已创建（含 .vue → typescript 映射）"
  else
    ok "sgconfig.yml 已创建"
  fi
fi

# 规则目录是整体加载的：任何一个规则文件解析失败，整次 scan 会一条都不跑。
if have ast-grep; then
  LOAD_ERR=$(ast-grep scan --json=compact /dev/null 2>&1 >/dev/null | head -5)
  if [ -n "$LOAD_ERR" ]; then
    fail "规则包加载失败——整个规则目录都不会生效："
    printf '%s\n' "$LOAD_ERR"
  else
    ok "规则包加载正常"
  fi
fi

# ---------- 初始化 codegraph ----------
if [ "$WITH_CODEGRAPH" -eq 1 ] && have codegraph; then
  say ""
  say "== 初始化 codegraph 索引 =="
  if [ -d .codegraph ] && [ "$FORCE_INDEX" -eq 0 ]; then
    ok "索引已存在，跑增量同步"
    codegraph sync
  else
    [ "$FORCE_INDEX" -eq 1 ] && codegraph index --force || codegraph init
  fi
  codegraph status

  if [ "$WITH_MCP" -eq 1 ]; then
    say ""
    say "== 接入 MCP（会改写 agent 配置）=="
    codegraph install --yes
    warn "需重启 agent 才会加载 MCP server"
  fi
fi

# ---------- gitignore ----------
say ""
say "== .gitignore =="
touch .gitignore
for entry in ".codegraph/" ".ast-grep/cache/"; do
  if grep -qxF "$entry" .gitignore; then
    ok "$entry 已忽略"
  else
    printf '%s\n' "$entry" >> .gitignore && ok "$entry 已加入 .gitignore"
  fi
done
ok "sgconfig.yml 与 .ast-grep/rules/ 应当提交（规则是团队资产）"

# ---------- smoke ----------
say ""
say "== smoke =="
if have ast-grep && [ -f sgconfig.yml ]; then
  # 注意：有 error 级 finding 时 ast-grep 退出码为 1，属正常结果
  COUNT=$(ast-grep scan --json=compact 2>/dev/null | grep -o '"ruleId"' | wc -l | tr -d ' ')
  ok "ast-grep 可用，起步规则命中 ${COUNT:-0} 处（命中不等于都要修，需人工分级）"
fi
if [ "$WITH_CODEGRAPH" -eq 1 ] && have codegraph && [ -d .codegraph ]; then
  ok "codegraph 可用：codegraph explore \"<问题>\" / callers <符号> / impact <符号>"
fi

say ""
say "完成。查图前先跑 codegraph status 确认索引新鲜度。"
