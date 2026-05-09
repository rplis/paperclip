import cors from "cors";
import express from "express";
import { store } from "@lean/db";
import {
  dmThreadId,
  createCardSchema,
  createCompanySchema,
  createEscalationSchema,
  createMessageSchema,
  createOrgNodeSchema,
  patchOrgAgentFilesBodySchema,
  updateCardStatusSchema
} from "@lean/shared";
import { runCodexForCard } from "@lean/runner-codex";

const app = express();
app.use(cors());
app.use(express.json());

function buildCeoKickoffPrompt(companyName: string, goalText: string, kickoff: { title: string; description: string }) {
  return `You are the CEO agent of "${companyName}".

Company goal (source of truth):
${goalText}

Your Kanban assignment:
Title: ${kickoff.title}
Description:
${kickoff.description}

The Board also has five separate checklist cards (Backlog) for structure, roles, manifests, hiring discipline, and @boss clarification—treat those as the task breakdown.

Deliver a concise written plan: (1) proposed reporting org under you, (2) first hires in order with role titles, (3) skills manifest outline per subtree, (4) any remaining questions for @boss only if blocking.

IMPORTANT: After the narrative, append exactly ONE markdown JSON code block so the app can create org nodes and board cards. Use this shape (example — replace with your real plan; list managers before their reports in "hires"):
\`\`\`json
{"hires":[{"name":"Chief Investment Officer","handle":"cio","role":"custom","reportsToHandle":"ceo","skills":["portfolio","risk"]}],"cards":[{"title":"Market data sourcing","description":"Define feeds and storage.","assigneeHandle":"cio"}]}
\`\`\`
Optional per hire (strings, omit to use role defaults): \`agentMd\`, \`heartbeatMd\`, \`soulMd\`, \`toolsMd\` — you and the hiring manager should tailor these for each role.
Rules: handles must be lowercase [a-z0-9_-]+ only. reportsToHandle must be "ceo" or a handle that appears earlier in the hires array (parent before child). role must be one of: ceo, cto, engineer, operator, custom. Max 8 hires and 12 cards. Use empty arrays if not ready to commit hires yet.`;
}

type CeoKickoffCodexResult =
  | { ok: false; httpStatus: 404 | 409 | 400; error: string }
  | {
      ok: true;
      cardId: string;
      exitCode: number;
      log: string[];
      applied: { createdHires: number; createdCards: number; errors: string[] } | null;
      planParsed: boolean;
    };

