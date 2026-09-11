# Friction Catalog（架构摩擦类型）

探索时按类型记笔记；每条候选应对准**一类主摩擦**（可附带次要）。

## F1 · Shallow module

**信号**：interface 几乎镜像 implementation；大量透传；一层函数只调下一层同名函数。

**加深方向**：合并包装进一个 deep module；缩小对外 interface；内部细节不再导出。

**Deletion test**：删浅包装后，调用方是否只面对一个更稳的 interface？

## F2 · Seam leakage

**信号**：本应在缝后的类型/错误/协议细节漏到调用方；跨包 import 实现细节；「抽象」仍强迫知道存储/HTTP 形状。

**加深方向**：缝上只暴露域概念；泄漏类型下沉到 adapter；调用方只依赖 interface。

## F3 · 无 locality 的「可测纯函数」

**信号**：为单测抽出一堆纯函数，编排仍在难测的上帝函数里；生产 bug 出在编排而非纯函数。

**加深方向**：把编排收进 deep module；测试打编排 interface；纯函数降为 implementation 细节（可测可不测）。

## F4 · 散射的同一概念

**信号**：理解「下单/计费/权限」要打开 5+ 小文件；命名重复（FooService/FooHelper/FooUtils/FooManager）。

**加深方向**：按域概念收敛为一个 module；删除重复浅名；CONTEXT 词条对齐。

## F5 · 假想缝 / 单 adapter

**信号**：ports & adapters 齐全但只有一个真实 adapter；测试也不替换；接口为将来预留而变宽。

**加深方向**：删假缝，先 deep in-process module；等出现第二个 adapter 再开缝。

## F6 · 难测的宽 interface

**信号**：测一个行为要 mock 十几个依赖；构造 fixture 成本高于实现；测试只打到浅包装。

**加深方向**：缩小 interface；把可替换依赖收到缝后；测试面 = 加深后的 interface。

## F7 · 循环 / 双向泄漏

**信号**：A 与 B 互相 import 实现；「工具包」依赖业务包。

**加深方向**：定单向 seam；共享概念上提为更小的 deep module；或合并成一个 module（若本不该分）。

## F8 · ADR 过时摩擦

**信号**：现行结构符合旧 ADR，但日常改动成本已证明决策代价过高。

**加深方向**：候选标 ADR callout；grilling 决定重开 ADR 或接受代价。勿默默违反 ADR。

---

## 不要当成架构候选

| 现象 | 去哪 |
|------|------|
| stub/mock 假成功、半成品入口 | code-reviewer |
| 文档缺失/漂移 | docs-reviewer |
| 页头/空态/CRUD 壳不一致 | ui-ux-reviewer |
| 仅目录命名不雅、无 depth 收益 | 忽略或 P2 备注，不进 HTML 主卡 |

## 候选数量纪律

- **候选卡 3～7**（整仓/单模块同）；Top 1 必须 Strong 或最强的 Worth exploring
- **摩擦证据池**：不设上限；命中即列，禁止「举几个例子」
- Speculative ≤ 候选卡总数 1/3；证据弱则进备忘或丢掉，勿占候选配额
- **禁止**只交 3 张候选交差且摩擦证据池为空（除非 explore 已写明穷尽自检：范围内无更多 polish_safe 摩擦）
