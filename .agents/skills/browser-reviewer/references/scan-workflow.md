# 扫描 / 走查执行工作流

## Phase 0 检查顺序

```
1. 定位仓根；确认 .dev/ 存在  
   - 不存在或缺必填 → **转 create-dev-config**，完成后再从本流程 Phase 0 继续
2. 读 config.yaml（或等价）；加载 secrets.env / password_env
3. 检查 .gitignore 对 .dev 的覆盖（密码跟踪 → P0）
4. curl/fetch base_url；失败则尝试 app.start（超时 ready_timeout_sec）
5. 探测浏览器后端：
   a. Cursor / MCP browser 工具可用？
   b. 否则 npx playwright / 仓内 e2e 脚本？
   c. 否则 Blind spot 中止走查（可仍输出 .dev 校验报告）
6. 写 Dev Card；创建 artifact 目录 .dev/walkthrough/YYYY-MM-DD/
7. **加载业务剧本**（顺序）：
   a. 用户指定路径
   b. `.dev/playbooks/<最新日期>/critical.md`
   c. `docs/qa/playbooks/<最新日期>/critical.md`
   d. 皆无 → 跑 scenario-playbook，或降级 walkthrough-playbook 并披露
```

## 浏览器后端约定

### A. MCP / IDE 浏览器（优先）

- 导航、点击、填表、截图、读 console（若工具提供）
- 每步截图存到 `artifact_dir/shots/<step-id>.png`
- 无原生 console API 时：用页面注入或 Playwright 补采，并披露

### B. Playwright 降级

最小脚本思路（Agent 可写在 artifact 目录临时跑，**不要**把密码写进仓库源码）：

```bash
# 示例：从环境变量读密码，不 echo
export DEV_ADMIN_PASSWORD  # 已由 Agent 从 .dev 注入到 shell env
npx playwright screenshot "$BASE_URL" shot.png   # 仅示意；完整走查用 node 脚本逐步操作
```

完整走查用 node + playwright：监听 `page.on('console')`、`page.on('response')`，写 `console.jsonl` / `network.jsonl`。

### C. 禁止

- 用截图 OCR 猜密码是否正确当唯一判据（应以 URL/选择器 success 为准）
- 把 `.dev` 密码写进 `scripts/` 提交到 git

## Console / 网络采集

| 事件 | 记录 | 分级 |
|------|------|------|
| console `error` | 文本+页面 URL+step | 默认 P0；第三方 allowlist 可降 |
| console `warning` | 同上 | 刷屏或业务相关 → P1；在 allowlist → 忽略 |
| response status ≥ 500 | url+status+step | P0（主路径）/ P1（次要） |
| response 4xx | 预期内（401 登录前）忽略；业务操作 404/422 未展示 UI → P1 |

`console.jsonl` 行格式：

```json
{"ts":"ISO","step":"W2.2","level":"error","text":"...","url":"https://..."}
```

## 截图命名

```
shots/S0-G0.2-login-ok.png
shots/S1-2-create-dialog.png
shots/S1-4-submit-FAIL.png
shots/W3.orders.1-list.png
```

优先用场景步 ID（`S1-2`）；降级通用幕仍用 `W*.*`。失败用 `-FAIL` 后缀，便于报告索引。

采集包一层证据层（工件进回传 `evidence.screenshots`）：

```bash
python3 ~/.agents/skills/_bin/evidence-run --slice <场景或路由 id> --phase screenshot \
  --label "<路由/态>" -- <落盘截图的命令或脚本>
```

无 baseline 的路由：截完顺手 `cp` 一份到 `.dev/baselines/_candidates/<route-slug>-<viewport>.png`，汇总进报告「待确认金样」。

## 勾选表生成提示（可交 subagent 只读生成）

**有业务剧本时：**

```
只读。项目根：{{ROOT}}
剧本路径：{{PLAYBOOK_CRITICAL_MD}}
将 critical.md 中 status=ready 的步骤展开为勾选表：
ID | 场景 | 步骤 | 路由 | 需要写操作(Y/N/needs_confirm) | 来源=playbook
blocked/draft 另表列出。
可选：剧本未覆盖的一级菜单补「进入+截图」行，来源=generic。
```

**无业务剧本（降级）时：**

```
只读。项目根：{{ROOT}}
前端路由/菜单候选路径：{{HINTS}}
输出 Markdown 勾选表：ID | 步骤 | 路由 | 域 | 需要写操作(Y/N) | 来源=generic
覆盖 walkthrough-playbook 幕 0–6；业务路由每条至少一行进入+截图。
排除 auth 回调与 redirect。
报告必须注明「无业务剧本」。
```

主 agent 拿勾选表后**亲自或串行**执行浏览器步骤（浏览器态难并行）；域很多时可「主 agent 走查 + 另一 agent 只做已截图的视觉读图」并行。

## 视觉并行

走查产生截图后，可开 readonly agent：

```
你只读截图文件，不操作浏览器。
金样：{{GOLDEN}}
待审：{{LIST_OF_SHOTS}}
按 visual-qa.md 的 A/B 出 findings（含截图路径）。
```

## 回归（修完后短跑）

1. 只重跑 fail 的 step ID + 同域邻页  
2. 对比新截图 vs 旧 FAIL 图  
3. 更新报告状态；密钥仍脱敏