async function runCeoKickoffCodex(companyId: string): Promise<CeoKickoffCodexResult> {
  const company = store.companies.get(companyId);
  if (!company) return { ok: false, httpStatus: 404, error: "Company not found" };
  const goal = store.goals.get(company.goalId);
  const ceo = [...store.orgNodes.values()].find((n) => n.companyId === companyId && n.handle === "ceo");
  if (!ceo) return { ok: false, httpStatus: 404, error: "CEO not found" };
  const kickoff = [...store.cards.values()].find(
    (c) =>
      c.companyId === companyId &&
      c.assigneeOrgNodeId === ceo.id &&
      c.title.includes("Define company structure")
  );
  if (!kickoff) return { ok: false, httpStatus: 404, error: "Kickoff card not found" };
  if (kickoff.status === "in_review") {
    return {
      ok: false,
      httpStatus: 409,
      error:
        "Kickoff is waiting in In review until @boss clarifies the goal. Reply in Messages (#general or CEO DM), then move the card to In progress on the Board (or extend the goal description and recreate)."
    };
  }

  const prompt = buildCeoKickoffPrompt(company.name, goal?.description ?? "(none)", kickoff);

  try {
    const result = await runCodexForCard({ cardId: kickoff.id, prompt });
    const raw = (result.log ?? []).join("\n");
    const plan = result.exitCode === 0 ? store.extractCeoPlanJsonFromLog(result.log) : null;
    let applied = { createdHires: 0, createdCards: 0, errors: [] as string[] };
    if (plan && result.exitCode === 0) {
      applied = store.applyCeoPlanJson(companyId, ceo.id, plan);
      if (applied.createdHires + applied.createdCards > 0) {
        store.updateCardStatus(kickoff.id, "closed");
      }
    }

    let body: string;
    if (result.exitCode !== 0) {
      const tail = raw.length > 1600 ? `${raw.slice(0, 1600)}…` : raw;
      body = `Run finished with exit ${result.exitCode}. Log:\n\n${tail || "(no log lines)"}`;
    } else if (plan && (applied.createdHires > 0 || applied.createdCards > 0)) {
      const warn = applied.errors.length ? ` Notes: ${applied.errors.join(" · ")}` : "";
      body = `Applied plan to the workspace: ${applied.createdHires} new hire(s), ${applied.createdCards} new card(s). Open Org and Board in the sidebar to review. Kickoff card marked done.${warn}`;
    } else if (plan) {
      body = `Parsed the JSON plan but created no hires/cards (${applied.errors.join(" · ") || "empty or invalid entries"}).`;
    } else {
      const preview = raw.replace(/```json[\s\S]*?```/gi, "[json plan omitted]").slice(0, 1200);
      body = `No fenced json code block was found in the model output, so Org and Board were not updated. Re-run after the model emits a valid JSON plan block. Log preview:\n\n${preview || "(empty)"}`;
    }

    store.createMessage({
      companyId,
      threadId: dmThreadId(ceo.handle, company.operatorHandle),
      authorType: "agent",
      authorId: ceo.id,
      body,
      linkedCardId: kickoff.id
    });
    return {
      ok: true,
      cardId: result.cardId,
      exitCode: result.exitCode,
      log: result.log,
      applied: plan ? applied : null,
      planParsed: Boolean(plan)
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Codex run failed";
    store.createMessage({
      companyId,
      threadId: dmThreadId(ceo.handle, company.operatorHandle),
      authorType: "agent",
      authorId: ceo.id,
      body: `CEO run failed: ${msg}`,
      linkedCardId: kickoff.id
    });
    return { ok: false, httpStatus: 400, error: msg };
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/companies", (req, res) => {
  try {
    const input = createCompanySchema.parse(req.body);
    const created = store.createCompany(input);
    runCompanyHeartbeat(created.company.id);
    res.status(201).json(created);
    void runCeoKickoffCodex(created.company.id).catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[lean-api] CEO auto-run after createCompany:", err);
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Invalid body" });
  }
});

app.post("/api/companies/:companyId/ceo/run", async (req, res) => {
  const out = await runCeoKickoffCodex(req.params.companyId);
  if (!out.ok) {
    res.status(out.httpStatus).json({ error: out.error });
    return;
  }
  res.json({
    cardId: out.cardId,
    exitCode: out.exitCode,
    log: out.log,
    applied: out.applied,
    planParsed: out.planParsed
  });
});

const lastInReviewSnapshotByCompany = new Map<string, number>();

function maybePostCeoBoardTriage(
  companyId: string,
  r: { promoted: Array<{ cardId: string; assigneeHandle: string }>; inReviewCount: number }
) {
  let prev = lastInReviewSnapshotByCompany.get(companyId);
  if (prev === undefined) prev = -1;

  const company = store.companies.get(companyId);
  const ceo = [...store.orgNodes.values()].find((n) => n.companyId === companyId && n.handle === "ceo");
  if (!company || !ceo) return;

  if (r.inReviewCount > 0) {
    if (prev === r.inReviewCount) return;
    lastInReviewSnapshotByCompany.set(companyId, r.inReviewCount);
    store.createMessage({
      companyId,
      threadId: dmThreadId(ceo.handle, company.operatorHandle),
      authorType: "agent",
      authorId: ceo.id,
      body: `Board check: ${r.inReviewCount} card(s) are In review—ping @${company.operatorHandle} in this thread or #general if you need a decision so work can keep moving.`,
      linkedCardId: null
    });
    return;
  }

  if (prev > 0) {
    lastInReviewSnapshotByCompany.set(companyId, 0);
    store.createMessage({
      companyId,
      threadId: dmThreadId(ceo.handle, company.operatorHandle),
      authorType: "agent",
      authorId: ceo.id,
      body: "Board check: nothing is In review right now—good to pull the next priorities from Backlog when you are ready.",
      linkedCardId: null
    });
    return;
  }

  if (prev === -1) {
    lastInReviewSnapshotByCompany.set(companyId, 0);
  }
}

function runCompanyHeartbeat(companyId: string) {
  const r = store.runHeartbeatsForCompany(companyId);
  maybePostCeoBoardTriage(companyId, r);
  return r;
}

app.post("/api/companies/:companyId/heartbeat", (req, res) => {
  const companyId = req.params.companyId;
  if (!store.companies.get(companyId)) return res.status(404).json({ error: "Company not found" });
  res.json(runCompanyHeartbeat(companyId));
});

app.get("/api/companies/:companyId/bootstrap", (req, res) => {
  const companyId = req.params.companyId;
  const company = store.companies.get(companyId);
  if (!company) return res.status(404).json({ error: "Company not found" });
  const goal = store.goals.get(company.goalId) ?? null;
  const org = [...store.orgNodes.values()].filter((n) => n.companyId === companyId);
  const columns = [...store.columns.values()]
    .filter((c) => c.companyId === companyId)
    .sort((a, b) => a.order - b.order);
  const cards = [...store.cards.values()].filter((c) => c.companyId === companyId);
  const messages = [...store.messages.values()].filter((m) => m.companyId === companyId);
  const escalations = [...store.escalations.values()].filter((e) => e.companyId === companyId);
  res.json({ company, goal, org, columns, cards, messages, escalations });
});

app.post("/api/org", (req, res) => {
  try {
    const input = createOrgNodeSchema.parse(req.body);
    const node = store.createOrgNode(input);
    res.status(201).json(node);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create node" });
  }
});

app.patch("/api/org/:orgNodeId/agent-files", (req, res) => {
  try {
    const { actorOrgNodeId, ...patch } = patchOrgAgentFilesBodySchema.parse(req.body);
    const node = store.patchOrgAgentFilesByManager(req.params.orgNodeId, actorOrgNodeId, patch);
    res.json(node);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Patch failed";
    if (msg === "Node not found") return res.status(404).json({ error: msg });
    if (msg.startsWith("Only direct manager")) return res.status(403).json({ error: msg });
    if (msg === "Company mismatch") return res.status(403).json({ error: msg });
    res.status(400).json({ error: msg });
  }
});

app.post("/api/cards", (req, res) => {
  const input = createCardSchema.parse(req.body);
  const card = store.createCard(input);
  res.status(201).json(card);
});

app.patch("/api/cards/:cardId/status", (req, res) => {
  const parsed = updateCardStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid status" });
  try {
    const card = store.updateCardStatus(req.params.cardId, parsed.data.status);
    res.json(card);
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : "Card not found" });
  }
});

