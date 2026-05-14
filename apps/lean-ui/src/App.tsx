import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  dmThreadId,
  type BoardCard,
  type BoardColumn,
  type ChannelMessage,
  type Company,
  type CompanySettings,
  type DailyReport,
  type Escalation,
  type Goal,
  type HeartbeatRun,
  type OrgNode
} from "@lean/shared";

const API = "http://localhost:3200/api";
const OPERATOR_HANDLE = "boss";

type NavId = "dashboard" | "channels" | "inbox" | "board" | "goals" | "settings";
type InboxTab = "mine" | "recent" | "unread" | "all";
type AgentFileTab = "agentMd" | "heartbeatMd" | "soulMd" | "toolsMd";

interface Bootstrap {
  company: Company;
  goal: Goal | null;
  org: OrgNode[];
  columns: BoardColumn[];
  cards: BoardCard[];
  messages: ChannelMessage[];
  escalations: Escalation[];
  settings: CompanySettings;
  heartbeatRuns: HeartbeatRun[];
  dailyReports: DailyReport[];
}

interface CompanySummary extends Company {
  stats: {
    orgNodes: number;
    cards: number;
    backlog: number;
    inProgress: number;
    boss: number;
    inReview: number;
    closed: number;
    heartbeatRuns: number;
  };
}

interface InboxItem {
  id: string;
  kind: "mention" | "escalation" | "activity";
  title: string;
  subtitle?: string;
  at: string;
  failed?: boolean;
  sortMs: number;
}

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

function threadSidebarLabel(threadId: string): string {
  if (threadId === "general") return "general";
  if (threadId === "escalations") return "escalations";
  const m = /^dm-([a-z0-9_-]+)-([a-z0-9_-]+)$/.exec(threadId);
  if (m) return `DM · @${m[1]} ↔ @${m[2]}`;
  return threadId;
}

function threadNavTitle(threadId: string): string {
  if (threadId === "general") return "#general";
  if (threadId === "escalations") return "#escalations";
  return threadSidebarLabel(threadId);
}

type WorkStatus = "idle" | "queued" | "working";

interface EmployeeWorkState {
  status: WorkStatus;
  statusLabel: string;
  currentTask: BoardCard | null;
  backlogCount: number;
}

function workStateForNode(nodeId: string, cards: BoardCard[]): EmployeeWorkState {
  const mine = cards.filter((c) => c.assigneeOrgNodeId === nodeId);
  const inProgress = mine.filter((c) => c.status === "in_progress").sort((a, b) => a.title.localeCompare(b.title));
  const backlog = mine.filter((c) => c.status === "backlog").sort((a, b) => a.title.localeCompare(b.title));

  if (inProgress[0]) {
    return {
      status: "working",
      statusLabel: "Working",
      currentTask: inProgress[0],
      backlogCount: backlog.length
    };
  }
  if (backlog[0]) {
    return {
      status: "queued",
      statusLabel: "Queued",
      currentTask: backlog[0],
      backlogCount: backlog.length
    };
  }
  return { status: "idle", statusLabel: "Idle", currentTask: null, backlogCount: 0 };
}

function cardDescSnippet(text: string, maxLen = 140): string {
  const single = text.replace(/\s+/g, " ").trim();
  if (single.length <= maxLen) return single || "—";
  return `${single.slice(0, maxLen)}…`;
}

function boardStatusLabel(s: BoardCard["status"]): string {
  const labels: Record<BoardCard["status"], string> = {
    backlog: "Backlog",
    planned: "Planned",
    in_progress: "In progress",
    waiting_supervisor: "Waiting for Supervisor",
    waiting_user: "Waiting for Boss",
    blocked: "Blocked",
    done: "Done"
  };
  return labels[s];
}

function parseBossSummary(summary: string): { ask: string; context: string } {
  const trimmed = summary.trim();
  const askMatch = /^Ask:\s*([\s\S]*?)(?:\n\s*\nContext:\s*([\s\S]*))?$/i.exec(trimmed);
  if (askMatch) {
    return {
      ask: askMatch[1]?.trim() || trimmed,
      context: askMatch[2]?.trim() || ""
    };
  }
  return { ask: trimmed, context: "" };
}

function isStaleReviewNotice(message: ChannelMessage): boolean {
  return (
    (message.body.includes("Review requested for") || message.body.includes("were waiting for review"))
  );
}

