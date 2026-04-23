# Agent Profile Dashboard — Rubric

## How to use this rubric

This rubric evaluates both Run A (Claude Code) and Run B (Paperclip agents) against the brief. Each run should be evaluated independently, then compared side-by-side in the comparison writeup.

Pass/fail items are binary — the condition is either met or not met. DS compliance items use **"pass with explicit justification"** — a run that deviates but documents its reasoning passes; a run that deviates silently fails. Qualitative items are scored 1–5, with 3 meaning "competent" and 5 meaning "notably excellent."

For each item, capture a one-sentence note with the reasoning. The notes matter more than the scores.

**Definition of "interaction":** one interaction = one click, one keypress, or one significant mouse action (drag, hover-activated menu open). Scrolls and passive hovers do not count.

## Section 1 — Primary goal

The load-bearing test. Everything else is secondary.

- [ ] **Monitoring test.** On a 1440px-wide screen with no scrolling, the design communicates all four of the following:
  1. **Activity state** — whether the agent is currently running, idle, paused, or in an error state
  2. **Current work** — the task, run, or issue the agent is engaged with right now, if any
  3. **Recent health** — outcomes of recent runs (succeeded, failed, mixed). Specific count open to the run.
  4. **Live economics — budget position** (the agent's current standing against its budget) is visible in the monitoring frame. Session burn rate may be present but does not itself satisfy this requirement unless budget position is also shown.

  Pass if all four are visible without scrolling. Fail if any one is missing or requires scrolling to locate.

## Section 2 — Mode coverage

Each secondary mode must be *served*, not just presented. Test the quality of support, not just the presence of information.

- [ ] **Operations.** A teammate can change the priority of the agent's in-flight tasks from the dashboard, without leaving the page. Pass/fail.
- [ ] **Accountability (spend).** A manager can identify which of the agent's tasks are most expensive — not just total spend, but enough granularity to spot outliers. Pass/fail.
- [ ] **Accountability (tokens).** An engineer can identify which runs burned the most tokens, with enough context to investigate (run identifier, timestamp, which task). Pass/fail.
- [ ] **Debug.** An engineer can identify failed tasks, see when each one failed, and navigate to the failed run within one interaction from the dashboard. Pass/fail.

## Section 3 — Action affordances

The two named actions from the brief, scoped as specified.

- [ ] **Change task priority.** Drag-and-drop between priority buckets or explicit priority selector, scoped to the top 5–10 in-flight tasks. Pass/fail.
- [ ] **Navigate to detail.** Link-based navigation to run/task/issue detail works. Pass/fail. (If the run introduced a different affordance, pass if it works and is at least as fast as the current link approach.)

## Section 4 — Data preservation

No user should be left unable to find the information they need for their mode.

- [ ] **Chart data reachable.** All four chart data surfaces (Run Activity, Issues by Priority, Issues by Status, Success Rate) are reachable within two interactions from the default view. Pass/fail.
- [ ] **Cost + token data both present.** Cost totals and token consumption are both visible on the dashboard — not one or the other. Pass/fail.
- [ ] **Recent issues reachable.** The list of recent issues assigned to this agent is accessible within two interactions. Pass/fail.

## Section 5 — DS compliance (pass with explicit justification)

A run that deviates and documents its reasoning passes. A run that deviates silently fails. Check `./run-notes.md` (or equivalent) for justifications.

- [ ] **Rounded corners.** The Paperclip dashboard aesthetic is sharp — `rounded-none` is the default. Runs may use `rounded-lg` / `rounded-xl` / `rounded-md` on specific surfaces if justified (e.g., "used `rounded-lg` on the run transcript card because chat-like surfaces read better with rounded corners"). Silent use of rounded corners without justification fails the item.
- [ ] **No new tokens.** The run did not add any new DS tokens. If the run felt a token was needed, it used existing tokens or flagged the gap without adding it.
- [ ] **No component extraction.** `AgentOverview` / `LatestRunCard` / `CostsSection` remain as inline functions inside `AgentDetail.tsx`. No new files created for these components.
- [ ] **No chart tokenization.** Chart colors remain hardcoded hex. No `--chart-*` token consumption.
- [ ] **No raw-palette drift.** The run did not introduce new raw-palette Tailwind classes (`bg-slate-500`, `text-zinc-700`, etc.) beyond what already existed in the dashboard region. Reusing existing raw-palette instances is okay; adding new ones isn't, unless flagged and justified.
- [ ] **Pause uses neutral styling.** No amber, orange, or destructive treatment on the pause-agent action.
- [ ] **Live-run visual distinction preserved.** The live-running state is clearly distinct from the non-running state in the redesigned dashboard. The specific mechanism (cyan pulse, different treatment, motion, typography) is open — but the distinction must exist.
- [ ] **No out-of-scope changes.** No edits to other profile tabs, other pages, `status-colors.ts`, the DS token files, or the plugin SDK.

## Section 6 — Qualitative (1–5)

Four axes where judgment matters. 3 = competent. 5 = notably excellent. 1 = fails to meet the minimum.

- [ ] **Improvement over current state.** Compared to the current dashboard (see `./reference/`), is this design an improvement for the primary monitoring mode?
  - _1: regression — worse than today. 3: roughly equivalent. 5: clearly and materially better._
  - This is the most important qualitative axis. A design that complies with every other section but doesn't improve on the current dashboard is a failure of the experiment's purpose.

- [ ] **Hierarchy clarity.** Does the design have a clear primary, secondary, and tertiary layer? Can a user tell at a glance what's most important?
  - _1: no hierarchy, everything equal weight. 3: clear primary, rest undifferentiated. 5: three layers distinct, each earning its place._

- [ ] **Visual restraint.** Does the design match Paperclip's Swiss-minimal aesthetic? Sharp, sparse, intentional. Density and decorative judgment are part of this axis.
  - _1: cluttered or decorative; aesthetic mismatch. 3: neutral, doesn't violate the aesthetic. 5: actively reinforces the aesthetic with considered restraint._

- [ ] **Live-run signal strength.** How clearly does the design communicate "this agent is alive right now" when applicable?
  - _1: live state is indistinguishable from non-live. 3: distinct but subtle. 5: unmistakable without being obnoxious._

## Section 7 — Friction log (not scored)

Capture observations from running the experiment. These don't affect pass/fail but inform the comparison writeup.

- What did the run get stuck on? Any scope pressure or ambiguity?
- What decisions got made implicitly vs. explicitly?
- What was the run's biggest interpretation of the brief? (E.g., how did it weight monitoring vs. secondary modes?)
- **DS awareness.** Did the run surface DS gaps, flag tensions, or make implicit DS decisions explicit in run-notes? (E.g., "pause wanted amber," "considered extracting AgentOverview but didn't because of scope," "flagged that Issues-by-Priority chart adds little value.")
- Did the run consider mobile implications? If so, what did it decide or avoid? If not, is there anything in the redesign that would clearly degrade on mobile? (Mobile is out of scope for this experiment — this question is about awareness, not deliverables.)
- **Rubric experience.** Was the rubric easy or hard to apply to this run? Any items that felt unclear, or any qualities of the design the rubric didn't capture well?
- What would you add to the brief if running this again?

---

## Scoring summary template

When evaluating each run, produce this summary at the top of the evaluation:

```
Section 1 (Primary goal):     PASS / FAIL
Section 2 (Mode coverage):    X / 4 passed
Section 3 (Actions):          X / 2 passed
Section 4 (Data):             X / 3 passed
Section 5 (DS compliance):    X / 8 passed (with justifications noted)
Section 6 (Qualitative):      Improvement: X/5 | Hierarchy: X/5 | Restraint: X/5 | Live-run: X/5
Section 7:                    See notes
```

A run that fails Section 1 is a failed redesign regardless of how it scored elsewhere. A run that passes Section 1 but scores 1–2 on "Improvement over current state" (Section 6) is also a failed redesign — it met the letter of the rubric but missed its purpose. Sections 2–5 determine whether the run is complete. Section 6 determines whether the run is excellent.
