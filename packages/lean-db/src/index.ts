import {
  dmThreadId,
  type AgentMarkdownPack,
  type BoardCard,
  type BoardColumn,
  type ChannelMessage,
  type Company,
  type CompanySettings,
  type DailyReport,
  type Escalation,
  type Goal,
  type HeartbeatRun,
  type OrgNode,
  type CardStatus,
  type Role
} from "@lean/shared";
import { randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  defaultAssistantMarkdownPack,
  defaultCeoMarkdownPack,
  defaultHireMarkdownPack,
  defaultHiringManagerMarkdownPack,
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

export type CeoPlanJson = {
  hires?: Array<{
    name?: string;
    handle?: string;
    role?: string;
    reportsToHandle?: string | null;
    skills?: string[];
    agentMd?: string;
    heartbeatMd?: string;
    soulMd?: string;
    toolsMd?: string;
  }>;
  cards?: Array<{
    title?: string;
    description?: string;
    assigneeHandle?: string | null;
  }>;
};

export type AssistantPlanJson = {
  cards?: Array<{
    title?: string;
    description?: string;
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

function normalizePlanHandle(raw: string): string | null {
  const s = raw.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 48);
  return s.length > 0 ? s : null;
}

function normalizePlanRole(raw: string | undefined): Role {
  const r = (raw ?? "custom").toLowerCase();
  if (r === "ceo" || r === "cto" || r === "engineer" || r === "operator" || r === "hiring_manager" || r === "custom") return r;
  return "custom";
}

function normalizeCardStatus(raw: string | undefined): CardStatus {
  if (raw === "closed") return "closed";
  if (raw === "in_progress") return "in_progress";
  if (raw === "in_review") return "in_review";
  if (raw === "boss") return "boss";
  return "backlog";
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
    for (const item of snapshot.companies ?? []) this.companies.set(item.id, item);
    for (const item of snapshot.settings ?? []) this.settings.set(item.companyId, item);
    for (const item of snapshot.goals ?? []) this.goals.set(item.id, item);
    for (const item of snapshot.orgNodes ?? []) this.orgNodes.set(item.id, item);
    for (const item of snapshot.columns ?? []) {
      const rawStatus = String(item.status);
      const status = normalizeCardStatus(rawStatus);
      this.columns.set(item.id, { ...item, status });
    }
    for (const item of snapshot.cards ?? []) this.cards.set(item.id, { ...item, status: normalizeCardStatus(String(item.status)) });
    for (const item of snapshot.messages ?? []) this.messages.set(item.id, item);
    for (const item of snapshot.escalations ?? []) this.escalations.set(item.id, item);
    for (const item of snapshot.heartbeatRuns ?? []) this.heartbeatRuns.set(item.id, item);
    for (const item of snapshot.dailyReports ?? []) this.dailyReports.set(item.id, item);
    for (const [key, value] of snapshot.runLogs ?? []) this.runLogs.set(key, value);
    this.sanitizeVisibleEngineNames();
    for (const company of this.companies.values()) this.ensureBoardColumns(company.id);
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
        .replace(/card\(s\) are In review—ping @boss in this thread or #general if you need a decision so work can keep moving\./g, "card(s) were waiting for review. Create explicit follow-up tasks for whoever owns the next action.");

    for (const [id, card] of this.cards) {
      this.cards.set(id, { ...card, title: clean(card.title), description: clean(card.description) });
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
      operatorHandle: "boss"
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
      skillsmpEnabled: false
    });
    this.goals.set(goal.id, goal);
    this.seedBoard(companyId);
    const { assistant, kickoff } = this.bootstrapAssistant(company, goal);
    this.persist();
    return { company, goal, kickoffCardId: kickoff.id, assistantId: assistant.id };
  }

  private bootstrapAssistant(company: Company, goal: Goal): { assistant: OrgNode; kickoff: BoardCard } {
    const assistant = this.createOrgNode({
      actorOrgNodeId: null,
      companyId: company.id,
      name: "Assistant",
      handle: "assistant",
      role: "assistant",
      reportsToId: null,
      subtreeSkillsManifest: ["project-management", "planning", "execution"],
      ...defaultAssistantMarkdownPack(company.name)
    });

    const kickoff = this.createCard({
      companyId: company.id,
      title: "Create the project plan",
      description:
        "Read the project goal, produce a detailed plan, and publish it as Backlog cards. Each card must be small enough to complete in about five minutes. Ask @boss in DM if the goal lacks a required decision.",
      assigneeOrgNodeId: assistant.id,
      goalId: goal.id
    });
    this.updateCardStatus(kickoff.id, "in_progress");

    this.createMessage({
      companyId: company.id,
      threadId: "general",
      authorType: "system",
      authorId: null,
      body: "Project created. The Assistant is the only AI agent and has started drafting the plan into Backlog.",
      linkedCardId: kickoff.id
    });
    this.createMessage({
      companyId: company.id,
      threadId: dmThreadId(assistant.handle, company.operatorHandle),
      authorType: "agent",
      authorId: assistant.id,
      body:
        goal.description.trim().length < 30
          ? "@boss I need a little more goal detail before I can produce a useful plan. What outcome should this project reach, and what constraints matter?"
          : "I will turn the goal into small Backlog tasks, then work them one at a time. Anything that needs your decision will come here as a direct question.",
      linkedCardId: kickoff.id
    });
    return { assistant, kickoff };
  }

  private bootstrapCeo(company: Company, goal: Goal): { ceo: OrgNode; kickoff: BoardCard } {
    const ceo = this.createOrgNode({
      actorOrgNodeId: null,
      companyId: company.id,
      name: "CEO",
      handle: "ceo",
      role: "ceo",
      reportsToId: null,
      subtreeSkillsManifest: ["strategy", "delegation"]
    });

    const hiring = this.createOrgNode({
      actorOrgNodeId: ceo.id,
      companyId: company.id,
      name: "Hiring Manager",
      handle: "hiring",
      role: "hiring_manager",
      reportsToId: ceo.id,
      subtreeSkillsManifest: ["hiring-intake", "skillsmp-search", "candidate-proposals", "boss-approval"],
      ...defaultHiringManagerMarkdownPack(company.name)
    });

    const kickoff = this.createCard({
      companyId: company.id,
      title: "Define company structure and hire team",
      description:
        "Complete the five checklist cards on the Board (Backlog, assigned to you)—each is a separate task. When reporting lines, roles, and manifests are clear, close this card and return a structured plan so the app can add hires and delegated cards. If the goal is ambiguous, create a task assigned to @boss or ask in Messages before proceeding.",
      assigneeOrgNodeId: ceo.id,
      goalId: goal.id
    });
    this.updateCardStatus(kickoff.id, "in_progress");

    const checklist: Array<{ title: string; description: string }> = [
      {
        title: "Map reporting lines under the CEO",
        description: "Document the org tree from the CEO down so hiring and delegation stay consistent."
      },
      {
        title: "Define first hiring requests for @hiring",
        description: "For each needed person, define requester, reporting manager, outcomes, required skills, nice-to-have skills, urgency, and acceptance criteria."
      },
      {
        title: "Attach a skills manifest for each subtree team",
        description: "For each branch under a manager, list the skills or capabilities that subtree owns."
      },
      {
        title: "Route hires through Hiring Manager",
        description: "Hiring Manager owns SkillsMP search, proposal, boss review, and final employee creation after the requester defines the need."
      },
      {
        title: "If the goal is ambiguous, ask @boss before committing the org plan",
        description: "Use Messages (DM with @boss or #general) before locking structure if anything about the goal is unclear."
      }
    ];
    for (const item of checklist) {
      this.createCard({
        companyId: company.id,
        title: item.title,
        description: item.description,
        assigneeOrgNodeId: ceo.id,
        goalId: goal.id
      });
    }

    this.createMessage({
      companyId: company.id,
      threadId: "general",
      authorType: "system",
      authorId: null,
      body: "CEO and Hiring Manager are hired. The kickoff card is In progress and five checklist tasks were added to Backlog. Hiring requests should go to @hiring with role needs, skills, reporting line, urgency, and acceptance criteria. @boss reviews hiring proposals before final hire creation.",
      linkedCardId: kickoff.id
    });

    this.createMessage({
      companyId: company.id,
      threadId: dmThreadId(hiring.handle, company.operatorHandle),
      authorType: "system",
      authorId: null,
      body: "Direct thread @boss ↔ @hiring is open. @hiring owns hiring intake, SkillsMP-backed search, proposal, boss review, and final approved hire creation.",
      linkedCardId: null
    });

    const ceoDm = dmThreadId(ceo.handle, company.operatorHandle);
    const goalNeedsClarification = goal.description.trim().length < 40;
    if (goalNeedsClarification) {
      this.createMessage({
        companyId: company.id,
        threadId: ceoDm,
        authorType: "agent",
        authorId: ceo.id,
        body: "@boss I am not certain we have enough goal detail to lock an org structure. Please clarify: who is the customer, timeline or deadline, and what counts as success (metric or milestone). Once you reply, I will unblock hiring and structure work.",
        linkedCardId: kickoff.id
      });
      return { ceo, kickoff };
    }

    this.createMessage({
      companyId: company.id,
      threadId: ceoDm,
      authorType: "agent",
      authorId: ceo.id,
        body: "Goal looks clear enough to draft the org chart and hiring sequence. I will work through the checklist cards on the Board first, then send hiring requests to @hiring rather than creating hires directly. If I hit ambiguity I will @boss in #general before proceeding.",
      linkedCardId: kickoff.id
    });
    return { ceo, kickoff };
  }

  private seedBoard(companyId: string) {
    this.ensureBoardColumns(companyId);
  }

  private ensureBoardColumns(companyId: string) {
    const defs: Array<{ title: string; status: CardStatus }> = [
      { title: "Backlog", status: "backlog" },
      { title: "In progress", status: "in_progress" },
      { title: "Boss", status: "boss" },
      { title: "Review", status: "in_review" },
      { title: "Closed", status: "closed" }
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
      const actorCanHireForManager =
        actor?.companyId === manager.companyId && actor.role === "hiring_manager";
      if (input.actorOrgNodeId !== manager.id && !actorCanHireForManager) {
        throw new Error("Only the direct manager or Hiring Manager can create this subordinate");
      }
    }
    const companyName = this.companies.get(input.companyId)?.name ?? "Company";
    const manager = input.reportsToId ? this.orgNodes.get(input.reportsToId) : null;
    const managerHandle = manager?.handle ?? "ceo";
    const handleLc = input.handle.toLowerCase();
    const baseFiles: AgentMarkdownPack =
      input.role === "assistant"
        ? defaultAssistantMarkdownPack(companyName)
        : input.role === "ceo" && (input.reportsToId === null || input.reportsToId === undefined)
          ? defaultCeoMarkdownPack(companyName)
          : defaultHireMarkdownPack(companyName, input.role, input.name, handleLc, managerHandle);
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
      skillsmpEnabled: false
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
      skillsmpEnabled: patch.skillsmpEnabled ?? current.skillsmpEnabled
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

  createCard(input: Omit<BoardCard, "id" | "status" | "completionSummary">) {
    const card: BoardCard = { id: uid(), ...input, status: "backlog", completionSummary: null };
    this.cards.set(card.id, card);
    this.persist();
    return card;
  }

  updateCardStatus(cardId: string, status: CardStatus, completionSummary?: string) {
    const card = this.cards.get(cardId);
    if (!card) throw new Error("Card not found");
    const next: BoardCard = {
      ...card,
      status,
      completionSummary:
        status === "closed" || status === "in_review" || status === "boss"
          ? completionSummary?.trim() || card.completionSummary || null
          : card.completionSummary ?? null
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

  createMessage(input: Omit<ChannelMessage, "id" | "createdAt" | "mentions">) {
    const body = cleanConversationBody(input.body);
    const message: ChannelMessage = {
      id: uid(),
      createdAt: new Date().toISOString(),
      mentions: extractMentions(body),
      ...input,
      body
    };
    this.messages.set(message.id, message);
    this.persist();
    return message;
  }

  ensureHiringManager(companyId: string): OrgNode | null {
    const company = this.companies.get(companyId);
    return company ? this.ensureHiringManagerForCompany(company) : null;
  }

  private ensureHiringManagerForCompany(company: Company): OrgNode | null {
    const existing = [...this.orgNodes.values()].find((n) => n.companyId === company.id && n.handle === "hiring");
    if (existing) {
      this.syncHiringProcessForCompany(company, existing);
      return existing;
    }
    const ceo = [...this.orgNodes.values()].find((n) => n.companyId === company.id && n.handle === "ceo");
    if (!ceo) return null;
    const hiring = this.createOrgNode({
      actorOrgNodeId: ceo.id,
      companyId: company.id,
      name: "Hiring Manager",
      handle: "hiring",
      role: "hiring_manager",
      reportsToId: ceo.id,
      subtreeSkillsManifest: ["hiring-intake", "skillsmp-search", "candidate-proposals", "boss-approval"],
      ...defaultHiringManagerMarkdownPack(company.name)
    });
    this.syncHiringProcessForCompany(company, hiring);
    return hiring;
  }

  private syncHiringProcessForCompany(company: Company, hiring: OrgNode) {
    let changed = false;
    const ceo = [...this.orgNodes.values()].find((n) => n.companyId === company.id && n.handle === "ceo");
    if (ceo) {
      const needsCeoFiles =
        !ceo.files.agentMd.includes("@hiring") ||
        !ceo.files.heartbeatMd.includes("@hiring") ||
        !ceo.files.toolsMd.includes("@hiring") ||
        ceo.files.agentMd.includes("in_review") ||
        ceo.files.heartbeatMd.includes("in_review") ||
        ceo.files.toolsMd.includes("in_review");
      const nextSkills = ceo.subtreeSkillsManifest.includes("hiring")
        ? ceo.subtreeSkillsManifest.filter((skill) => skill !== "hiring")
        : ceo.subtreeSkillsManifest;
      if (needsCeoFiles || nextSkills.length !== ceo.subtreeSkillsManifest.length) {
        this.orgNodes.set(ceo.id, {
          ...ceo,
          subtreeSkillsManifest: nextSkills.length > 0 ? nextSkills : ["strategy", "delegation"],
          files: needsCeoFiles ? defaultCeoMarkdownPack(company.name) : ceo.files
        });
        changed = true;
      }
    }
    if (
      hiring.files.agentMd.includes("In review") ||
      hiring.files.heartbeatMd.includes("In review") ||
      hiring.files.toolsMd.includes("in_review")
    ) {
      this.orgNodes.set(hiring.id, { ...hiring, files: defaultHiringManagerMarkdownPack(company.name) });
      changed = true;
    }

    const cardUpdates = new Map<string, { title: string; description: string }>([
      [
        "Decide first roles to hire (e.g. CTO, leads)",
        {
          title: "Define first hiring requests for @hiring",
          description:
            "For each needed person, define requester, reporting manager, outcomes, required skills, nice-to-have skills, urgency, and acceptance criteria."
        }
      ],
      [
        "Create hires only after structure is clear",
        {
          title: "Route hires through Hiring Manager",
          description:
            "Hiring Manager owns SkillsMP search, proposal, boss review, and final employee creation after the requester defines the need."
        }
      ]
    ]);
    for (const [id, card] of this.cards) {
      if (card.companyId !== company.id) continue;
      const update = cardUpdates.get(card.title);
      if (!update) continue;
      this.cards.set(id, { ...card, ...update });
      changed = true;
    }

    const hiringThreadId = dmThreadId(hiring.handle, company.operatorHandle);
    const hasHiringThreadIntro = [...this.messages.values()].some(
      (m) => m.companyId === company.id && m.threadId === hiringThreadId && m.body.includes("@hiring owns hiring intake")
    );
    if (!hasHiringThreadIntro) {
      const messageId = uid();
      this.messages.set(messageId, {
        id: messageId,
        createdAt: new Date().toISOString(),
        mentions: ["hiring"],
        companyId: company.id,
        threadId: hiringThreadId,
        authorType: "system",
        authorId: null,
        body: "Direct thread @boss ↔ @hiring is open. @hiring owns hiring intake, SkillsMP-backed search, proposal, boss review, and final approved hire creation.",
        linkedCardId: null
      });
      changed = true;
    }

    if (changed) this.persist();
  }

  createActionCardFromMessage(message: ChannelMessage): BoardCard | null {
    if (message.authorType === "system") return null;
    if (message.linkedCardId) return null;
    const company = this.companies.get(message.companyId);
    if (!company) return null;
    const assistant = [...this.orgNodes.values()].find((n) => n.companyId === company.id && n.handle === "assistant");
    const body = message.body.trim();
    if (!body) return null;

    if (message.authorType !== "user" || !assistant) return null;
    if (message.threadId !== dmThreadId(company.operatorHandle, assistant.handle)) return null;
    return this.createCard({
      companyId: company.id,
      title: `Assistant action: ${body.slice(0, 80)}${body.length > 80 ? "..." : ""}`,
      description: `Boss message from ${new Date(message.createdAt).toLocaleString()}:\n\n${body}\n\nExpected assistant action: decide whether this needs a reply, a board card, or a concrete next step. Keep the task about five minutes.`,
      assigneeOrgNodeId: assistant.id,
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

  extractCeoPlanJsonFromLog(logLines: string[]): CeoPlanJson | null {
    const text = logLines.join("\n");
    const matches = [...text.matchAll(/```json\s*([\s\S]*?)```/gi)];
    for (const match of matches.reverse()) {
      if (!match[1]) continue;
      try {
        const parsed: unknown = JSON.parse(match[1].trim());
        if (!parsed || typeof parsed !== "object") continue;
        const record = parsed as Record<string, unknown>;
        const hires = Array.isArray(record.hires) ? record.hires : [];
        const cards = Array.isArray(record.cards) ? record.cards : [];
        if (!Array.isArray(record.hires) && !Array.isArray(record.cards)) continue;
        return { hires: hires as CeoPlanJson["hires"], cards: cards as CeoPlanJson["cards"] };
      } catch {
        continue;
      }
    }
    return null;
  }

  applyCeoPlanJson(companyId: string, ceoId: string, plan: CeoPlanJson): {
    createdHires: number;
    createdCards: number;
    errors: string[];
  } {
    const errors: string[] = [];
    let createdHires = 0;
    let createdCards = 0;
    const ceo = this.orgNodes.get(ceoId);
    if (!ceo || ceo.companyId !== companyId) {
      errors.push("CEO invalid for company");
      return { createdHires, createdCards, errors };
    }

    const handleToId = new Map<string, string>();
    for (const node of this.orgNodes.values()) {
      if (node.companyId === companyId) handleToId.set(node.handle, node.id);
    }

    const goal = [...this.goals.values()].find((g) => g.companyId === companyId) ?? null;

    for (const hire of (plan.hires ?? []).slice(0, 14)) {
      const handle = normalizePlanHandle(String(hire?.handle ?? ""));
      if (!handle) {
        errors.push("skip hire: missing or invalid handle");
        continue;
      }
      if (handleToId.has(handle)) {
        errors.push(`skip @${handle}: duplicate handle`);
        continue;
      }
      const managerHandle = normalizePlanHandle(String(hire?.reportsToHandle ?? "ceo")) ?? "ceo";
      const managerId = handleToId.get(managerHandle);
      if (!managerId) {
        errors.push(`skip @${handle}: unknown reportsToHandle @${managerHandle}`);
        continue;
      }
      const manager = this.orgNodes.get(managerId);
      if (!manager) {
        errors.push(`skip @${handle}: manager not found`);
        continue;
      }
      const hiringManager = [...this.orgNodes.values()].find(
        (node) => node.companyId === companyId && node.role === "hiring_manager"
      );
      try {
        const node = this.createOrgNode({
          actorOrgNodeId: hiringManager?.id ?? manager.id,
          companyId,
          name: String(hire?.name ?? "").trim() || handle,
          handle,
          role: normalizePlanRole(hire?.role),
          reportsToId: managerId,
          subtreeSkillsManifest: Array.isArray(hire?.skills)
            ? hire.skills.map((s) => String(s)).filter(Boolean).slice(0, 32)
            : [],
          agentMd: typeof hire?.agentMd === "string" ? hire.agentMd : undefined,
          heartbeatMd: typeof hire?.heartbeatMd === "string" ? hire.heartbeatMd : undefined,
          soulMd: typeof hire?.soulMd === "string" ? hire.soulMd : undefined,
          toolsMd: typeof hire?.toolsMd === "string" ? hire.toolsMd : undefined
        });
        handleToId.set(handle, node.id);
        createdHires += 1;
        const op = this.companies.get(companyId)?.operatorHandle ?? "boss";
        this.createMessage({
          companyId,
          threadId: dmThreadId(handle, op),
          authorType: "system",
          authorId: null,
          body: `Direct thread @${op} ↔ @${handle} is open — use Messages to coordinate with @${handle}.`,
          linkedCardId: null
        });
      } catch (err) {
        errors.push(`hire @${handle}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    for (const card of (plan.cards ?? []).slice(0, 18)) {
      const title = String(card?.title ?? "").trim();
      if (!title) continue;
      const assigneeHandleRaw = card?.assigneeHandle != null ? String(card.assigneeHandle).trim() : "";
      const assigneeHandle = assigneeHandleRaw ? normalizePlanHandle(assigneeHandleRaw) : null;
      const assigneeOrgNodeId = assigneeHandle ? handleToId.get(assigneeHandle) ?? null : null;
      this.createCard({
        companyId,
        title: title.slice(0, 240),
        description: String(card?.description ?? "").slice(0, 12000),
        assigneeOrgNodeId,
        goalId: goal?.id ?? null
      });
      createdCards += 1;
    }

    this.persist();
    return { createdHires, createdCards, errors };
  }

  extractAssistantPlanJsonFromLog(logLines: string[]): AssistantPlanJson | null {
    const text = logLines.join("\n");
    const matches = [...text.matchAll(/```json\s*([\s\S]*?)```/gi)];
    for (const match of matches.reverse()) {
      if (!match[1]) continue;
      try {
        const parsed: unknown = JSON.parse(match[1].trim());
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
    const assistant = this.orgNodes.get(assistantId);
    if (!assistant || assistant.companyId !== companyId) {
      errors.push("Assistant invalid for project");
      return { createdCards, errors };
    }
    const goal = [...this.goals.values()].find((g) => g.companyId === companyId) ?? null;
    const existingTitles = new Set(
      [...this.cards.values()]
        .filter((card) => card.companyId === companyId)
        .map((card) => card.title.trim().toLowerCase())
    );

    for (const card of (plan.cards ?? []).slice(0, 24)) {
      const title = String(card?.title ?? "").trim();
      if (!title) continue;
      if (existingTitles.has(title.toLowerCase())) {
        errors.push(`skip duplicate card: ${title}`);
        continue;
      }
      this.createCard({
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
        assigneeOrgNodeId: assistant.id,
        goalId: goal?.id ?? null
      });
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

      if (mine?.length) {
        const openSlots = Math.max(0, wipPerAssignee - mine.filter((c) => c.status === "in_progress").length);
        const backlog = mine
          .filter((c) => c.status === "backlog")
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
            ? `Promoted ${promotedForNode.length} backlog card(s) to In progress.`
            : "Heartbeat completed; no backlog card needed promotion."
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

    const openSlots = Math.max(0, wipPerAssignee - mine.filter((c) => c.status === "in_progress").length);
    const backlog = mine
      .filter((c) => c.status === "backlog")
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
          ? `Promoted ${promotedForNode.length} backlog card(s) to In progress.`
          : "Heartbeat completed; no backlog card needed promotion."
    };
    this.heartbeatRuns.set(run.id, run);
    this.persist();
    return { promoted, run };
  }

  generateDailyReport(companyId: string): DailyReport {
    const company = this.companies.get(companyId);
    if (!company) throw new Error("Project not found");
    const assistant = [...this.orgNodes.values()].find((n) => n.companyId === companyId && n.handle === "assistant") ?? null;
    const cards = [...this.cards.values()].filter((c) => c.companyId === companyId);
    const openEscalations = [...this.escalations.values()].filter((e) => e.companyId === companyId && e.status === "open");
    const latestRuns = [...this.heartbeatRuns.values()]
      .filter((r) => r.companyId === companyId)
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
      .slice(0, 8);
    const byStatus = (status: CardStatus) => cards.filter((c) => c.status === status).length;
    const reportDate = new Date().toISOString().slice(0, 10);
    const body = [
      `Assistant project report for ${company.name} (${reportDate})`,
      "",
      `Goal: ${this.goals.get(company.goalId)?.description || "No goal description set."}`,
      "",
      `Board: ${byStatus("backlog")} backlog, ${byStatus("in_progress")} in progress, ${byStatus("boss")} boss, ${byStatus("in_review")} review, ${byStatus("closed")} closed.`,
      `Agent: @assistant is the only AI worker.`,
      `Escalations: ${openEscalations.length} open item(s) need attention.`,
      "",
      "Recent heartbeat activity:",
      ...(latestRuns.length
        ? latestRuns.map((run) => {
            const node = this.orgNodes.get(run.orgNodeId);
            return `- @${node?.handle ?? "unknown"}: ${run.summary}`;
          })
        : ["- No heartbeat runs recorded yet."]),
      "",
      openEscalations.length
        ? `Recommended boss action: answer the open escalation(s) in Inbox so the project can keep moving.`
        : `Recommended boss action: review cards in Review and close or send them back.`
    ].join("\n");
    const report: DailyReport = {
      id: uid(),
      companyId,
      authorOrgNodeId: assistant?.id ?? null,
      reportDate,
      body,
      createdAt: new Date().toISOString()
    };
    this.dailyReports.set(report.id, report);
    this.createMessage({
      companyId,
      threadId: dmThreadId(company.operatorHandle, "assistant"),
      authorType: "agent",
      authorId: assistant?.id ?? null,
      body,
      linkedCardId: null
    });
    this.persist();
    return report;
  }
}

export const store = new LeanStore();
