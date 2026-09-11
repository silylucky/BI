from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.auth_integration import router as auth_integration_router
from app.api.v1.column_masks import router as column_masks_router
from app.api.v1.audit import router as audit_router
from app.api.v1.datasources import router as datasources_router
from app.api.v1.charts import router as charts_router
from app.api.v1.dashboards import router as dashboards_router
from app.api.v1.dashboard_templates import router as dashboard_templates_router
from app.api.v1.viz_components import router as viz_components_router
from app.api.v1.designer import router as designer_router
from app.api.v1.gov import router as gov_router
from app.api.v1.nfr import router as nfr_router
from app.api.v1.query import router as query_router
from app.api.v1.query_configs import router as query_configs_router
from app.api.v1.ingestion import router as ingestion_router
from app.api.v1.me import router as me_router
from app.api.v1.metadata import router as metadata_router
from app.api.v1.orgs import router as orgs_router
from app.api.v1.permissions import router as permissions_router
from app.api.v1.resource_grants import router as resource_grants_router
from app.api.v1.rls import router as rls_router
from app.api.v1.roles import router as roles_router
from app.api.v1.users import router as users_router
from app.api.v1.views import role_defaults_router, router as views_router, user_views_router
from app.api.v1.workno import router as workno_router
from app.api.v1.services import router as services_router
from app.api.v1.integration_bus import router as integration_bus_router
from app.api.v1.reports.export import router as reports_export_router
from app.api.v1.reports import router as reports_router
from app.api.v1.datasets import router as datasets_router
from app.api.v1.demo_package import router as demo_package_router
from app.api.v1.embed import router as embed_router
from app.api.v1.stats import router as stats_router
from app.api.v1.ai_viz import router as ai_viz_router
from app.api.v1.platform_delivery import router as platform_delivery_router
from app.api.v1.tile_services import router as tile_services_router
from app.api.v1.agent import router as agent_router

api_v1_router = APIRouter()
api_v1_router.include_router(me_router)
api_v1_router.include_router(auth_router)
api_v1_router.include_router(auth_integration_router)
api_v1_router.include_router(column_masks_router)
api_v1_router.include_router(ingestion_router)
api_v1_router.include_router(datasources_router)
api_v1_router.include_router(query_router)
api_v1_router.include_router(query_configs_router)
api_v1_router.include_router(charts_router)
api_v1_router.include_router(dashboards_router)
api_v1_router.include_router(dashboard_templates_router)
api_v1_router.include_router(demo_package_router)
api_v1_router.include_router(viz_components_router)
api_v1_router.include_router(designer_router)
api_v1_router.include_router(gov_router)
api_v1_router.include_router(nfr_router)
api_v1_router.include_router(roles_router)
api_v1_router.include_router(permissions_router)
api_v1_router.include_router(orgs_router)
api_v1_router.include_router(users_router)
api_v1_router.include_router(resource_grants_router)
api_v1_router.include_router(rls_router)
api_v1_router.include_router(audit_router)
api_v1_router.include_router(views_router)
api_v1_router.include_router(role_defaults_router)
api_v1_router.include_router(user_views_router)
api_v1_router.include_router(workno_router)
api_v1_router.include_router(metadata_router)
api_v1_router.include_router(datasets_router)
api_v1_router.include_router(services_router)
api_v1_router.include_router(integration_bus_router)
api_v1_router.include_router(reports_export_router)
api_v1_router.include_router(reports_router)
api_v1_router.include_router(embed_router)
api_v1_router.include_router(stats_router)
api_v1_router.include_router(ai_viz_router)
api_v1_router.include_router(platform_delivery_router)
api_v1_router.include_router(tile_services_router)
api_v1_router.include_router(agent_router)
