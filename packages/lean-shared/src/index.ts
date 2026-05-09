import { z } from "zod";

export type Id = string;

export type Role = "ceo" | "cto" | "engineer" | "operator" | "custom";
export type CardStatus = "todo" | "doing" | "blocked" | "done";

/** Per-agent markdown: same roles as agent.md, HEARTBEAT.md, SOUL.md, TOOLS.md on disk. */
export interface AgentMarkdownPack {
  agentMd: string;
  heartbeatMd: string;
  soulMd: string;
  toolsMd: string;
}

export interface Company {
  id: Id;
  name: string;
  goalId: Id;
  operatorHandle: string;
}

export interface Goal {
  id: Id;
  companyId: Id;
  title: string;
  description: string;
}

export interface OrgNode {
  id: Id;
  companyId: Id;
  name: string;
  handle: string;
  role: Role;
  reportsToId: Id | null;
  subtreeSkillsManifest: string[];
  files: AgentMarkdownPack;
}

export interface BoardColumn {
  id: Id;
  companyId: Id;
  title: string;
  status: CardStatus;
  order: number;
}

export interface BoardCard {
  id: Id;
  companyId: Id;
  title: string;
  description: string;
  status: CardStatus;
  assigneeOrgNodeId: Id | null;
  goalId: Id | null;
}

export interface ChannelMessage {
  id: Id;
  companyId: Id;
  threadId: Id;
  authorType: "user" | "agent" | "system";
  authorId: Id | null;
  body: string;
  mentions: string[];
  linkedCardId: Id | null;
  createdAt: string;
}

function normalizeDmHandle(handle: string): string {
  const h = handle.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return h.length > 0 ? h : "unknown";
}

/** Direct-message thread between two parties (sorted handles, stable id). */
export function dmThreadId(handleA: string, handleB: string): string {
  const a = normalizeDmHandle(handleA);
  const b = normalizeDmHandle(handleB);
  const [x, y] = a < b ? [a, b] : [b, a];
  return `dm-${x}-${y}`;
}

export interface Escalation {
  id: Id;
  companyId: Id;
  fromOrgNodeId: Id;
  toOrgNodeId: Id | null;
  toOperator: boolean;
  cardId: Id | null;
  question: string;
  context: string;
  status: "open" | "answered";
  answer: string | null;
  createdAt: string;
}

export const createCompanySchema = z.object({
  name: z.string().min(1),
  goalDescription: z.string().default("")
});

export const createOrgNodeSchema = z.object({
  companyId: z.string().min(1),
  actorOrgNodeId: z.string().min(1).nullable(),
  name: z.string().min(1),
  handle: z.string().min(1),
  role: z.enum(["ceo", "cto", "engineer", "operator", "custom"]),
  reportsToId: z.string().nullable(),
  subtreeSkillsManifest: z.array(z.string()).default([]),
  agentMd: z.string().optional(),
  heartbeatMd: z.string().optional(),
  soulMd: z.string().optional(),
  toolsMd: z.string().optional()
});

export const patchOrgAgentFilesSchema = z.object({
  agentMd: z.string().optional(),
  heartbeatMd: z.string().optional(),
  soulMd: z.string().optional(),
  toolsMd: z.string().optional()
});

/** Body for PATCH agent-files: manager identity plus optional file overrides. */
export const patchOrgAgentFilesBodySchema = patchOrgAgentFilesSchema.extend({
  actorOrgNodeId: z.string().min(1)
});

export const createCardSchema = z.object({
  companyId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(""),
  assigneeOrgNodeId: z.string().nullable(),
  goalId: z.string().nullable()
});

export const createMessageSchema = z.object({
  companyId: z.string().min(1),
  threadId: z.string().min(1),
  authorType: z.enum(["user", "agent", "system"]),
  authorId: z.string().nullable(),
  body: z.string().min(1),
  linkedCardId: z.string().nullable()
});

export const createEscalationSchema = z.object({
  companyId: z.string().min(1),
  fromOrgNodeId: z.string().min(1),
  cardId: z.string().nullable(),
  question: z.string().min(1),
  context: z.string().default("")
});
