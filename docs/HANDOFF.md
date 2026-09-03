# arkive — engineering handoff

prototype: `design/arkive-v2.html` (standalone, opens anywhere). this doc indexes it.

## 1 · shell

7 pills: `chat · graph · vault · agents · manifests · relay · audit` + settings gear (⌘,). graph is an overlay (⌘g), not a page. esc closes overlays/drawers in order: settings → picker → context → everything else.

sub-tabs render as second-tier pills inline after their parent when active:
- vault → files · inbox · library · shared · sources · policies
- agents → network · work
- relay → health · overview · policies · integrations · storage · models · advanced

state: `view`, `vaultTab`, `agentsTab`, `relayTab`, `graphOpen`, `graphMode` (graph|canvas), `capDock`, `settingsOpen`, `pane`. all react state in Shell.

## 2 · screen inventory  (`data-screen-label` → component)

| label | component | data | notes |
|---|---|---|---|
| chat | ChatPanel | messages, manifest, ctxVersions | header: manifest id · vault head · ctx chip · `● capture` chip. composer with ttl chip + deny toggle. citations click → open doc. |
| capture | CaptureDock | proposals (write) | docked over chat. modes voice·note·task·files. recorder state machine below. |
| graph | GraphOverlay | documents (read), selection | LOCKED: renderer, physics, lasso, tier filters, labels, scope bar. only feed it more nodes/edges. |
| canvas | CanvasMode | brainObjects, canvasLayout | inside graph overlay. 5 views over one list. select → temp chat context. |
| vault (files) | VaultTree + ReadingView | documents, stars, always | obsidian-style tree; click file → reading view; wiki-links; linked mentions from graph edges. |
| inbox | ProposalReview | proposals | accept / edit / merge / defer / dismiss-with-reason. shows diff before accept. `save to` tier override. memory kind requires consent. |
| library | Library + CartridgeBuilder | cartridges | 6-step builder; multi-template; ▣ scope separate; preview = exactly what ships. |
| shared | Shared | grants, requests | in / waiting on you / out. simulate-before-grant. revoke previews impact. |
| brain-sources | Sources | folders, sync | watcher + droplet + recordings + drops. |
| brain-policies | Policies | policy | tier toggles feed retrieval + graph immediately. dreams locked. |
| agents | AgentNetwork + AgentLog + AgentDrawer | agents, runs, auditEvents, tasks | orchestrator above specialists; connectors colored by state; drawer with 9 tabs + actions. |
| work | Work | tasks, runs | assign → hermes creates a run with a per-run grant; completion carries evidence. |
| manifests | Manifests | manifests | active / superseded / revoked. rollback = pointer. |
| relay (health) | RelayHealth | sync, folders, events | watcher live/offline, queued, droplet mirror. |
| system | SystemPanel | settings, policy | overview · policies · integrations · storage · models · advanced (rows). |
| audit | Audit | auditEvents | expandable rows → raw event · "what the agent saw". |
| settings | SettingsOverlay | opt, agentModel, capSkills, capConns, plugins, team | rail groups: personal · vault · app · capabilities · workspace(team). |
| team | Team (inside settings) | members, grants, requests | roles, share dialog, permission simulation, revoke → impact. |

## 3 · the six journeys (acceptance tests)

A **voice → brain** — chat `● capture` → record → markers → finish → saving → transcribing → ready (or simulated failure: audio survives) → correct transcript v1→v2 → send proposals → vault/inbox shows note+task+memory → accept with `save to` override → node appears in that tier on the graph → reading view shows provenance chain to rec@00:31.

B **canvas → chat** — graph overlay → canvas mode → select cards → "use in chat temporarily" → chat scope = those docs, ttl session → nothing persisted unless "sign + publish manifest".

C **build + share cartridge** — vault/library → new cartridge → pick ≥1 templates → name → ≥1 sources → guidance → ▣ toggle → preview → sign → appears in library + audit event → share from settings/sharing.

D **install safely** — vault/library → nezu-desk pack update v3 → "apply knowledge only" leaves ▣ off → audit shows knowledge accepted, capability declined.

