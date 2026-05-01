import { describe, expect, it } from "vitest";
import { orderReusableExecutionWorkspaces, type ReusableExecutionWorkspaceLike } from "./reusable-execution-workspaces";

function workspace(overrides: Partial<ReusableExecutionWorkspaceLike>): ReusableExecutionWorkspaceLike {
  return {
    id: overrides.id ?? "workspace-id",
    name: overrides.name ?? "Workspace",
    cwd: overrides.cwd ?? null,
    updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00.000Z",
  };
}

describe("orderReusableExecutionWorkspaces", () => {
  it("puts the most recently updated workspace first and sorts the rest alphabetically", () => {
    const workspaces = [
      workspace({ id: "charlie", name: "Charlie", updatedAt: "2026-01-03T00:00:00.000Z" }),
      workspace({ id: "zulu", name: "Zulu", updatedAt: "2026-01-05T00:00:00.000Z" }),
      workspace({ id: "alpha", name: "Alpha", updatedAt: "2026-01-01T00:00:00.000Z" }),
      workspace({ id: "bravo", name: "Bravo", updatedAt: "2026-01-04T00:00:00.000Z" }),
    ];

    expect(orderReusableExecutionWorkspaces(workspaces).map((item) => item.id)).toEqual([
      "zulu",
      "alpha",
      "bravo",
      "charlie",
    ]);
  });

  it("keeps only the latest updated workspace for duplicate paths before sorting", () => {
    const workspaces = [
      workspace({ id: "older-duplicate", name: "Older duplicate", cwd: "/tmp/shared", updatedAt: "2026-01-01T00:00:00.000Z" }),
      workspace({ id: "beta", name: "Beta", cwd: "/tmp/beta", updatedAt: "2026-01-02T00:00:00.000Z" }),
      workspace({ id: "newer-duplicate", name: "Newer duplicate", cwd: "/tmp/shared", updatedAt: "2026-01-04T00:00:00.000Z" }),
      workspace({ id: "alpha", name: "Alpha", cwd: "/tmp/alpha", updatedAt: "2026-01-03T00:00:00.000Z" }),
    ];

    expect(orderReusableExecutionWorkspaces(workspaces).map((item) => item.id)).toEqual([
      "newer-duplicate",
      "alpha",
      "beta",
    ]);
  });
});
