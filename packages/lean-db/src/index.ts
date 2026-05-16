import {
  dmThreadId,
  type AgentMarkdownPack,
  type BoardCard,
  type BoardColumn,
  type ChannelMessage,
  type CardPriority,
  type Company,
  type CompanySettings,
  type CommentAttachment,
  type DailyReport,
  type Escalation,
  type Goal,
  type HeartbeatRun,
  type OrgNode,
  type Role,
  type CardStatus,
  type ValueCategory
} from "@lean/shared";
import { randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  defaultDeveloperMarkdownPack,
  defaultPlannerMarkdownPack,
  defaultPmMarkdownPack,
  defaultRecoveryMarkdownPack,
  defaultSupervisorMarkdownPack,
  mergeAgentPack
} from "./agent-templates.js";

function uid() {
  return randomUUID();
}

function extractMentions(text: string): string[] {
  const matches = text.match(/@([a-zA-Z0-9_-]+)/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
}

function cleanConversationBody(text: string) {
  const runTranscriptMarker = /(?:^|\n)--------\nmodel:/;
  const withoutRunTranscript = runTranscriptMarker.test(text)
    ? text.split(runTranscriptMarker)[0]?.trim() || "Assistant run details omitted."
    : text;

  return withoutRunTranscript
    .replace(/Heartbeat work pass failed on "([^"]+)" with exit \d+\.\s*(?:\n+|\s*)\(no output\)/g, 'Assistant runtime failed on "$1".')
    .replace(/Heartbeat work pass failed on "([^"]+)" with exit \d+\./g, 'Assistant runtime failed on "$1".')
    .trim();
}

export type AssistantPlanJson = {
  cards?: Array<{
    title?: string;
    description?: string;
    priority?: string;
    dependencies?: string[];
    risks?: string[];
    requiredUserDecision?: string | null;
    valueCategory?: string | null;
    targetMetric?: string | null;
    baseline?: string | null;
    successThreshold?: string | null;
    measurementMethod?: string | null;
    expectedImpact?: number | string | null;
    confidence?: number | string | null;
    effort?: number | string | null;
  }>;
};

type LeanSnapshot = {
  companies: Company[];
  settings: CompanySettings[];
  goals: Goal[];
  orgNodes: OrgNode[];
  columns: BoardColumn[];
  cards: BoardCard[];
  messages: ChannelMessage[];
  escalations: Escalation[];
  heartbeatRuns: HeartbeatRun[];
  dailyReports: DailyReport[];
  runLogs: Array<[string, string[]]>;
};

function normalizeCardStatus(raw: string | undefined): CardStatus {
  if (raw === "done" || raw === "closed") return "done";
  if (raw === "in_progress") return "in_progress";
  if (raw === "planned" || raw === "todo") return "planned";
  if (raw === "waiting_supervisor" || raw === "in_review") return "waiting_supervisor";
  if (raw === "waiting_user" || raw === "boss") return "waiting_user";
  if (raw === "blocked") return "blocked";
  return "backlog";
}

function normalizeCardPriority(raw: string | undefined): CardPriority {
  if (raw === "critical" || raw === "high" || raw === "low") return raw;
  return "medium";
}

function normalizeValueCategory(raw: string | null | undefined): ValueCategory | null {
  if (
    raw === "acquisition" ||
    raw === "activation" ||
    raw === "retention" ||
    raw === "revenue" ||
    raw === "learning" ||
    raw === "infrastructure"
  ) {
    return raw;
  }
  return null;
}

function normalizeValueScore(raw: number | string | null | undefined): number | null {
  const n = typeof raw === "number" ? raw : Number.parseFloat(String(raw ?? ""));
  if (!Number.isFinite(n)) return null;
  return Math.min(5, Math.max(1, Math.round(n)));
}

function cleanOptionalText(raw: unknown, max = 500): string | null {
  const text = String(raw ?? "").trim();
  return text ? text.slice(0, max) : null;
}

export class LeanStore {
  readonly companies = new Map<string, Company>();
  readonly settings = new Map<string, CompanySettings>();
  readonly goals = new Map<string, Goal>();
  readonly orgNodes = new Map<string, OrgNode>();
  readonly columns = new Map<string, BoardColumn>();
  readonly cards = new Map<string, BoardCard>();
  readonly messages = new Map<string, ChannelMessage>();
  readonly escalations = new Map<string, Escalation>();
  readonly heartbeatRuns = new Map<string, HeartbeatRun>();
  readonly dailyReports = new Map<string, DailyReport>();
  readonly runLogs = new Map<string, string[]>();

  constructor(private readonly snapshotPath = process.env.LEAN_DB_FILE ?? join(process.cwd(), "data", "lean-store.json")) {
    this.loadSnapshot();
  }

  private persist() {
    mkdirSync(dirname(this.snapshotPath), { recursive: true });
    if (existsSync(this.snapshotPath)) {
      try {
        copyFileSync(this.snapshotPath, `${this.snapshotPath}.bak`);
      } catch {
        // Best-effort only; the temp write below is still atomic.
      }
    }
    const snapshot: LeanSnapshot = {
      companies: [...this.companies.values()],
      settings: [...this.settings.values()],
      goals: [...this.goals.values()],
      orgNodes: [...this.orgNodes.values()],
      columns: [...this.columns.values()],
      cards: [...this.cards.values()],
      messages: [...this.messages.values()],
      escalations: [...this.escalations.values()],
      heartbeatRuns: [...this.heartbeatRuns.values()],
      dailyReports: [...this.dailyReports.values()],
      runLogs: [...this.runLogs.entries()]
    };
    const tempPath = `${this.snapshotPath}.${process.pid}.tmp`;
    writeFileSync(tempPath, JSON.stringify(snapshot, null, 2));
    renameSync(tempPath, this.snapshotPath);
  }

