#!/usr/bin/env node

import { execFileSync } from "node:child_process";

import { buildReleasePackagePlan } from "./release-package-map.mjs";

function normalizePath(filePath) {
  return filePath.replace(/\\/g, "/");
}

function npmPackageExists(packageName) {
  try {
    execFileSync("npm", ["view", packageName, "name", "--json"], {
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    });
    return true;
  } catch {
    return false;
  }
}

function main(changedPaths) {
  const normalizedChangedPaths = changedPaths.map(normalizePath);
  const releasePackages = buildReleasePackagePlan();
  const changedReleasePackages = [];
  const seen = new Set();

  for (const pkg of releasePackages) {
    if (!pkg.publishFromCi) continue;
    const packageJsonPath = `${pkg.dir}/package.json`;

    if (!normalizedChangedPaths.includes(packageJsonPath)) continue;
    if (seen.has(pkg.name)) continue;

    changedReleasePackages.push(pkg);
    seen.add(pkg.name);
  }

  if (changedReleasePackages.length === 0) {
    process.stdout.write("No release-enabled package manifests changed in this PR.\n");
    return;
  }

  const missingPackages = changedReleasePackages.filter((pkg) => !npmPackageExists(pkg.name));

  if (missingPackages.length > 0) {
    const details = missingPackages
      .map(
        (pkg) =>
          `${pkg.name} (${pkg.dir}) is release-enabled but does not exist on npm yet; bootstrap the first publish before merge or keep it out of CI release enrollment`,
      )
      .join("\n- ");

    throw new Error(`release package bootstrap check failed:\n- ${details}`);
  }

  process.stdout.write(
    `Release bootstrap OK for changed manifests: ${changedReleasePackages.map((pkg) => pkg.name).join(", ")}\n`,
  );
}

main(process.argv.slice(2));
