# Architecture Vocabulary

报告与 grilling **只用**下列术语。中文可解释，但名词保持英文原词。

## 核心词

| Term | 用 | 禁用替词 |
|------|----|----------|
| **module** | 有 interface + implementation 的职责单元 | component, service, unit（当 module 讲时） |
| **interface** | 外部调用该 module 的表面；也是测试面 | API, signature, façade（随意混用） |
| **implementation** | interface 背后的细节 | internals（可偶用，优先 implementation） |
| **depth / deep / shallow** | 实现重、接口轻 = deep；接口≈实现 = shallow | complex/simple 单独当结论 |
| **seam** | 可替换一侧的接缝 | boundary, layer |
| **adapter** | 缝一侧的具体实现 | wrapper（当 adapter 讲时） |
| **leverage** | 一 interface，多 call site | reuse, DRY（空泛） |
| **locality** | 相关逻辑/缺陷集中一处 | cohesion（可提，优先 locality） |

## 原则

### 1. Deletion test

对疑似 shallow 的 module 问：删掉它，复杂度是**浓缩**到别处，还是**只是搬家**？

- 浓缩 → 值得加深（把包装吃进 deep module）
- 只搬家 → 不是加深机会，可能只是错误拆分

### 2. Interface = test surface

加深后：测试应打在 deepened module 的 **interface** 上，而不是穿过一串浅包装函数。

### 3. Adapter 计数

| 适配器数 | 含义 |
|----------|------|
| 0～1 | 多为假想缝；勿为「将来」保留空 seam |
| ≥2（如 HTTP + in-memory） | 真缝；值得保留并画进 after 图 |

### 4. Leverage vs 过早抽象

- **Leverage**：已有多个 call site 受益于同一 interface → 加深/抽 seam 有回报
- **过早**：只有一个 call site 却先做 ports & adapters → 标 Speculative 或丢掉

## 句式（照抄风格）

- "Order intake module is shallow — interface nearly matches the implementation."
- "Pricing leaks across the seam."
- "Deepen: one interface, one place to test."
- "Two adapters justify the seam: HTTP in prod, in-memory in tests."

## Wins 写法

每条 ≤6 个英文词或 ≤12 个汉字，且点名 glossary：

- ✅ `locality: bugs concentrate in one module`
- ✅ `leverage: one interface, N call sites`
- ✅ `interface shrinks; implementation absorbs wrappers`
- ❌ `easier to maintain` / `cleaner code` / `more modular`

## 依赖类别标签（候选徽章）

| 标签 | 含义 |
|------|------|
| `in-process` | 同进程内 module 边界 |
| `local-substitutable` | 可本地替换（文件/内存）而无 IO 契约 |
| `ports & adapters` | 真端口；≥2 adapters |
| `mock` | 仅测试侧 adapter（证明缝，不进生产拓扑） |
