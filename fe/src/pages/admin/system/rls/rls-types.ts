export type DimensionTypeOut = {
  id: string;
  code: string;
  name: string;
  value_type: string;
  org_dimension: boolean;
  description: string | null;
};

export type DimensionGroupOut = {
  id: string;
  dimension_type_id: string;
  code: string;
  name: string;
  parent_id: string | null;
};

export type RoleOut = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
};

export type ColumnBindingOut = {
  id: string;
  datasourceId: string | null;
  datasetId: string | null;
  tableName: string;
  dimensionTypeId: string;
  columnName: string;
  createdAt: string;
};
