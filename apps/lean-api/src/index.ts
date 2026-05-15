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
  patchCompanySettingsSchema,
  updateCardStatusSchema
} from "@lean/shared";
import { runCodexForCard } from "@lean/runner-codex";

const app = express();
app.use(cors());
app.use(express.json());

function buildAssistantPlanPrompt(projectName: string, goalText: string, kickoff: { title: string; description: string }) {
  return `You are the Planning Agent for project "${projectName}". You run on the Kodeks/Codex execution engine inside an autonomous project team.

Project goal (source of truth):
${goalText}

Your Kanban assignment:
Title: ${kickoff.title}
Description:
${kickoff.description}

Create a detailed implementation plan and publish it as Kanban cards. Include milestones, tasks/subtasks, dependencies, priorities, execution order, required boss decisions, and risks.

Deliver a concise written plan. If the goal is missing a required human decision, ask @boss in the narrative and include a card that captures the blocker.

IMPORTANT: After the narrative, append exactly ONE markdown JSON code block. Use this shape:
\`\`\`json
{"cards":[{"title":"Example planning card - replace with real work","description":"Describe one concrete task that advances this specific project goal.","priority":"high","dependencies":[],"risks":["Example risk"],"requiredUserDecision":null}]}
\`\`\`
Rules: Max 16 cards. Use only this agent model: Supervisor, PM, Planning, Developer, Recovery. PM owns goal delivery tracking, milestones, and daily progress reporting. No CEO, hiring, departments, company org chart, or generic task-manager language. Every card title should name one concrete action.`;
}

function buildAgentTaskPrompt(input: {
  companyName: string;
  goalText: string;
  agentName: string;
  agentHandle: string;
  role: string;
  cardTitle: string;
  cardDescription: string;
  cardConversation: string;
  agentMd: string;
  heartbeatMd: string;
  soulMd: string;
  toolsMd: string;
}) {
  return `You are @${input.agentHandle} (${input.agentName}), role: ${input.role}, in the company "${input.companyName}".

Project goal:
${input.goalText}

Current assigned card:
Title: ${input.cardTitle}
Description:
${input.cardDescription || "(no description)"}

Task conversation:
${input.cardConversation || "(no linked task conversation yet)"}

Your agent.md:
${input.agentMd}

Your HEARTBEAT.md:
${input.heartbeatMd}

Your SOUL.md:
${input.soulMd}

Your TOOLS.md:
${input.toolsMd}

Do the smallest useful unit of work for this card now. Return a concise progress note with:
1. What you did or decided.
2. Evidence or output for review.
3. Remaining blocker or next step.

Autonomy rules:
- Try to solve the task with available context before asking @boss.
- If a live path, paid action, credential, private file, or strategic choice is missing, first complete every safe audit, draft, simulation, or partial deliverable that does not require it.
- Ask @boss only for true blockers or strategic decisions that cannot be resolved safely by the agent team.
- Never move a card to Waiting for Boss just because more evidence would be nice.

Do not invent external state. If you truly need @boss before continuing, make the request actionable and self-contained.

IMPORTANT: After the narrative, append exactly ONE markdown JSON code block. Use this shape:
\`\`\`json
{"status":"done","summary":"What was completed and what evidence exists.","bossAsk":""}
\`\`\`
If you need @boss before continuing, use \`"status":"waiting_user"\` only when there is no safe autonomous workaround. Put one precise request in \`bossAsk\` using this format: "I need <specific decision/access/artifact>. Reason: <why it blocks the next step>. Default if no preference: <safe default>." Keep \`summary\` focused on evidence already gathered.
If you need Supervisor validation before execution, use \`"status":"waiting_supervisor"\` and summarize the execution plan.`;
}

type AssistantPlanCodexResult =
  | { ok: false; httpStatus: 404 | 409 | 400; error: string }
  | {
      ok: true;
      cardId: string;
      exitCode: number;
      log: string[];
      applied: { createdCards: number; errors: string[] } | null;
      planParsed: boolean;
    };

type AssistantTaskResult = {
  status: "done" | "waiting_user" | "waiting_supervisor";
  summary: string;
  bossAsk: string;
};

