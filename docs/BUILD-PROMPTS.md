# arkive — build prompts for claude code / cursor

run these in order, one per session, inside the repo root. each ends with `npm run typecheck` green and a PR. after each, say "sync" in the design chat so the prototype and repo get diffed.

every prompt assumes the agent has read `.cursor/rules/arkive.mdc` first — say so explicitly if it's claude code.

---

## 00 · boot

> read `.cursor/rules/arkive.mdc`, `docs/HANDOFF.md` and `docs/STATE-SCHEMA.md` fully. then: `cd app && npm i`, run `npx convex dev` once to provision a dev deployment and write `.env.local` (`VITE_CONVEX_URL`), then `npm run tauri dev`. confirm the 7-pill shell renders on :1420 with sub-tabs for vault/agents/relay, ⌘g toggles the graph overlay, ⌘, opens settings, esc closes. fix anything broken in the scaffold. commit "00 boot".

## 01 · seed data

> create `app/convex/seed.ts` — an internal mutation that seeds brainObjects, proposals, manifests, rooms, agents, runs, tasks, cartridges, grants, accessRequests, skills, connectors, plugins, watchedFolders, syncState, tierPolicy, userSettings from the prototype's `state = {…}` block and `TIERS`/`NAMES` in `design/arkive-v2.html` (search for `class Component`). use the same paths, tiers, briefs, hashes and copy verbatim. 9 canon · 20 curated · 14 dashboards · 8 legal · 58 inbox docs (inbox names generated like the prototype). never create a row under `inbox/dreams/`. add `npm run seed`. commit "01 seed".

## 02 · chat panel

> port `[data-screen-label='chat']` from `design/arkive-v2.html` into `app/src/ChatPanel.tsx`. header (title, hermes · mini · launchd / manifest id / vault head / ctx chip / `● capture` chip), message list with citations (click → open doc in vault), typing indicator, composer with ttl chip + deny toggle + send. data: `useChatMessages(room)` over `messages`; `chat.sendMessage` action appends the op message then an ag reply from the prototype's `REPLIES` (rotate, substitute `{n}` with scope doc count). match structure, inline styles and copy exactly. commit "02 chat".

## 02b · rooms rail

> port the rooms rail from `design/arkive-chat-canvas-2a-2b.html` into `app/src/RoomsRail.tsx`, mounted to the right of the room's chat/canvas projection. derive rooms and waiting/running summaries from existing `rooms`, `manifests`, `runs`, `brainObjects`, `contextSummaries`, `tierPolicy`, and `auditEvents` rows. the rail writes nothing; every row deep-links to the page that owns the action. `⌘\\` toggles it and `userSettings.opt.railOpen` remembers the choice. status copy must say `simulated` or `not connected` until a real runtime health check exists. commit "02b rail".

## 02c · room canvas

> port option 2b into `app/src/RoomCanvasView.tsx`, rendered in place of chat+tray when `roomView[room]==='canvas'`. keep the existing graph overlay and `CanvasMode` untouched: room canvas projects one room; graph projects the vault. three bands show memory, a compact `<ChatPanel />`, and agents/tools from existing rows. connectors are derived SVG paths, never stored. canvas actions reuse existing page mutations or deep-link to their owner. persist only `roomView`, `railOpen`, and `canvasLayers` in `userSettings.opt`; hiding a layer never changes access. label Hermes and every runtime truthfully as simulated/not connected until an adapter health check succeeds. commit "02c room canvas".

## 03 · four-card tray

> port the light tray under chat: exactly four cards — docs in scope · context weight · provenance coverage · attention — with the stacked tier bar, progress bar, two gauges, arrow controls, and click → detail sheet. formulas from `docs/STATE-SCHEMA.md §derived` as a `useScopeMetrics(room)` hook. band thresholds 50/70/90. zero exposure reads as success. responsive: 4 → 2×2 → 1 column. commit "03 tray".

