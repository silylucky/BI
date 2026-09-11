# code-scanning bootstrap (Windows PowerShell)
# 幂等：可重复执行。安装 ast-grep + codegraph，并在当前仓库初始化。
param(
  [switch]$NoCodegraph,
  [switch]$Mcp,
  [switch]$Check,
  [switch]$ForceIndex
)

$ErrorActionPreference = 'Continue'

# 兼容 sh 版的写法：--no-codegraph / --mcp / --check / --force-index
foreach ($a in $args) {
  switch ($a) {
    '--no-codegraph' { $NoCodegraph = $true }
    '--mcp'          { $Mcp = $true }
    '--check'        { $Check = $true }
    '--force-index'  { $ForceIndex = $true }
  }
}

$SkillDir = Split-Path -Parent $PSScriptRoot
$RepoRoot = (git rev-parse --show-toplevel 2>$null)
if (-not $RepoRoot) { $RepoRoot = (Get-Location).Path }
$RepoRoot = $RepoRoot -replace '/', '\'

function Say  ($m) { Write-Host $m }
function Ok   ($m) { Write-Host "  [ok]   $m" }
function Warn ($m) { Write-Host "  [warn] $m" -ForegroundColor Yellow }
function Fail ($m) { Write-Host "  [FAIL] $m" -ForegroundColor Red }
function Have ($c) { [bool](Get-Command $c -ErrorAction SilentlyContinue) }

Say "仓库: $RepoRoot"
Set-Location $RepoRoot

# ---------- 规模探测 ----------
$exts = 'go','ts','tsx','js','jsx','vue','py','rs','java','kt','rb','php','cs','swift','c','cc','cpp','h','hpp','scala','dart'
$tracked = @(git ls-files 2>$null)
$srcCount = @($tracked | Where-Object { $ext = [IO.Path]::GetExtension($_).TrimStart('.'); $exts -contains $ext }).Count
Say "源文件数: $srcCount"
if ($srcCount -gt 0 -and $srcCount -lt 100 -and -not $NoCodegraph) {
  Warn "小仓（<100 源文件）：codegraph 索引维护成本可能高于收益，考虑 -NoCodegraph"
}

# ---------- 探测 ----------
Say ""
Say "== 探测 =="
if (Have 'ast-grep')  { Ok "ast-grep  $(ast-grep --version)" }  else { Warn "ast-grep 未安装" }
if (Have 'codegraph') { Ok "codegraph $(codegraph --version)" } else { Warn "codegraph 未安装" }
if (Test-Path 'sgconfig.yml') { Ok "sgconfig.yml 已存在" } else { Warn "sgconfig.yml 缺失" }
if (Test-Path '.codegraph')   { Ok ".codegraph\ 已存在" }    else { Warn ".codegraph\ 缺失" }

if ($Check) {
  Say ""
  Say "-Check：只探测，未做任何改动。"
  exit 0
}

# ---------- 安装 ast-grep ----------
Say ""
Say "== 安装 ast-grep =="
if (Have 'ast-grep') {
  Ok "已安装，跳过"
} else {
  if     (Have 'winget') { winget install --id ast-grep.ast-grep --accept-package-agreements --accept-source-agreements }
  elseif (Have 'scoop')  { scoop install main/ast-grep }
  elseif (Have 'npm')    { npm install -g '@ast-grep/cli' }
  elseif (Have 'cargo')  { cargo install ast-grep --locked }
  else   { Fail "找不到 winget / scoop / npm / cargo，无法自动安装 ast-grep" }
  # 新装的命令未必在当前进程 PATH 里
  $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
  if (Have 'ast-grep') { Ok "ast-grep 安装完成" } else { Fail "ast-grep 安装失败（可能需重开终端让 PATH 生效）" }
}

# ---------- 安装 codegraph ----------
# 优先 npm：registry 比 GitHub raw/install.ps1 更稳
if (-not $NoCodegraph) {
  Say ""
  Say "== 安装 codegraph =="
  if (Have 'codegraph') {
    Ok "已安装，跳过"
  } else {
    if (Have 'npm') {
      npm install -g '@colbymchenry/codegraph'
    } else {
      try {
        Warn "无 npm，回退到官方 install.ps1"
        Invoke-RestMethod https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.ps1 | Invoke-Expression
      } catch {
        Fail "找不到 npm，且官方安装脚本失败: $_"
      }
    }
    $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
    if (-not (Have 'codegraph') -and (Have 'npm')) {
      $npmBin = (npm prefix -g 2>$null)
      if ($npmBin) { $env:Path = (Join-Path $npmBin 'bin') + ';' + (Join-Path $npmBin '') + ';' + $env:Path }
    }
    if (Have 'codegraph') { Ok "codegraph 安装完成" } else { Fail "codegraph 安装失败（可能需重开终端让 PATH 生效）" }
  }
}

# ---------- 落 ast-grep 配置与规则 ----------
Say ""
Say "== 初始化 ast-grep =="
New-Item -ItemType Directory -Force -Path '.ast-grep\rules' | Out-Null

