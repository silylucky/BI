# 好测试

配合主 Skill（go-fast）红绿循环。测试验的是**公共边界上的行为**，不是实现细节；实现可整页重写，测试应仍站住。示例用伪代码，落地时换成仓内测试框架。

## 好测试长什么样

- 测**调用方在乎的行为**，只走**已确认 seam**
- 内部重构后测试仍应稳定
- 名字像规格：`user can checkout with valid cart`，不写 `calls paymentService.process`
- 期望值来自规格或已知字面量，**不要**用与实现相同的算法现场算一遍

```text
测试：有效购物车可结账
  cart = 新建购物车
  cart.加入(商品)
  result = 结账(cart, 支付方式)
  断言 result.状态 == 已确认
```

## 多例同一行为

用表驱动 / parameterized（Jest `each`、pytest 参数化、Go `t.Run` 等），名称说清**行为**：

```text
用例表:
  - 名称: 整数元    输入: "12"   期望: 1200
  - 名称: 空串      输入: ""     期望: 错误
对每行: 跑解析(输入) → 比对期望
```

## 坏测试（避免）

### 实现耦合

```text
坏：断言 payment.mock 被调用 1 次
好：经公共 API 断言「订单已确认 / 可再次查询到」
```

测试因重构而红、行为未变 → 多半测到了内部。

### 同义反复

```text
坏:  want = items.reduce(sum+price);  assert Total(items) == want
好:  assert Total([{price:10},{price:5}]) == 15
```

### 绕过 seam 查库

优先：`Create` 后用同一公共边界的 `Get` / 查询 API 断言。只有仓储本身是确认过的 seam 时，才允许对测试库做状态断言。

## 跑法

- 每刀：只跑当前文件/用例，确认红/绿可见
- 避免用会掩盖失败的缓存（若工具有缓存开关，红绿确认时关掉）