app.post("/api/messages", (req, res) => {
  const input = createMessageSchema.parse(req.body);
  const message = store.createMessage(input);
  res.status(201).json(message);
});

app.get("/api/inbox/:companyId/:handle", (req, res) => {
  const handle = req.params.handle.toLowerCase();
  const messages = [...store.messages.values()].filter(
    (message) => message.companyId === req.params.companyId && message.mentions.includes(handle)
  );
  const escalations = [...store.escalations.values()].filter((esc) => {
    if (esc.companyId !== req.params.companyId) return false;
    if (esc.toOperator) {
      const company = store.companies.get(esc.companyId);
      return company?.operatorHandle === handle;
    }
    const toNode = esc.toOrgNodeId ? store.orgNodes.get(esc.toOrgNodeId) : null;
    return toNode?.handle === handle;
  });
  res.json({ messages, escalations });
});

app.post("/api/escalations", (req, res) => {
  const input = createEscalationSchema.parse(req.body);
  try {
    const escalation = store.createEscalation(input);
    res.status(201).json(escalation);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Escalation failed" });
  }
});

app.patch("/api/escalations/:id/answer", (req, res) => {
  const answer = String(req.body?.answer ?? "").trim();
  if (!answer) return res.status(400).json({ error: "Answer required" });
  try {
    const escalation = store.answerEscalation(req.params.id, answer);
    res.json(escalation);
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : "Escalation not found" });
  }
});

app.post("/api/cards/:id/run-codex", async (req, res) => {
  try {
    const prompt = String(req.body?.prompt ?? "").trim();
    if (!prompt) return res.status(400).json({ error: "Prompt required" });
    const result = await runCodexForCard({ cardId: req.params.id, prompt });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Codex run failed" });
  }
});

app.get("/api/cards/:id/run-log", (req, res) => {
  res.json({ log: store.runLogs.get(req.params.id) ?? [] });
});

const port = Number(process.env.PORT ?? 3200);
const heartbeatMs = Number(process.env.LEAN_HEARTBEAT_MS ?? 60_000);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`lean-api listening on http://localhost:${port}`);
  // eslint-disable-next-line no-console
  console.log(`[lean-api] agent heartbeats every ${heartbeatMs}ms (LEAN_HEARTBEAT_MS)`);
  setInterval(() => {
    for (const companyId of store.companies.keys()) {
      try {
        runCompanyHeartbeat(companyId);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[lean-api] heartbeat failed", companyId, err);
      }
    }
  }, heartbeatMs);
});
