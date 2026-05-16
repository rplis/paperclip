# AI Company App Caveats and Build Plan

Date: 2026-05-09

## Context

The active workspace is a lean AI-company control plane, with the richer Paperclip implementation kept in `archive/paperclip-reference` for reference. The current lean app already has a useful prototype loop:

- company creation with a goal
- automatic CEO bootstrap
- org nodes with reporting lines
- board cards with simple statuses
- message channels and direct-message style threads
- operator inbox and escalations
- simulated heartbeats that promote assigned backlog cards
- Codex kickoff flow that can create hires and cards from a CEO plan JSON block

The target product is an AI company app that behaves more like a real company: a boss creates a company and goal, a CEO decomposes work, managers delegate down the org tree, agents execute via heartbeats, the board oversees governance, and the dashboard shows progress, org structure, escalations, and daily reporting.

## Main Caveats

### 1. Persistence is currently in-memory

`packages/lean-db` stores companies, org nodes, cards, messages, escalations, and logs in `Map`s. Restarting the API loses the company. This is fine for a prototype but blocks real use.

Recommended next step: introduce SQLite or PGlite/Postgres behind a repository interface. Keep the lean data model small, but make every business entity company-scoped from day one.

### 2. Heartbeats do not execute agents yet

The heartbeat loop currently promotes assigned cards from Backlog to In progress. That proves scheduling, but not real agent execution. Codex can run for a card manually, and CEO kickoff runs automatically, but individual agents do not yet wake, read their assignments, act, update cards, and report.

Recommended next step: create a `heartbeat_runs` model and a scheduler that invokes an agent runner per due active agent. Store run status, logs, linked card, timestamps, and failure reason.

### 3. CEO conversation exists, but actions are not generally derived from chat

Messages and CEO DM are present. The CEO kickoff flow can turn a model plan into hires/cards, but normal conversation messages from the boss do not yet become structured actions.

Recommended next step: treat CEO chat as an issue/card-backed decision surface. When the boss messages the CEO, create or update a CEO work card and let the CEO heartbeat produce explicit proposed actions: create cards, hire agents, escalate, or ask clarification.

### 4. Governance needs clearer state transitions

Escalations exist, and manager-only hiring is partially enforced. But board approval, board-of-directors decisions, agent pause/resume, hire approvals, and budget hard stops are not yet modeled.

Recommended next step: add decision/approval records with `requested_by`, `requested_of`, `status`, `payload`, and `resolution`. Use them for hires, budget changes, destructive actions, and CEO strategy proposals.

### 5. Org hierarchy enforcement is partial

The store enforces “only the direct manager can create this subordinate” and “only direct manager can update a report’s agent files.” It does not yet enforce hierarchy for task assignment, escalation routing beyond manager/operator, visibility, or delegation rules.

Recommended next step: centralize org-policy helpers: `canHire`, `canAssign`, `canEditAgentFiles`, `escalationTargetFor`, and `isInManagementChain`.

### 6. The board model is too thin for real company operations

Current cards have title, description, status, assignee, and goal. Real operations need priority, parent/child tasks, due dates, acceptance criteria, blockers, comments, artifacts, and decision links.

Recommended next step: evolve `BoardCard` into a lightweight issue/task model before adding too much UI on top of it.

### 7. Daily CEO reporting is not implemented

The dashboard shows recent activity, but there is no daily report generation, report history, delivery preference, or “what changed since yesterday” summary.

Recommended next step: create a scheduled daily report job per company. The report should summarize completed/in-progress/blocked cards, escalations needing boss attention, new hires, run failures, and recommended next decisions.

### 8. SkillsMP integration should be a service, not prompt glue

The concept is good: use SkillsMP to find capabilities for agents. The caveat is that external skill search should not be embedded directly inside CEO prompts or UI event handlers.

Recommended next step: create a server-side skills provider with configuration, request validation, caching, and redacted logs. Never persist or display the raw API key.

### 9. Secrets and credentials need immediate hygiene

An API key was shared in plain text during planning. Treat it as exposed. It should be rotated before production use.

Recommended next step: store third-party API keys in environment variables or a secrets table/provider. Add `.env.example` names only, not real values.

### 10. UI is useful but still prototype-grade

The UI covers onboarding, dashboard, messages, inbox, board, goals, and org. It is enough to validate the concept, but it mixes test controls, long textual explanations, and hardcoded `localhost:3200`.

Recommended next step: split API client helpers from components, add proper settings, remove test-only escalation affordances, and make heartbeat interval visible/editable.

## Recommended MVP Slices

### Slice 1: Durable company core

- persist companies, goals, org nodes, cards, messages, escalations
- add company-scoped IDs and timestamps everywhere
- add a minimal migration path
- keep API responses compatible with the existing UI where possible

### Slice 2: Real heartbeat runs

- add per-agent heartbeat interval, default 10 minutes
- add `heartbeat_runs`
- scheduler finds due agents and invokes runner
- store run output and status
- dashboard shows live/last run state

### Slice 3: CEO action loop

- boss messages CEO
- CEO heartbeat reads messages and assigned CEO cards
- CEO returns structured actions
- server validates and applies allowed actions
- ambiguous or privileged actions become board approvals

### Slice 4: Governance and escalation

- approval model for hires, budget changes, external actions, and CEO strategic plans
- board-of-directors page or panel
- escalation routing through manager chain, then boss/board
- pause/resume agents and cards

### Slice 5: Reporting and settings

- daily CEO report job
- report history in dashboard
- heartbeat interval settings
- SkillsMP settings and skill search cache
- basic cost/budget fields even if token accounting is initially manual

## Design Principle

Keep chat as an interface to work, not a second source of truth. Every CEO conversation that creates action should resolve into a card, approval, escalation, report, or org change.