## 04 · graph overlay (LOCKED — port verbatim)

> port the graph overlay into `app/src/GraphOverlay.tsx`. copy the renderer verbatim from the prototype: `graph()` layout with `CENTERS`, `SIM` constants, `tick()` physics, node sizing/opacity per tier, edge paths, hot path for selection, labels per `labelMode`, tier filter chips, lasso (drag / shift-drag / click toggle), sealed `dreams` node, bottom scope bar (count · tiers · est. tokens · inspect), `clear` and `sign + publish manifest`. nodes come from `useDocuments()`. signing inserts a `manifests` row and moves `rooms.activeManifestId`. do not change visuals, physics or controls. add the `graph | canvas` mode seg (canvas is a placeholder for now). commit "04 graph".

## 05 · vault files — tree + reading view

> port `[data-screen-label='vault']` files tab into `VaultTree.tsx` + `ReadingView.tsx`. obsidian-style folder tree grouped by dirname, tier order canon·curated·dashboards·legal·inbox, collapsed by default for dashboards/legal/inbox, counts, sealed `dreams ⊘` row after the inbox subtree, search/★/always filters that force-expand matches. click file → reading view: breadcrumb, title, metadata strip, rendered body (h/p/li/q/tag/wiki-link rows — port `DOCBODIES` + `docBody()` generator), linked mentions from graph edges, header actions ★ / always / add to scope / promote / ✕. star/always write `brainObjects.starred/alwaysLoad`. commit "05 vault".

## 06 · vault inbox — proposal review

> port `[data-screen-label='inbox']` into `ProposalReview.tsx`. cards per proposal: kind pill, confidence, source line, brief, quote, chips (the diff), `save to` tier chips with live path preview (canon shows "needs authority review"), actions accept / edit / merge / defer / dismiss with reason; memory kind requires `consent + accept`. wire `proposals.accept` (already implemented — honor `saveToTier`) and `proposals.dismiss`. accepted docs appear in the tree and graph immediately. commit "06 inbox".

## 07 · capture dock + recorder

> port `[data-screen-label='capture']` into `CaptureDock.tsx`, mounted over chat when `capDock`. modes voice · note · task · files. recorder state machine exactly: idle → perm → recording (timer, waveform bars, markers, pause/resume) → finish → processing → transcribing → ready | failed (audio intact, retry) → publish. use tauri + web audio for a real mic; store audio via convex file storage with checksum BEFORE any derivation; transcript segments seeded from the prototype's `TRS` (real STT later). note/task/files create `proposals` rows (targetTier inbox). `send proposals → inbox` creates note+task+memory proposals with `derivedFrom` locators (rec@00:04 etc.). commit "07 capture".

## 08 · agents — network, drawer, log

> port `[data-screen-label='agents']` into `AgentNetwork.tsx`, `AgentDrawer.tsx`, `AgentLog.tsx`. orchestrator card above specialists; connectors as svg lines colored by state (running orange animated, waiting amber, done green, failed red, idle gray) + glyphs; click agent highlights routes, enter opens drawer; click connector opens route detail. drawer tabs identity · instructions · memory · knowledge · permissions · tools · runs · events · relationships; actions assign / open run / pause-resume / what it can see / revoke / change model (identity untouched) / delegate / retry from pinned context. log: latest 50 audit events, filters, expand → saw/did/outputs/citations/errors/approvals/id. approval banner → preflight → approve. data: agents · runs · grants · delegations · auditEvents. commit "08 agents".

## 09 · work

> port `[data-screen-label='work']` into `Work.tsx` (agents › work tab). task rows with status pill, source, due, assignee. `assign → hermes` creates a run with `saw.docHashes` = the task's cited docs only (never wider), state running → done after the simulated step with `evidence` and an audit event; grant expires on completion. `evidence · run #n` opens the agents drawer on that run. commit "09 work".

## 10 · library + cartridge builder