E **agent work with evidence** — agents/work → assign t1 → hermes → run #414 running (grant = task's cited docs only) → done with evidence → agents/network drawer → runs → "what it saw" → agents approval banner → inspect preflight → approve.

F **team governance** — settings/team → share dialog → kiln guest, view+comment, 30d, no download → effective-access preview → grant (audit) → simulate kiln → revoke → impact panel → audit row.

## 4 · four-card tray (chat)

docs in scope (tier breakdown + stacked bar) · context weight (tokens / 128k, band normal<50 elevated<70 warning<90 critical) · provenance coverage (signed·pinned·sealed·unknown) · attention (pending proposals + drift + expiring grants + failed runs). click → detail sheet. exactly four. formulas in STATE-SCHEMA §derived.

## 5 · engineering annotations (easy to misbuild)

1. **accept is an event, not a row update.** the diff shown on the proposal card IS the event body. write proposal→accepted, create/append the object, append auditEvent — one mutation.
2. **canvas stores layout only.** `canvasLayout {objectId, x, y, w, h, group}`. no object fields duplicated.
3. **manifest rollback = pointer move.** manifests are immutable rows; `activeManifestId` per room moves. never edit a manifest row.
4. **grants are leases.** `grants {agentId, runId, docHashes[], expiresAt}`. run end → lease expires. pause = stop issuing.
5. **declined ▣ = absent.** installed bundle manifest excludes the capability; don't ship it disabled.
6. **model swap ≠ identity.** `agents.model` is a plain field. memory, instructions, grants, history untouched.
7. **capture never blocks on routing.** default destination is inbox tier; `save to` on accept overrides.
8. **transcription failure ≠ loss.** recording row exists with checksum before any derivation starts. failure sets `transcript.state=failed`, nothing else.
9. **connection ≠ access.** connector.status is separate from `capabilityGrants {agentId, capabilityId}`.
10. **sealed tier is excluded at indexing**, not at retrieval. `inbox/dreams/**` never gets a document row.

## 6 · state matrix (all reachable in prototype via demo actions)

recorder: idle · perm · recording · paused · processing · transcribing · ready · failed · published
proposal: pending · accepted · edited · merged · deferred · dismissed(reason) · consent-required
run: queued · running · waiting(approval) · done · failed · paused
connector: off · connected · error
cartridge: owned · installed(mounted) · temp · update-pending
grant: active · expiring · revoked
manifest: active · superseded · revoked
sync: watcher live/offline · queued n · indexing · drift ↯

## 7 · responsive

≥1200 full shell · 768–1199 tray wraps 2×2, nav scrolls · <768 one panel + pills scroll; graph/canvas/agents drill-in. mobile jobs first-class: record, capture, review inbox, approve, find object.

## 8 · accessibility

focus ring 2px #ff5a1f offset 2 · all clickable divs → role+tabindex (port as <button>) · status = glyph + word + color, never color alone (● ◇ ▣ ↯ ⊘) · reduced-motion: kill arkPulse/arkRise · 44px targets on mobile · aria-live for recorder, sync, approval, run state.

## 9 · glossary (ship the plain sentence; the definition is one disclosure deeper)

manifest — the exact list of documents a chat or agent answers from.
provenance chain — where this came from, step by step, back to the original.
context weight — how much room these docs take in the model's attention.
signature — proof of who made this and that it hasn't changed. (relay phase)
capability scope ▣ — the part of a package that can act, not just be read.
authority — how settled a piece of knowledge is: draft → reviewed → canonical.
live reference — the canvas card IS the object.
mount / promote — use behind its boundary vs. adopt into your brain via inbox review.
grant — a specific, revocable permission — never a standing door.

## 10 · open decisions

blockers: sync conflict UX beyond two parties · key recovery (relay phase) · cartridge license enforcement.
later: graph physics tuning · voice commands beyond find/play · workflow builder · marketplace (explicitly deferred) · realtime multiplayer canvas · mobile freeform canvas editing.
