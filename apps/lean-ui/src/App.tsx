import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  dmThreadId,
  type BoardCard,
  type BoardColumn,
  type ChannelMessage,
  type Company,
  type Escalation,
  type Goal,
  type OrgNode
} from "@lean/shared";

const API = "http://localhost:3200/api";
const OPERATOR_HANDLE = "boss";

type NavId = "dashboard" | "channels" | "inbox" | "board" | "org" | "goals";
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

function buildOrgRoots(nodes: OrgNode[]): OrgNode[] {
  return nodes.filter((n) => n.reportsToId === null);
}

function orgChildren(nodes: OrgNode[], parentId: string): OrgNode[] {
  return nodes.filter((n) => n.reportsToId === parentId);
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

type WorkStatus = "idle" | "working" | "blocked";

function workStatusForNode(nodeId: string, cards: BoardCard[]): WorkStatus {
  const mine = cards.filter((c) => c.assigneeOrgNodeId === nodeId);
  if (mine.some((c) => c.status === "in_review")) return "blocked";
  if (mine.some((c) => c.status === "in_progress")) return "working";
  return "idle";
}

function cardDescSnippet(text: string, maxLen = 140): string {
  const single = text.replace(/\s+/g, " ").trim();
  if (single.length <= maxLen) return single || "—";
  return `${single.slice(0, maxLen)}…`;
}

function boardStatusLabel(s: BoardCard["status"]): string {
  const labels: Record<BoardCard["status"], string> = {
    backlog: "Backlog",
    in_progress: "In progress",
    in_review: "In review",
    closed: "Closed"
  };
  return labels[s];
}

export function App() {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [companyId, setCompanyId] = useState("");
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
    hiringManagerId: "",
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
  const [newEscalation, setNewEscalation] = useState({ fromOrgNodeId: "", cardId: "", question: "", context: "" });
  const [codexPromptByCard, setCodexPromptByCard] = useState<Record<string, string>>({});
  const [codexLogByCard, setCodexLogByCard] = useState<Record<string, string[]>>({});
  const [ceoRunLoading, setCeoRunLoading] = useState(false);
  const [ceoRunError, setCeoRunError] = useState<string | null>(null);
  const [boardDetailCardId, setBoardDetailCardId] = useState<string | null>(null);
  const [lastWorkspaceSyncAt, setLastWorkspaceSyncAt] = useState<number | null>(null);

  const orgOptions = bootstrap?.org ?? [];

  const selectedOrgNode = useMemo(
    () => orgOptions.find((n) => n.id === selectedOrgNodeId) ?? null,
    [orgOptions, selectedOrgNodeId]
  );

  useEffect(() => {
    if (!selectedOrgNode) return;
    setAgentFileDraft({ ...selectedOrgNode.files });
  }, [selectedOrgNode?.id, selectedOrgNode?.files.agentMd, selectedOrgNode?.files.heartbeatMd, selectedOrgNode?.files.soulMd, selectedOrgNode?.files.toolsMd]);

  const channelIds = useMemo(() => {
    if (!bootstrap) return ["general", "escalations"] as string[];
    const op = bootstrap.company.operatorHandle;
    const dms = [...bootstrap.org]
      .sort((a, b) => a.handle.localeCompare(b.handle))
      .map((n) => dmThreadId(op, n.handle));
    return ["general", "escalations", ...dms];
  }, [bootstrap]);

  const ceoDmThreadId = useMemo(() => {
    if (!bootstrap) return null;
    const ceo = bootstrap.org.find((n) => n.handle === "ceo");
    if (!ceo) return null;
    return dmThreadId(bootstrap.company.operatorHandle, ceo.handle);
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
        subtitle: e.context || "Escalation to Boss",
        at: new Date(e.createdAt).toLocaleString(),
        failed: e.status === "open",
        sortMs: Number.isFinite(sortMs) ? sortMs : 0
      });
    }

    for (const m of bootstrap.messages) {
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
    await load(cid);
    setActiveChannelId(dmThreadId(data.company.operatorHandle, "ceo"));
    setNav("channels");
    let polls = 0;
    const poll = window.setInterval(() => {
      void load(cid);
      polls += 1;
      if (polls >= 30) window.clearInterval(poll);
    }, 2000);
  }

  async function addOrgNode() {
    if (!bootstrap || !newNode.hiringManagerId) return;
    const skills = newNode.subtreeSkillsManifest
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const body: Record<string, unknown> = {
      companyId: bootstrap.company.id,
      actorOrgNodeId: newNode.hiringManagerId,
      name: newNode.name,
      handle: newNode.handle,
      role: newNode.role,
      reportsToId: newNode.hiringManagerId,
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
        body: JSON.stringify({ status: columnStatus })
      });
    }
    await load(bootstrap.company.id);
    setBoardDetailCardId(created.id);
  }

  async function setCardStatus(cardId: string, status: BoardCard["status"]) {
    await fetch(`${API}/cards/${cardId}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status })
    });
    if (bootstrap) await load(bootstrap.company.id);
  }

  async function postChannelMessage() {
    if (!bootstrap || !newMessage.body.trim()) return;
    await fetch(`${API}/messages`, {
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
    setNewMessage({ body: "" });
    await load(bootstrap.company.id);
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

  async function runCodex(cardId: string) {
    const prompt = codexPromptByCard[cardId]?.trim();
    if (!prompt) return;
    await fetch(`${API}/cards/${cardId}/run-codex`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt })
    });
    const logResponse = await fetch(`${API}/cards/${cardId}/run-log`);
    const logData = await logResponse.json();
    setCodexLogByCard((prev) => ({ ...prev, [cardId]: logData.log }));
    if (bootstrap) await load(bootstrap.company.id);
  }

  function markAllRead() {
    if (!bootstrap) return;
    const next = new Set(readIds);
    for (const m of bootstrap.messages) next.add(`m:${m.id}`);
    for (const e of bootstrap.escalations) if (e.toOperator) next.add(`e:${e.id}`);
    setReadIds(next);
  }

  useEffect(() => {
    if (companyId) void load(companyId);
  }, []);

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
    if (!bootstrap) return { total: 0, inReview: 0, inProgress: 0, team: 0 };
    const cards = bootstrap.cards;
    return {
      total: cards.length,
      inReview: cards.filter((c) => c.status === "in_review").length,
      inProgress: cards.filter((c) => c.status === "in_progress").length,
      team: bootstrap.org.length
    };
  }, [bootstrap]);

  const ceoKickoffCard = useMemo(() => {
    if (!bootstrap) return null;
    const ceo = bootstrap.org.find((n) => n.handle === "ceo");
    if (!ceo) return null;
    return (
      bootstrap.cards.find(
        (c) => c.assigneeOrgNodeId === ceo.id && c.title.includes("Define company structure")
      ) ?? null
    );
  }, [bootstrap]);

  async function runCeoKickoff() {
    if (!bootstrap) return;
    setCeoRunError(null);
    setCeoRunLoading(true);
    try {
      const response = await fetch(`${API}/companies/${bootstrap.company.id}/ceo/run`, { method: "POST" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? response.statusText);
      await load(bootstrap.company.id);
    } catch (err) {
      setCeoRunError(err instanceof Error ? err.message : "CEO run failed");
    } finally {
      setCeoRunLoading(false);
    }
  }

  function renderOrgTree(nodes: OrgNode[], parentId: string | null, depth: number): ReactNode {
    const list = parentId === null ? buildOrgRoots(nodes) : orgChildren(nodes, parentId);
    return (
      <ul style={{ listStyle: "none", margin: 0, paddingLeft: depth ? 20 : 0 }}>
        {list.map((node) => (
          <li key={node.id} className={`orgNode${selectedOrgNodeId === node.id ? " orgNodeSelected" : ""}`} style={{ marginBottom: 8 }}>
            <button type="button" className="orgNodePick" onClick={() => setSelectedOrgNodeId(node.id)}>
              <span className="handle">@{node.handle}</span>{" "}
              <span className="muted">
                {node.name} · {node.role}
              </span>
            </button>
            {node.subtreeSkillsManifest.length > 0 ? (
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Skills: {node.subtreeSkillsManifest.join(", ")}
              </div>
            ) : null}
            {renderOrgTree(nodes, node.id, depth + 1)}
          </li>
        ))}
      </ul>
    );
  }

  if (!bootstrap) {
    return (
      <div className="onboard">
        <div className="onboardCard">
          <h1>New company</h1>
          <p>Enter the company name and goal. After that you land in the workspace.</p>
          <label htmlFor="co-name">Company name</label>
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
            Create company
          </button>
        </div>
      </div>
    );
  }

  const recentMessages = [...(bootstrap.messages ?? [])]
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

        <div className="navSection">Company</div>
        <button type="button" className={`navItem ${nav === "goals" ? "active" : ""}`} onClick={() => setNav("goals")}>
          <Icon>
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
          </Icon>
          Goals
        </button>
        <button type="button" className={`navItem ${nav === "org" ? "active" : ""}`} onClick={() => setNav("org")}>
          <Icon>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </Icon>
          Org
        </button>

        <div className="navSection">People</div>
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
                The API promotes assigned Backlog cards to In progress every minute (LEAN_HEARTBEAT_MS). Last refresh:{" "}
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
                  <h3>In review</h3>
                  <div className="num">{dashStats.inReview}</div>
                </div>
                <div className="statCard">
                  <h3>Team</h3>
                  <div className="num">{dashStats.team}</div>
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
                  {ceoDmThreadId && activeChannelId === ceoDmThreadId && ceoKickoffCard ? (
                    ceoKickoffCard.status === "in_review" ? (
                      <p className="calloutWarn channelHeaderNote">
                        Kickoff is in review: reply in this DM or #general, then move the card to In progress on the Board.
                      </p>
                    ) : (
                      <button type="button" className="btnOutline channelRerun" disabled={ceoRunLoading} onClick={() => void runCeoKickoff()}>
                        {ceoRunLoading ? "Running Codex…" : "Re-run CEO kickoff (Codex)"}
                      </button>
                    )
                  ) : null}
                  {ceoDmThreadId && activeChannelId === ceoDmThreadId && ceoRunError ? <p className="calloutErr">{ceoRunError}</p> : null}
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
                    onChange={(e) => setNewMessage({ body: e.target.value })}
                  />
                  <button type="button" className="btnPrimary" onClick={() => void postChannelMessage()}>
                    Send
                  </button>
                </div>
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
              </div>
            </div>
          </>
        )}

        {nav === "org" && (
          <>
            <header className="mainHeader">
              <h1>ORG</h1>
            </header>
            <div className="mainBody orgWrap">
              <section className="orgRoster" aria-label="Team roster">
                <h2 className="orgRosterTitle">People</h2>
                <p className="muted small orgRosterHint">Status reflects assigned board cards: In review → blocked, In progress → working, otherwise idle.</p>
                <table className="orgRosterTable">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Handle</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {[...bootstrap.org]
                      .sort((a, b) => a.handle.localeCompare(b.handle))
                      .map((node) => {
                        const ws = workStatusForNode(node.id, bootstrap.cards);
                        return (
                          <tr key={node.id}>
                            <td>{node.name}</td>
                            <td>@{node.handle}</td>
                            <td>{node.role}</td>
                            <td>
                              <span className={`statusPill status-${ws}`}>{ws}</span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btnOutline orgRosterDm"
                                onClick={() => {
                                  setActiveChannelId(dmThreadId(bootstrap.company.operatorHandle, node.handle));
                                  setNav("channels");
                                }}
                              >
                                Message
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </section>
              <div className="orgPage">
              <div className="orgTree">{renderOrgTree(bootstrap.org, null, 0)}</div>
              <div className="orgSide">
                {selectedOrgNode ? (
                  <div className="orgAgentPack">
                    <h3>
                      @{selectedOrgNode.handle} — agent.md, HEARTBEAT, SOUL, TOOLS
                    </h3>
                    <p className="muted small">
                      Each hire gets defaults from the hiring manager and role; override here or when hiring. Only a <strong>direct manager</strong> can save edits
                      (CEO root has no manager in-app).
                    </p>
                    <div className="orgFileTabs">
                      {(
                        [
                          ["agentMd", "agent.md"],
                          ["heartbeatMd", "HEARTBEAT.md"],
                          ["soulMd", "SOUL.md"],
                          ["toolsMd", "TOOLS.md"]
                        ] as const
                      ).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          className={orgFileTab === key ? "tabActive" : "tab"}
                          onClick={() => setOrgFileTab(key)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <textarea
                      className="orgFileEditor"
                      spellCheck={false}
                      value={agentFileDraft[orgFileTab]}
                      onChange={(e) => setAgentFileDraft((d) => ({ ...d, [orgFileTab]: e.target.value }))}
                    />
                    {selectedOrgNode.reportsToId ? (
                      <button type="button" className="primary" disabled={agentFilesSaving} onClick={() => void saveOrgAgentFiles()}>
                        {agentFilesSaving ? "Saving…" : "Save pack (manager)"}
                      </button>
                    ) : (
                      <p className="muted small">Read-only for top-level CEO (no org manager in tree).</p>
                    )}
                  </div>
                ) : (
                  <p className="muted">Select someone in the org tree to view their four markdown files.</p>
                )}
                <div className="orgHire">
                  <h3>Hire (manager creates subordinate)</h3>
                  <p className="muted small">
                    Pick the hiring manager (their node id is used as <code>actorOrgNodeId</code> and <code>reportsToId</code>). Optionally paste custom agent / heartbeat / soul /
                    tools markdown — otherwise defaults apply for the role.
                  </p>
                  <div className="row">
                    <select
                      value={newNode.hiringManagerId}
                      onChange={(e) => setNewNode((s) => ({ ...s, hiringManagerId: e.target.value }))}
                    >
                      <option value="">Hiring manager…</option>
                      {orgOptions.map((node) => (
                        <option key={node.id} value={node.id}>
                          @{node.handle} — {node.name}
                        </option>
                      ))}
                    </select>
                    <input placeholder="Display name" value={newNode.name} onChange={(e) => setNewNode((s) => ({ ...s, name: e.target.value }))} />
                    <input placeholder="Handle" value={newNode.handle} onChange={(e) => setNewNode((s) => ({ ...s, handle: e.target.value }))} />
                  </div>
                  <div className="row">
                    <input
                      placeholder="Skills (comma-separated)"
                      value={newNode.subtreeSkillsManifest}
                      onChange={(e) => setNewNode((s) => ({ ...s, subtreeSkillsManifest: e.target.value }))}
                    />
                    <select value={newNode.role} onChange={(e) => setNewNode((s) => ({ ...s, role: e.target.value }))}>
                      <option value="ceo">CEO</option>
                      <option value="cto">CTO</option>
                      <option value="engineer">Engineer</option>
                      <option value="operator">Operator</option>
                      <option value="custom">Custom</option>
                    </select>
                    <button type="button" className="btnOutline" disabled={!newNode.hiringManagerId} onClick={() => void addOrgNode()}>
                      Hire
                    </button>
                  </div>
                  <details className="orgHireAdvanced">
                    <summary>Optional markdown overrides (hire)</summary>
                    <label>agent.md</label>
                    <textarea value={newNode.agentMd} onChange={(e) => setNewNode((s) => ({ ...s, agentMd: e.target.value }))} spellCheck={false} />
                    <label>HEARTBEAT.md</label>
                    <textarea value={newNode.heartbeatMd} onChange={(e) => setNewNode((s) => ({ ...s, heartbeatMd: e.target.value }))} spellCheck={false} />
                    <label>SOUL.md</label>
                    <textarea value={newNode.soulMd} onChange={(e) => setNewNode((s) => ({ ...s, soulMd: e.target.value }))} spellCheck={false} />
                    <label>TOOLS.md</label>
                    <textarea value={newNode.toolsMd} onChange={(e) => setNewNode((s) => ({ ...s, toolsMd: e.target.value }))} spellCheck={false} />
                  </details>
                </div>
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
                      value={boardDetailCard.status}
                      onChange={(e) => void setCardStatus(boardDetailCard.id, e.target.value as BoardCard["status"])}
                    >
                      {(["backlog", "in_progress", "in_review", "closed"] as const).map((s) => (
                        <option key={s} value={s}>
                          {boardStatusLabel(s)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="cardModalSection">
                    <label className="muted cardModalK" htmlFor="codex-prompt">
                      Codex prompt
                    </label>
                    <textarea
                      id="codex-prompt"
                      className="cardModalCodex"
                      value={codexPromptByCard[boardDetailCard.id] ?? ""}
                      onChange={(e) => setCodexPromptByCard((prev) => ({ ...prev, [boardDetailCard.id]: e.target.value }))}
                    />
                    <button type="button" className="btnOutline" onClick={() => void runCodex(boardDetailCard.id)}>
                      Run Codex
                    </button>
                    {codexLogByCard[boardDetailCard.id] ? (
                      <pre className="cardModalLog">{(codexLogByCard[boardDetailCard.id] ?? []).slice(-48).join("\n")}</pre>
                    ) : null}
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
