import { describe, expect, it } from "vitest";
import {
  isAdminConstrainedRoute,
  isAdminDashboardBuilderRoute,
  isAdminDatasetFormRoute,
  isAdminDatasourceFormRoute,
  isAdminDatasourceDetailRoute,
  isAdminSyncJobFormRoute,
  isAdminListFillRoute,
  isAdminMaxWidthNoneRoute,
  isAdminScreenPreviewRoute,
  isAdminShareRoute,
  isAdminVizComponentEditRoute,
  isAdminWideScrollRoute,
} from "./admin-layout-routes";

describe("isAdminListFillRoute", () => {
  it("matches paginated list routes", () => {
    expect(isAdminListFillRoute("/admin/system/roles")).toBe(true);
    expect(isAdminListFillRoute("/admin/system")).toBe(true);
    expect(isAdminListFillRoute("/admin/system/users/")).toBe(true);
    expect(isAdminListFillRoute("/admin/system/rls")).toBe(true);
    expect(isAdminListFillRoute("/admin/system/orgs")).toBe(true);
    expect(isAdminListFillRoute("/admin/system/grants")).toBe(true);
    expect(isAdminListFillRoute("/admin/dashboards")).toBe(true);
    expect(isAdminListFillRoute("/admin/data-screens")).toBe(true);
    expect(isAdminListFillRoute("/admin/agent")).toBe(true);
    expect(isAdminListFillRoute("/admin/viz-templates")).toBe(true);
    expect(isAdminListFillRoute("/admin/viz-components")).toBe(true);
    expect(isAdminListFillRoute("/admin/reports/standard/results")).toBe(true);
    expect(isAdminListFillRoute("/admin/reports/standard/setup")).toBe(true);
    expect(isAdminListFillRoute("/admin/reports/center")).toBe(true);
    expect(isAdminListFillRoute("/admin/reports/schedules")).toBe(true);
    expect(isAdminListFillRoute("/admin/reports/templates")).toBe(true);
    expect(isAdminListFillRoute("/admin/reports/templates/node-1")).toBe(true);
  });

  it("does not match edit or detail routes", () => {
    expect(isAdminListFillRoute("/admin/dashboards/abc/edit")).toBe(false);
    expect(isAdminListFillRoute("/admin/viz-components/abc/edit")).toBe(false);
    expect(isAdminListFillRoute("/admin/datasources/new")).toBe(false);
    expect(isAdminListFillRoute("/admin/account/profile")).toBe(false);
  });
});

describe("isAdminWideScrollRoute", () => {
  it("matches report hub and detail routes not on fill list", () => {
    expect(isAdminWideScrollRoute("/admin/reports")).toBe(true);
    expect(isAdminWideScrollRoute("/admin/reports/view/node-1")).toBe(true);
    expect(isAdminWideScrollRoute("/admin/governance/tickets")).toBe(true);
    expect(isAdminWideScrollRoute("/admin/governance/publish")).toBe(true);
    expect(isAdminWideScrollRoute("/admin/designer")).toBe(true);
    expect(isAdminWideScrollRoute("/admin/metadata")).toBe(true);
    expect(isAdminWideScrollRoute("/admin/metadata/glossary")).toBe(true);
    expect(isAdminWideScrollRoute("/admin/themes/dash-1")).toBe(true);
    expect(isAdminWideScrollRoute("/admin/entities/overview")).toBe(true);
    expect(isAdminWideScrollRoute("/admin/ingestion/sync-jobs/j1/history")).toBe(true);
  });

  it("does not match fill list routes (fill takes precedence)", () => {
    expect(isAdminWideScrollRoute("/admin/reports/center")).toBe(false);
    expect(isAdminWideScrollRoute("/admin/reports/schedules")).toBe(false);
    expect(isAdminWideScrollRoute("/admin/reports/templates")).toBe(false);
    expect(isAdminWideScrollRoute("/admin/reports/templates/node-1")).toBe(false);
    expect(isAdminWideScrollRoute("/admin/reports/standard/results")).toBe(false);
    expect(isAdminWideScrollRoute("/admin/reports/standard/setup")).toBe(false);
  });

  it("does not match sync job form fill routes", () => {
    expect(isAdminWideScrollRoute("/admin/ingestion/sync-jobs/new")).toBe(false);
    expect(isAdminWideScrollRoute("/admin/ingestion/sync-jobs/j1/edit")).toBe(false);
    expect(isAdminWideScrollRoute("/admin/ingestion/sync-jobs/j1/etl-rules")).toBe(false);
  });

  it("does not match form routes or datasource list", () => {
    expect(isAdminWideScrollRoute("/admin/datasources")).toBe(false);
    expect(isAdminWideScrollRoute("/admin/datasources/new")).toBe(false);
    expect(isAdminWideScrollRoute("/admin/datasources/ds-1/edit")).toBe(false);
    expect(isAdminWideScrollRoute("/admin/account/profile")).toBe(false);
  });
});

