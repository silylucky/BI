import { describe, expect, it } from "vitest";
import {
  groupCustomVizStyleProperties,
  inferStyleSchemaFromDefault,
  mergeCustomVizStyleValue,
  resolveCustomVizStyleSchema,
} from "./customVizStyleSchema";

describe("customVizStyleSchema", () => {
  it("infers style schema from defaultStyle when styleSchema is missing", () => {
    const schema = inferStyleSchemaFromDefault({
      accentColor: "#2563eb",
      barHeight: 20,
      showValue: true,
    });
    expect(schema?.properties).toMatchObject({
      accentColor: { type: "string", format: "color", title: "强调色" },
      barHeight: { type: "number", title: "条高度" },
      showValue: { type: "boolean", title: "显示数值" },
    });
  });

  it("prefers explicit styleSchema over inferred default", () => {
    const explicit = { type: "object", properties: { foo: { type: "string" } } };
    expect(resolveCustomVizStyleSchema(explicit, { barHeight: 20 })).toBe(explicit);
  });

  it("merges layout style over manifest defaultStyle", () => {
    expect(
      mergeCustomVizStyleValue({ accentColor: "#111111" }, { accentColor: "#2563eb", barHeight: 20 }),
    ).toEqual({ accentColor: "#111111", barHeight: 20 });
  });

  it("groups properties by x-styleSections", () => {
    const sections = groupCustomVizStyleProperties({
      type: "object",
      "x-styleSections": [
        { title: "条形外观", properties: ["accentColor", "barHeight"] },
        { title: "标签", properties: ["showValue"] },
      ],
      properties: {
        accentColor: { type: "string", format: "color" },
        barHeight: { type: "number" },
        showValue: { type: "boolean" },
        extra: { type: "string" },
      },
    });
    expect(sections.map((s) => s.title)).toEqual(["条形外观", "标签", "其他"]);
    expect(sections[0]?.propertyKeys).toEqual(["accentColor", "barHeight"]);
  });

  it("groups properties by x-section when x-styleSections is absent", () => {
    const sections = groupCustomVizStyleProperties({
      type: "object",
      properties: {
        a: { type: "string", "x-section": "A 组" },
        b: { type: "number", "x-section": "A 组" },
        c: { type: "boolean", "x-section": "B 组" },
      },
    });
    expect(sections).toHaveLength(2);
    expect(sections[0]?.title).toBe("A 组");
    expect(sections[1]?.title).toBe("B 组");
  });
});
