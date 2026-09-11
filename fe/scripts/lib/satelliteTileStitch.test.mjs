import assert from "node:assert/strict";
import { test } from "node:test";
import {
  TILE_FEATHER,
  featherWeight,
  placeTileOnCanvas,
  tileRangeForBounds,
} from "./satelliteTileStitch.mjs";

const TILE = 256;

function solidTile(r, g, b) {
  const tile = new Uint8Array(TILE * TILE * 4);
  for (let i = 0; i < tile.length; i += 4) {
    tile[i] = r;
    tile[i + 1] = g;
    tile[i + 2] = b;
    tile[i + 3] = 255;
  }
  return tile;
}

test("TILE_FEATHER defaults to hard paste (no dark grid expansion)", () => {
  assert.equal(TILE_FEATHER, 0);
  assert.equal(featherWeight(0), 1);
  assert.equal(featherWeight(2), 1);
});

test("placeTileOnCanvas hard-pastes adjacent tiles without dark feather band", () => {
  const canvasW = TILE * 2;
  const canvasH = TILE;
  const canvas = new Uint8Array(canvasW * canvasH * 4);
  placeTileOnCanvas(canvas, canvasW, canvasH, solidTile(255, 0, 0), 0, 0, {
    featherLeft: false,
    featherTop: false,
  });
  placeTileOnCanvas(canvas, canvasW, canvasH, solidTile(0, 0, 255), TILE, 0, {
    featherLeft: true,
    featherTop: false,
  });

  const leftIdx = (128 * canvasW + (TILE - 1)) * 4;
  const rightIdx = (128 * canvasW + TILE) * 4;

  assert.equal(canvas[leftIdx], 255);
  assert.equal(canvas[leftIdx + 2], 0);
  assert.equal(canvas[rightIdx], 0);
  assert.equal(canvas[rightIdx + 2], 255);
});

test("tileRangeForBounds counts grid tiles", () => {
  const range = tileRangeForBounds(
    { west: 10, south: 10, east: 10.5, north: 10.5 },
    5,
  );
  assert.equal(range.count, 1);
});