  private loadSnapshot() {
    if (!existsSync(this.snapshotPath)) return;
    try {
      const raw = readFileSync(this.snapshotPath, "utf8");
      if (!raw.trim()) {
        this.loadSnapshotBackup();
        return;
      }
      const snapshot = JSON.parse(raw) as Partial<LeanSnapshot>;
      this.applySnapshot(snapshot);
    } catch (error) {
      if (this.loadSnapshotBackup()) return;
      // eslint-disable-next-line no-console
      console.error("[lean-db] failed to load snapshot", this.snapshotPath, error);
    }
  }

  private loadSnapshotBackup() {
    const backupPath = `${this.snapshotPath}.bak`;
    if (!existsSync(backupPath)) return false;
    try {
      const raw = readFileSync(backupPath, "utf8");
      if (!raw.trim()) return false;
      const snapshot = JSON.parse(raw) as Partial<LeanSnapshot>;
      this.applySnapshot(snapshot);
      copyFileSync(backupPath, this.snapshotPath);
      return true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[lean-db] failed to load snapshot backup", backupPath, error);
      return false;
    }
  }

  private applySnapshot(snapshot: Partial<LeanSnapshot>) {
    for (const item of snapshot.companies ?? []) {
      const goal = snapshot.goals?.find((g) => g.id === item.goalId);
      this.companies.set(item.id, {
        ...item,
        memory: item.memory ?? {
          objective: goal?.description ?? "",
          strategicDecisions: [],
          executionHistory: [],
          failuresAndRetries: [],
          supervisorEvaluations: []
        }
      });
    }
    for (const item of snapshot.settings ?? []) {
      this.settings.set(item.companyId, {
        ...item,
        supervisorValidationRequired: item.supervisorValidationRequired ?? true
      });
    }
    for (const item of snapshot.goals ?? []) this.goals.set(item.id, item);
    for (const item of snapshot.orgNodes ?? []) this.orgNodes.set(item.id, item);
    for (const item of snapshot.columns ?? []) {
      const rawStatus = String(item.status);
      const status = normalizeCardStatus(rawStatus);
      this.columns.set(item.id, { ...item, status });
    }
    for (const item of snapshot.cards ?? []) {
      this.cards.set(item.id, {
        ...item,
        status: normalizeCardStatus(String(item.status)),
        priority: normalizeCardPriority(String(item.priority)),
        dependencies: item.dependencies ?? [],
        risks: item.risks ?? [],
        requiredUserDecision: item.requiredUserDecision ?? null
      });
    }
    for (const item of snapshot.messages ?? []) this.messages.set(item.id, { ...item, attachments: item.attachments ?? [] });
    for (const item of snapshot.escalations ?? []) this.escalations.set(item.id, item);
    for (const item of snapshot.heartbeatRuns ?? []) this.heartbeatRuns.set(item.id, item);
    for (const item of snapshot.dailyReports ?? []) this.dailyReports.set(item.id, item);
    for (const [key, value] of snapshot.runLogs ?? []) this.runLogs.set(key, value);
    this.sanitizeVisibleEngineNames();
    for (const company of this.companies.values()) {
      if (company.operatorHandle !== "boss") this.companies.set(company.id, { ...company, operatorHandle: "boss" });
      this.ensureBoardColumns(company.id);
      this.ensureProjectAgentTeam(this.companies.get(company.id) ?? company);
    }
  }

  private ensureProjectAgentTeam(company: Company) {
    const allowedRoles = new Set(["supervisor", "pm", "planner", "developer", "recovery", "operator", "custom"]);
    const before = [...this.orgNodes.values()].filter((node) => node.companyId === company.id);
    const legacyIds = new Set(before.filter((node) => !allowedRoles.has(node.role) || ["assistant", "ceo", "hiring"].includes(node.handle)).map((node) => node.id));
    for (const id of legacyIds) this.orgNodes.delete(id);

    const existing = () => [...this.orgNodes.values()].filter((node) => node.companyId === company.id);
    const makeNode = (
      role: Extract<Role, "supervisor" | "pm" | "planner" | "developer" | "recovery">,
      name: string,
      handle: string,
      reportsToId: string | null,
      subtreeSkillsManifest: string[],
      files: AgentMarkdownPack
    ): OrgNode => {
      const current = existing().find((node) => node.handle === handle || node.role === role);
      if (current) {
        const next = {
          ...current,
          name,
          handle,
          role,
          reportsToId,
          subtreeSkillsManifest,
          files
        };
        this.orgNodes.set(current.id, next);
        return next;
      }
      const node: OrgNode = {
        id: uid(),
        companyId: company.id,
        name,
        handle,
        role,
        reportsToId,
        subtreeSkillsManifest,
        files,
        lastHeartbeatAt: null
      };
      this.orgNodes.set(node.id, node);
      return node;
    };

    const supervisor = makeNode(
      "supervisor",
      "Supervisor Agent",
      "supervisor",
      null,
      ["strategic-alignment", "risk-review", "approval-gates"],
      defaultSupervisorMarkdownPack(company.name)
    );
    makeNode(
      "pm",
      "PM Agent",
      "pm",
      supervisor.id,
      ["goal-delivery", "milestones", "daily-reporting", "progress-tracking"],
      defaultPmMarkdownPack(company.name)
    );
    const planner = makeNode(
      "planner",
      "Planning Agent",
      "planner",
      supervisor.id,
      ["milestones", "dependencies", "prioritization", "replanning"],
      defaultPlannerMarkdownPack(company.name)
    );
    const developer = makeNode(
      "developer",
      "Developer Agent",
      "developer",
      supervisor.id,
      ["task-execution", "deliverables", "implementation-plans"],
      defaultDeveloperMarkdownPack(company.name)
    );
    makeNode(
      "recovery",
      "Heartbeat / Recovery Agent",
      "recovery",
      supervisor.id,
      ["stalled-execution-detection", "continuity", "retry-recovery"],
      defaultRecoveryMarkdownPack(company.name)
    );

    for (const [id, card] of this.cards) {
      if (card.companyId !== company.id) continue;
      const shouldReassign = card.assigneeOrgNodeId == null || legacyIds.has(card.assigneeOrgNodeId) || !this.orgNodes.has(card.assigneeOrgNodeId);
      const isPlanningCard = card.title.includes("Create the project plan") || card.title.includes("Generate autonomous project plan");
      this.cards.set(id, {
        ...card,
        title: card.title.includes("Create the project plan") ? "Generate autonomous project plan" : card.title,
        assigneeOrgNodeId: shouldReassign ? (isPlanningCard ? planner.id : developer.id) : card.assigneeOrgNodeId
      });
    }
  }