function extractAssistantTaskResult(logLines: string[]): AssistantTaskResult | null {
  const text = logLines.join("\n");
  const matches = [...text.matchAll(/```json\s*([\s\S]*?)```/gi)];
  for (const match of matches.reverse()) {
    if (!match[1]) continue;
    try {
      const parsed = JSON.parse(match[1].trim()) as Record<string, unknown>;
      const status =
        parsed.status === "waiting_user" || parsed.status === "boss"
          ? "waiting_user"
          : parsed.status === "waiting_supervisor" || parsed.status === "review"
            ? "waiting_supervisor"
            : parsed.status === "done"
              ? "done"
              : null;
      if (!status) continue;
      return {
        status,
        summary: String(parsed.summary ?? "").trim(),
        bossAsk: String(parsed.bossAsk ?? "").trim()
      };
    } catch {
      continue;
    }
  }
  return null;
}

function hasActionableBossAsk(parsed: AssistantTaskResult | null) {
  if (!parsed || parsed.status !== "waiting_user") return false;
  const ask = parsed.bossAsk.trim();
  if (!ask) return false;
  return /i need|please|provide|approve|choose|confirm|grant|share|send|select|authorize|decyduj|wybierz|zatwierd/i.test(ask);
}

function formatBossAskSummary(parsed: AssistantTaskResult, fallbackSummary: string) {
  const ask = parsed.bossAsk.trim();
  const summary = parsed.summary.trim();
  if (!ask) return fallbackSummary;
  if (summary && summary !== ask) return `Ask: ${ask}\n\nContext: ${summary}`;
  return `Ask: ${ask}`;
}

function inferBossDependency(cardTitle: string, cardDescription: string, parsed: AssistantTaskResult | null) {
  if (parsed) return hasActionableBossAsk(parsed);
  const taskText = `${cardTitle}\n${cardDescription}`;
  return /@boss|ask boss|confirm .*budget|analytics access|search console access|provide access|need .*decision|needs .*input/i.test(
    taskText
  );
}

function cleanCodexLog(logLines: string[]) {
  const cleaned: string[] = [];
  for (const entry of logLines) {
    if (entry.startsWith("[stderr]")) continue;
    for (const line of entry.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith("$ ")) continue;
      if (trimmed.startsWith("[stdin]")) continue;
      if (trimmed.startsWith("[stderr]")) continue;
      if (trimmed.startsWith("process_exit=")) continue;
      if (trimmed === "tokens used") continue;
      if (/^\d+(\.\d+)?$/.test(trimmed)) continue;
      cleaned.push(line);
    }
  }
  return cleaned.join("\n").trim();
}

function extractCodexError(logLines: string[]) {
  const stderr = logLines
    .filter((entry) => entry.startsWith("[stderr]"))
    .join("\n")
    .replace(/\[stderr\]\s*/g, "")
    .trim();
  const usageLimit = stderr.match(/You've hit your usage limit[\s\S]*?(?:try again at [^\n.]+|$)/i);
  if (usageLimit?.[0]) return usageLimit[0].trim();
  const explicitError = stderr
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("ERROR:"))
    .at(-1);
  return explicitError || "Codex run failed. Check the run log for details.";
}

function buildCardConversation(cardId: string, companyId: string) {
  return [...store.messages.values()]
    .filter((message) => message.companyId === companyId && message.linkedCardId === cardId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-10)
    .map((message) => {
      const author =
        message.authorType === "system"
          ? "system"
          : message.authorType === "user"
          ? "boss"
          : store.orgNodes.get(message.authorId ?? "")?.handle ?? "agent";
      const body = message.body.includes("--------\nmodel:")
        ? message.body.split("--------\nmodel:")[0]?.trim() || "Previous assistant run log omitted."
        : message.body;
      const compact = body.length > 900 ? `${body.slice(0, 900)}...` : body;
      return `[${new Date(message.createdAt).toISOString()}] @${author}: ${compact}`;
    })
    .join("\n\n");
}

function latestUserCommentMs(cardId: string, companyId: string) {
  let latest = 0;
  for (const message of store.messages.values()) {
    if (message.companyId !== companyId || message.linkedCardId !== cardId || message.authorType !== "user") continue;
    const ms = Date.parse(message.createdAt);
    if (Number.isFinite(ms) && ms > latest) latest = ms;
  }
  return latest;
}

