export const queryKeys = {
  me: ["me"] as const,
  demoPackage: {
    status: ["demoPackage", "status"] as const,
  },
  datasources: {
    all: ["datasources"] as const,
    list: (params?: { q?: string; type?: string; limit?: number; offset?: number; includeManaged?: boolean }) =>
      ["datasources", "list", params] as const,
    detail: (id: string) => ["datasources", "detail", id] as const,
    schemas: (id: string) => ["datasources", id, "schemas"] as const,
    tables: (id: string, schema: string) => ["datasources", id, "tables", schema] as const,
    columns: (id: string, schema: string, table: string) =>
      ["datasources", id, "columns", schema, table] as const,
  },
  connectorTypes: ["connectorTypes"] as const,
  roles: {
    all: ["roles"] as const,
    list: (params?: { codePrefix?: string; limit?: number; offset?: number }) =>
      ["roles", "list", params] as const,
    dimensionGroups: (roleId: string) => ["roles", roleId, "dimension-groups"] as const,
    dimensionValues: (roleId: string, dimensionTypeId: string) =>
      ["roles", roleId, "dimension-values", dimensionTypeId] as const,
  },
  permissions: {
    catalog: ["permissions", "catalog"] as const,
    role: (roleId: string) => ["permissions", "role", roleId] as const,
  },
  resourceGrants: {
    all: ["resourceGrants"] as const,
    list: (params?: { roleId?: string; resourceType?: string }) =>
      ["resourceGrants", "list", params] as const,
  },
  dashboards: {
    all: ["dashboards"] as const,
    list: (params?: { limit?: number; offset?: number; surfaceKind?: string; q?: string }) =>
      ["dashboards", "list", params] as const,
    globalFilters: (id: string) => ["dashboards", id, "globalFilters"] as const,
  },
  dashboardTemplates: {
    all: ["dashboardTemplates"] as const,
    list: (params?: {
      surfaceKind?: string;
      categoryKey?: string;
      q?: string;
      includeDrafts?: boolean;
      limit?: number;
      offset?: number;
    }) => ["dashboardTemplates", "list", params] as const,
    detail: (id: string) => ["dashboardTemplates", "detail", id] as const,
  },
  vizComponents: {
    all: ["vizComponents"] as const,
    list: (params?: {
      surfaceKind?: string;
      widgetType?: string;
      chartPaletteCategory?: string;
      categoryKey?: string;
      q?: string;
      includeDrafts?: boolean;
      limit?: number;
      offset?: number;
    }) => ["vizComponents", "list", params] as const,
    detail: (id: string) => ["vizComponents", "detail", id] as const,
    resolve: (ids: string[]) => ["vizComponents", "resolve", [...ids].sort().join(",")] as const,
    references: (id: string) => ["vizComponents", "references", id] as const,
  },
  metadata: {
    entityTypes: ["metadata", "entityTypes"] as const,
    physicalTables: (entityTypeCode?: string) =>
      ["metadata", "physicalTables", entityTypeCode ?? "all"] as const,
    entityOverview: (dashboardId: string) =>
      ["metadata", "entityOverview", dashboardId] as const,
  },
  reports: {
    standardPacks: ["reports", "standardPacks"] as const,
    standardRun: (packKey: string, theme: string) => ["reports", "standardRun", packKey, theme] as const,
    standardCompare: (
      packKey: string,
      theme: string,
      baselinePeriodKey?: string,
      currentPeriodKey?: string,
    ) =>
      [
        "reports",
        "standardCompare",
        packKey,
        theme,
        baselinePeriodKey ?? "",
        currentPeriodKey ?? "",
      ] as const,
    standardCompareMatrix: (packKey: string, theme: string, periodKeys?: string) =>
      ["reports", "standardCompareMatrix", packKey, theme, periodKeys ?? ""] as const,
    standardSnapshots: (packKey: string, theme?: string) =>
      ["reports", "standardSnapshots", packKey, theme ?? "all"] as const,
    standardCapabilities: (packKey: string) => ["reports", "standardCapabilities", packKey] as const,
    catalogNodes: (parentId?: string | null) =>
      ["reports", "catalogNodes", parentId ?? "root"] as const,
    catalogAllNodes: ["reports", "catalogAllNodes"] as const,
    catalogNode: (nodeId: string) => ["reports", "catalog-node", nodeId] as const,
    template: (key: string) => ["reports", "template", key] as const,
    extension: (nodeId: string) => ["reports", "extension", nodeId] as const,
    renderSpec: (nodeId: string) => ["reports", "renderSpec", nodeId] as const,
    centerPreferences: ["reports", "centerPreferences"] as const,
    extensionRevisions: (nodeId: string) => ["reports", "extensionRevisions", nodeId] as const,
    templateVersions: (key: string) => ["reports", "templateVersions", key] as const,
  },
  themes: {
    config: (refType: string, refId: string) => ["themes", "config", refType, refId] as const,
    chartBindings: (refType: string, refId: string) =>
      ["themes", "chartBindings", refType, refId] as const,
    drill: (refType: string, refId: string, dimensionId: string, regionFilter?: string | null) =>
      ["themes", "drill", refType, refId, dimensionId, regionFilter ?? ""] as const,
  },
  users: {
    all: ["users"] as const,
    list: (params?: { q?: string; orgId?: string; limit?: number; offset?: number }) =>
      ["users", "list", params] as const,
    roles: (userId: string) => ["users", userId, "roles"] as const,
    org: (userId: string) => ["users", userId, "org"] as const,
    resourceGrants: (userId: string) => ["users", userId, "resource-grants"] as const,
    views: ["users", "me", "views"] as const,
  },
  orgs: {
    all: ["orgs"] as const,
    list: (params?: { q?: string; limit?: number; offset?: number }) =>
      ["orgs", "list", params ?? {}] as const,
    picker: ["orgs", "picker"] as const,
  },
  rls: {
    dimensions: (params?: { limit?: number; offset?: number }) =>
      ["rls", "dimensions", params] as const,
    groups: (params?: {
      dimensionTypeId?: string;
      limit?: number;
      offset?: number;
    }) => ["rls", "groups", params ?? {}] as const,
    columnBindings: (params?: { datasetId?: string; datasourceId?: string }) =>
      ["rls", "column-bindings", params ?? {}] as const,
    columnMasks: (params?: { datasetId?: string }) =>
      ["rls", "column-masks", params ?? {}] as const,
  },
  audit: {
    events: (params?: Record<string, string | number | undefined>) =>
      ["audit", "events", params] as const,
  },
  platformConnect: {
    email: ["platform-connect", "email"] as const,
    emailSlots: ["platform-connect", "email-slots"] as const,
    emailSlot: (slot: string) => ["platform-connect", "email-slot", slot] as const,
  },
  gov: {
    categories: ["gov", "categories"] as const,
    entries: (params?: { category?: string; limit?: number; offset?: number }) =>
      ["gov", "entries", params] as const,
    workflowTemplates: ["gov", "workflowTemplates"] as const,
    workflowNodeRoles: (templateId: string) =>
      ["gov", "workflowNodeRoles", templateId] as const,
    workflowInstances: (params?: { status?: string }) =>
      ["gov", "workflowInstances", params ?? {}] as const,
    workflowInstance: (id: string, withSnapshot?: boolean) =>
      ["gov", "workflowInstance", id, withSnapshot ? "snap" : "base"] as const,
    publishOpenapi: (entryId: string) => ["gov", "publishOpenapi", entryId] as const,
  },
  metadataHub: {
    glossary: (params?: { codePrefix?: string }) => ["metadata", "glossary", params] as const,
    themes: (parentId?: string | null) => ["metadata", "themes", parentId ?? "root"] as const,
    dimensions: (params?: { codePrefix?: string }) => ["metadata", "dimensions", params] as const,
  },
  datasets: {
    all: ["datasets"] as const,
    list: (params?: { q?: string; limit?: number; offset?: number }) =>
      ["datasets", "list", params] as const,
    detail: (id: string) => ["datasets", "detail", id] as const,
  },
  services: {
    list: (params?: { limit?: number; offset?: number }) => ["services", "list", params] as const,
    openapi: (serviceId: string) => ["services", "openapi", serviceId] as const,
  },
  charts: {
    types: ["charts", "types"] as const,
  },
  aiViz: {
    all: ["aiViz"] as const,
    list: (params?: { limit?: number; offset?: number }) => ["aiViz", "list", params] as const,
    detail: (artifactId: string) => ["aiViz", "detail", artifactId] as const,
  },
  designer: {
    sqlCapabilities: ["designer", "sqlCapabilities"] as const,
    fields: (datasetId?: string | null) => ["designer", "fields", datasetId ?? "none"] as const,
    conditions: (refId: string) => ["designer", "conditions", refId] as const,
    computeRules: (refId: string) => ["designer", "computeRules", refId] as const,
    outputFields: (refId: string) => ["designer", "outputFields", refId] as const,
    preview: (refId: string) => ["designer", "preview", refId] as const,
    designMode: (refId: string) => ["designer", "designMode", refId] as const,
    sqlMode: (refId: string) => ["designer", "sqlMode", refId] as const,
    snapshot: (id: string) => ["designer", "snapshot", id] as const,
  },
  reportSchedules: (
    filter?: { catalogNodeId?: string; sourceId?: string; sourceType?: string; sourceKey?: string },
  ) =>
    [
      "reports",
      "schedules",
      filter?.catalogNodeId ?? filter?.sourceId ?? filter?.sourceKey ?? "all",
      filter?.sourceType ?? "",
      filter?.sourceKey ?? "",
    ] as const,
  agent: {
    health: ["agent", "health"] as const,
    uploads: ["agent", "uploads"] as const,
    memories: ["agent", "memories"] as const,
    plugins: ["agent", "plugins"] as const,
  },
};