describe("isAdminMaxWidthNoneRoute", () => {
  it("is true for all admin routes", () => {
    expect(isAdminMaxWidthNoneRoute("/admin/dashboards")).toBe(true);
    expect(isAdminMaxWidthNoneRoute("/admin/reports/center")).toBe(true);
    expect(isAdminMaxWidthNoneRoute("/admin/dashboards/d1/share")).toBe(true);
    expect(isAdminMaxWidthNoneRoute("/admin/account/profile")).toBe(true);
    expect(isAdminMaxWidthNoneRoute("/admin/ingestion/sync-jobs/new")).toBe(true);
    expect(isAdminMaxWidthNoneRoute("/admin/datasources/new")).toBe(true);
    expect(isAdminMaxWidthNoneRoute("/admin/datasets/d1/edit")).toBe(true);
    expect(
      isAdminMaxWidthNoneRoute("/admin/dashboards/d1/edit", { dashboardBuilder: true }),
    ).toBe(true);
  });

  it("is false for non-admin paths", () => {
    expect(isAdminMaxWidthNoneRoute("/login")).toBe(false);
    expect(isAdminMaxWidthNoneRoute("/embed/dashboard/x")).toBe(false);
  });
});

describe("isAdminConstrainedRoute", () => {
  it("always false after unified full-width layout", () => {
    expect(isAdminConstrainedRoute("/admin/account/security")).toBe(false);
    expect(isAdminConstrainedRoute("/admin/ingestion/sync-jobs/j1/edit")).toBe(false);
    expect(isAdminConstrainedRoute("/admin/datasets/new")).toBe(false);
  });
});

describe("isAdminDashboardBuilderRoute", () => {
  it("matches dashboard and data screen view/edit paths", () => {
    expect(isAdminDashboardBuilderRoute("/admin/dashboards/d1")).toBe(true);
    expect(isAdminDashboardBuilderRoute("/admin/dashboards/d1/edit")).toBe(true);
    expect(isAdminDashboardBuilderRoute("/admin/data-screens/ds1/edit/")).toBe(true);
    expect(isAdminDashboardBuilderRoute("/admin/dashboards/d1/share")).toBe(false);
  });
});

describe("isAdminScreenPreviewRoute", () => {
  it("matches data screen preview chromeless route", () => {
    expect(isAdminScreenPreviewRoute("/admin/data-screens/abc/preview")).toBe(true);
    expect(isAdminScreenPreviewRoute("/admin/data-screens/abc/edit")).toBe(false);
  });
});

describe("isAdminVizComponentEditRoute", () => {
  it("matches viz component edit fill route", () => {
    expect(isAdminVizComponentEditRoute("/admin/viz-components/abc/edit")).toBe(true);
    expect(isAdminVizComponentEditRoute("/admin/viz-components/abc/edit/")).toBe(true);
    expect(isAdminVizComponentEditRoute("/admin/viz-components")).toBe(false);
    expect(isAdminVizComponentEditRoute("/admin/viz-components/new")).toBe(false);
  });
});

describe("isAdminDatasourceDetailRoute", () => {
  it("matches datasource detail fill route", () => {
    expect(isAdminDatasourceDetailRoute("/admin/datasources/ds-1")).toBe(true);
    expect(isAdminDatasourceDetailRoute("/admin/datasources/ds-1/")).toBe(true);
    expect(isAdminDatasourceDetailRoute("/admin/datasources/new")).toBe(false);
    expect(isAdminDatasourceDetailRoute("/admin/datasources/ds-1/edit")).toBe(false);
    expect(isAdminDatasourceDetailRoute("/admin/datasources")).toBe(false);
  });
});

describe("isAdminDatasourceFormRoute", () => {
  it("matches datasource new and edit fill routes", () => {
    expect(isAdminDatasourceFormRoute("/admin/datasources/new")).toBe(true);
    expect(isAdminDatasourceFormRoute("/admin/datasources/ds-1/edit")).toBe(true);
    expect(isAdminDatasourceFormRoute("/admin/datasources/ds-1/edit/")).toBe(true);
    expect(isAdminDatasourceFormRoute("/admin/datasources")).toBe(false);
  });
});

describe("isAdminSyncJobFormRoute", () => {
  it("matches sync job new, edit, and etl-rules fill routes", () => {
    expect(isAdminSyncJobFormRoute("/admin/ingestion/sync-jobs/new")).toBe(true);
    expect(isAdminSyncJobFormRoute("/admin/ingestion/sync-jobs/j1/edit")).toBe(true);
    expect(isAdminSyncJobFormRoute("/admin/ingestion/sync-jobs/j1/etl-rules/")).toBe(true);
    expect(isAdminSyncJobFormRoute("/admin/ingestion/sync-jobs")).toBe(false);
    expect(isAdminSyncJobFormRoute("/admin/ingestion/sync-jobs/j1/history")).toBe(false);
  });
});

describe("isAdminDatasetFormRoute", () => {
  it("matches dataset new and edit fill routes", () => {
    expect(isAdminDatasetFormRoute("/admin/datasets/new")).toBe(true);
    expect(isAdminDatasetFormRoute("/admin/datasets/d1/edit")).toBe(true);
    expect(isAdminDatasetFormRoute("/admin/datasets/d1/edit/")).toBe(true);
    expect(isAdminDatasetFormRoute("/admin/datasets")).toBe(false);
  });
});

describe("isAdminShareRoute", () => {
  it("matches dashboard and data screen share routes", () => {
    expect(isAdminShareRoute("/admin/dashboards/d1/share")).toBe(true);
    expect(isAdminShareRoute("/admin/data-screens/ds1/share/")).toBe(true);
  });

  it("does not match edit, preview, or list routes", () => {
    expect(isAdminShareRoute("/admin/dashboards")).toBe(false);
    expect(isAdminShareRoute("/admin/dashboards/d1/edit")).toBe(false);
    expect(isAdminShareRoute("/admin/data-screens/ds1/preview")).toBe(false);
  });
});
