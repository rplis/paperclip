import {
  dmThreadId,
  type AgentMarkdownPack,
  type BoardCard,
  type BoardColumn,
  type ChannelMessage,
  type Company,
  type Escalation,
  type Goal,
  type OrgNode,
  type CardStatus,
  type Role
} from "@lean/shared";
import { randomUUID } from "node:crypto";
import { defaultCeoMarkdownPack, defaultHireMarkdownPack, mergeAgentPack } from "./agent-templates.js";

function uid() {
  return randomUUID();
}

function extractMentions(text: string): string[] {
  const matches = text.match(/@([a-zA-Z0-9_-]+)/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
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

function normalizePlanHandle(raw: string): string | null {
  const s = raw.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 48);
  return s.length > 0 ? s : null;
}

function normalizePlanRole(raw: string | undefined): Role {
  const r = (raw ?? "custom").toLowerCase();
  if (r === "ceo" || r === "cto" || r === "engineer" || r === "operator" || r === "custom") return r;
  return "custom";
}

export class LeanStore {
  readonly companies = new Map<string, Company>();
  readonly goals = new Map<string, Goal>();
  readonly orgNodes = new Map<string, OrgNode>();
  readonly columns = new Map<string, BoardColumn>();
  readonly cards = new Map<string, BoardCard>();
  readonly messages = new Map<string, ChannelMessage>();
  readonly escalations = new Map<string, Escalation>();
  readonly runLogs = new Map<string, string[]>();

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
    this.goals.set(goal.id, goal);
    this.seedBoard(companyId);
    const { ceo, kickoff } = this.bootstrapCeo(company, goal);
    return { company, goal, kickoffCardId: kickoff.id, ceoId: ceo.id };
  }

  private bootstrapCeo(company: Company, goal: Goal): { ceo: OrgNode; kickoff: BoardCard } {
    const ceo = this.createOrgNode({
      actorOrgNodeId: null,
      companyId: company.id,
      name: "CEO",
      handle: "ceo",
      role: "ceo",
      reportsToId: null,
      subtreeSkillsManifest: ["strategy", "hiring", "delegation"]
    });

    const kickoff = this.createCard({
      companyId: company.id,
      title: "Define company structure and hire team",
      description:
        "1) Map reporting lines under the CEO. 2) Decide first roles to hire (e.g. CTO, leads). 3) For each subtree, attach a skills manifest for that team. 4) Create hires only after structure is clear; each manager hires their own reports. 5) If anything about the goal is ambiguous, ask @boss in Messages (DM or #general) before committing the org plan.",
      assigneeOrgNodeId: ceo.id,
      goalId: goal.id
    });
    this.updateCardStatus(kickoff.id, "doing");

    this.createMessage({
      companyId: company.id,
      threadId: "general",
      authorType: "system",
      authorId: null,
      body: "CEO is hired; the kickoff card is on the Board. Codex runs automatically when that card is not blocked. Use Messages for direct threads with each person (@boss ↔ @ceo, etc.) and #general for company-wide posts.",
      linkedCardId: kickoff.id
    });

    const ceoDm = dmThreadId(ceo.handle, company.operatorHandle);
    const goalNeedsClarification = goal.description.trim().length < 40;
    if (goalNeedsClarification) {
      this.updateCardStatus(kickoff.id, "blocked");
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
      body: "Goal looks clear enough to draft the org chart and hiring sequence. I will complete the assigned card first, then propose hires (no hires until structure is defined). If I hit ambiguity I will @boss in #general before proceeding.",
      linkedCardId: kickoff.id
    });
    return { ceo, kickoff };
  }

  private seedBoard(companyId: string) {
    const defs: Array<{ title: string; status: CardStatus }> = [
      { title: "To Do", status: "todo" },
      { title: "Doing", status: "doing" },
      { title: "Blocked", status: "blocked" },
      { title: "Done", status: "done" }
    ];
    defs.forEach((d, index) => {
      const col: BoardColumn = {
        id: uid(),
        companyId,
        title: d.title,
        status: d.status,
        order: index
      };
      this.columns.set(col.id, col);
    });
  }

  createOrgNode(
    input: Omit<OrgNode, "id" | "files"> & {
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
      if (input.actorOrgNodeId !== manager.id) {
        throw new Error("Only direct manager can create this subordinate");
      }
    }
    const companyName = this.companies.get(input.companyId)?.name ?? "Company";
    const manager = input.reportsToId ? this.orgNodes.get(input.reportsToId) : null;
    const managerHandle = manager?.handle ?? "ceo";
    const handleLc = input.handle.toLowerCase();
    const baseFiles: AgentMarkdownPack =
      input.role === "ceo" && (input.reportsToId === null || input.reportsToId === undefined)
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
      files
    };
    this.orgNodes.set(node.id, node);
    return node;
  }

  patchOrgAgentFilesByManager(targetNodeId: string, managerOrgNodeId: string, partial: Partial<AgentMarkdownPack>): OrgNode {
    const target = this.orgNodes.get(targetNodeId);
    const manager = this.orgNodes.get(managerOrgNodeId);
    if (!target || !manager) throw new Error("Node not found");
    if (target.companyId !== manager.companyId) throw new Error("Company mismatch");
    if (target.reportsToId !== manager.id) throw new Error("Only direct manager may update this hire's agent files");
    const next: OrgNode = { ...target, files: mergeAgentPack(target.files, partial) };
    this.orgNodes.set(targetNodeId, next);
    return next;
  }

  createCard(input: Omit<BoardCard, "id" | "status">) {
    const card: BoardCard = { id: uid(), ...input, status: "todo" };
    this.cards.set(card.id, card);
    return card;
  }

  updateCardStatus(cardId: string, status: CardStatus) {
    const card = this.cards.get(cardId);
    if (!card) throw new Error("Card not found");
    card.status = status;
    this.cards.set(card.id, card);
    return card;
  }

  createMessage(input: Omit<ChannelMessage, "id" | "createdAt" | "mentions">) {
    const message: ChannelMessage = {
      id: uid(),
      createdAt: new Date().toISOString(),
      mentions: extractMentions(input.body),
      ...input
    };
    this.messages.set(message.id, message);
    return message;
  }

  answerEscalation(id: string, answer: string) {
    const escalation = this.escalations.get(id);
    if (!escalation) throw new Error("Escalation not found");
    escalation.answer = answer;
    escalation.status = "answered";
    this.escalations.set(escalation.id, escalation);
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
    return escalation;
  }

  extractCeoPlanJsonFromLog(logLines: string[]): CeoPlanJson | null {
    const text = logLines.join("\n");
    const match = text.match(/```json\s*([\s\S]*?)```/i);
    if (!match?.[1]) return null;
    try {
      const parsed: unknown = JSON.parse(match[1].trim());
      if (!parsed || typeof parsed !== "object") return null;
      const record = parsed as Record<string, unknown>;
      const hires = Array.isArray(record.hires) ? record.hires : [];
      const cards = Array.isArray(record.cards) ? record.cards : [];
      return { hires: hires as CeoPlanJson["hires"], cards: cards as CeoPlanJson["cards"] };
    } catch {
      return null;
    }
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
      try {
        const node = this.createOrgNode({
          actorOrgNodeId: manager.id,
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

    return { createdHires, createdCards, errors };
  }
}

export const store = new LeanStore();
