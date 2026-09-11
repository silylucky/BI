import assert from "node:assert/strict";
import { test } from "node:test";
import { buildHeightGridMercator, sampleElevation } from "./chinaTerrainSynth.mjs";
import { buildHeightGridProjBounds, softenHeightGrid } from "./terrainDisplaceBake.mjs";
import { loadChinaTerrainFeatureCollection } from "./terrainGeoJson.mjs";
import { readNationalBounds } from "./terrainPackBounds.mjs";

test("projBounds height grid matches mercator at center for square sample", async () => {
  const bounds = await readNationalBounds();
  const w = 64;
  const h = 64;
  const fc = await loadChinaTerrainFeatureCollection();
  const merc = buildHeightGridMercator(w, h, bounds);
  const { grid: proj } = buildHeightGridProjBounds(w, h, fc);
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);
  assert.ok(Math.abs(merc[cy * w + cx] - proj[cy * w + cx]) < 0.08);
});

test("softenHeightGrid reduces local contrast", () => {
  const grid = new Float32Array([0, 1, 0, 1]);
  const soft = softenHeightGrid(grid, 2, 2, 1);
  assert.ok(soft[1] < 1);
  assert.ok(soft[1] > 0);
});

test("sampleElevation stays bounded", () => {
  const v = sampleElevation(105, 35);
  assert.ok(v >= 0 && v <= 1);
});
