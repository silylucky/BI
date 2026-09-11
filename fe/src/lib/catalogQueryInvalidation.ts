import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

export function invalidateCatalogQueries(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: ["reports", "catalogNodes"] });
  void qc.invalidateQueries({ queryKey: queryKeys.reports.catalogAllNodes });
  void qc.invalidateQueries({ queryKey: ["reports", "center", "templates"] });
  void qc.invalidateQueries({ queryKey: ["reports", "catalog-node"] });
}