function findRuntimeBlockedUserCard(companyId: string, assistantId: string) {
  return [...store.cards.values()].find(
    (card) =>
      card.companyId === companyId &&
      card.assigneeOrgNodeId === assistantId &&
      (card.status === "blocked" || card.status === "waiting_user") &&
      (card.completionSummary?.startsWith("Kodeks runtime needs attention:") ||
        card.completionSummary?.startsWith("Planning runtime needs attention:"))
  );
}

async function runAssistantPlanCodex(companyId: string): Promise<AssistantPlanCodexResult> {
  const company = store.companies.get(companyId);
  if (!company) return { ok: false, httpStatus: 404, error: "Project not found" };
  const goal = store.goals.get(company.goalId);
  const assistant = [...store.orgNodes.values()].find((n) => n.companyId === companyId && n.handle === "planner");
  if (!assistant) return { ok: false, httpStatus: 404, error: "Planning Agent not found" };
  const kickoff = findPlanningCard(companyId, assistant.id);
  if (!kickoff) return { ok: false, httpStatus: 404, error: "Planning card not found" };
  const prompt = buildAssistantPlanPrompt(company.name, goal?.description ?? "(none)", kickoff);

  try {
    const result = await runCodexForCard({ cardId: kickoff.id, prompt });
    const plan = result.exitCode === 0 ? store.extractAssistantPlanJsonFromLog(result.log) : null;
    let applied = { createdCards: 0, errors: [] as string[] };
    if (plan && result.exitCode === 0) {
      applied = store.applyAssistantPlanJson(companyId, assistant.id, plan);
      if (applied.createdCards > 0) {
        store.updateCardStatus(
          kickoff.id,
          "waiting_supervisor",
          `Planning Agent created ${applied.createdCards} task card(s) from the structured JSON plan. Supervisor validation is next.`
        );
      }
    }

    let body: string;
    if (result.exitCode !== 0) {
      const errorSummary = extractCodexError(result.log);
      store.updateCardStatus(
        kickoff.id,
        "blocked",
        `Planning runtime needs attention: ${errorSummary} The PM/Recovery flow should retry this planning card after the runtime is available again.`
      );
      body = `Planning heartbeat failed: ${errorSummary}`;
    } else if (plan && applied.createdCards > 0) {
      const warn = applied.errors.length ? ` Notes: ${applied.errors.join(" · ")}` : "";
      body = `Applied the project plan: ${applied.createdCards} new Kanban card(s). The planning card is waiting for Supervisor validation.${warn}`;
    } else if (plan) {
      body = `Parsed the JSON plan but created no cards (${applied.errors.join(" · ") || "empty or invalid entries"}).`;
    } else {
      const preview = cleanCodexLog(result.log).replace(/```json[\s\S]*?```/gi, "[json plan omitted]").slice(0, 1200);
      body = `No fenced json code block was found in the model output, so the Board was not updated. Re-run after the model emits a valid JSON plan block.\n\n${preview || "(empty)"}`;
    }

    store.createMessage({
      companyId,
      threadId: dmThreadId(assistant.handle, company.operatorHandle),
      authorType: "agent",
      authorId: assistant.id,
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
    const msg = error instanceof Error ? error.message : "Work engine run failed";
    store.createMessage({
      companyId,
      threadId: dmThreadId(assistant.handle, company.operatorHandle),
      authorType: "agent",
      authorId: assistant.id,
      body: `Planning heartbeat failed: ${msg}`,
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
    void runAssistantPlanCodex(created.company.id).catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[lean-api] planning auto-run after createProject:", err);
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Invalid body" });
  }
});

app.get("/api/companies", (_req, res) => {
  const companies = [...store.companies.values()].map((company) => {
    const cards = [...store.cards.values()].filter((card) => card.companyId === company.id);
    const org = [...store.orgNodes.values()].filter((node) => node.companyId === company.id);
    const heartbeatRuns = [...store.heartbeatRuns.values()].filter((run) => run.companyId === company.id);
    return {
      ...company,
      stats: {
        orgNodes: org.length,
        cards: cards.length,
        backlog: cards.filter((card) => card.status === "backlog").length,
        inProgress: cards.filter((card) => card.status === "in_progress").length,
        boss: cards.filter((card) => card.status === "waiting_user").length,
        inReview: cards.filter((card) => card.status === "waiting_supervisor").length,
        closed: cards.filter((card) => card.status === "done").length,
        heartbeatRuns: heartbeatRuns.length
      }
    };
  });
  res.json({ companies });
});

app.post("/api/companies/:companyId/assistant/run", async (req, res) => {
  const out = await runAssistantPlanCodex(req.params.companyId);
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

const activeAssistantHeartbeats = new Map<string, number>();
const ACTIVE_HEARTBEAT_STALE_MS = 15 * 60_000;

function findPlanningCard(companyId: string, assistantId: string) {
  return [...store.cards.values()]
    .filter(
      (card) =>
        card.companyId === companyId &&
        card.assigneeOrgNodeId === assistantId &&
        (card.title.includes("Generate autonomous project plan") || card.title.includes("Create the project plan"))
    )
    .sort((a, b) => {
      if (a.status !== "done" && b.status === "done") return -1;
      if (a.status === "done" && b.status !== "done") return 1;
      return a.title.localeCompare(b.title);
    })[0];
}

function createContinuationPlanningCard(companyId: string, plannerId: string) {
  const company = store.companies.get(companyId);
  if (!company) throw new Error("Project not found");
  const existing = [...store.cards.values()].find(
    (card) =>
      card.companyId === companyId &&
      card.assigneeOrgNodeId === plannerId &&
      card.status !== "done" &&
      card.title.includes("Generate autonomous project plan")
  );
  if (existing) return existing;

  const card = store.createCard({
    companyId,
    title: "Generate autonomous project plan - continuation",
    description:
      "All current execution cards are done. Re-read the project goal, previous task outputs, and conversations, then generate the next day-by-day traffic-growth tasks. Focus on actions that move epubtoepub.com toward qualified traffic and 10k MRR over time.",
    priority: "high",
    assigneeOrgNodeId: plannerId,
    goalId: company.goalId,
    dependencies: [],
    risks: ["Without a continuation plan, the autonomous project loop stalls after the first batch."],
    requiredUserDecision: null
  });
  return store.updateCardStatus(card.id, "in_progress");
}

async function executeAgentActiveCard(agentId: string) {
  const agent = store.orgNodes.get(agentId);
  if (!agent) throw new Error("Agent not found");
  const company = store.companies.get(agent.companyId);
  if (!company) throw new Error("Company not found");

  const activeCard = [...store.cards.values()]
    .filter((card) => card.companyId === agent.companyId && card.assigneeOrgNodeId === agent.id && card.status === "in_progress")
    .sort((a, b) => {
      const byBossComment = latestUserCommentMs(b.id, agent.companyId) - latestUserCommentMs(a.id, agent.companyId);
      return byBossComment !== 0 ? byBossComment : a.title.localeCompare(b.title);
    })[0];

  if (!activeCard) {
    store.createMessage({
      companyId: agent.companyId,
      threadId: dmThreadId(company.operatorHandle, agent.handle),
      authorType: "agent",
      authorId: agent.id,
      body: "Heartbeat checked in. I did not find an in-progress card to execute.",
      linkedCardId: null
    });
    return { engine: null };
  }

  const goal = store.goals.get(company.goalId);
  const result = await runCodexForCard({
    cardId: activeCard.id,
    prompt: buildAgentTaskPrompt({
      companyName: company.name,
      goalText: goal?.description ?? "(none)",
      agentName: agent.name,
      agentHandle: agent.handle,
      role: agent.role,
        cardTitle: activeCard.title,
        cardDescription: activeCard.description,
        cardConversation: buildCardConversation(activeCard.id, agent.companyId),
        agentMd: agent.files.agentMd,
      heartbeatMd: agent.files.heartbeatMd,
      soulMd: agent.files.soulMd,
      toolsMd: agent.files.toolsMd
    })
  });
  const withoutNoise = cleanCodexLog(result.log).replace(/```json[\s\S]*?```/gi, "[json omitted]").trim();
  const preview = withoutNoise.length > 1400 ? `${withoutNoise.slice(0, 1400)}...` : withoutNoise;
  const taskResult = result.exitCode === 0 ? extractAssistantTaskResult(result.log) : null;
  const summary = taskResult?.summary || preview || "Heartbeat completed the assigned task.";
  const needsUser = result.exitCode === 0 && inferBossDependency(activeCard.title, activeCard.description, taskResult);
  const invalidBossEscalation = result.exitCode === 0 && taskResult?.status === "waiting_user" && !needsUser;
  const nextStatus =
    taskResult?.status === "waiting_supervisor" || invalidBossEscalation ? "waiting_supervisor" : needsUser ? "waiting_user" : "done";
  const statusSummary =
    needsUser && taskResult
      ? formatBossAskSummary(taskResult, summary)
      : invalidBossEscalation
        ? `Supervisor review needed: the agent tried to escalate to @boss without a clear actionable blocker.\n\nAgent summary: ${summary}`
        : summary;

  if (result.exitCode === 0) {
    store.updateCardStatus(activeCard.id, nextStatus, statusSummary);
    if (needsUser) {
      store.createMessage({
        companyId: agent.companyId,
        threadId: dmThreadId(company.operatorHandle, agent.handle),
        authorType: "agent",
        authorId: agent.id,
        body: statusSummary,
        linkedCardId: activeCard.id
      });
    }
  } else {
    const errorSummary = extractCodexError(result.log);
    store.updateCardStatus(
      activeCard.id,
      "blocked",
      `Kodeks runtime needs attention: ${errorSummary} PM/Recovery should retry this card after the runtime is available again.`
    );
  }
  store.createMessage({
    companyId: agent.companyId,
    threadId: dmThreadId(company.operatorHandle, agent.handle),
    authorType: "agent",
    authorId: agent.id,
    body:
      result.exitCode === 0
        ? needsUser
          ? `Moved "${activeCard.title}" to Waiting for Boss.\n\n${statusSummary}`
          : nextStatus === "waiting_supervisor"
            ? `Moved "${activeCard.title}" to Waiting for Supervisor.\n\n${statusSummary}`
            : `Completed "${activeCard.title}" and moved it to Done.\n\n${statusSummary}`
        : `Moved "${activeCard.title}" to Blocked because the Kodeks runtime failed with exit ${result.exitCode}.\n\n${extractCodexError(result.log)}`,
    linkedCardId: activeCard.id
  });

  return { engine: { cardId: result.cardId, exitCode: result.exitCode } };
}

async function runAssistantHeartbeat(companyId: string, options: { force: boolean }) {
  const company = store.companies.get(companyId);
  if (!company) return { ok: false as const, httpStatus: 404 as const, error: "Project not found" };
  const planner = [...store.orgNodes.values()].find((n) => n.companyId === companyId && n.handle === "planner");
  const developer = [...store.orgNodes.values()].find((n) => n.companyId === companyId && n.handle === "developer");
  if (!planner || !developer) return { ok: false as const, httpStatus: 404 as const, error: "Project agents not found" };

  const activeSince = activeAssistantHeartbeats.get(companyId);
  if (activeSince && Date.now() - activeSince < ACTIVE_HEARTBEAT_STALE_MS) {
    return { ok: true as const, heartbeat: null, engine: null, message: "Project heartbeat is already running." };
  }
  if (activeSince) activeAssistantHeartbeats.delete(companyId);

  activeAssistantHeartbeats.set(companyId, Date.now());
  try {
    const hasActiveCard = [...store.cards.values()].some(
      (card) => card.companyId === companyId && card.assigneeOrgNodeId === developer.id && card.status === "in_progress"
    );
    const runtimeBlockedCard = findRuntimeBlockedUserCard(companyId, developer.id);
    if (!hasActiveCard && runtimeBlockedCard) {
      return {
        ok: true as const,
        heartbeat: null,
        engine: null,
        message: `Kodeks runtime is blocked on "${runtimeBlockedCard.title}". PM/Recovery should retry it when the runtime is available.`
      };
    }

    const kickoff = findPlanningCard(companyId, planner.id);

    if (kickoff && kickoff.status !== "waiting_supervisor" && kickoff.status !== "done") {
      const heartbeat = store.runHeartbeatForAgent(planner.id, 1, { force: options.force });
      const engine = await runAssistantPlanCodex(companyId);
      if (!engine.ok) return { ok: false as const, httpStatus: engine.httpStatus, error: engine.error, heartbeat };
      return { ok: true as const, heartbeat, engine };
    }

    const waitingForSupervisor = [...store.cards.values()].some(
      (card) => card.companyId === companyId && card.status === "waiting_supervisor"
    );
    if (waitingForSupervisor) {
      const supervisor = store.runSupervisorValidation(companyId, { force: options.force });
      return { ok: true as const, heartbeat: supervisor.run, engine: null, supervisor };
    }

    const hasOpenDeveloperWork = [...store.cards.values()].some(
      (card) => card.companyId === companyId && card.assigneeOrgNodeId === developer.id && card.status !== "done"
    );
    const hasOpenPlannerWork = [...store.cards.values()].some(
      (card) => card.companyId === companyId && card.assigneeOrgNodeId === planner.id && card.status !== "done"
    );
    if (!hasOpenDeveloperWork && !hasOpenPlannerWork) {
      createContinuationPlanningCard(companyId, planner.id);
      const heartbeat = store.runHeartbeatForAgent(planner.id, 1, { force: options.force });
      const engine = await runAssistantPlanCodex(companyId);
      if (!engine.ok) return { ok: false as const, httpStatus: engine.httpStatus, error: engine.error, heartbeat };
      return { ok: true as const, heartbeat, engine };
    }

    const heartbeat = store.runHeartbeatForAgent(developer.id, 1, { force: options.force });
    const work = await executeAgentActiveCard(developer.id);
    return { ok: true as const, heartbeat, ...work };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Project heartbeat failed";
    if (msg === "Agent heartbeat is not due yet") {
      return { ok: true as const, heartbeat: null, engine: null, message: msg };
    }
    return { ok: false as const, httpStatus: 409 as const, error: msg };
  } finally {
    activeAssistantHeartbeats.delete(companyId);
  }
}

function runCompanyHeartbeat(companyId: string) {
  return runAssistantHeartbeat(companyId, { force: false });
}

app.post("/api/companies/:companyId/heartbeat", async (req, res) => {
  const out = await runAssistantHeartbeat(req.params.companyId, { force: true });
  if (!out.ok) {
    res.status(out.httpStatus).json({ error: out.error });
    return;
  }
  res.json(out);
});

async function handleAssistantHeartbeat(req: express.Request, res: express.Response) {
  const out = await runAssistantHeartbeat(req.params.companyId, { force: true });
  if (!out.ok) {
    res.status(out.httpStatus).json({ error: out.error });
    return;
  }
  res.json(out);
}

function runDuePmReports(now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const hhmm = now.toTimeString().slice(0, 5);
  for (const companyId of store.companies.keys()) {
    const settings = store.getCompanySettings(companyId);
    if (hhmm < settings.dailyReportTime) continue;
    const alreadyReported = [...store.dailyReports.values()].some((report) => report.companyId === companyId && report.reportDate === today);
    if (!alreadyReported) store.generateDailyReport(companyId);
  }
}

app.post("/api/companies/:companyId/planner/heartbeat", handleAssistantHeartbeat);
app.post("/api/companies/:companyId/developer/heartbeat", handleAssistantHeartbeat);
app.post("/api/companies/:companyId/assistant/heartbeat", handleAssistantHeartbeat);

app.post("/api/agents/:agentId/heartbeat", async (req, res) => {
  try {
    const agent = store.orgNodes.get(req.params.agentId);
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    const company = store.companies.get(agent.companyId);
    if (!company) return res.status(404).json({ error: "Company not found" });

    if (agent.handle === "planner" || agent.handle === "developer") {
      const out = await runAssistantHeartbeat(agent.companyId, { force: true });
      if (!out.ok) {
        res.status(out.httpStatus).json({ error: out.error });
        return;
      }
      res.json(out);
      return;
    }

    if (agent.handle === "pm" || agent.role === "pm") {
      const out = store.runHeartbeatForAgent(agent.id, 0, { force: true });
      const report = store.generateDailyReport(agent.companyId);
      res.json({ ...out, report });
      return;
    }

    const out = store.runHeartbeatForAgent(agent.id, 1, { force: true });
    const work = await executeAgentActiveCard(agent.id);
    res.json({ ...out, ...work });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Agent heartbeat failed";
    const status = msg === "Agent not found" || msg === "Company not found" ? 404 : 409;
    res.status(status).json({ error: msg });
  }
});

app.get("/api/companies/:companyId/bootstrap", (req, res) => {
  const companyId = req.params.companyId;
  const company = store.companies.get(companyId);
  if (!company) return res.status(404).json({ error: "Project not found" });
  const goal = store.goals.get(company.goalId) ?? null;
  const org = [...store.orgNodes.values()].filter((n) => n.companyId === companyId);
  const columns = [...store.columns.values()]
    .filter((c) => c.companyId === companyId)
    .sort((a, b) => a.order - b.order);
  const cards = [...store.cards.values()].filter((c) => c.companyId === companyId);
  const messages = [...store.messages.values()].filter((m) => m.companyId === companyId);
  const escalations = [...store.escalations.values()].filter((e) => e.companyId === companyId);
  const settings = store.getCompanySettings(companyId);
  const heartbeatRuns = [...store.heartbeatRuns.values()]
    .filter((r) => r.companyId === companyId)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
    .slice(0, 50);
  const dailyReports = [...store.dailyReports.values()]
    .filter((r) => r.companyId === companyId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 30);
  res.json({ company, goal, org, columns, cards, messages, escalations, settings, heartbeatRuns, dailyReports });
});

app.patch("/api/companies/:companyId/settings", (req, res) => {
  try {
    const patch = patchCompanySettingsSchema.parse(req.body);
    const settings = store.updateCompanySettings(req.params.companyId, patch);
    res.json(settings);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Invalid settings";
    res.status(msg === "Company not found" ? 404 : 400).json({ error: msg });
  }
});

app.post("/api/companies/:companyId/daily-report", (req, res) => {
  try {
    const report = store.generateDailyReport(req.params.companyId);
    res.status(201).json(report);
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : "Company not found" });
  }
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
    const existing = store.cards.get(req.params.cardId);
    if (!existing) return res.status(404).json({ error: "Card not found" });
    if (parsed.data.status === "done" && existing.status !== "done" && !parsed.data.completionSummary?.trim()) {
      return res.status(400).json({ error: "Closing a task requires a completion summary." });
    }
    const card = store.updateCardStatus(req.params.cardId, parsed.data.status, parsed.data.completionSummary);
    if (parsed.data.status === "in_progress" && (existing.status === "waiting_user" || existing.status === "blocked") && card.assigneeOrgNodeId) {
      store.markAgentDueNow(card.assigneeOrgNodeId);
    }
    if (parsed.data.status === "done" && existing.status !== "done" && parsed.data.completionSummary?.trim()) {
      const company = store.companies.get(card.companyId);
      const assignee = card.assigneeOrgNodeId ? store.orgNodes.get(card.assigneeOrgNodeId) : null;
      store.createMessage({
        companyId: card.companyId,
        threadId: assignee && company ? dmThreadId(company.operatorHandle, assignee.handle) : "general",
        authorType: "system",
        authorId: null,
        body: `Closed "${card.title}".\n\nSummary:\n${parsed.data.completionSummary.trim()}`,
        linkedCardId: card.id
      });
    }
    res.json(card);
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : "Card not found" });
  }
});

app.post("/api/messages", (req, res) => {
  const input = createMessageSchema.parse(req.body);
  const message = store.createMessage(input);
  const actionCard = store.createActionCardFromMessage(message);
  res.status(201).json({ message, actionCard });
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

const port = Number(process.env.PORT ?? 3200);
const heartbeatMs = Number(process.env.LEAN_HEARTBEAT_MS ?? 60_000);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`lean-api listening on http://localhost:${port}`);
  // eslint-disable-next-line no-console
  console.log(`[lean-api] scheduler checks every ${heartbeatMs}ms (LEAN_HEARTBEAT_MS); company settings decide whether agents are due`);
  setInterval(() => {
    for (const companyId of store.companies.keys()) {
      void runCompanyHeartbeat(companyId).catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[lean-api] heartbeat failed", companyId, err);
      });
    }
    try {
      runDuePmReports();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[lean-api] PM report scheduler failed", err);
    }
  }, heartbeatMs);
});
