import { describe, expect, it } from "vitest";
import "@/components/charts/engine/plugins/index";
import { buildPlanForType } from "@/components/charts/engine/plugins/plans/buildPlan";
import { buildChartRenderModel } from "@/lib/buildChartRenderModel";
import { deriveFieldRuleFromDeCatalog, getDeAxisBlueprint } from "@/lib/chartDeAxis";
import {
  CHART_CATALOG_SMOKE_CASES,
  smokeCaseToConfig,
  smokeCaseToViewModel,
} from "@/components/charts/chartCatalogSmokeFixtures";
import { assertPlanMatchesFixture } from "@/components/charts/chartCatalogPlanAssertions";

const CHART_TYPE = "funnel" as const;

describe(`${CHART_TYPE} DE parity`, () => {
  const smoke = () => {
    const item = CHART_CATALOG_SMOKE_CASES.find((c) => c.type === CHART_TYPE);
    if (!item) throw new Error(`missing smoke fixture for ${CHART_TYPE}`);
    return item;
  };

  it("L3: DE axis blueprint is registered", () => {
    const slots = getDeAxisBlueprint(CHART_TYPE);
    expect(slots.length).toBeGreaterThan(0);
    expect(deriveFieldRuleFromDeCatalog(CHART_TYPE).minMetrics).toBeGreaterThanOrEqual(0);
  });

  it("L2: buildPlan encodes §2 fixture (L3 槽位 + L2 plan + L1 smoke)", () => {
    const item = smoke();
    const plan = buildPlanForType(CHART_TYPE, smokeCaseToViewModel(item));
    assertPlanMatchesFixture(item, plan);
  });

  it("L1: render model ready for fixture rows", () => {
    const item = smoke();
    const config = smokeCaseToConfig(item);
    const model = buildChartRenderModel(config, item.columns, item.rows as never);
    expect(["ready", "table"]).toContain(model.kind);
  });
});
