import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(__dirname, "check-design.mjs");
const fixturesRoot = path.join(__dirname, "__fixtures__/check-design");

function runCheck(rootDir) {
  return spawnSync(process.execPath, [script, "--root", rootDir], {
    cwd: path.join(__dirname, ".."),
    encoding: "utf8",
  });
}

test("T-FE-DG-01: hardcoded hex in fixture fails check:design", () => {
  const result = runCheck(path.join(fixturesRoot, "bad-only"));
  assert.equal(result.status, 1, result.stdout + result.stderr);
});

test("T-FE-DG-02: @design-token-ok line exempts hex", () => {
  const result = runCheck(path.join(fixturesRoot, "ok-only"));
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("T-FE-DG-03: rgb() in fixture fails check:design", () => {
  const result = runCheck(path.join(fixturesRoot, "rgb-only"));
  assert.equal(result.status, 1, result.stdout + result.stderr);
});

test("T-FE-DG-04: mixed bad+ok fixtures fail check:design", () => {
  const result = runCheck(path.join(fixturesRoot, "mixed"));
  assert.equal(result.status, 1, result.stdout + result.stderr);
});