> port `[data-screen-label='library']` into `Library.tsx` + `CartridgeBuilder.tsx`. cards: owned / installed(mounted) / temp with verbs (load into scope, share, update review, stay). update review: `apply knowledge only` vs `apply + enable ▣` vs stay — declined ▣ must be structurally absent. builder: 6 steps, multi-select templates (select all / clear all), name+purpose, sources by pinned hash, guidance, scopes with ▣ separate consent, preview = exactly what ships → sign → insert `cartridges` + audit. commit "10 library".

## 11 · shared + team (settings)

> port `[data-screen-label='shared']` into `Shared.tsx` (vault › shared) and `[data-screen-label='team']` into `settings/Team.tsx` under a `workspace › team` rail group. shared: with you / waiting on you (simulate first · deny · grant) / shared out (revoke). team: members + roles, share dialog (people/groups/link, view·comment·edit·manage·run·install·redistribute, expiry, no-download, sensitive warning, separate ▣ consent, plain-language effective-access preview), permission simulation (inherited / direct / denied with why-lines, raw behind advanced), revoke → downstream impact panel. all writes → grants/accessRequests + auditEvents. commit "11 team".

## 12 · manifests · relay · audit · system panels

> port manifests (active / superseded / revoked, detail, rollback = move `rooms.activeManifestId`), relay health (watcher live/offline, queued, droplet, drift ↯, retry) fed by `syncState`, audit (expandable rows → raw + "what the agent saw", kind filter), and the relay sub-tabs overview · policies · integrations · storage · models · advanced as row panels. settings panes: profile, appearance, notifications, shortcuts, tier policy, desktop sync (watched folders add/remove), manifests, sharing, agents (model per agent), relay, experiments, mobile, updates, skills, connectors, plugins — native row/toggle/seg patterns from the prototype's `panes()`. commit "12 system".

## 13 · canvas mode

> port `[data-screen-label='canvas']` into `CanvasMode.tsx` inside the graph overlay (mode seg). five views over one object list: freeform (absolute cards, live-ref dot vs canvas-only), board (3 columns), graph (opens the real graph), timeline, workflow (5 nodes, run → approval gate → done). select cards → dashed temp bar → "use in chat temporarily" sets session scope without a manifest. layout persists to `canvasLayout` only. commit "13 canvas".

## 14 · tauri watcher

> in `app/src-tauri/src/lib.rs` implement the folder watcher: watch `watchedFolders` paths, on create/modify compute sha256, upsert `brainObjects` (type source, tier from folder rule or path prefix, never modify the file), skip `**/dreams/**` entirely, update `syncState` (head, lastScan, pending, indexing). expose `tauri::command`s: `add_folder`, `remove_folder`, `reindex`. wire the desktop sync pane. commit "14 watcher".

## 15 · responsive + a11y pass

> apply `docs/HANDOFF.md §7–8`: breakpoints ≥1200 / 768–1199 / <768 with drill-ins for graph/canvas/agents; every clickable div → `<button>`; status = glyph + word + color; `aria-live` regions for recorder, sync, approvals, run state; focus ring; 44px targets on mobile; reduced-motion honored. no visual redesign. commit "15 a11y".

## 16 · relay phase (only after 00–15 are merged and approved)

> implement `app/src/adapters/` for real: IdentityProvider (npub via nostr-tools, key in os keychain via tauri plugin — never in convex or localStorage), RelayAdapter (buzz relay ws), EventVerifier (schnorr), EventProjector (event → convex). every mutation that today only appends `auditEvents` also emits a signed event; manifests/grants/accepts become kinds. remove every "simulated" label only where the real thing now exists. commit "16 relay".

---

## sync ritual (after each PR)

in the design chat: **"sync — PR 0N merged"**. the designer reads the repo, diffs against `design/arkive-v2.html`, and returns drift notes (styles, copy, missing states) before the next prompt.
