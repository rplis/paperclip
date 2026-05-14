import { z } from "zod";

export type Id = string;

export type Role = "supervisor" | "pm" | "planner" | "developer" | "recovery" | "operator" | "custom";

export const CARD_STATUS_VALUES = [
  "backlog",
  "planned",
  "in_progress",
  "waiting_supervisor",
  "waiting_user",
  "blocked",
  "done"
] as const;
export type CardStatus = (typeof CARD_STATUS_VALUES)[number];

export const CARD_PRIORITY_VALUES = ["critical", "high", "medium", "low"] as const;
export type CardPriority = (typeof CARD_PRIORITY_VALUES)[number];

export const updateCardStatusSchema = z.object({
  status: z.enum(CARD_STATUS_VALUES),
  completionSummary: z.string().trim().min(1).max(4000).optional()
});

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
  memory: ProjectMemory;
}

export interface CompanySettings {
  companyId: Id;
  heartbeatIntervalMinutes: number;
  dailyReportTime: string;
  supervisorValidationRequired: boolean;
}

export interface ProjectMemory {
  objective: string;
  strategicDecisions: string[];
  executionHistory: string[];
  failuresAndRetries: string[];
  supervisorEvaluations: string[];
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
  lastHeartbeatAt: string | null;
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
  priority: CardPriority;
  assigneeOrgNodeId: Id | null;
  goalId: Id | null;
  dependencies: string[];
  risks: string[];
  requiredUserDecision: string | null;
  completionSummary?: string | null;
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

export interface HeartbeatRun {
  id: Id;
  companyId: Id;
  orgNodeId: Id;
  status: "completed" | "skipped" | "failed";
  startedAt: string;
  completedAt: string;
  summary: string;
  promotedCardIds: Id[];
}

export interface DailyReport {
  id: Id;
  companyId: Id;
  authorOrgNodeId: Id | null;
  reportDate: string;
  body: string;
  createdAt: string;
}

export const createCompanySchema = z.object({
  name: z.string().min(1),
  goalDescription: z.string().default("")
});

export const patchCompanySettingsSchema = z.object({
  heartbeatIntervalMinutes: z.number().int().min(1).max(1440).optional(),
  dailyReportTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  supervisorValidationRequired: z.boolean().optional()
});

export const createOrgNodeSchema = z.object({
  companyId: z.string().min(1),
  actorOrgNodeId: z.string().min(1).nullable(),
  name: z.string().min(1),
  handle: z.string().min(1),
  role: z.enum(["supervisor", "pm", "planner", "developer", "recovery", "operator", "custom"]),
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
  priority: z.enum(CARD_PRIORITY_VALUES).default("medium"),
  assigneeOrgNodeId: z.string().nullable(),
  goalId: z.string().nullable(),
  dependencies: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  requiredUserDecision: z.string().trim().min(1).nullable().default(null)
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

export const skillSearchSchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(20).default(8)
});
