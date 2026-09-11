# go-zero / goctl（绝对红线）

目标仓**使用 go-zero**（见下方判定）时，下列为 go-fast **绝对红线**，不可被项目 rule、快捷补丁或「先改再生成」绕过。

## 判定（任一成立 → 启用本红线）

- `go.mod` 依赖 `github.com/zeromicro/go-zero`
- 存在 `*.api` + goctl 生成的 handler/logic 布局
- 仓内文档 / `.cursor/rules` 声明 go-zero

## 绝对红线（原文口径）

1. **一定要遵守 goctl 的使用规范**（改契约从 `*.api` / 模板配置走 goctl，不手搓生成物）。  
2. **严禁手动修改** goctl 产物中的 **`types.go`** 与 **`routes.go`**。  
3. **不能给 goctl 的产物文件打补丁**（含：直接编辑、sed/脚本改生成文件、为过编译在生成物上贴 hotfix、手改后再 pretend 已 goctl）。  

正确路径：改 `.api`（或官方允许的输入）→ **重新 goctl 生成** → 只在 **非生成** 的 logic/自定义层写业务。

## 开工 / 派发

- 认栈命中 go-zero → 回传 `stack.go_zero: true`；implementer 模板必须粘贴本节「绝对红线」三条。  
- 白名单若误含须手改的 `types.go`/`routes.go` → **改白名单或改工单**，禁止派「修补 types/routes」片。  
- 合并门 / diff：若本批出现对 goctl 产物 `types.go`/`routes.go`（及其他已识别生成物）的手改 → 该片 **不可合入**，`BLOCKED` 或打回重做。

## 与 code-reviewer

同尺见 [batch-fix-workflow.md](../../code-reviewer/references/batch-fix-workflow.md)「栈附录：Go / go-zero」。CR 发现手改生成物 → **P0**，修法是回滚生成物并从 `.api` 再生，不是继续打补丁。
