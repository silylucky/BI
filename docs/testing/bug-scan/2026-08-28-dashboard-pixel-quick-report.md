# Bug 扫描报告 — dashboard / pixelCanvas（quick）

| 字段 | 值 |
|------|-----|
| 日期 | 2026-08-28 |
| Skill | `vitalspan-auto-test` |
| Scope | dashboard · pixelCanvas · collision |
| Depth | quick |
| Mode | report-only |
| Anchor | `project-grounded-review` pixel-size 收口 · collisionLayout 域 |

---

## 1. Verdict

**GREEN**（本 scope targeted 套件）

| 套件 | 结果 | 计数 |
|------|------|------|
| collisionLayout.test.ts | ✅ | 见下 |
| PixelCanvas.test.ts | ✅ | 见下 |

---

## 2. 执行命令

```bash
cd fe && npx vitest run src/components/dashboard/pixelCanvas/collisionLayout.test.ts src/components/dashboard/pixelCanvas/PixelCanvas.test.ts --reporter=dot
```

```
Test Files  2 passed (2)
Tests       77 passed (77)
Duration    ~12.6s
```

---

## 3. 失败聚类

无（本 scope 无 FAIL）。

---

## 4. 样本失败

N/A

---

## 5. 未扫描（刻意）

| 套件 | 原因 |
|------|------|
| 全仓 `pnpm test` | 用户未要求 ci depth |
| Playwright resize e2e | BROWSER；truth 文档 T1 |
| `pnpm build` | 非本 scope |

---

## 6. 交接建议

- 用户规则「仅宽高变才 remeasure」→ 主路径单测绿 ≠ 产品 REAL
- 建议：`feature-truth-verify` BROWSER 或扩 `e2e/data-screen-resize-content.spec.ts`
- 全仓 CI 红 → 见 [`2026-08-27-full-ci-baseline-report.md`](2026-08-27-full-ci-baseline-report.md)

---

## 7. 修后复扫

```
/vitalspan-auto-test scope=dashboard/pixelCanvas depth=quick
```

对比 §1 计数应仍 77/77 或增加回归用例数。
