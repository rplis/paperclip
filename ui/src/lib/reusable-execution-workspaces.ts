export interface ReusableExecutionWorkspaceLike {
  id: string;
  name: string;
  cwd: string | null;
  updatedAt: Date | string;
}

function workspaceUpdatedTime(workspace: Pick<ReusableExecutionWorkspaceLike, "updatedAt">) {
  const time = new Date(workspace.updatedAt).getTime();
  return Number.isFinite(time) ? time : 0;
}

function compareWorkspaceNames(a: ReusableExecutionWorkspaceLike, b: ReusableExecutionWorkspaceLike) {
  const nameCompare = a.name.localeCompare(b.name, undefined, {
    numeric: true,
    sensitivity: "base",
  });
  if (nameCompare !== 0) return nameCompare;
  return a.id.localeCompare(b.id);
}

export function orderReusableExecutionWorkspaces<T extends ReusableExecutionWorkspaceLike>(
  workspaces: readonly T[],
): T[] {
  const deduplicatedByPath = new Map<string, T>();

  for (const workspace of workspaces) {
    const key = workspace.cwd ?? workspace.id;
    const existing = deduplicatedByPath.get(key);
    if (!existing || workspaceUpdatedTime(workspace) > workspaceUpdatedTime(existing)) {
      deduplicatedByPath.set(key, workspace);
    }
  }

  const alphabetized = Array.from(deduplicatedByPath.values()).sort(compareWorkspaceNames);
  if (alphabetized.length <= 1) return alphabetized;

  let mostRecentlyUpdated = alphabetized[0]!;
  for (const workspace of alphabetized.slice(1)) {
    if (workspaceUpdatedTime(workspace) > workspaceUpdatedTime(mostRecentlyUpdated)) {
      mostRecentlyUpdated = workspace;
    }
  }

  return [
    mostRecentlyUpdated,
    ...alphabetized.filter((workspace) => workspace.id !== mostRecentlyUpdated.id),
  ];
}