  private sanitizeVisibleEngineNames() {
    const clean = (text: string) =>
      text
        .replace(/Codex runs automatically/g, "Agent heartbeats run automatically")
        .replace(/Codex run/g, "structured planning pass")
        .replace(/run \*\*Codex\*\*/g, "use your heartbeat")
        .replace(/Run Codex/g, "Kick heartbeat")
        .replace(/Re-run CEO kickoff \(Codex\)/g, "Kick CEO planning heartbeat")
        .replace(/Codex kickoff/g, "planning heartbeat")
        .replace(/codex exec/g, "engine run")
        .replace(/the the work engine engine/g, "the Codex engine")
        .replace(/the work engine engine/g, "Codex engine")
        .replace(/\|"in_review"/g, "")
        .replace(/"in_review"\|/g, "")
        .replace(/\|"in_review"\|/g, "|")
        .replace(/Move the card to In review when waiting for @boss approval; create the hire only after approval\./g, "If @boss approval is needed, create or assign a clear task to @boss instead of parking work in a review status. Create the hire only after approval.")
        .replace(/write a direct message in `dm-assistant-boss` and leave the task in progress with the blocker stated\./g, "write a direct message in `dm-assistant-boss` and move the task to Boss with the blocker stated.")
        .replace(/If blocked by missing human input, DM @boss in `dm-assistant-boss` with a precise question\./g, "If blocked by missing human input, DM @boss in `dm-assistant-boss` with a precise question and move the card to Boss.")
        .replace(/This card is already In review and waiting on you\./g, "This now needs a delegated follow-up task if action is still required.")
        .replace(/card\(s\) are In review—ping @boss in this thread or #general if you need a decision so work can keep moving\./g, "card(s) were waiting for review. Create explicit follow-up tasks for whoever owns the next action.")
        .replace(/\bBoss\b/g, "Waiting for Boss")
        .replace(/Waiting for Waiting for Boss/g, "Waiting for Boss")
        .replace(/\bReview\b/g, "Waiting for Supervisor")
        .replace(/Waiting for Waiting for Supervisor/g, "Waiting for Supervisor")
        .replace(/\bClosed\b/g, "Done")
        .replace(/\bAssistant\b/g, "Developer Agent")
        .replace(/\bassistant\b/g, "developer");

    for (const [id, card] of this.cards) {
      const cleanedSummary = card.completionSummary ? clean(card.completionSummary) : card.completionSummary;
      const clearerBossSummary =
        card.status === "waiting_user" &&
        cleanedSummary &&
        !/^Ask:/i.test(cleanedSummary) &&
        /please provide|please approve|authorize|provide or approve|choose|confirm|grant|share|send|select/i.test(cleanedSummary)
          ? `Ask: ${cleanedSummary}`
          : cleanedSummary;
      this.cards.set(id, {
        ...card,
        title: clean(card.title),
        description: clean(card.description),
        completionSummary: clearerBossSummary
      });
    }
    for (const [id, message] of this.messages) {
      this.messages.set(id, { ...message, body: cleanConversationBody(clean(message.body)) });
    }
    for (const [id, node] of this.orgNodes) {
      this.orgNodes.set(id, {
        ...node,
        files: {
          agentMd: clean(node.files.agentMd),
          heartbeatMd: clean(node.files.heartbeatMd),
          soulMd: clean(node.files.soulMd),
          toolsMd: clean(node.files.toolsMd)
        }
      });
    }
  }

  createCompany(input: {
    name: string;
    goalDescription: string;
  }) {
    const companyId = uid();
    const goalId = uid();
    const company: Company = {
      id: companyId,
      name: input.name,
      goalId,
      operatorHandle: "boss",
      memory: {
        objective: input.goalDescription,
        strategicDecisions: [],
        executionHistory: ["Project initialized from a high-level business objective."],
        failuresAndRetries: [],
        supervisorEvaluations: []
      }
    };
    const goal: Goal = {
      id: goalId,
      companyId,
      title: `${input.name} main goal`,
      description: input.goalDescription
    };
    this.companies.set(company.id, company);
    this.settings.set(company.id, {
      companyId: company.id,
      heartbeatIntervalMinutes: 10,
      dailyReportTime: "09:00",
      supervisorValidationRequired: true
    });
    this.goals.set(goal.id, goal);
    this.seedBoard(companyId);
    const { developer, kickoff } = this.bootstrapProjectAgents(company, goal);
    this.persist();
    return { company, goal, kickoffCardId: kickoff.id, assistantId: developer.id };
  }

  private bootstrapProjectAgents(company: Company, goal: Goal): { developer: OrgNode; kickoff: BoardCard } {
    const supervisor = this.createOrgNode({
      actorOrgNodeId: null,
      companyId: company.id,
      name: "Supervisor Agent",
      handle: "supervisor",
      role: "supervisor",
      reportsToId: null,
      subtreeSkillsManifest: ["strategic-alignment", "risk-review", "approval-gates"],
      ...defaultSupervisorMarkdownPack(company.name)
    });

    const pm = this.createOrgNode({
      actorOrgNodeId: supervisor.id,
      companyId: company.id,
      name: "PM Agent",
      handle: "pm",
      role: "pm",
      reportsToId: supervisor.id,
      subtreeSkillsManifest: ["goal-delivery", "milestones", "daily-reporting", "progress-tracking"],
      ...defaultPmMarkdownPack(company.name)
    });

    const planner = this.createOrgNode({
      actorOrgNodeId: supervisor.id,
      companyId: company.id,
      name: "Planning Agent",
      handle: "planner",
      role: "planner",
      reportsToId: supervisor.id,
      subtreeSkillsManifest: ["milestones", "dependencies", "prioritization", "replanning"],
      ...defaultPlannerMarkdownPack(company.name)
    });

    const developer = this.createOrgNode({
      actorOrgNodeId: supervisor.id,
      companyId: company.id,
      name: "Developer Agent",
      handle: "developer",
      role: "developer",
      reportsToId: supervisor.id,
      subtreeSkillsManifest: ["task-execution", "deliverables", "implementation-plans"],
      ...defaultDeveloperMarkdownPack(company.name)
    });

    this.createOrgNode({
      actorOrgNodeId: supervisor.id,
      companyId: company.id,
      name: "Heartbeat / Recovery Agent",
      handle: "recovery",
      role: "recovery",
      reportsToId: supervisor.id,
      subtreeSkillsManifest: ["stalled-execution-detection", "continuity", "retry-recovery"],
      ...defaultRecoveryMarkdownPack(company.name)
    });

    const kickoff = this.createCard({
      companyId: company.id,
      title: "Generate autonomous project plan",
      description:
        "Analyze the project goal and generate milestones, tasks, subtasks, dependencies, priorities, execution order, required boss decisions, and risks. Publish the result onto the Kanban board.",
      priority: "critical",
      assigneeOrgNodeId: planner.id,
      goalId: goal.id,
      dependencies: [],
      risks: ["Planning quality determines execution quality."],
      requiredUserDecision: null
    });
    this.updateCardStatus(kickoff.id, "in_progress");

    this.createMessage({
      companyId: company.id,
      threadId: "general",
      authorType: "system",
      authorId: null,
      body: "Project created. Supervisor, PM, Planning, Developer, and Recovery agents are active. Planning has started and PM will track delivery against the goal.",
      linkedCardId: kickoff.id
    });
    this.createMessage({
      companyId: company.id,
      threadId: dmThreadId(pm.handle, company.operatorHandle),
      authorType: "agent",
      authorId: pm.id,
      body: "I will own goal delivery tracking, maintain the milestone view, and issue daily progress reports in the Goal tab.",
      linkedCardId: kickoff.id
    });
    this.createMessage({
      companyId: company.id,
      threadId: dmThreadId(planner.handle, company.operatorHandle),
      authorType: "agent",
      authorId: planner.id,
      body:
        goal.description.trim().length < 30
          ? "@boss I need a little more goal detail before I can produce a useful plan. What outcome should this project reach, and what constraints matter?"
          : "I will turn the goal into milestones and executable tasks. Anything that needs your decision will be moved to Waiting for Boss with a direct question.",
      linkedCardId: kickoff.id
    });
    return { developer, kickoff };
  }

  private seedBoard(companyId: string) {
    this.ensureBoardColumns(companyId);
  }

  private ensureBoardColumns(companyId: string) {
    const defs: Array<{ title: string; status: CardStatus }> = [
      { title: "Backlog", status: "backlog" },
      { title: "Planned", status: "planned" },
      { title: "In progress", status: "in_progress" },
      { title: "Waiting for Supervisor", status: "waiting_supervisor" },
      { title: "Waiting for Boss", status: "waiting_user" },
      { title: "Blocked", status: "blocked" },
      { title: "Done", status: "done" }
    ];
    defs.forEach((d, index) => {
      const existing = [...this.columns.values()].find((col) => col.companyId === companyId && col.status === d.status);
      if (existing) {
        this.columns.set(existing.id, { ...existing, title: d.title, order: index });
        return;
      }
      const id = uid();
      this.columns.set(id, {
        id,
        companyId,
        title: d.title,
        status: d.status,
        order: index
      });
    });
  }

  createOrgNode(
    input: Omit<OrgNode, "id" | "files" | "lastHeartbeatAt"> & {
      actorOrgNodeId: string | null;
      agentMd?: string;
      heartbeatMd?: string;
      soulMd?: string;
      toolsMd?: string;
    }
  ) {
    if (input.reportsToId) {
      const manager = this.orgNodes.get(input.reportsToId);
      if (!manager) throw new Error("Manager not found");
      const actor = input.actorOrgNodeId ? this.orgNodes.get(input.actorOrgNodeId) : null;
      const actorCanCoordinate = actor?.companyId === manager.companyId && actor.role === "supervisor";
      if (input.actorOrgNodeId !== manager.id && !actorCanCoordinate) {
        throw new Error("Only the direct manager or Supervisor Agent can create this subordinate");
      }
    }
    const companyName = this.companies.get(input.companyId)?.name ?? "Company";
    const manager = input.reportsToId ? this.orgNodes.get(input.reportsToId) : null;
    const managerHandle = manager?.handle ?? "supervisor";
    const handleLc = input.handle.toLowerCase();
    const baseFiles: AgentMarkdownPack =
      input.role === "supervisor"
        ? defaultSupervisorMarkdownPack(companyName)
        : input.role === "pm"
          ? defaultPmMarkdownPack(companyName)
          : input.role === "planner"
            ? defaultPlannerMarkdownPack(companyName)
            : input.role === "recovery"
              ? defaultRecoveryMarkdownPack(companyName)
              : defaultDeveloperMarkdownPack(companyName, input.name, handleLc, managerHandle);
    const files = mergeAgentPack(baseFiles, {
      agentMd: input.agentMd,
      heartbeatMd: input.heartbeatMd,
      soulMd: input.soulMd,
      toolsMd: input.toolsMd
    });
    const node: OrgNode = {
      id: uid(),
      companyId: input.companyId,
      name: input.name,
      handle: handleLc,
      role: input.role,
      reportsToId: input.reportsToId,
      subtreeSkillsManifest: input.subtreeSkillsManifest,
      files,
      lastHeartbeatAt: null
    };
    this.orgNodes.set(node.id, node);
    this.persist();
    return node;
  }

  getCompanySettings(companyId: string): CompanySettings {
    const existing = this.settings.get(companyId);
    if (existing) return existing;
    const fallback: CompanySettings = {
      companyId,
      heartbeatIntervalMinutes: 10,
      dailyReportTime: "09:00",
      supervisorValidationRequired: true
    };
    this.settings.set(companyId, fallback);
    return fallback;
  }

  updateCompanySettings(companyId: string, patch: Partial<Omit<CompanySettings, "companyId">>): CompanySettings {
    if (!this.companies.get(companyId)) throw new Error("Company not found");
    const current = this.getCompanySettings(companyId);
    const next: CompanySettings = {
      ...current,
      heartbeatIntervalMinutes: patch.heartbeatIntervalMinutes ?? current.heartbeatIntervalMinutes,
      dailyReportTime: patch.dailyReportTime ?? current.dailyReportTime,
      supervisorValidationRequired: patch.supervisorValidationRequired ?? current.supervisorValidationRequired
    };
    this.settings.set(companyId, next);
    this.persist();
    return next;
  }

  patchOrgAgentFilesByManager(targetNodeId: string, managerOrgNodeId: string, partial: Partial<AgentMarkdownPack>): OrgNode {
    const target = this.orgNodes.get(targetNodeId);
    const manager = this.orgNodes.get(managerOrgNodeId);
    if (!target || !manager) throw new Error("Node not found");
    if (target.companyId !== manager.companyId) throw new Error("Company mismatch");
    if (target.reportsToId !== manager.id) throw new Error("Only direct manager may update this hire's agent files");
    const next: OrgNode = { ...target, files: mergeAgentPack(target.files, partial) };
    this.orgNodes.set(targetNodeId, next);
    this.persist();
    return next;
  }

  createCard(
    input: Omit<BoardCard, "id" | "status" | "completionSummary" | "priority" | "dependencies" | "risks" | "requiredUserDecision"> &
      Partial<Pick<BoardCard, "priority" | "dependencies" | "risks" | "requiredUserDecision">>
  ) {
    const card: BoardCard = {
      id: uid(),
      ...input,
      priority: input.priority ?? "medium",
      dependencies: input.dependencies ?? [],
      risks: input.risks ?? [],
      requiredUserDecision: input.requiredUserDecision ?? null,
      status: "backlog",
      completionSummary: null,
      valueCategory: input.valueCategory ?? null,
      targetMetric: input.targetMetric ?? null,
      baseline: input.baseline ?? null,
      successThreshold: input.successThreshold ?? null,
      measurementMethod: input.measurementMethod ?? null,
      expectedImpact: input.expectedImpact ?? null,
      confidence: input.confidence ?? null,
      effort: input.effort ?? null,
      evidence: input.evidence ?? null
    };
    this.cards.set(card.id, card);
    this.persist();
    return card;
  }

  updateCardStatus(cardId: string, status: CardStatus, completionSummary?: string, evidence?: string) {
    const card = this.cards.get(cardId);
    if (!card) throw new Error("Card not found");
    const next: BoardCard = {
      ...card,
      status,
      completionSummary:
        status === "done" || status === "waiting_supervisor" || status === "waiting_user" || status === "blocked"
          ? completionSummary?.trim() || card.completionSummary || null
          : card.completionSummary ?? null,
      evidence: evidence?.trim() || card.evidence || null
    };
    this.cards.set(card.id, next);
    this.persist();
    return next;
  }

  markAgentDueNow(orgNodeId: string) {
    const node = this.orgNodes.get(orgNodeId);
    if (!node) return null;
    const next: OrgNode = { ...node, lastHeartbeatAt: null };
    this.orgNodes.set(orgNodeId, next);
    this.persist();
    return next;
  }

  createMessage(input: Omit<ChannelMessage, "id" | "createdAt" | "mentions" | "attachments"> & { attachments?: CommentAttachment[] }) {
    const body = cleanConversationBody(input.body);
    const message: ChannelMessage = {
      id: uid(),
      createdAt: new Date().toISOString(),
      mentions: extractMentions(body),
      ...input,
      attachments: input.attachments ?? [],
      body
    };
    this.messages.set(message.id, message);
    this.persist();
    return message;
  }

  createActionCardFromMessage(message: ChannelMessage): BoardCard | null {
    if (message.authorType === "system") return null;
    if (message.linkedCardId) return null;
    const company = this.companies.get(message.companyId);
    if (!company) return null;
    const developer = [...this.orgNodes.values()].find((n) => n.companyId === company.id && n.handle === "developer");
    const body = message.body.trim();
    if (!body) return null;

    if (message.authorType !== "user" || !developer) return null;
    if (message.threadId !== dmThreadId(company.operatorHandle, developer.handle)) return null;
    return this.createCard({
      companyId: company.id,
      title: `Boss follow-up: ${body.slice(0, 80)}${body.length > 80 ? "..." : ""}`,
      description: `Boss message from ${new Date(message.createdAt).toLocaleString()}:\n\n${body}\n\nExpected action: decide whether this needs a reply, a board card, or a concrete next step.`,
      assigneeOrgNodeId: developer.id,
      goalId: company.goalId
    });
  }

  answerEscalation(id: string, answer: string) {
    const escalation = this.escalations.get(id);
    if (!escalation) throw new Error("Escalation not found");
    escalation.answer = answer;
    escalation.status = "answered";
    this.escalations.set(escalation.id, escalation);
    this.persist();
    return escalation;
  }

  createEscalation(input: {
    companyId: string;
    fromOrgNodeId: string;
    cardId: string | null;
    question: string;
    context: string;
  }) {
    const from = this.orgNodes.get(input.fromOrgNodeId);
    if (!from) throw new Error("Requester not found");
    let toOrgNodeId: string | null = from.reportsToId;
    let toOperator = false;
    if (!toOrgNodeId) toOperator = true;

    const escalation: Escalation = {
      id: uid(),
      companyId: input.companyId,
      fromOrgNodeId: input.fromOrgNodeId,
      toOrgNodeId,
      toOperator,
      cardId: input.cardId,
      question: input.question,
      context: input.context,
      status: "open",
      answer: null,
      createdAt: new Date().toISOString()
    };
    this.escalations.set(escalation.id, escalation);

    const company = this.companies.get(input.companyId);
    const targetHandle = toOperator
      ? company?.operatorHandle ?? "boss"
      : this.orgNodes.get(toOrgNodeId ?? "")?.handle ?? "unknown";
    const escBody = `Escalation from @${from.handle} to @${targetHandle}: ${input.question}`;
    this.createMessage({
      companyId: input.companyId,
      threadId: "escalations",
      authorType: "system",
      authorId: null,
      body: escBody,
      linkedCardId: input.cardId
    });
    const dmPeer = toOperator ? (company?.operatorHandle ?? "boss") : (this.orgNodes.get(toOrgNodeId ?? "")?.handle ?? targetHandle);
    this.createMessage({
      companyId: input.companyId,
      threadId: dmThreadId(from.handle, dmPeer),
      authorType: "system",
      authorId: null,
      body: escBody,
      linkedCardId: input.cardId
    });
    this.persist();
    return escalation;
  }

  extractAssistantPlanJsonFromLog(logLines: string[]): AssistantPlanJson | null {
    const text = logLines
      .filter((line) => !line.startsWith("[stderr]") && !line.startsWith("$ ") && !line.startsWith("[stdin]") && !line.startsWith("process_exit="))
      .join("\n");
    const matches = [...text.matchAll(/```json\s*([\s\S]*?)```/gi)];
    for (const match of matches.reverse()) {
      if (!match[1]) continue;
      try {
        const parsed: unknown = JSON.parse(match[1].trim().replace(/[\r\n]+/g, " "));
        if (!parsed || typeof parsed !== "object") continue;
        const record = parsed as Record<string, unknown>;
        const cards = Array.isArray(record.cards) ? record.cards : [];
        if (!Array.isArray(record.cards)) continue;
        return { cards: cards as AssistantPlanJson["cards"] };
      } catch {
        continue;
      }
    }
    return null;
  }

  applyAssistantPlanJson(companyId: string, assistantId: string, plan: AssistantPlanJson): {
    createdCards: number;
    errors: string[];
  } {
    const errors: string[] = [];
    let createdCards = 0;
    const planner = this.orgNodes.get(assistantId);
    if (!planner || planner.companyId !== companyId) {
      errors.push("Planning Agent invalid for project");
      return { createdCards, errors };
    }
    const developer = [...this.orgNodes.values()].find((node) => node.companyId === companyId && node.role === "developer") ?? planner;
    const goal = [...this.goals.values()].find((g) => g.companyId === companyId) ?? null;
    const existingTitles = new Set(
      [...this.cards.values()]
        .filter((card) => card.companyId === companyId)
        .map((card) => card.title.trim().toLowerCase())
    );

    for (const card of (plan.cards ?? []).slice(0, 24)) {
      const title = String(card?.title ?? "").trim();
      if (!title) continue;
      if (title.toLowerCase().startsWith("example planning card")) {
        errors.push(`skip example card: ${title}`);
        continue;
      }
      if (existingTitles.has(title.toLowerCase())) {
        errors.push(`skip duplicate card: ${title}`);
        continue;
      }
      const requiredUserDecision = card?.requiredUserDecision ? String(card.requiredUserDecision).trim() : null;
      const created = this.createCard({
        companyId,
        title: title.slice(0, 140),
        description: [
          String(card?.description ?? "").trim(),
          "",
          "Size constraint: complete this in about five minutes. If it is larger, split it before working."
        ]
          .join("\n")
          .trim()
          .slice(0, 12000),
        priority: normalizeCardPriority(String(card?.priority ?? "medium")),
        assigneeOrgNodeId: developer.id,
        goalId: goal?.id ?? null,
        dependencies: Array.isArray(card?.dependencies) ? card.dependencies.map((d) => String(d)).filter(Boolean).slice(0, 8) : [],
        risks: Array.isArray(card?.risks) ? card.risks.map((r) => String(r)).filter(Boolean).slice(0, 8) : [],
        requiredUserDecision,
        valueCategory: normalizeValueCategory(card?.valueCategory),
        targetMetric: cleanOptionalText(card?.targetMetric, 240),
        baseline: cleanOptionalText(card?.baseline, 240),
        successThreshold: cleanOptionalText(card?.successThreshold, 240),
        measurementMethod: cleanOptionalText(card?.measurementMethod, 500),
        expectedImpact: normalizeValueScore(card?.expectedImpact),
        confidence: normalizeValueScore(card?.confidence),
        effort: normalizeValueScore(card?.effort)
      });
      if (requiredUserDecision) {
        this.updateCardStatus(created.id, "waiting_user", requiredUserDecision);
      }
      existingTitles.add(title.toLowerCase());
      createdCards += 1;
    }

    this.persist();
    return { createdCards, errors };
  }

  /**
   * Simulated agent heartbeats: each org member with assigned cards may pull work from Backlog
   * into In progress up to wipPerAssignee concurrent cards.
   */
  runHeartbeatsForCompany(
    companyId: string,
    wipPerAssignee = 2,
    options: { force?: boolean } = {}
  ): { promoted: Array<{ cardId: string; assigneeHandle: string }>; runs: HeartbeatRun[] } {
    if (!this.companies.get(companyId)) return { promoted: [], runs: [] };

    const cardsInCompany = [...this.cards.values()].filter((c) => c.companyId === companyId);
    const settings = this.getCompanySettings(companyId);
    const intervalMs = settings.heartbeatIntervalMinutes * 60_000;
    const nowMs = Date.now();

    const byAssignee = new Map<string, BoardCard[]>();
    for (const c of cardsInCompany) {
      if (c.assigneeOrgNodeId == null) continue;
      const arr = byAssignee.get(c.assigneeOrgNodeId) ?? [];
      arr.push(c);
      byAssignee.set(c.assigneeOrgNodeId, arr);
    }

    const orgInCompany = [...this.orgNodes.values()].filter((n) => n.companyId === companyId);
    const promoted: Array<{ cardId: string; assigneeHandle: string }> = [];
    const runs: HeartbeatRun[] = [];

    for (const node of orgInCompany) {
      const lastMs = node.lastHeartbeatAt ? Date.parse(node.lastHeartbeatAt) : 0;
      if (!options.force && Number.isFinite(lastMs) && lastMs > 0 && nowMs - lastMs < intervalMs) {
        continue;
      }

      const startedAt = new Date().toISOString();
      const mine = byAssignee.get(node.id);
      const promotedForNode: string[] = [];
      const activeCount = mine?.filter((c) => c.status === "in_progress").length ?? 0;

      if (mine?.length) {
        const openSlots = Math.max(0, wipPerAssignee - activeCount);
        const backlog = mine
          .filter((c) => c.status === "backlog" || c.status === "planned")
          .sort((a, b) => a.title.localeCompare(b.title))
          .slice(0, openSlots);
        for (const next of backlog) {
          this.updateCardStatus(next.id, "in_progress");
          promoted.push({ cardId: next.id, assigneeHandle: node.handle });
          promotedForNode.push(next.id);
        }
      }

      const completedAt = new Date().toISOString();
      const nextNode: OrgNode = { ...node, lastHeartbeatAt: completedAt };
      this.orgNodes.set(node.id, nextNode);
      const run: HeartbeatRun = {
        id: uid(),
        companyId,
        orgNodeId: node.id,
        status: "completed",
        startedAt,
        completedAt,
        promotedCardIds: promotedForNode,
        summary:
          promotedForNode.length > 0
            ? `Promoted ${promotedForNode.length} ready card(s) to In progress.`
            : activeCount > 0
              ? `Heartbeat found ${activeCount} active in-progress card(s); no promotion slot available.`
              : "Heartbeat completed; no ready card needed promotion."
      };
      this.heartbeatRuns.set(run.id, run);
      runs.push(run);
    }

    this.persist();
    return { promoted, runs };
  }

  runHeartbeatForAgent(
    orgNodeId: string,
    wipPerAssignee = 2,
    options: { force?: boolean } = {}
  ): { promoted: Array<{ cardId: string; assigneeHandle: string }>; run: HeartbeatRun } {
    const node = this.orgNodes.get(orgNodeId);
    if (!node) throw new Error("Agent not found");
    if (!this.companies.get(node.companyId)) throw new Error("Company not found");

    const cardsInCompany = [...this.cards.values()].filter((c) => c.companyId === node.companyId);
    const settings = this.getCompanySettings(node.companyId);
    const intervalMs = settings.heartbeatIntervalMinutes * 60_000;
    const lastMs = node.lastHeartbeatAt ? Date.parse(node.lastHeartbeatAt) : 0;
    const nowMs = Date.now();
    if (!options.force && Number.isFinite(lastMs) && lastMs > 0 && nowMs - lastMs < intervalMs) {
      throw new Error("Agent heartbeat is not due yet");
    }

    const startedAt = new Date().toISOString();
    const mine = cardsInCompany.filter((card) => card.assigneeOrgNodeId === node.id);
    const promotedForNode: string[] = [];
    const promoted: Array<{ cardId: string; assigneeHandle: string }> = [];
    const activeCount = mine.filter((c) => c.status === "in_progress").length;

    const openSlots = Math.max(0, wipPerAssignee - activeCount);
    const backlog = mine
      .filter((c) => c.status === "backlog" || c.status === "planned")
      .sort((a, b) => a.title.localeCompare(b.title))
      .slice(0, openSlots);
    for (const next of backlog) {
      this.updateCardStatus(next.id, "in_progress");
      promoted.push({ cardId: next.id, assigneeHandle: node.handle });
      promotedForNode.push(next.id);
    }

    const completedAt = new Date().toISOString();
    this.orgNodes.set(node.id, { ...node, lastHeartbeatAt: completedAt });
    const run: HeartbeatRun = {
      id: uid(),
      companyId: node.companyId,
      orgNodeId: node.id,
      status: "completed",
      startedAt,
      completedAt,
      promotedCardIds: promotedForNode,
      summary:
        promotedForNode.length > 0
          ? `Promoted ${promotedForNode.length} ready card(s) to In progress.`
          : activeCount > 0
            ? `Heartbeat found ${activeCount} active in-progress card(s); no promotion slot available.`
            : "Heartbeat completed; no ready card needed promotion."
    };
    this.heartbeatRuns.set(run.id, run);
    this.persist();
    return { promoted, run };
  }

  runSupervisorValidation(companyId: string, options: { force?: boolean } = {}): { run: HeartbeatRun; validatedCardIds: string[] } {
    const company = this.companies.get(companyId);
    if (!company) throw new Error("Company not found");
    const supervisor = [...this.orgNodes.values()].find((node) => node.companyId === companyId && node.handle === "supervisor");
    if (!supervisor) throw new Error("Supervisor Agent not found");

    const settings = this.getCompanySettings(companyId);
    const intervalMs = settings.heartbeatIntervalMinutes * 60_000;
    const lastMs = supervisor.lastHeartbeatAt ? Date.parse(supervisor.lastHeartbeatAt) : 0;
    const nowMs = Date.now();
    if (!options.force && Number.isFinite(lastMs) && lastMs > 0 && nowMs - lastMs < intervalMs) {
      throw new Error("Agent heartbeat is not due yet");
    }

    const startedAt = new Date().toISOString();
    const waiting = [...this.cards.values()]
      .filter((card) => card.companyId === companyId && card.status === "waiting_supervisor")
      .sort((a, b) => a.title.localeCompare(b.title));
    const validatedCardIds: string[] = [];

    for (const card of waiting) {
      const assignee = card.assigneeOrgNodeId ? this.orgNodes.get(card.assigneeOrgNodeId) : null;
      const isPlanningCard = assignee?.role === "planner" || card.title.includes("Generate autonomous project plan");
      const hasValueHypothesis = Boolean(card.targetMetric?.trim() && card.measurementMethod?.trim() && card.successThreshold?.trim());
      if (!isPlanningCard && !hasValueHypothesis) {
        const summary =
          "Supervisor rejected this as activity-only work. Add a target metric, measurement method, and success threshold before execution.";
        this.updateCardStatus(card.id, "blocked", summary);
        this.createMessage({
          companyId,
          threadId: "general",
          authorType: "agent",
          authorId: supervisor.id,
          body: `Blocked "${card.title}". ${summary}`,
          linkedCardId: card.id
        });
        continue;
      }
      const nextStatus: CardStatus = isPlanningCard ? "done" : "planned";
      const summary = isPlanningCard
        ? "Supervisor approved the planning pass. The generated execution cards are ready for Developer heartbeats."
        : "Supervisor approved this execution plan. Developer may proceed on the next heartbeat.";
      this.updateCardStatus(card.id, nextStatus, summary);
      this.createMessage({
        companyId,
        threadId: "general",
        authorType: "agent",
        authorId: supervisor.id,
        body: `Approved "${card.title}". ${summary}`,
        linkedCardId: card.id
      });
      validatedCardIds.push(card.id);
    }

    const completedAt = new Date().toISOString();
    this.orgNodes.set(supervisor.id, { ...supervisor, lastHeartbeatAt: completedAt });
    const run: HeartbeatRun = {
      id: uid(),
      companyId,
      orgNodeId: supervisor.id,
      status: "completed",
      startedAt,
      completedAt,
      promotedCardIds: validatedCardIds,
      summary:
        validatedCardIds.length > 0
          ? `Supervisor validated ${validatedCardIds.length} card(s).`
          : "Supervisor heartbeat completed; no cards were waiting for validation."
    };
    this.heartbeatRuns.set(run.id, run);
    this.persist();
    return { run, validatedCardIds };
  }

  generateDailyReport(companyId: string): DailyReport {
    const company = this.companies.get(companyId);
    if (!company) throw new Error("Project not found");
    const pm = [...this.orgNodes.values()].find((n) => n.companyId === companyId && n.handle === "pm") ?? null;
    const cards = [...this.cards.values()].filter((c) => c.companyId === companyId);
    const openEscalations = [...this.escalations.values()].filter((e) => e.companyId === companyId && e.status === "open");
    const byStatus = (status: CardStatus) => cards.filter((c) => c.status === status).length;
    const pct = cards.length ? Math.round((byStatus("done") / cards.length) * 100) : 0;
    const nextMilestone = cards
      .filter((card) => card.status !== "done")
      .sort((a, b) => {
        const statusRank: Record<CardStatus, number> = {
          in_progress: 0,
          waiting_supervisor: 1,
          waiting_user: 2,
          blocked: 3,
          planned: 4,
          backlog: 5,
          done: 6
        };
        const priorityRank = { critical: 0, high: 1, medium: 2, low: 3 } as const;
        return statusRank[a.status] - statusRank[b.status] || priorityRank[a.priority] - priorityRank[b.priority] || a.title.localeCompare(b.title);
      })[0];
    const needsBossCount = byStatus("waiting_user") + openEscalations.length;
    const blockedCount = byStatus("blocked");
    const reviewCount = byStatus("waiting_supervisor");
    const valueLinked = cards.filter((card) => Boolean(card.targetMetric?.trim() && card.measurementMethod?.trim()));
    const doneValueLinked = valueLinked.filter((card) => card.status === "done");
    const doneWithEvidence = cards.filter((card) => card.status === "done" && Boolean(card.evidence?.trim() || card.completionSummary?.trim()));
    const unmeasuredDone = cards.filter((card) => card.status === "done" && !card.targetMetric?.trim());
    const evidencePct = cards.length ? Math.round((doneWithEvidence.length / cards.length) * 100) : 0;
    const valuePct = valueLinked.length ? Math.round((doneValueLinked.length / valueLinked.length) * 100) : 0;
    const nextAction =
      needsBossCount > 0
        ? "Boss: answer the waiting decision(s) so execution can resume."
        : blockedCount > 0
          ? "PM/Supervisor: clear blocked work before expanding scope."
          : reviewCount > 0
            ? "Supervisor: validate waiting execution plans."
            : unmeasuredDone.length > 0
              ? "PM: review unmeasured closed work and convert learnings into value experiments."
            : nextMilestone
              ? `Team: continue ${nextMilestone.title}.`
              : "PM/Planning: create the next measurable value experiment.";
    const reportDate = new Date().toISOString().slice(0, 10);
    const body = [
      `PM report — ${company.name} (${reportDate})`,
      "",
      `Progress: ${byStatus("done")}/${cards.length} done (${pct}%). Active: ${byStatus("in_progress")} in progress, ${byStatus("planned")} planned.`,
      `Value progress: ${doneValueLinked.length}/${valueLinked.length} value-linked card(s) done (${valuePct}%). Evidence coverage: ${doneWithEvidence.length}/${cards.length} card(s) (${evidencePct}%).`,
      `Unmeasured done work: ${unmeasuredDone.length === 0 ? "none" : `${unmeasuredDone.length} card(s) closed without a target metric`}.`,
      nextMilestone ? `Main milestone: ${nextMilestone.title} (${nextMilestone.status}).` : "Main milestone: all tracked work is done; PM/Planning should create the next measurable value experiment.",
      `Needs boss: ${needsBossCount === 0 ? "none" : `${needsBossCount} item(s)`}.`,
      `Blockers: ${blockedCount} blocked, ${reviewCount} waiting for Supervisor.`,
      `Next: ${nextAction}`
    ].join("\n");
    const report: DailyReport = {
      id: uid(),
      companyId,
      authorOrgNodeId: pm?.id ?? null,
      reportDate,
      body,
      createdAt: new Date().toISOString()
    };
    this.dailyReports.set(report.id, report);
    this.createMessage({
      companyId,
      threadId: dmThreadId(company.operatorHandle, "pm"),
      authorType: "agent",
      authorId: pm?.id ?? null,
      body,
      linkedCardId: null
    });
    this.persist();
    return report;
  }
}

export const store = new LeanStore();