function Copy-Rule($rule, [string[]]$extList) {
  $hit = $tracked | Where-Object { $e = [IO.Path]::GetExtension($_).TrimStart('.'); $extList -contains $e } | Select-Object -First 1
  if (-not $hit) { return }
  $dest = ".ast-grep\rules\$rule"
  if (Test-Path $dest) {
    Ok "$rule 已存在，保留（不覆盖你的改动）"
  } else {
    Copy-Item (Join-Path $SkillDir "rules\$rule") $dest
    Ok "$rule 已落地"
  }
}

Copy-Rule 'go-stub.yml'            @('go')
Copy-Rule 'go-reliability.yml'     @('go')
Copy-Rule 'go-hardcode.yml'        @('go')
Copy-Rule 'python-stub.yml'        @('py')
Copy-Rule 'python-reliability.yml' @('py')
Copy-Rule 'python-hardcode.yml'    @('py')
Copy-Rule 'ts-stub.yml'            @('ts','tsx','vue')
Copy-Rule 'tsx-surface.yml'        @('tsx')
Copy-Rule 'js-stub.yml'            @('js','jsx','mjs','cjs')
Copy-Rule 'jsx-surface.yml'        @('jsx')

if (-not (Get-ChildItem '.ast-grep\rules' -ErrorAction SilentlyContinue)) {
  Warn "起步规则包未覆盖本仓语言（当前带 Go / Python / TS / TSX / JS / JSX / Vue）"
  Warn "参考 $SkillDir\references\ast-grep-rules.md 为本仓语言写规则"
}

$hasVue = [bool]($tracked | Where-Object { $_ -like '*.vue' } | Select-Object -First 1)

if (Test-Path 'sgconfig.yml') {
  Ok "sgconfig.yml 已存在，保留"
  if (-not (Select-String -Path 'sgconfig.yml' -Pattern '\.ast-grep/rules' -Quiet)) {
    Warn "但它没有引用 .ast-grep/rules，请手工把该目录加进 ruleDirs"
  }
  if ($hasVue -and -not (Select-String -Path 'sgconfig.yml' -Pattern 'languageGlobs' -Quiet)) {
    Warn "检测到 .vue 但 sgconfig.yml 没有 languageGlobs，.vue 不会被扫。手工补："
    Warn "  languageGlobs:"
    Warn "    typescript:"
    Warn "      - `"*.vue`""
  }
} else {
  $cfg = "ruleDirs:`n  - .ast-grep/rules`n"
  if ($hasVue) {
    $cfg += @"

# .vue 按 TypeScript 解析。只覆盖 <script> 段——<template> 不是合法 TS，
# 解析成垃圾节点，模板里的问题请交给 ui-ux-reviewer / browser-reviewer。
languageGlobs:
  typescript:
    - "*.vue"
"@
    Ok "sgconfig.yml 已创建（含 .vue → typescript 映射）"
  } else {
    Ok "sgconfig.yml 已创建"
  }
  $cfg | Set-Content -Path 'sgconfig.yml' -Encoding utf8
}

# 规则目录是整体加载的：任何一个规则文件解析失败，整次 scan 会一条都不跑。
if (Have 'ast-grep') {
  $loadErr = (ast-grep scan --json=compact $null 2>&1 | Select-Object -First 5 | Out-String).Trim()
  if ($loadErr) {
    Fail "规则包加载失败——整个规则目录都不会生效："
    Write-Host $loadErr
  } else {
    Ok "规则包加载正常"
  }
}

# ---------- 初始化 codegraph ----------
if (-not $NoCodegraph -and (Have 'codegraph')) {
  Say ""
  Say "== 初始化 codegraph 索引 =="
  if ((Test-Path '.codegraph') -and -not $ForceIndex) {
    Ok "索引已存在，跑增量同步"
    codegraph sync
  } elseif ($ForceIndex) {
    codegraph index --force
  } else {
    codegraph init
  }
  codegraph status

  if ($Mcp) {
    Say ""
    Say "== 接入 MCP（会改写 agent 配置）=="
    codegraph install --yes
    Warn "需重启 agent 才会加载 MCP server"
  }
}

# ---------- gitignore ----------
Say ""
Say "== .gitignore =="
if (-not (Test-Path '.gitignore')) { New-Item -ItemType File -Path '.gitignore' | Out-Null }
$gi = Get-Content '.gitignore' -ErrorAction SilentlyContinue
foreach ($entry in @('.codegraph/', '.ast-grep/cache/')) {
  if ($gi -contains $entry) {
    Ok "$entry 已忽略"
  } else {
    Add-Content '.gitignore' $entry
    Ok "$entry 已加入 .gitignore"
  }
}
Ok "sgconfig.yml 与 .ast-grep/rules/ 应当提交（规则是团队资产）"

# ---------- smoke ----------
Say ""
Say "== smoke =="
if ((Have 'ast-grep') -and (Test-Path 'sgconfig.yml')) {
  # 注意：有 error 级 finding 时 ast-grep 退出码为 1，属正常结果
  $out = (ast-grep scan --json=compact 2>$null) -join ''
  $count = ([regex]::Matches($out, '"ruleId"')).Count
  Ok "ast-grep 可用，起步规则命中 $count 处（命中不等于都要修，需人工分级）"
}
if (-not $NoCodegraph -and (Have 'codegraph') -and (Test-Path '.codegraph')) {
  Ok "codegraph 可用：codegraph explore `"<问题>`" / callers <符号> / impact <符号>"
}

Say ""
Say "完成。查图前先跑 codegraph status 确认索引新鲜度。"
