# state schema — prototype → convex

legend: **T** convex table · **R** react state (Shell) · **D** derived (query or useMemo) · **X** dev fixture only

## BrainObject (T `brainObjects`) — the one table

```ts
{
  _id, type: 'source'|'note'|'task'|'recording'|'transcriptSegment'|'person'|'project'|'concept'|'memory'|'decision'|'canvas'|'cartridge'|'agent'|'relation',
  path?: string,            // vault path for file-backed objects
  title: string,
  tier: 'canon'|'curated'|'dashboards'|'legal'|'inbox',   // sensitivity/policy compat
  authority: 'draft'|'reviewed'|'approved'|'canonical'|'superseded',
  lifecycle: 'inbox'|'active'|'archived'|'expired'|'revoked',
  provenance: 'original'|'imported'|'inferred'|'transformed'|'unverified',
  hash: string,             // content hash of current version
  sourceId?: Id,            // the original this derives from (recording, file)
  derivedFrom: { objectId: Id, locator?: string }[],   // e.g. rec@00:31
  relations: { to: Id, kind: string, visualOnly?: boolean }[],
  permissions: { owner: string, sensitivity: 'private'|'restricted'|'shared'|'public' },
  reviewStatus: 'n/a'|'pending'|'accepted'|'rejected',
  starred: boolean, alwaysLoad: boolean,
  createdAt, modifiedAt, supersededBy?: Id
}
```
documents in the prototype (`allNodes()`) = brainObjects where type in (source, note) and path set. `useDocuments()` should return these.

## prototype state → home

| key | home | notes |
|---|---|---|
| view, vaultTab, agentsTab, relayTab, graphOpen, graphMode, capDock, settingsOpen, pane | R | shell |
| sel[], ttl, revoked, lasso, filters{} | R | graph selection = candidate manifest; sign → T manifests |
| msgs[] | T `messages` | keep useChatMessages; add `cites: string[]`, `snap` |
| draft, typing | R | |
| mid, room | R + T `rooms.activeManifestId` | manifest pointer lives on the room |
| manifests[] | T `manifests` | immutable rows {id, room, docHashes[], tiers, ttl, state, createdAt}. rollback moves `rooms.activeManifestId`. |
| ctxVersions[], lastSumAt | T `contextSummaries` | {room, version, tokens, on, note} — the "unlimited context" rolling summary files |
| extra[] | R | temp context adds (session) |
| inbox[] | T `proposals` | {kind, state, conf, sourceRef, brief, quote, diff[], targetPath, targetTier, consent, dup, rel[]} |
| inboxRoute{} | R | per-proposal save-to override until accept |
| promoted{} | D | brainObjects.authority |
| starIds[], alwaysIds[] | T brainObjects.starred / alwaysLoad | |
| treeClosed{}, vaultQ, vaultFilter, selDoc | R | |
| folders[], addingFolder, folderPath, folderTier | T `watchedFolders` + R | {path, tier, docs, status, primary} |
| pending, indexing, head, lastScan, macOnline, queued | T `syncState` (singleton) | written by the tauri watcher |
| policy{} | T `tierPolicy` (singleton) | dreams always 'exclude', enforced at indexing |
| runs[], selRun, approval, pfOpen | T `runs` + R | {agentId, taskId, state, cost, saw{instructionsV, manifestId, docHashes[]}, did, evidence[]} |
| agentModel{}, agentPaused{} | T `agents` | {name, purpose, model, harness, paused, instructionsV, memoryPolicy} |
| agDeleg{}, agSel, agDrawer, agDTab, agRoute, agQ, agLogF, agActiveOnly, agZoom, agView | T `delegations` + R | |
| tasks[] | T `tasks` | {title, status, assignee, due, sourceRef, evidenceRunId, subtasks[]} |
| carts[], cartUpdate, builder | T `cartridges` + R(builder draft) | {name, rel: owned|installed|temp, templates[], docHashes[], exec, version, publisher, updatePending} |
| tmReqs[], tmOut[], tmEvents[], tmSim, tmShare, tmWho, tmPerms, tmExp, tmDl, tmSens, tmRevoke | T `grants`, `accessRequests`, `auditEvents` + R | grants {principal, objectIds[], perms[], expiresAt, noDownload, revokedAt} |
| capSkills[], capConns[], capConnScope, capPlugOn, capPlugExec | T `skills`, `connectors`, `plugins`, `capabilityGrants` | capabilityGrants {agentId, capabilityId, kind} — connection ≠ access |
| capMode, rec, recT, recMarks, recTv, capVal, capDone, capTitle, capRoute | R + T `recordings` | recordings {audioBlobRef, checksum, durationS, markers[], transcript{version, state, segments[]}} |
| canvasMode, canvasSel | R + T `canvasLayout` | layout {canvasId, objectId, x, y, w, h, group} |
| wfStep | R (prototype) → T `workflowRuns` later | |
| opt{}, theme, density, roomView{}, railOpen, canvasLayers{} | T `userSettings` | room presentation only; hiding a layer never changes retrieval or access |
| metric, inspect, picker, pickQ, ctxOpen, traceOpen | R | sheets/overlays |
| clock | X | prototype clock; use real timestamps |
| REPLIES, TIERS, NAMES, CENTERS, SIM, DOCBODIES, CNV, WF, BTPL, TRS, RO | X | seed data / physics constants. graph SIM constants port verbatim into the (locked) graph. |

## derived (D) — same formulas as prototype `renderVals()`

- scope = selected docs ∪ alwaysLoad docs, filtered by tierPolicy != exclude, minus sealed
- tokens = Σ tier.tok per doc · dedup = ~15% · ctxLimit = 128k · util% = tokens/limit
- band: <50 normal · <70 elevated · <90 warning · else critical
- trust split = count per tier / scope.length
- provenance = signed% (relay phase: real) · pinned% · sealed/excluded count · unknown
- attention = pendingProposals + driftedDocs + expiringGrants + failedRuns
- agent tools tab = skills where on && (scope==='all' || scope===agentId) + connectors where capabilityGrant exists
- vault tree = group documents by dirname; tier order canon·curated·dashboards·legal·inbox; sealed row after inbox subtree
- linked mentions = graph edges touching the open doc

## audit events (T `auditEvents`) — every mutation appends one
`{ kind: 'capture'|'accept'|'dismiss'|'promote'|'manifest'|'revoke'|'grant'|'run'|'approval'|'install'|'update'|'model-swap'|'policy'|'capability', actor, objectIds[], summary, raw, at }`

## adapters (interfaces only this phase) — `app/src/adapters/`
IdentityProvider · RelayAdapter · EventVerifier · EventProjector · WorkflowEngine · NotificationProvider. see `app/src/adapters/index.ts`.
