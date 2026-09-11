export const SOURCE_TYPE_LABELS: Record<string, string> = {
  mysql: "MySQL",
  postgresql: "PostgreSQL",
  postgres: "PostgreSQL",
  sqlserver: "SQL Server",
  oracle: "Oracle",
};

export function sourceTypeLabel(type: string) {
  return SOURCE_TYPE_LABELS[type.toLowerCase()] ?? type;
}
