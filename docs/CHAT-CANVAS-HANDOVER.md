# arkive — chat + canvas handover

**scope:** the main chat page gains (1) a permanent rooms rail and (2) a `chat | canvas` toggle. nothing else in the app changes.
**reference:** `design/arkive-chat-canvas-2a-2b.html` — option **2a** is chat view, **2b** is canvas view. same shell, same rail, one toggle.
**slots into:** `docs/BUILD-PROMPTS.md` as prompts **02b** and **02c**, after `02 chat`.

---

## 1 · the idea in one paragraph

a room (dm:hermes, #xela, night desk…) is the unit of work. today the chat page shows one room and hides its context behind header chips and other tabs. this change puts the room's context beside it (the rail) and, on demand, *around* it (the canvas). the canvas is not a new object model or a whiteboard — it is the same room drawn as three bands: what it can **read** (memory), the room itself, and what it can **do** (agents + tools). every card is an existing row; every action is an existing mutation.

---

## 2 · what stays exactly as is

- 7-pill nav (`chat · graph · vault · agents · manifests · relay · audit`), settings overlay, capture dock
- the graph overlay and its renderer (⌘g) — **locked**. canvas ≠ graph: canvas projects a *room*, graph projects the *vault*.
- the four-card tray under chat (docs in scope · context weight · provenance · attention)
- all convex tables and mutations. this feature adds **zero** tables and **zero** mutations.

---

## 3 · chat view (2a)

### layout
```
header: [scope label] [7 pills] [chat|canvas seg] [⚙]
main:   [ chat panel ─────────── flex 1 ] [ rooms rail 252px ]
        [ four-card tray                ] [                  ]
```
- rail is a sibling of the chat column, `gap: 10px`, full height of main.
- chat panel and tray are unchanged from prompt 02/03.
- header manifest/ctx chips shrink to one mono line — the rail carries the detail now.

### rooms rail — three blocks, top to bottom
| block | rows | data | click |
|---|---|---|---|
| **rooms** | one per room: dot (state color), name, one-line status (`m-0412 · run #415 live`, `you · nezu · hermes`, `idle · 04:10`, `21:30 brief · scheduled`), amber badge for waiting approvals | `rooms` + latest `runs` per room + `proposals`/approvals count | switch room |
| **this room pulls from** | `canon · 4 always` · `curated · 6 m-0412` · `ctx summary v3 8k` · `inbox · denied 3 refusals` | active manifest → docHashes grouped by tier; `contextSummaries` where on; `tierPolicy`; denial count from `auditEvents` kind=deny this session | tier row → vault/files filtered · ctx row → chat context sheet · denied row → audit filtered |
| **running** | `hermes · #415 drafting` (orange pulse) · `hermes · #414 waiting on you` (amber) | `runs` where state in (running, waiting) for agents present in this room | → agents/network drawer on that run |
| footer | `open canvas view →` | — | sets `roomView='canvas'` |

state colors are the existing status vocabulary: orange = running, amber `#d9a13a` = waiting, gray `#8a8a8a` = active/human, `#5c5c5c` idle, `#3a3a3a` scheduled/sealed.

### rules
- the rail **reads**; it never writes. all actions deep-link to the page that owns the mutation.
- collapsible (`⌘\`), remembered per user.

---

## 4 · canvas view (2b)

### layout (over the same main area; rail stays)
```
[memory layers · what the room can read]      ← band 1, 4 cards, grid
          ╲    ╲    ╲    ╲  (connectors)
             [ the room card ]                 ← band 2, centered, 400×270
          ╱    ╱    ╱    ╱  (connectors)
[agents + tools · what the room can do]        ← band 3, 4 cards, grid
```
dotted canvas background (`radial-gradient(rgba(255,255,255,.06) 1px, transparent 1px)`, 22px). an absolute `<svg>` layer draws connectors between band cards and the room card. the tray is hidden in canvas (its numbers appear on the cards).

### band 1 — memory (what the room can read)
| card | shows | source | actions |
|---|---|---|---|
| **canon** | count, file names, `always` | brainObjects tier=canon ∩ alwaysLoad | → vault/files |
| **curated** | count, names, manifest id | active manifest docHashes tier=curated | lasso ⌘g · supersede |
| **context summary** | version, tokens, `on`, other versions off | `contextSummaries` for room | **summarize now** (existing) · pick versions |
| **inbox · sealed** | `0` · refusals count · `dreams ⊘ excluded at source` (dashed border, 0.8 opacity) | tierPolicy + deny events | — (informational; the gate working is a success state) |

### band 2 — the room
the chat panel in miniature: header (dot · name · manifest · doc count), last 2–3 messages with citation chips, live-run row, composer. `⤢ open in chat` flips `roomView` back. it is the **same component** as chat view at a fixed size — not a copy.

### band 3 — agents + tools (what the room can do)
| card | shows | source | actions |
|---|---|---|---|
| **agent (hermes)** | state, run id + task, grant (`2 docs · send gated`), model · harness | `agents` + current `runs` + `grants` | what it sees · pause |
| **approval gate** | waiting run, saw N docs at pinned hashes | `runs` state=waiting | **approve** · preflight |
| **skills · connectors** | scoped skills, connector leases, `▣ none consented` | `skills` (scope ∋ agent) · `capabilityGrants` | manage → settings/capabilities |
| **cartridges** | mounted pack, version, update pending, `▣ declined` | `cartridges` | review v3 · load |

### connectors (derived, never stored)
| stroke | meaning | derived from |
|---|---|---|
| orange `#ff5a1f`, dashed, animated | a running run's grant is reading this | run.state=running & docHashes ∩ card |
| amber `#d9a13a` | waiting on an approval | run.state=waiting |
| tan `#c8b4a6` | context summary feeding the room | contextSummary.on |
| gray `#5c5c5c` | allowed, idle | manifest membership |
| `#3a3a3a` dotted | denied / sealed | tierPolicy exclude or deny events |

`@media (prefers-reduced-motion)` kills the dash animation; every connector also carries a title/label so state never relies on color alone.

### rail in canvas view
same three blocks, plus a **canvas layers** block: `memory · agents · tools · graph floor · audit trail` checkboxes (persisted). footer becomes `← back to chat`. hiding a layer is visual only — **hidden layer ≠ revoked access**.

---

## 5 · state + persistence

```ts
// Shell / userSettings
roomView: Record<roomKey, 'chat' | 'canvas'>          // per room
railOpen: boolean                                     // ⌘\ 
canvasLayers: { memory: boolean; agents: boolean; tools: boolean; graphFloor: boolean; audit: boolean }
```
persist in `userSettings.opt`. **nothing else is written by this feature.**

---

## 6 · invariants (the reviewer checks these)

1. canvas creates no rows. every card maps to an existing row id; deleting/hiding a card never touches the object.
2. every canvas action calls the mutation the page version already calls — `approve`, `pause`, `summarize`, `proposals.accept`, cartridge review. no parallel handlers.
3. connectors are computed in `useMemo` from runs/grants/approvals/policy. no `connections` table.
4. the graph renderer is not imported into canvas. "graph floor" is a dimmed read-only render behind the bands, or omitted in v1.
5. the room card in band 2 is `<ChatPanel compact />`, not a second implementation.
6. hidden layer ≠ revoked access. denial is shown as a success state (`0 exposed · protected`).
7. rail deep-links only.

---

## 7 · responsive

| width | rail | canvas |
|---|---|---|
| ≥ 1200 | visible, 252px | three bands, 4 cards each |
| 768–1199 | collapses to a 44px icon strip (rooms dots + badge counts) | bands wrap to 2×2 cards; room card full width |
| < 768 | bottom sheet (rooms) | canvas becomes a vertical stack: memory → room → agents; connectors hidden, replaced by a one-line "reads 10 docs · 1 run live · 1 gate" strip |

---

## 8 · build prompts (append to `docs/BUILD-PROMPTS.md`)

### 02b · rooms rail
> port the rooms rail from `design/arkive-chat-canvas-2a-2b.html` (option 2a, the 252px column) into `app/src/RoomsRail.tsx`, mounted right of `ChatPanel` in `Shell`. three blocks: rooms (from `rooms` + latest run per room + waiting count), "this room pulls from" (active manifest docHashes grouped by tier via brainObjects, `contextSummaries` on-version, `tierPolicy`, deny-event count), "running" (runs in running/waiting for agents in this room). every row deep-links to the owning page; the rail writes nothing. ⌘\ toggles, persisted in `userSettings.opt.railOpen`. footer button sets `roomView='canvas'`. match inline styles and copy exactly. typecheck. commit "02b rail".

### 02c · canvas view
> port option 2b into `app/src/CanvasView.tsx`, rendered in place of chat+tray when `roomView[room]==='canvas'`. three bands as css grids over the same queries the rail uses plus `agents`, `runs`, `grants`, `skills`, `capabilityGrants`, `cartridges`. band 2 renders `<ChatPanel compact />` at 400×270. connectors: absolute svg, paths computed in `useMemo` from card/room DOM rects + run/grant/approval/policy state; colors per the handover table; dash animation off under reduced-motion; each path has a `<title>`. card actions call the existing mutations (approve, pause, summarize, cartridge review) — no new mutations. rail gains the "canvas layers" block persisted in `userSettings.opt.canvasLayers`; header gains the `chat | canvas` seg. tray hidden in canvas. typecheck. commit "02c canvas".

---

## 9 · acceptance (journey G — add to HANDOFF §3)

open dm:hermes → rail shows m-0412 pulls 4 canon + 6 curated, ctx v3 on, 3 denials, hermes #415 running → click `open canvas view` → memory band matches rail counts; orange dashed connector from curated → room → hermes card; amber from gate → click `approve` on the gate card → same audit event as approving from agents page; connector turns green → click `summarize now` → ctx summary card shows v4 on, rail updates → `← back to chat` → chat unchanged, tray back, rail identical.

---

*simulated until the relay phase. source: Arkive Chat Canvas Explorations · turn 2 · options 2a + 2b · 2026-09-04.*