export function App() {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [companyId, setCompanyId] = useState("");
  const [companyList, setCompanyList] = useState<CompanySummary[]>([]);
  const [companyListLoading, setCompanyListLoading] = useState(true);
  const [companyListError, setCompanyListError] = useState<string | null>(null);
  const companyListRequestId = useRef(0);
  const [nav, setNav] = useState<NavId>("channels");
  const [activeChannelId, setActiveChannelId] = useState("general");
  const [inboxTab, setInboxTab] = useState<InboxTab>("mine");
  const [inboxSearch, setInboxSearch] = useState("");
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());

  const [createCompany, setCreateCompany] = useState({
    name: "",
    goalDescription: ""
  });
  const [newNode, setNewNode] = useState({
    reportingManagerId: "",
    name: "",
    handle: "",
    role: "custom",
    subtreeSkillsManifest: "",
    agentMd: "",
    heartbeatMd: "",
    soulMd: "",
    toolsMd: ""
  });
  const [selectedOrgNodeId, setSelectedOrgNodeId] = useState<string | null>(null);
  const [orgFileTab, setOrgFileTab] = useState<AgentFileTab>("agentMd");
  const [agentFileDraft, setAgentFileDraft] = useState({
    agentMd: "",
    heartbeatMd: "",
    soulMd: "",
    toolsMd: ""
  });
  const [agentFilesSaving, setAgentFilesSaving] = useState(false);
  const [newCard, setNewCard] = useState({ title: "", description: "", assigneeOrgNodeId: "" });
  const [newMessage, setNewMessage] = useState({ body: "" });
  const [messageSending, setMessageSending] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [newEscalation, setNewEscalation] = useState({ fromOrgNodeId: "", cardId: "", question: "", context: "" });
  const [ceoRunLoading, setCeoRunLoading] = useState(false);
  const [ceoRunError, setCeoRunError] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [heartbeatLoading, setHeartbeatLoading] = useState(false);
  const [agentHeartbeatLoadingId, setAgentHeartbeatLoadingId] = useState<string | null>(null);
  const [boardDetailCardId, setBoardDetailCardId] = useState<string | null>(null);
  const [closingCardId, setClosingCardId] = useState<string | null>(null);
  const [completionSummary, setCompletionSummary] = useState("");
  const [completionSummaryError, setCompletionSummaryError] = useState<string | null>(null);
  const [cardComment, setCardComment] = useState("");
  const [cardCommentSending, setCardCommentSending] = useState(false);
  const [lastWorkspaceSyncAt, setLastWorkspaceSyncAt] = useState<number | null>(null);
  const [settingsDraft, setSettingsDraft] = useState({
    heartbeatIntervalMinutes: "10",
    dailyReportTime: "09:00",
    supervisorValidationRequired: true
  });

  const orgOptions = bootstrap?.org ?? [];
  const supervisorNode = orgOptions.find((node) => node.role === "supervisor" || node.handle === "supervisor") ?? null;

  const selectedOrgNode = useMemo(
    () => orgOptions.find((n) => n.id === selectedOrgNodeId) ?? null,
    [orgOptions, selectedOrgNodeId]
  );

  useEffect(() => {
    if (!selectedOrgNode) return;
    setAgentFileDraft({ ...selectedOrgNode.files });
  }, [selectedOrgNode?.id, selectedOrgNode?.files.agentMd, selectedOrgNode?.files.heartbeatMd, selectedOrgNode?.files.soulMd, selectedOrgNode?.files.toolsMd]);

  useEffect(() => {
    if (!bootstrap?.settings) return;
    setSettingsDraft({
      heartbeatIntervalMinutes: String(bootstrap.settings.heartbeatIntervalMinutes),
      dailyReportTime: bootstrap.settings.dailyReportTime,
      supervisorValidationRequired: bootstrap.settings.supervisorValidationRequired
    });
  }, [bootstrap?.settings.heartbeatIntervalMinutes, bootstrap?.settings.dailyReportTime, bootstrap?.settings.supervisorValidationRequired]);

  useEffect(() => {
    if (boardDetailCardId) return;
    setClosingCardId(null);
    setCompletionSummary("");
    setCompletionSummaryError(null);
    setCardComment("");
  }, [boardDetailCardId]);

  const channelIds = useMemo(() => {
    if (!bootstrap) return ["general", "escalations"] as string[];
    const op = bootstrap.company.operatorHandle;
    const dms = [...bootstrap.org]
      .sort((a, b) => a.handle.localeCompare(b.handle))
      .map((n) => dmThreadId(op, n.handle));
    return ["general", "escalations", ...dms];
  }, [bootstrap]);

  const plannerDmThreadId = useMemo(() => {
    if (!bootstrap) return null;
    const planner = bootstrap.org.find((n) => n.handle === "planner");
    if (!planner) return null;
    return dmThreadId(bootstrap.company.operatorHandle, planner.handle);
  }, [bootstrap]);

  useEffect(() => {
    if (!channelIds.includes(activeChannelId)) setActiveChannelId("general");
  }, [channelIds, activeChannelId]);

  const channelMessages = useMemo(() => {
    if (!bootstrap) return [];
    return [...bootstrap.messages]
      .filter((m) => m.threadId === activeChannelId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [bootstrap, activeChannelId]);

  const groupedCards = useMemo(() => {
    if (!bootstrap) return {};
    const bucket: Record<string, BoardCard[]> = {};
    for (const column of bootstrap.columns) bucket[column.status] = [];
    for (const card of bootstrap.cards) {
      bucket[card.status] ??= [];
      bucket[card.status].push(card);
    }
    return bucket;
  }, [bootstrap]);

  const sortedBoardColumns = useMemo(() => {
    if (!bootstrap) return [];
    return [...bootstrap.columns].sort((a, b) => a.order - b.order);
  }, [bootstrap]);

  const boardDetailCard = useMemo(() => {
    if (!bootstrap || !boardDetailCardId) return null;
    return bootstrap.cards.find((c) => c.id === boardDetailCardId) ?? null;
  }, [bootstrap, boardDetailCardId]);

  const inboxUnreadCount = useMemo(() => {
    if (!bootstrap) return 0;
    let n = 0;
    for (const m of bootstrap.messages) {
      if (isStaleReviewNotice(m)) continue;
      if (m.mentions.includes(OPERATOR_HANDLE) && !readIds.has(`m:${m.id}`)) n += 1;
    }
    for (const e of bootstrap.escalations) {
      if (e.toOperator && e.status === "open" && !readIds.has(`e:${e.id}`)) n += 1;
    }
    return n;
  }, [bootstrap, readIds]);

  const inboxItems: InboxItem[] = useMemo(() => {
    if (!bootstrap) return [];
    const items: InboxItem[] = [];

    for (const e of bootstrap.escalations) {
      if (!e.toOperator) continue;
      const sortMs = Date.parse(e.createdAt);
      items.push({
        id: `e:${e.id}`,
        kind: "escalation",
        title: e.question,
        subtitle: e.context || "Escalation to boss",
        at: new Date(e.createdAt).toLocaleString(),
        failed: e.status === "open",
        sortMs: Number.isFinite(sortMs) ? sortMs : 0
      });
    }

    for (const m of bootstrap.messages) {
      if (isStaleReviewNotice(m) && inboxTab !== "all") continue;
      const mentioned = m.mentions.includes(OPERATOR_HANDLE);
      const author =
        m.authorType === "system"
          ? "system"
          : m.authorType === "user"
            ? OPERATOR_HANDLE
            : bootstrap.org.find((o) => o.id === m.authorId)?.handle ?? "agent";
      const sortMs = Date.parse(m.createdAt);
      items.push({
        id: `m:${m.id}`,
        kind: mentioned ? "mention" : "activity",
        title: m.body.length > 120 ? `${m.body.slice(0, 117)}…` : m.body,
        subtitle: `#${m.threadId} · @${author}`,
        at: new Date(m.createdAt).toLocaleString(),
        sortMs: Number.isFinite(sortMs) ? sortMs : 0
      });
    }

    items.sort((a, b) => b.sortMs - a.sortMs);

    const q = inboxSearch.trim().toLowerCase();
    let filtered = items;
    if (q) filtered = filtered.filter((i) => i.title.toLowerCase().includes(q) || (i.subtitle ?? "").toLowerCase().includes(q));

    if (inboxTab === "mine") {
      filtered = filtered.filter((i) => i.kind === "mention" || i.kind === "escalation");
    } else if (inboxTab === "unread") {
      filtered = filtered.filter((i) => !readIds.has(i.id));
    } else if (inboxTab === "recent") {
      filtered = filtered.slice(0, 25);
    }

    return filtered;
  }, [bootstrap, inboxTab, inboxSearch, readIds]);

  const load = useCallback(async (company: string) => {
    const response = await fetch(`${API}/companies/${company}/bootstrap`);
    if (!response.ok) return;
    const data = (await response.json()) as Bootstrap;
    setBootstrap(data);
    setCompanyId(company);
    setLastWorkspaceSyncAt(Date.now());
  }, []);

  const loadCompanyList = useCallback(async () => {
    const requestId = companyListRequestId.current + 1;
    companyListRequestId.current = requestId;
    setCompanyListLoading(true);
    setCompanyListError(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(`${API}/companies`, { signal: controller.signal });
      if (!response.ok) throw new Error(`Company list failed with ${response.status}`);
      const data = (await response.json()) as { companies: CompanySummary[] };
      if (companyListRequestId.current !== requestId) return;
      setCompanyList(data.companies);
      setCompanyListError(null);
    } catch (error) {
      if (companyListRequestId.current !== requestId) return;
      setCompanyListError(error instanceof Error && error.name === "AbortError" ? "API did not respond. Restart the dev server." : error instanceof Error ? error.message : "Company list failed.");
    } finally {
      window.clearTimeout(timeout);
      if (companyListRequestId.current !== requestId) return;
      setCompanyListLoading(false);
    }
  }, []);

  async function createCompanyAndLoad() {
    if (!createCompany.name.trim() || !createCompany.goalDescription.trim()) return;
    const response = await fetch(`${API}/companies`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: createCompany.name.trim(),
        goalDescription: createCompany.goalDescription.trim()
      })
    });
    const data = (await response.json()) as { company: Company };
    const cid = data.company.id;
    setCreateCompany({ name: "", goalDescription: "" });
    await loadCompanyList();
    await load(cid);
    setActiveChannelId(dmThreadId(data.company.operatorHandle, "planner"));
    setNav("channels");
    let polls = 0;
    const poll = window.setInterval(() => {
      void load(cid);
      polls += 1;
      if (polls >= 30) window.clearInterval(poll);
    }, 2000);
  }

  async function addOrgNode() {
    if (!bootstrap || !supervisorNode || !newNode.reportingManagerId) return;
    const skills = newNode.subtreeSkillsManifest
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const body: Record<string, unknown> = {
      companyId: bootstrap.company.id,
      actorOrgNodeId: supervisorNode.id,
      name: newNode.name,
      handle: newNode.handle,
      role: newNode.role,
      reportsToId: newNode.reportingManagerId,
      subtreeSkillsManifest: skills
    };
    const am = newNode.agentMd.trim();
    const hm = newNode.heartbeatMd.trim();
    const sm = newNode.soulMd.trim();
    const tm = newNode.toolsMd.trim();
    if (am) body.agentMd = am;
    if (hm) body.heartbeatMd = hm;
    if (sm) body.soulMd = sm;
    if (tm) body.toolsMd = tm;
    await fetch(`${API}/org`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    await load(bootstrap.company.id);
  }

  async function saveOrgAgentFiles() {
    if (!bootstrap || !selectedOrgNode?.reportsToId) return;
    setAgentFilesSaving(true);
    try {
      await fetch(`${API}/org/${selectedOrgNode.id}/agent-files`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actorOrgNodeId: selectedOrgNode.reportsToId,
          agentMd: agentFileDraft.agentMd,
          heartbeatMd: agentFileDraft.heartbeatMd,
          soulMd: agentFileDraft.soulMd,
          toolsMd: agentFileDraft.toolsMd
        })
      });
      await load(bootstrap.company.id);
    } finally {
      setAgentFilesSaving(false);
    }
  }

  async function addCard() {
    if (!bootstrap) return;
    await fetch(`${API}/cards`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        companyId: bootstrap.company.id,
        title: newCard.title,
        description: newCard.description,
        assigneeOrgNodeId: newCard.assigneeOrgNodeId || null,
        goalId: bootstrap.goal?.id ?? null
      })
    });
    setNewCard({ title: "", description: "", assigneeOrgNodeId: "" });
    await load(bootstrap.company.id);
  }

  async function addCardToColumn(columnStatus: BoardCard["status"]) {
    if (!bootstrap) return;
    const res = await fetch(`${API}/cards`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        companyId: bootstrap.company.id,
        title: "Untitled card",
        description: "",
        assigneeOrgNodeId: null,
        goalId: bootstrap.goal?.id ?? null
      })
    });
    const created = (await res.json()) as BoardCard;
    if (columnStatus !== "backlog") {
      await fetch(`${API}/cards/${created.id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: columnStatus,
          completionSummary: columnStatus === "done" ? "Created directly in Done." : undefined
        })
      });
    }
    await load(bootstrap.company.id);
    setBoardDetailCardId(created.id);
  }

  async function setCardStatus(cardId: string, status: BoardCard["status"], summary?: string) {
    const response = await fetch(`${API}/cards/${cardId}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, completionSummary: summary })
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "Could not update card status");
    }
    if (bootstrap) await load(bootstrap.company.id);
  }

  async function closeCardWithSummary(cardId: string) {
    const summary = completionSummary.trim();
    if (!summary) {
      setCompletionSummaryError("Write a short summary before closing this task.");
      return;
    }
    setCompletionSummaryError(null);
    await setCardStatus(cardId, "done", summary);
    setClosingCardId(null);
    setCompletionSummary("");
  }

  async function postCardComment(card: BoardCard) {
    if (!bootstrap || !cardComment.trim()) return;
    setCardCommentSending(true);
    try {
      await fetch(`${API}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          companyId: bootstrap.company.id,
          threadId: dmThreadId(bootstrap.company.operatorHandle, "developer"),
          authorType: "user",
          authorId: null,
          body: cardComment.trim(),
          linkedCardId: card.id
        })
      });
      setCardComment("");
      await load(bootstrap.company.id);
    } finally {
      setCardCommentSending(false);
    }
  }

  async function postChannelMessage() {
    if (!bootstrap || !newMessage.body.trim()) return;
    setMessageSending(true);
    setMessageError(null);
    try {
      const response = await fetch(`${API}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          companyId: bootstrap.company.id,
          threadId: activeChannelId,
          authorType: "user",
          authorId: null,
          body: newMessage.body.trim(),
          linkedCardId: null
        })
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `Message failed with ${response.status}`);
      }
      setNewMessage({ body: "" });
      await load(bootstrap.company.id);
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : "Message failed to send.");
    } finally {
      setMessageSending(false);
    }
  }

  async function createEscalation() {
    if (!bootstrap) return;
    await fetch(`${API}/escalations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        companyId: bootstrap.company.id,
        fromOrgNodeId: newEscalation.fromOrgNodeId,
        cardId: newEscalation.cardId || null,
        question: newEscalation.question,
        context: newEscalation.context
      })
    });
    setNewEscalation({ fromOrgNodeId: "", cardId: "", question: "", context: "" });
    await load(bootstrap.company.id);
  }

  async function runHeartbeatNow() {
    if (!bootstrap) return;
    setHeartbeatLoading(true);
    try {
      await fetch(`${API}/companies/${bootstrap.company.id}/heartbeat`, { method: "POST" });
      await load(bootstrap.company.id);
    } finally {
      setHeartbeatLoading(false);
    }
  }

  async function kickAssistantHeartbeat() {
    if (!bootstrap) return;
    setCeoRunError(null);
    setCeoRunLoading(true);
    try {
      const response = await fetch(`${API}/companies/${bootstrap.company.id}/developer/heartbeat`, { method: "POST" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? response.statusText);
      await load(bootstrap.company.id);
      setNav("dashboard");
    } catch (err) {
      setCeoRunError(err instanceof Error ? err.message : "Project heartbeat failed");
    } finally {
      setCeoRunLoading(false);
    }
  }

  async function kickAgentHeartbeat(agent: OrgNode) {
    if (!bootstrap) return;
    if (agent.handle === "planner" || agent.handle === "developer") {
      await kickAssistantHeartbeat();
      return;
    }
    setAgentHeartbeatLoadingId(agent.id);
    try {
      const response = await fetch(`${API}/agents/${agent.id}/heartbeat`, { method: "POST" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? response.statusText);
      await load(bootstrap.company.id);
    } finally {
      setAgentHeartbeatLoadingId(null);
    }
  }

  async function generateDailyReport() {
    if (!bootstrap) return;
    setReportLoading(true);
    try {
      await fetch(`${API}/companies/${bootstrap.company.id}/daily-report`, { method: "POST" });
      await load(bootstrap.company.id);
      setNav("dashboard");
    } finally {
      setReportLoading(false);
    }
  }

  async function saveSettings() {
    if (!bootstrap) return;
    const heartbeatIntervalMinutes = Number(settingsDraft.heartbeatIntervalMinutes);
    await fetch(`${API}/companies/${bootstrap.company.id}/settings`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        heartbeatIntervalMinutes,
        dailyReportTime: settingsDraft.dailyReportTime,
        supervisorValidationRequired: settingsDraft.supervisorValidationRequired
      })
    });
    await load(bootstrap.company.id);
  }

  function markAllRead() {
    if (!bootstrap) return;
    const next = new Set(readIds);
    for (const m of bootstrap.messages) next.add(`m:${m.id}`);
    for (const e of bootstrap.escalations) if (e.toOperator) next.add(`e:${e.id}`);
    setReadIds(next);
  }

  useEffect(() => {
    void loadCompanyList();
  }, [loadCompanyList]);

  const HEARTBEAT_POLL_MS = 60_000;

  useEffect(() => {
    if (!bootstrap?.company.id) return;
    const cid = bootstrap.company.id;
    const id = window.setInterval(() => {
      void load(cid);
    }, HEARTBEAT_POLL_MS);
    return () => window.clearInterval(id);
  }, [bootstrap?.company.id, load]);

  const dashStats = useMemo(() => {
    if (!bootstrap) return { total: 0, backlog: 0, planned: 0, inProgress: 0, waitingUser: 0, waitingSupervisor: 0, blocked: 0, done: 0, team: 0 };
    const cards = bootstrap.cards;
    return {
      total: cards.length,
      backlog: cards.filter((c) => c.status === "backlog").length,
      planned: cards.filter((c) => c.status === "planned").length,
      inProgress: cards.filter((c) => c.status === "in_progress").length,
      waitingUser: cards.filter((c) => c.status === "waiting_user").length,
      waitingSupervisor: cards.filter((c) => c.status === "waiting_supervisor").length,
      blocked: cards.filter((c) => c.status === "blocked").length,
      done: cards.filter((c) => c.status === "done").length,
      team: bootstrap.org.length
    };
  }, [bootstrap]);

  const latestDailyReport = bootstrap?.dailyReports[0] ?? null;
  const pmNode = bootstrap?.org.find((n) => n.handle === "pm" || n.role === "pm") ?? null;
  const goalMilestones = useMemo(() => {
    if (!bootstrap) return [];
    const statusRank: Record<BoardCard["status"], number> = {
      in_progress: 0,
      waiting_supervisor: 1,
      waiting_user: 2,
      blocked: 3,
      planned: 4,
      backlog: 5,
      done: 6
    };
    const priorityRank: Record<BoardCard["priority"], number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return [...bootstrap.cards]
      .filter((card) => card.priority === "critical" || card.priority === "high")
      .sort((a, b) => statusRank[a.status] - statusRank[b.status] || priorityRank[a.priority] - priorityRank[b.priority] || a.title.localeCompare(b.title))
      .slice(0, 8);
  }, [bootstrap]);
  const latestHeartbeatRuns = bootstrap?.heartbeatRuns.slice(0, 8) ?? [];

  const plannerKickoffCard = useMemo(() => {
    if (!bootstrap) return null;
    const assistant = bootstrap.org.find((n) => n.handle === "planner");
    if (!assistant) return null;
    return (
      bootstrap.cards.find(
        (c) => c.assigneeOrgNodeId === assistant.id && c.title.includes("Generate autonomous project plan")
      ) ?? null
    );
  }, [bootstrap]);

  async function runAssistantPlan() {
    if (!bootstrap) return;
    setCeoRunError(null);
    setCeoRunLoading(true);
    try {
      const response = await fetch(`${API}/companies/${bootstrap.company.id}/assistant/run`, { method: "POST" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? response.statusText);
      await load(bootstrap.company.id);
    } catch (err) {
      setCeoRunError(err instanceof Error ? err.message : "Planning run failed");
    } finally {
      setCeoRunLoading(false);
    }
  }

  if (!bootstrap) {
    return (
      <div className="onboard">
        <div className="companyChooser">
          <section className="onboardCard companyListCard">
            <div className="chooserHead">
              <div>
                <h1>Projects</h1>
                <p>Select an existing project or create a new one.</p>
              </div>
              <button type="button" className="btnOutline" onClick={() => void loadCompanyList()}>
                Refresh
              </button>
            </div>
            {companyListLoading ? <p className="muted">Loading projects…</p> : null}
            {companyListError && companyList.length === 0 ? <p className="calloutErr">{companyListError}</p> : null}
            {!companyListLoading && companyList.length === 0 ? <p className="emptyState">No projects yet.</p> : null}
            <div className="companyPickList">
              {companyList.map((company) => (
                <button
                  key={company.id}
                  type="button"
                  className="companyPick"
                  onClick={() => {
                    void load(company.id);
                    setNav("dashboard");
                  }}
                >
                  <div>
                    <strong>{company.name}</strong>
                    <span className="muted"> Kodeks agents · {company.stats.cards} cards · {company.stats.heartbeatRuns} runs</span>
                  </div>
                  <div className="companyStats">
                    <span>{company.stats.inProgress} in progress</span>
                    <span>{company.stats.boss} waiting boss</span>
                    <span>{company.stats.inReview} waiting supervisor</span>
                    <span>{company.stats.backlog} backlog</span>
                    <span>{company.stats.closed} done</span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="onboardCard">
            <h1>New project</h1>
            <p>Enter the project name and goal. Planning starts automatically and the agent team keeps execution moving.</p>
            <label htmlFor="co-name">Project name</label>
            <input
              id="co-name"
              value={createCompany.name}
              onChange={(e) => setCreateCompany((s) => ({ ...s, name: e.target.value }))}
              placeholder=""
            />
            <label htmlFor="co-goal">Goal description</label>
            <textarea
              id="co-goal"
              value={createCompany.goalDescription}
              onChange={(e) => setCreateCompany((s) => ({ ...s, goalDescription: e.target.value }))}
              placeholder=""
            />
            <button
              type="button"
              className="primary"
              onClick={createCompanyAndLoad}
              disabled={!createCompany.name.trim() || !createCompany.goalDescription.trim()}
            >
              Create project
            </button>
          </section>
        </div>
      </div>
    );
  }

  const recentMessages = [...(bootstrap.messages ?? [])]
    .filter((message) => !isStaleReviewNotice(message))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 12);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebarHeader">
          <button type="button" className="workspaceName" onClick={() => setNav("dashboard")}>
            {bootstrap.company.name}
            <Icon>
              <polyline points="6 9 12 15 18 9" />
            </Icon>
          </button>
          <button type="button" className="iconBtn" aria-label="Search">
            <Icon>
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </Icon>
          </button>
        </div>

        <button
          type="button"
          className="navItem"
          onClick={() => {
            setBootstrap(null);
            setCompanyId("");
            void loadCompanyList();
          }}
        >
          <Icon>
            <path d="M8 6h13" />
            <path d="M8 12h13" />
            <path d="M8 18h13" />
            <path d="M3 6h.01" />
            <path d="M3 12h.01" />
            <path d="M3 18h.01" />
          </Icon>
          Projects
        </button>

        <button type="button" className="navItem" onClick={() => setNav("board")}>
          <Icon>
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </Icon>
          New card
        </button>

        <button type="button" className={`navItem ${nav === "dashboard" ? "active" : ""}`} onClick={() => setNav("dashboard")}>
          <Icon>
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </Icon>
          Dashboard
        </button>

        <button type="button" className={`navItem ${nav === "channels" ? "active" : ""}`} onClick={() => setNav("channels")}>
          <Icon>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </Icon>
          Messages
        </button>

        <button type="button" className={`navItem ${nav === "inbox" ? "active" : ""}`} onClick={() => setNav("inbox")}>
          <Icon>
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </Icon>
          Inbox
          {inboxUnreadCount > 0 ? <span className="badge">{inboxUnreadCount > 99 ? "99+" : inboxUnreadCount}</span> : null}
        </button>

        <div className="navSection">Work</div>
        <button type="button" className={`navItem ${nav === "board" ? "active" : ""}`} onClick={() => setNav("board")}>
          <Icon>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18" />
            <path d="M9 21V9" />
          </Icon>
          Board
        </button>

        <div className="navSection">Project</div>
        <button type="button" className={`navItem ${nav === "goals" ? "active" : ""}`} onClick={() => setNav("goals")}>
          <Icon>
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
          </Icon>
          Goals
        </button>
        <button type="button" className={`navItem ${nav === "settings" ? "active" : ""}`} onClick={() => setNav("settings")}>
          <Icon>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 8.6 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 0-1.1-.4H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 8.6a1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 7.04 3.9l.06.06A1.65 1.65 0 0 0 8.6 4.6a1.65 1.65 0 0 0 1-.6 1.65 1.65 0 0 0 .4-1.1V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 8.6a1.65 1.65 0 0 0 .6 1 1.65 1.65 0 0 0 1.1.4H21a2 2 0 1 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15Z" />
          </Icon>
          Settings
        </button>

        <div className="navSection">Agents</div>
        <ul className="agentList">
          {bootstrap.org.map((node) => (
            <li key={node.id}>
              <button
                type="button"
                className="channelJump"
                onClick={() => {
                  setActiveChannelId(dmThreadId(bootstrap.company.operatorHandle, node.handle));
                  setNav("channels");
                }}
              >
                <strong>@{node.handle}</strong>
                <span className="muted"> · {node.role}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="main">
        {nav === "dashboard" && (
          <>
            <header className="mainHeader">
              <h1>DASHBOARD</h1>
              <p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>
                The Kodeks agent team wakes on the configured heartbeat interval; the scheduler checks continuity and due work. Last refresh:{" "}
                {lastWorkspaceSyncAt ? new Date(lastWorkspaceSyncAt).toLocaleTimeString() : "—"}
              </p>
            </header>
            <div className="mainBody">
              <div className="dashGrid">
                <div className="statCard">
                  <h3>Cards</h3>
                  <div className="num">{dashStats.total}</div>
                </div>
                <div className="statCard">
                  <h3>In progress</h3>
                  <div className="num">{dashStats.inProgress}</div>
                </div>
                <div className="statCard">
                  <h3>Planned</h3>
                  <div className="num">{dashStats.planned}</div>
                </div>
                <div className="statCard">
                  <h3>Waiting boss</h3>
                  <div className="num">{dashStats.waitingUser}</div>
                </div>
                <div className="statCard">
                  <h3>Supervisor</h3>
                  <div className="num">{dashStats.waitingSupervisor}</div>
                </div>
                <div className="statCard">
                  <h3>Heartbeat</h3>
                  <div className="num">{bootstrap.settings.heartbeatIntervalMinutes}m</div>
                </div>
              </div>

              <div className="panelBlock">
                <div className="panelHead">
                  <h2>PM delivery report</h2>
                  <button type="button" className="btnOutline" disabled={reportLoading} onClick={() => void generateDailyReport()}>
                    {reportLoading ? "Generating…" : "Generate report"}
                  </button>
                </div>
                {latestDailyReport ? (
                  <>
                    <p className="muted small">Created {new Date(latestDailyReport.createdAt).toLocaleString()}</p>
                    <pre className="reportBody">{latestDailyReport.body}</pre>
                  </>
                ) : (
                  <p className="muted">No project report generated yet.</p>
                )}
              </div>

              <div className="panelBlock">
                <div className="panelHead">
                  <h2>Heartbeat runs</h2>
                  <div className="panelActions">
                    <button type="button" className="btnOutline" disabled={ceoRunLoading} onClick={() => void kickAssistantHeartbeat()}>
                      {ceoRunLoading ? "Kicking agents…" : "Kick project heartbeat"}
                    </button>
                    <button type="button" className="btnOutline" disabled={heartbeatLoading} onClick={() => void runHeartbeatNow()}>
                      {heartbeatLoading ? "Running…" : "Run all"}
                    </button>
                  </div>
                </div>
                {ceoRunError ? <p className="calloutErr">{ceoRunError}</p> : null}
                <div className="runList">
                  {latestHeartbeatRuns.length ? (
                    latestHeartbeatRuns.map((run) => {
                      const node = bootstrap.org.find((o) => o.id === run.orgNodeId);
                      return (
                        <div key={run.id} className="runRow">
                          <strong>@{node?.handle ?? "unknown"}</strong>
                          <span>{run.summary}</span>
                          <span className="muted">{new Date(run.completedAt).toLocaleTimeString()}</span>
                        </div>
                      );
                    })
                  ) : (
                    <p className="muted">No heartbeat runs recorded yet.</p>
                  )}
                </div>
              </div>

              <div className="panelBlock">
                <h2>Recent activity</h2>
                {recentMessages.map((m) => {
                  const author =
                    m.authorType === "system"
                      ? "system"
                      : m.authorType === "user"
                        ? OPERATOR_HANDLE
                        : bootstrap.org.find((o) => o.id === m.authorId)?.handle ?? "agent";
                  return (
                    <div key={m.id} className="activityRow">
                      <span className="muted">#{m.threadId}</span> · <strong>@{author}</strong> · {new Date(m.createdAt).toLocaleString()}
                      <div>{m.body}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {nav === "settings" && (
          <>
            <header className="mainHeader">
              <h1>SETTINGS</h1>
            </header>
            <div className="mainBody">
              <div className="settingsPanel">
                <h2>Project operations</h2>
                <label htmlFor="heartbeat-minutes">Agent heartbeat interval</label>
                <div className="settingsRow">
                  <input
                    id="heartbeat-minutes"
                    type="number"
                    min="1"
                    max="1440"
                    value={settingsDraft.heartbeatIntervalMinutes}
                    onChange={(e) => setSettingsDraft((s) => ({ ...s, heartbeatIntervalMinutes: e.target.value }))}
                  />
                  <span className="muted">minutes</span>
                </div>
                <label htmlFor="daily-report-time">PM report time</label>
                <input
                  id="daily-report-time"
                  type="time"
                  value={settingsDraft.dailyReportTime}
                  onChange={(e) => setSettingsDraft((s) => ({ ...s, dailyReportTime: e.target.value }))}
                />
                <label className="checkRow">
                  <input
                    type="checkbox"
                    checked={settingsDraft.supervisorValidationRequired}
                    onChange={(e) => setSettingsDraft((s) => ({ ...s, supervisorValidationRequired: e.target.checked }))}
                  />
                  Require Supervisor validation for major execution steps
                </label>
                <button type="button" className="btnPrimary" onClick={() => void saveSettings()}>
                  Save settings
                </button>
              </div>
            </div>
          </>
        )}

        {nav === "channels" && (
          <>
            <header className="mainHeader">
              <h1>MESSAGES</h1>
            </header>
            <div className="mainBody channelsBody">
              <nav className="channelList" aria-label="Channel list">
                {channelIds.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={`channelListItem ${activeChannelId === id ? "active" : ""}`}
                    onClick={() => setActiveChannelId(id)}
                  >
                    {threadNavTitle(id)}
                  </button>
                ))}
              </nav>
              <div className="channelPane">
                <div className="channelHeader">
                  <h2>{threadNavTitle(activeChannelId)}</h2>
                  {plannerDmThreadId && activeChannelId === plannerDmThreadId && plannerKickoffCard ? (
                    <button type="button" className="btnOutline channelRerun" disabled={ceoRunLoading} onClick={() => void runAssistantPlan()}>
                      {ceoRunLoading ? "Running…" : "Kick Planning heartbeat"}
                    </button>
                  ) : null}
                  {plannerDmThreadId && activeChannelId === plannerDmThreadId && ceoRunError ? <p className="calloutErr">{ceoRunError}</p> : null}
                </div>
                <div className="channelTimeline">
                  {channelMessages.map((m) => {
                    const author =
                      m.authorType === "system"
                        ? "system"
                        : m.authorType === "user"
                          ? OPERATOR_HANDLE
                          : bootstrap.org.find((o) => o.id === m.authorId)?.handle ?? "agent";
                    return (
                      <div key={m.id} className="channelMsg">
                        <div className="channelMsgMeta">
                          <strong>@{author}</strong>
                          <span className="muted">{new Date(m.createdAt).toLocaleString()}</span>
                        </div>
                        <div className="channelMsgBody">{m.body}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="channelComposer">
                  <textarea
                    placeholder={`Message in ${threadNavTitle(activeChannelId)} (as @${OPERATOR_HANDLE})…`}
                    value={newMessage.body}
                    onChange={(e) => {
                      setNewMessage({ body: e.target.value });
                      if (messageError) setMessageError(null);
                    }}
                  />
                  <button type="button" className="btnPrimary" disabled={messageSending || !newMessage.body.trim()} onClick={() => void postChannelMessage()}>
                    {messageSending ? "Sending…" : "Send"}
                  </button>
                </div>
                {messageError ? <p className="composerError">{messageError}</p> : null}
              </div>
            </div>
          </>
        )}

        {nav === "inbox" && (
          <>
            <header className="mainHeader">
              <h1>INBOX</h1>
              <div className="tabs">
                {(
                  [
                    ["mine", "Mine"],
                    ["recent", "Recent"],
                    ["unread", "Unread"],
                    ["all", "All"]
                  ] as const
                ).map(([id, label]) => (
                  <button key={id} type="button" className={`tab ${inboxTab === id ? "active" : ""}`} onClick={() => setInboxTab(id)}>
                    {label}
                  </button>
                ))}
              </div>
            </header>
            <div className="toolbar">
              <input
                type="search"
                className="search"
                placeholder="Search inbox…"
                value={inboxSearch}
                onChange={(e) => setInboxSearch(e.target.value)}
              />
              <div className="toolbarActions">
                <button type="button" aria-label="Sort">
                  <Icon>
                    <path d="M3 6h18M7 12h10M11 18h2" />
                  </Icon>
                </button>
                <button type="button" aria-label="Filter">
                  <Icon>
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                  </Icon>
                </button>
              </div>
              <button type="button" className="btnOutline" onClick={markAllRead}>
                Mark all as read
              </button>
            </div>
            <div className="mainBody">
              <div className="inboxList">
                {inboxItems.map((item) => {
                  const unread = !readIds.has(item.id);
                  return (
                    <div
                      key={item.id}
                      className={`inboxRow ${unread ? "unread" : ""}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setReadIds((prev) => new Set(prev).add(item.id));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setReadIds((prev) => new Set(prev).add(item.id));
                        }
                      }}
                    >
                      <div className="dot" />
                      <div className={`inboxIcon ${item.failed ? "danger" : "info"}`}>{item.kind === "escalation" ? "!" : "•"}</div>
                      <div>
                        <div className="inboxTitle">{item.title}</div>
                        <div className="inboxMeta">{item.subtitle}</div>
                        {item.failed && item.kind === "escalation" ? <span className="tag">needs attention</span> : null}
                      </div>
                      <div className="inboxTime">{item.at}</div>
                    </div>
                  );
                })}
              </div>

              <div className="sectionDivider">Other</div>

              <div className="escalateInline">
                <strong>Test escalation</strong>
                <div className="row">
                  <select value={newEscalation.fromOrgNodeId} onChange={(e) => setNewEscalation((s) => ({ ...s, fromOrgNodeId: e.target.value }))}>
                    <option value="">From agent</option>
                    {orgOptions.map((node) => (
                      <option key={node.id} value={node.id}>
                        @{node.handle}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="Question"
                    value={newEscalation.question}
                    onChange={(e) => setNewEscalation((s) => ({ ...s, question: e.target.value }))}
                  />
                  <button type="button" className="btnOutline" onClick={createEscalation}>
                    Escalate
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {nav === "goals" && (
          <>
            <header className="mainHeader">
              <h1>GOALS</h1>
            </header>
            <div className="mainBody">
              <div className="goalPage">
                <h2>{bootstrap.goal?.title}</h2>
                <p className="desc">{bootstrap.goal?.description}</p>

                <div className="dashGrid">
                  <div className="statCard">
                    <h3>Delivery owner</h3>
                    <div className="num">@{pmNode?.handle ?? "pm"}</div>
                  </div>
                  <div className="statCard">
                    <h3>Done</h3>
                    <div className="num">{dashStats.done}/{dashStats.total}</div>
                  </div>
                  <div className="statCard">
                    <h3>Waiting boss</h3>
                    <div className="num">{dashStats.waitingUser}</div>
                  </div>
                </div>

                <div className="panelBlock">
                  <div className="panelHead">
                    <h2>Main milestones</h2>
                    <span className="muted small">Owned by PM</span>
                  </div>
                  {goalMilestones.length ? (
                    <div className="cardThread">
                      {goalMilestones.map((card) => (
                        <button key={card.id} type="button" className="channelRow" onClick={() => setBoardDetailCardId(card.id)}>
                          <strong>{card.title}</strong>
                          <span className="muted">
                            {boardStatusLabel(card.status)} · {card.priority}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">No high-priority milestones have been created yet.</p>
                  )}
                </div>

                <div className="panelBlock">
                  <div className="panelHead">
                    <h2>PM daily report</h2>
                    <button type="button" className="btnOutline" disabled={reportLoading} onClick={() => void generateDailyReport()}>
                      {reportLoading ? "Generating…" : "Generate report"}
                    </button>
                  </div>
                  {latestDailyReport ? (
                    <>
                      <p className="muted small">
                        Created {new Date(latestDailyReport.createdAt).toLocaleString()} by @{pmNode?.handle ?? "pm"}
                      </p>
                      <pre className="reportBody">{latestDailyReport.body}</pre>
                    </>
                  ) : (
                    <p className="muted">No PM report generated yet.</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {nav === "board" && (
          <>
            <header className="mainHeader">
              <h1>Board</h1>
            </header>
            <div className="mainBody trelloWrap">
              <div className="trelloComposerBar">
                <span className="muted trelloComposerHint">Add to Backlog</span>
                <input placeholder="Title" value={newCard.title} onChange={(e) => setNewCard((s) => ({ ...s, title: e.target.value }))} />
                <input placeholder="Description" value={newCard.description} onChange={(e) => setNewCard((s) => ({ ...s, description: e.target.value }))} />
                <select value={newCard.assigneeOrgNodeId} onChange={(e) => setNewCard((s) => ({ ...s, assigneeOrgNodeId: e.target.value }))}>
                  <option value="">Unassigned</option>
                  {orgOptions.map((node) => (
                    <option key={node.id} value={node.id}>
                      @{node.handle}
                    </option>
                  ))}
                </select>
                <button type="button" className="btnPrimary" onClick={() => void addCard()}>
                  Add to backlog
                </button>
              </div>
              <div className="trelloBoard">
                {sortedBoardColumns.map((column) => (
                  <section key={column.id} className="trelloLane" aria-label={column.title}>
                    <header className="trelloLaneHead">
                      <h3>{column.title}</h3>
                      <span className="trelloLaneBadge">{(groupedCards[column.status] ?? []).length}</span>
                    </header>
                    <div className="trelloLaneBody">
                      {(groupedCards[column.status] ?? []).map((card) => {
                        const assignee = card.assigneeOrgNodeId ? bootstrap.org.find((o) => o.id === card.assigneeOrgNodeId) : null;
                        return (
                          <article
                            key={card.id}
                            className="trelloCard"
                            role="button"
                            tabIndex={0}
                            onClick={() => setBoardDetailCardId(card.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setBoardDetailCardId(card.id);
                              }
                            }}
                          >
                            <div className="trelloCardTitle">{card.title}</div>
                            <div className="trelloCardSnippet">{cardDescSnippet(card.description)}</div>
                            <div className="trelloCardMeta">
                              {assignee ? (
                                <>
                                  <span className="assigneeBubble" aria-hidden>
                                    {(assignee.handle[0] ?? "?").toUpperCase()}
                                  </span>
                                  <span className="assigneeLabel">@{assignee.handle}</span>
                                </>
                              ) : (
                                <span className="muted trelloUnassigned">Unassigned</span>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                    <button type="button" className="trelloLaneAdd" onClick={() => void addCardToColumn(column.status)}>
                      + Add card
                    </button>
                  </section>
                ))}
              </div>
            </div>
            {boardDetailCard ? (
              <div className="cardModalOverlay" role="presentation" onClick={() => setBoardDetailCardId(null)}>
                <div
                  className="cardModal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="card-modal-title"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button type="button" className="cardModalClose" aria-label="Close" onClick={() => setBoardDetailCardId(null)}>
                    ×
                  </button>
                  <h2 id="card-modal-title">{boardDetailCard.title}</h2>
                  <div className="cardModalSection">
                    <div className="muted cardModalK">Description</div>
                    <div className="cardModalDesc">{boardDetailCard.description.trim() || "—"}</div>
                  </div>
                  <div className="cardModalSection">
                    <div className="muted cardModalK">Assignee</div>
                    <div>
                      {boardDetailCard.assigneeOrgNodeId
                        ? (() => {
                            const a = bootstrap.org.find((o) => o.id === boardDetailCard.assigneeOrgNodeId);
                            return a ? `@${a.handle} (${a.name})` : "—";
                          })()
                        : "Unassigned"}
                    </div>
                  </div>
                  <div className="cardModalSection">
                    <label className="muted cardModalK" htmlFor="card-status">
                      Status
                    </label>
                    <select
                      id="card-status"
                      value={closingCardId === boardDetailCard.id ? "done" : boardDetailCard.status}
                      onChange={(e) => {
                        const nextStatus = e.target.value as BoardCard["status"];
                        setCompletionSummaryError(null);
                        if (nextStatus === "done" && boardDetailCard.status !== "done") {
                          setClosingCardId(boardDetailCard.id);
                          setCompletionSummary(boardDetailCard.completionSummary ?? "");
                          return;
                        }
                        setClosingCardId(null);
                        setCompletionSummary("");
                        void setCardStatus(boardDetailCard.id, nextStatus);
                      }}
                    >
                      {(["backlog", "planned", "in_progress", "waiting_supervisor", "waiting_user", "blocked", "done"] as const).map((s) => (
                        <option key={s} value={s}>
                          {boardStatusLabel(s)}
                        </option>
                      ))}
                    </select>
                  </div>
                  {closingCardId === boardDetailCard.id ? (
                    <div className="cardModalSection closeSummaryBlock">
                      <label className="muted cardModalK" htmlFor="completion-summary">
                        Completion summary
                      </label>
                      <textarea
                        id="completion-summary"
                        value={completionSummary}
                        onChange={(e) => {
                          setCompletionSummary(e.target.value);
                          if (completionSummaryError) setCompletionSummaryError(null);
                        }}
                        placeholder="What was done?"
                      />
                      {completionSummaryError ? <p className="fieldError">{completionSummaryError}</p> : null}
                      <button
                        type="button"
                        className="btnPrimary"
                        onClick={() => void closeCardWithSummary(boardDetailCard.id)}
                        disabled={!completionSummary.trim()}
                      >
                        Close task
                      </button>
                    </div>
                  ) : null}
                  {(boardDetailCard.status === "done" || boardDetailCard.status === "waiting_user" || boardDetailCard.status === "waiting_supervisor" || boardDetailCard.status === "blocked") &&
                  boardDetailCard.completionSummary ? (
                    <div className="cardModalSection">
                      {boardDetailCard.status === "waiting_user" ? (
                        (() => {
                          const bossSummary = parseBossSummary(boardDetailCard.completionSummary ?? "");
                          return (
                            <>
                              <div className="muted cardModalK">What I need from @boss</div>
                              <div className="cardModalDesc">{bossSummary.ask}</div>
                              {bossSummary.context ? (
                                <>
                                  <div className="muted cardModalK">Context</div>
                                  <div className="cardModalDesc">{bossSummary.context}</div>
                                </>
                              ) : null}
                            </>
                          );
                        })()
                      ) : (
                        <>
                          <div className="muted cardModalK">Status summary</div>
                          <div className="cardModalDesc">{boardDetailCard.completionSummary}</div>
                        </>
                      )}
                    </div>
                  ) : null}
                  <div className="cardModalSection">
                    <div className="muted cardModalK">Conversation</div>
                    <div className="cardThread">
                      {bootstrap.messages
                        .filter((message) => message.linkedCardId === boardDetailCard.id)
                        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                        .map((message) => {
                          const author =
                            message.authorType === "system"
                              ? "system"
                              : message.authorType === "user"
                                ? OPERATOR_HANDLE
                                : bootstrap.org.find((o) => o.id === message.authorId)?.handle ?? "agent";
                          return (
                            <div key={message.id} className="cardThreadMsg">
                              <div className="channelMsgMeta">
                                <strong>@{author}</strong>
                                <span className="muted">{new Date(message.createdAt).toLocaleString()}</span>
                              </div>
                              <div className="channelMsgBody">{message.body}</div>
                            </div>
                          );
                        })}
                    </div>
                    <div className="channelComposer cardComposer">
                      <textarea
                        placeholder="Reply on this task…"
                        value={cardComment}
                        onChange={(e) => setCardComment(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btnPrimary"
                        disabled={cardCommentSending || !cardComment.trim()}
                        onClick={() => void postCardComment(boardDetailCard)}
                      >
                        {cardCommentSending ? "Sending…" : "Comment"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
