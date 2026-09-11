# 平台元数据 · 迁移与表域索引

> **定位**：Alembic revision → 主要表 → 后端域的导航图；**不是**列级 DDL 真理源。  
> **DDL 真源**：`backend/migrations/versions/` · 运行时 `alembic current` / `alembic history`；架构登记见 [arch.md](../arch.md) §4 目录与迁移节。  
> **域边界**：各表业务语义见 [services/README.md](../services/README.md)。

```yaml
alembic_head: 0064
revision_count: 63
migrations_path: backend/migrations/versions/
```

## 维护约定

| 时机 | 动作 |
|------|------|
| 新增 Alembic revision | 在本文件「修订一览」补一行；跨域大表变更更新「域 ↔ 表」节 |
| `alembic head` 变更 | 更新 frontmatter `alembic_head` |
| 文档评审 / arch-inspect | 核对 head 与 `docs/arch.md` §4 登记一致 |

## 当前 head

| 项 | 值 |
|----|-----|
| **Head revision** | `0064`（`0064_user_im_bindings_source_device_scan.py`） |
| **上一版** | `0062`（`0062_im_dingtalk_group_webhook.py`） |
| **主要新增** | 删除企业微信 IM 通道（绑定/平台对接 CHECK + 清数据） |

升级命令（本地）：

```bash
cd backend
alembic upgrade head
alembic current   # 应显示 0064
```

## 修订一览（按域分组）

| Rev | 文件（简） | 域 | 摘要 |
|-----|------------|-----|------|
| 0001 | `initial` | core | 基线 |
| 0002 | `ingestion_tables` | ingestion | 同步作业表 |
| 0003–0007 | `auth_*` | auth | 用户/组织/审计/维度组/RLS |
| 0008–0010 | `datasources_*` | datasources | 数据源表、软删、连接选项 |
| 0011–0012 | `chart_query_bindings*` | query | 图表直连绑定 |
| 0013 | `dashboards` | dashboard | 看板主表 |
| 0014 | `gov_catalog` | governance | 治理 catalog |
| 0015 | `meta_design_config` | metadata | 设计配置 JSON |
| 0016 | `dimension_dict` | metadata | 维度字典 |
| 0017–0018 | `auth_user_password` · `dev_demo_users` | auth | 密码列、开发演示用户 |
| 0019 | `dimension_theme_node` | metadata | 主题节点 |
| 0020 | `auth_user_profile` | auth | 用户资料字段 |
| 0021 | `term_physical_mappings` | metadata | 术语物理映射 |
| 0022 | `view_role_defaults` | views | 角色默认视图 |
| 0023 | `datasets_orm` | metadata | Dataset ORM |
| 0024–0025 | `auth_permission_*` | auth | 权限码与回填 |
| 0026 | `dashboard_templates` | dashboard | 可视化模板 |
| 0027 | `dashboard_surface_kind` | dashboard | 看板/大屏 surface |
| 0028 | `dashboard_thumbnail_ref` | dashboard | 缩略图引用 |
| 0029 | `viz_components` | viz | 组织组件库 |
| 0030 | `guomi_password_sm3_dev` | auth | 开发 SM3 密码迁移 |
| 0031 | `sync_job_incremental` | ingestion | 增量同步字段 |
| 0032 | `report_schedules_persistence` | reports | 调度/执行/导出 job 持久化（ADR-19） |
| 0033 | `dataset_sync_lineage` | metadata | Dataset 同步血缘 |
| 0034 | `report_metadata_persistence` | reports | 报表元数据 ORM（ADR-20） |
| 0035 | `dataset_table_source_datasource` | metadata | Dataset 表源数据源 |
| 0036 | `analyst_template_manage` | auth | 分析师模板权限 |
| 0037 | `sync_job_source_schema` | ingestion | 同步源 schema |
| 0038 | `view_user_override_persistence` | views | 用户视图覆盖 |
| 0039 | `entity_physical_embed_gov` | governance | 实体物理表/embed 治理 |
| 0040 | `report_artifact_owners` | reports | 产物 owner ACL |
| 0041 | `report_center_final` | reports | 报表中心 jobs/收藏/最近/投递审计/模板版本 |
| 0042 | `report_dismissed_failures` | reports | 调度失败提醒忽略 |
| 0043 | `ai_viz_artifacts` | viz | AI 可视化产物 |
| 0044 | `standard_analysis` | reports | 标准分析包持久化 |
| 0045 | `datasets_transform_rules` | metadata | Dataset 转换规则 |
| 0046 | `standard_schedule_source_key` | reports | 调度 `source_key`（标准分析投递） |
| 0047 | `user_im_bindings` | auth / reports | 用户 IM 账号绑定；调度 `notify_group` |
| 0048 | `platform_delivery_configs` | integration | 平台投递配置 |
| 0049 | `email_smtp_dual_slots` | integration | 双 SMTP 槽位 |
| 0050 | `standard_pack_dataset_retention` | reports | 分析包 dataset 绑定 + 快照保留期数 |
| 0051–0060 | `viz_tile_services` … `im_user_delegated_delivery` | viz/auth/integration | 瓦片服务 · RLS 列绑定 · Phase C · IM OAuth/投递 |
| 0061 | `model_reviewer_auth_fixes` | auth | org path / audit / user_roles 索引；resource_type CHECK；IM source CHECK |
| 0062 | `im_dingtalk_group_webhook` | reports | 钉钉 `delivery_mode=group_webhook` |
| 0063 | `drop_wecom_im_channel` | auth / reports | 删除企业微信绑定与平台对接通道 |
| 0064 | `user_im_bindings_source_device_scan` | auth | `source` CHECK 允许 `device`/`scan`（飞书 device-code 绑定） |

## 域 ↔ 主要表（导航）

| 域附录 | 后端模块 | 代表性表 / 存储 |
|--------|----------|-----------------|
| [auth.md](../services/auth.md) | `app/auth/` | `auth_users` · `auth_roles` · `auth_orgs` · `user_im_bindings` · `auth_audit_logs` · RLS 相关 |
| [datasources.md](../services/datasources.md) | `app/datasources/` | `datasources` |
| [ingestion.md](../services/ingestion.md) | `app/ingestion/` | `ingestion_sync_jobs` 等 |
| [metadata.md](../services/metadata.md) | `app/metadata/` | `datasets` · `dimension_*` · `meta_design_*` |
| [query.md](../services/query.md) | `app/query/` | `chart_query_bindings` · 配置 JSON store |
| [dashboard.md](../services/dashboard.md) | `app/dashboard/` | `dashboards` · `dashboard_templates` |
| [viz.md](../services/viz.md) | `app/viz/` | `viz_components` |
| [views.md](../services/views.md) | `app/views/` | 视图偏好/覆盖表 |
| [reports.md](../services/reports.md) | `app/reports/` | `report_schedules` · `report_catalog_*` · `report_jobs` · `report_integration_exports` |
| [governance.md](../services/governance.md) | `app/governance/` | `gov_catalog_*` · 实体物理/embed |
| [integration.md](../services/integration.md) | `app/integration/` | `report_integration_exports` · 进程内 companion store（部分） |

**平台库与业务库分离**（ADR-07）：上表均为**平台元库**（`DATABASE_URL`）；业务分析数据在各 `dataSourceId` 指向的外部库或 `ANALYTICS_DATABASE_URL` 托管库。

## 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 0.1.3 | 2026-09-01 | head 升至 0063；删除企业微信 IM |
| 0.1.1 | 2026-08-12 | head 升至 0046；补 0042–0046 修订行 |
| 0.1.0 | 2026-08-09 | 初版：head 0041、修订一览、域表导航 |
