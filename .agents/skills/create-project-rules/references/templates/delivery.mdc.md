---
description: 交付门禁（指针 release-package / deploy-dev；禁无版本裸交付）
alwaysApply: true
---

# 交付门禁

本文件**不写**打包命令与 S3 步骤（避免与发布技能重复）。

| 事项 | 真源 |
|------|------|
| 编译顺序、打 zip/tar、上传制品 | 仓内 `scripts/release.sh` + 姊妹 skill **release-package** + 仓库 `.dev` `release:` |
| 演示/开发机部署 | **deploy-dev** + 仓库 `.dev` deploy 字段 |
| 本项目运行/走查环境地图与 release 登记 | 仓库 `.dev/`（**create-dev-config**） |
| 外部集成验真（SSH / S3 / DB / LDAP / OAuth / 日志·Trace） | 家目录 `$HOME/.dev/`（**create-home-dev**）；只引用选源，**不**把台账复制进仓 |
| 功能验收规格 | `docs/automate/prd*`（**create-evolution-prd**） |

## 红线

- **禁止**无版本号、无产物清单的手工拷贝二进制冒充生产交付
- **禁止**生产对象存储 AK/SK 写入仓库或任一 `.dev` 的 yaml 明文
- 外部 smoke / 集成验真：先查 `$HOME/.dev`，再对齐仓库 `.dev` `integrations` 的变量名；缺台账 → create-home-dev / create-dev-config，禁止编造端点
- 宣称可交付前：约定测试/smoke 通过、无假绿、迁移可重放
- `docs/service` 或发布说明须含**如何回滚上一版本产物**
- 对外发制品需依赖可追溯时：走 release 流水线产出清单/SBOM，禁止无清单外发

需要执行打包/上传时：改用 release-package，不要在本规则里发明第二套脚本约定。
