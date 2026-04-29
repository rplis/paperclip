// @vitest-environment node

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IssueBlockedNotice } from "./IssueBlockedNotice";

function renderNotice(node: React.ReactNode) {
  const queryClient = new QueryClient();
  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("IssueBlockedNotice", () => {
  it("renders the rose recovery variant with parent-perspective copy and a wake-to-continue verb", () => {
    const html = renderNotice(
      <>
        <IssueBlockedNotice
          issueStatus="blocked"
          blockers={[
            {
              id: "issue-recovery-parent",
              identifier: "PAP-2089",
              title: "Liveness root",
              status: "blocked",
              priority: "medium",
              assigneeAgentId: null,
              assigneeUserId: null,
              terminalBlockers: [
                {
                  id: "issue-recovery-leaf",
                  identifier: "PAP-2642",
                  title: "Implementation phase",
                  status: "in_progress",
                  priority: "medium",
                  assigneeAgentId: "agent-1",
                  assigneeUserId: null,
                },
              ],
            },
          ]}
          blockerAttention={{
            state: "recovery_needed",
            reason: "productive_run_stopped",
            unresolvedBlockerCount: 1,
            coveredBlockerCount: 0,
            stalledBlockerCount: 0,
            attentionBlockerCount: 0,
            sampleBlockerIdentifier: "PAP-2642",
            sampleStalledBlockerIdentifier: null,
            nextActionOwner: { type: "agent", agentId: "agent-1", userId: null },
            nextActionHint: "wake_to_continue",
          }}
          ownerAgentName="CodexCoder"
        />
      </>,
    );

    expect(html).toContain('data-blocker-attention-state="recovery_needed"');
    expect(html).toContain('data-blocker-attention-reason="productive_run_stopped"');
    expect(html).toContain("paused at a liveness break");
    expect(html).toContain("Liveness break at");
    expect(html).toContain("Wake to continue");
    expect(html).toContain("PAP-2642");
    expect(html).toContain("border-rose-300/70");
  });

  it("renders the leaf-perspective copy without blocker chips when the issue itself is the invalid leaf", () => {
    const html = renderNotice(
      <>
        <IssueBlockedNotice
          issueStatus="in_progress"
          blockers={[]}
          blockerAttention={{
            state: "recovery_needed",
            reason: "productive_run_stopped",
            unresolvedBlockerCount: 0,
            coveredBlockerCount: 0,
            stalledBlockerCount: 0,
            attentionBlockerCount: 0,
            sampleBlockerIdentifier: "PAP-2642",
            sampleStalledBlockerIdentifier: null,
            nextActionOwner: { type: "agent", agentId: "agent-1", userId: null },
            nextActionHint: "wake_to_continue",
          }}
          ownerAgentName="CodexCoder"
        />
      </>,
    );

    expect(html).toContain("productive run that exited without queueing a continuation");
    expect(html).not.toContain("Liveness break at");
    expect(html).toContain("Wake to continue");
  });

  it("renders the sky explicit-wait banner with plan-confirmation copy when a pending request_confirmation exists", () => {
    const html = renderNotice(
      <>
        <IssueBlockedNotice
          issueIdentifier="PAP-2708"
          issueStatus="in_review"
          blockers={[]}
          blockerAttention={{
            state: "covered",
            reason: "explicit_waiting",
            unresolvedBlockerCount: 0,
            coveredBlockerCount: 0,
            stalledBlockerCount: 0,
            attentionBlockerCount: 0,
            sampleBlockerIdentifier: "PAP-2708",
            sampleStalledBlockerIdentifier: null,
            nextActionOwner: { type: "user", agentId: null, userId: null },
            nextActionHint: "needs_human_review",
          }}
          interactions={[
            {
              id: "interaction-1",
              companyId: "co-1",
              issueId: "issue-1",
              kind: "request_confirmation",
              status: "pending",
              continuationPolicy: "wake_assignee",
              createdAt: "2026-04-28T22:00:00.000Z",
              updatedAt: "2026-04-28T22:00:00.000Z",
              createdByAgentId: "agent-coder",
              createdByUserId: null,
              payload: {
                version: 1,
                prompt: "Approve plan",
                target: {
                  type: "issue_document",
                  key: "plan",
                  revisionId: "rev-1",
                  revisionNumber: 2,
                },
              },
            },
          ]}
        />
      </>,
    );

    expect(html).toContain('data-blocker-attention-state="covered"');
    expect(html).toContain('data-blocker-attention-reason="explicit_waiting"');
    expect(html).toContain("Waiting on board confirmation");
    expect(html).not.toContain("Plan revision r2");
    expect(html).not.toMatch(/>\s*Target\s*</);
    expect(html).toContain(">Owner<");
    expect(html).toContain(">Resume<");
    expect(html).toContain("Resumes when the board accepts");
    expect(html).toContain("border-sky-300/70");
    expect(html).not.toContain("border-rose-300/70");
    expect(html).toContain("Jump to confirmation");
  });

  it("renders the sky explicit-wait banner falling back to a board-approval message when only an approval is pending", () => {
    const html = renderNotice(
      <>
        <IssueBlockedNotice
          issueIdentifier="PAP-2710"
          issueStatus="in_review"
          blockers={[]}
          blockerAttention={{
            state: "covered",
            reason: "explicit_waiting",
            unresolvedBlockerCount: 0,
            coveredBlockerCount: 0,
            stalledBlockerCount: 0,
            attentionBlockerCount: 0,
            sampleBlockerIdentifier: "PAP-2710",
            sampleStalledBlockerIdentifier: null,
            nextActionOwner: { type: "user", agentId: null, userId: null },
            nextActionHint: "needs_human_review",
          }}
          interactions={[]}
          approvals={[
            {
              id: "approval-abcdef12",
              companyId: "co-1",
              type: "request_board_approval",
              requestedByAgentId: "agent-1",
              requestedByUserId: null,
              status: "pending",
              payload: {},
              decisionNote: null,
              decidedByUserId: null,
              decidedAt: null,
              createdAt: new Date("2026-04-28T22:00:00.000Z"),
              updatedAt: new Date("2026-04-28T22:00:00.000Z"),
            },
          ]}
        />
      </>,
    );

    expect(html).toContain("Waiting on board approval");
    expect(html).toContain("A board approval is open");
    expect(html).not.toContain("Approval approval");
    expect(html).toContain("Jump to approval");
    expect(html).toContain("border-sky-300/70");
  });

  it("falls back to amber stalled treatment when state is stalled rather than recovery_needed", () => {
    const html = renderNotice(
      <>
        <IssueBlockedNotice
          issueStatus="blocked"
          blockers={[
            {
              id: "issue-stalled",
              identifier: "PAP-2279",
              title: "Stage gate review",
              status: "in_review",
              priority: "medium",
              assigneeAgentId: "agent-1",
              assigneeUserId: null,
            },
          ]}
          blockerAttention={{
            state: "stalled",
            reason: "stalled_review",
            unresolvedBlockerCount: 1,
            coveredBlockerCount: 0,
            stalledBlockerCount: 1,
            attentionBlockerCount: 0,
            sampleBlockerIdentifier: "PAP-2279",
            sampleStalledBlockerIdentifier: "PAP-2279",
            nextActionOwner: null,
            nextActionHint: null,
          }}
        />
      </>,
    );

    expect(html).toContain("Stalled in review");
    expect(html).not.toContain("Liveness break");
    expect(html).toContain("border-amber-300/70");
  });
});
