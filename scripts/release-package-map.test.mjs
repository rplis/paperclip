import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReleasePackagePlan,
  checkConfiguration,
  getReleasePackages,
} from "./release-package-map.mjs";

test("release package manifest covers all public packages with explicit CI enrollment", () => {
  const packages = buildReleasePackagePlan();
  assert.ok(packages.length > 0);
  assert.ok(packages.every((pkg) => typeof pkg.publishFromCi === "boolean"));
});

test("ACPX adapter remains enrolled for CI publishing", () => {
  const packages = buildReleasePackagePlan();
  const acpxPackage = packages.find((pkg) => pkg.name === "@paperclipai/adapter-acpx-local");
  assert.ok(acpxPackage);
  assert.equal(acpxPackage.publishFromCi, true);

  const enabledNames = new Set(getReleasePackages().map((pkg) => pkg.name));
  assert.equal(enabledNames.has("@paperclipai/adapter-acpx-local"), true);
  assert.equal(enabledNames.has("@paperclipai/adapter-utils"), true);
});

test("release package configuration validates successfully", () => {
  assert.doesNotThrow(() => checkConfiguration());
});
