import { describe, expect, it } from "vitest";
import "@/components/charts/engine/plugins/index";
import { buildPlanForType } from "@/components/charts/engine/plugins/plans/buildPlan";
import {
  assertCatalogSmokeCoverage,
  CHART_CATALOG_SMOKE_CASES,
  smokeCaseToViewModel,
} from "./chartCatalogSmokeFixtures";
import { assertPlanMatchesFixture } from "./chartCatalogPlanAssertions";

describe("chart catalog L2 DATA", () => {
  assertCatalogSmokeCoverage();

  it.each(CHART_CATALOG_SMOKE_CASES.map((c) => [c.type, c] as const))(
    "T-VIZ-R31-001 %s: buildPlan encodes fixture rows",
    (_type, item) => {
      const plan = buildPlanForType(item.type, smokeCaseToViewModel(item));
      assertPlanMatchesFixture(item, plan);
    },
  );
});
