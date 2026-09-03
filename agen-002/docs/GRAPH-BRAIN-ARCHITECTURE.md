# GRAPH BRAIN // ARCHITECTURE SPEC
## Sovereign relay + spatial context selection + Hermes fleet integration

**Status:** Draft v0.1 — design capture
**Date:** 2026-08-05
**Author:** drafted with Hermes-adjacent assistance, operator review pending
**Depends on:** Buzz pilot verdict (MacBook taste-test → mini pilot)
**Related:** ARKIVE_PRODUCT_BLUEPRINT.md · FRTL_OPS_BUILD_PLAN.md · HERMES-BRAIN-CANON.md · xela-system-audit.md

---

## 0. one-line

A stock Buzz relay as coordination substrate, a custom EXO_DOS-based client as the interface skin, and an Obsidian-style graph layer where the operator *visually selects which vault data the brain is allowed to see* — scope expressed as a signed, auditable context manifest.

---

## 1. principles

1. **Fork nothing you don't have to.** Relay stays stock `block/buzz`. Upstream updates come free. Divergence is debt.
2. **The vault stays canonical on disk.** Git-versioned markdown remains the source of truth. The relay holds *references*, never content. Sovereignty by construction (Arkive posture), not by hosting alone (Buzz posture).
3. **The brain doesn't move.** Hermes keeps running as-is on the mini — same launchd service, skills, cron, OKF memory. Buzz is one more limb, not a new body.
4. **Scope is an artifact.** What the agent can see for a given conversation is an explicit, signed, inspectable object — not an emergent property of retrieval.
5. **Client is a skin.** The relay doesn't care what connects. EXO_DOS speaks the protocol; the desktop app remains a fallback client.
6. **Zero cross-brand leakage.** Per-brand relays (communities) preserve the three-brains isolation model at the protocol level.

---

## 2. system overview

```
                        ┌──────────────────────────────┐
                        │   EXO_DOS CLIENT (skin)       │
                        │  React + tldraw canvas        │
                        │  ┌────────┐ ┌──────────────┐  │
                        │  │ chat / │ │ GRAPH VIEW    │  │
                        │  │ rooms  │ │ vault nodes   │  │
                        │  │ / DMs  │ │ lasso select  │  │
                        │  └───┬────┘ └──────┬───────┘  │
                        └──────┼─────────────┼──────────┘
                               │ WS + REST   │ publishes
                               ▼             ▼
                    ┌─────────────────────────────────┐
                    │      BUZZ RELAY (stock)          │
                    │  signed events · channels · DMs  │
                    │  context-manifest events         │
                    │  vault-reference index events    │
                    │  Postgres · Redis · MinIO        │
                    └───────┬─────────────────▲────────┘
                            │ subscribes      │ posts
                            ▼                 │
                    ┌─────────────────────────────────┐
                    │   HERMES (mini, unchanged)       │
                    │  + buzz skill (buzz-cli wrapper) │
                    │  + manifest reader               │
                    │  + vault indexer (watcher)       │
                    └───────┬─────────────────────────┘
                            │ reads full content
                            ▼
                    ┌─────────────────────────────────┐
                    │   VAULT (disk + git, canonical)  │
                    │  canon/ · curated/ · inbox/      │
                    │  dashboards/ · legal/ · dreams/  │
                    └─────────────────────────────────┘
```

Content flows: **vault → Hermes → prompt context**. Only *references and manifests* touch the relay. If the relay dies, the brain and the vault are intact.

---

## 3. components

### 3.1 relay — stock buzz

- Deployment: `deploy/compose/` production bundle (relay + Postgres + Redis + MinIO as supervised containers), on the mini for the personal brain, per-droplet for brand/client brains later.
- Network posture: Tailscale-only. No public exposure. Relay URL = `ws://100.74.112.27:3000` (personal).
- One relay = one community = one brain scope. `xela` relay first; `frtl` and `zbmd` relays are later instantiations of the same pattern, never shared tenancy.
- No relay code modifications in v1. Manifest enforcement is agent-side (honor system) — acceptable while every agent in the fleet is operator-controlled. Server-side enforcement is the only future item that would require touching relay code; park it.

### 3.2 client — exo_dos skin

Reuse the existing EXO_DOS stack (React, tldraw SDK, Framer Motion panels, Clerk auth optional for multi-user later).

Surfaces:
- **Rooms/DMs panel** — standard chat client against the relay's WS + REST. Streaming responses from agents render as normal messages.
- **Graph view** — tldraw canvas rendering vault-reference events as nodes. Edges from: wiki-links, shared tags, embedding-similarity above threshold. Node states: default / selected / excluded.
- **Manifest bar** — shows active context manifest for the current conversation: doc count, trust-tier breakdown (canon/curated/inbox), last updated. One click to inspect the full doc list.
- **Session picker** — choose which agent (npub) a DM targets; model choice remains a Hermes-side concern, not a client concern.

v1 scope cut: no canvas co-editing, no huddles, no media comments. Chat + graph + manifest only.

### 3.3 vault indexer — hermes-side watcher

Small daemon (or cron-driven skill) on the mini:

- Watches `~/vault-xela/` for changes (fswatch or git-hook on commit).
- For each doc, publishes/updates a **vault-reference event** to the relay:

```json
{
  "kind": "<app-specific kind, vault-ref>",
  "content": "",
  "tags": [
    ["d", "canon/xela.md"],              // stable doc id (path)
    ["title", "operator identity"],
    ["tier", "canon"],                    // canon | curated | inbox | dashboards | legal
    ["hash", "sha256:..."],               // content hash at publish time
    ["t", "identity"], ["t", "voice"],    // doc tags
    ["links", "canon/brands.md"],         // outbound wiki-links, repeatable
    ["emb", "local:nomic/..."]            // pointer to local embedding, never the vector itself
  ]
}
```

- Never publishes document content. Title + tags are the exposure ceiling; if even titles are sensitive for a tier (e.g. dreams), publish hashed titles and resolve client-side from a local map.
- Embeddings computed locally (nomic-embed-text on Ollama, already running) and stored locally; the event carries only a pointer.

### 3.4 context manifest — the core primitive

A signed event created by the client when the operator lassos a selection on the graph:

```json
{
  "kind": "<app-specific kind, ctx-manifest>",
  "content": "brief for jrny proposal — canon + last 30d captures, no dreams",
  "tags": [
    ["d", "manifest-<uuid>"],
    ["scope", "dm:<agent-npub>"],          // or "channel:<id>"
    ["include", "canon/xela.md", "sha256:..."],
    ["include", "canon/brands.md", "sha256:..."],
    ["include", "inbox/hermes/2026-07-*.md", "sha256:..."],   // globs allowed, hash of glob-set
    ["exclude", "inbox/dreams/**"],
    ["ttl", "session"]                      // session | until-revoked | <iso-datetime>
  ]
}
```

Properties:
- **Signed by the operator's npub** — authorship is provenance.
- **Pinned by hash** — the manifest names the exact content versions in scope; a doc edited after manifest creation is detectably different.
- **Scoped** — applies to one DM or one channel, not globally.
- **Revocable** — publishing a superseding manifest (same `d` tag) or a revocation event ends it.
- **Auditable** — "what was the agent looking at when it said this" is answered by joining message timestamps against the active manifest. This is the client-deliverable feature.

Default when no manifest is active: **deny-by-tier** — agent sees `canon/` only. Explicit selection widens; nothing widens silently.

### 3.5 hermes buzz skill

One new skill on the existing brain, three functions:

1. **post** — wrap buzz-cli to publish messages/events as the agent npub (`BUZZ_PRIVATE_KEY` in skill env). Used by night-desk (brief → channel), capture (echo → channel), and ad-hoc.
2. **listen** — subscribe to the agent's DMs + member channels. On inbound message: resolve active manifest for that scope → pull named docs from vault at pinned hashes (git makes this trivial) → build prompt context → respond via post. This is the one genuinely new plumbing piece; pattern already exists in the macos-webhook-server skill.
3. **index** — the vault indexer from 3.3, runnable as cron or watcher.

Guardrails inherit: standing rules (drafts-not-fires, no cross-brand leakage) load before this skill, as with everything else.

---

## 4. flows

**Operator scopes a conversation:**
lasso nodes on graph → client signs + publishes manifest → manifest bar confirms → operator DMs agent → Hermes listener resolves manifest → context built from exactly those docs → response posts back → both sides of the exchange and the manifest itself are signed events in the log.

**Nightly brief:**
21:30 cron fires night-desk as today → output additionally posts to `#xela` via buzz skill → brief becomes a searchable event. Telegram delivery unchanged during pilot (double-post), retired only on verdict.

**Capture:**
`x note:` via Telegram works as today. Additionally, posting `x note:` in `#xela` triggers the listener → same capture skill → vault commit → indexer publishes updated reference → node appears/updates on graph. The loop closes: capture is visible as a new star on the map within seconds.

---

## 5. what this is NOT

- Not a fork of buzz. Zero relay patches in v1.
- Not a vault migration. Relay never becomes the system of record for knowledge.
- Not a replacement for buzz-agent/goose harnesses. Hermes is the runtime; Buzz-native agents are not used.
- Not multi-tenant. One relay per brain scope, full stop, until the per-customer platform work formally begins.
- Not dependent on Buzz's 🚧/💭 columns. Nothing here needs approval-gate glue, mobile clients, or web-of-trust to ship.

---

## 6. phases

**Phase 0 — pilot gate (now).** MacBook taste-test → mini relay via compose bundle → Nezu double-posting via `post` function only. Two weeks. Verdict question: does the searchable room beat the pipe. *No graph work before this passes.*

**Phase 1 — listener.** `listen` function: DM the brain inside Buzz, get answers with canon-only default context. First moment Buzz is a real second interface.

**Phase 2 — indexer + graph read-only.** Vault-reference events flowing; EXO_DOS renders the graph. No selection yet — just the map. (Standalone value: first real visualization of the vault.)

**Phase 3 — manifests.** Lasso → signed manifest → scoped context → manifest bar. The product moment.

**Phase 4 — harden + generalize.** TTLs, revocation UX, per-tier title-hashing, manifest audit view ("show me everything the agent saw this week"). Then, and only then, evaluate instantiating the pattern for `frtl` / `zbmd` relays and whether this becomes the spine of the per-customer platform offering.

---

## 7. open questions

1. **Event kinds** — pick app-specific Nostr kind numbers for vault-ref and ctx-manifest that don't collide with Buzz's reserved ranges (check ARCHITECTURE.md kind table before assigning).
2. **Glob semantics in manifests** — hash-of-glob-set vs. expanding globs to explicit doc lists at signing time. Explicit expansion is more auditable; leaning that way.
3. **Dreams tier exposure** — hashed titles vs. full exclusion from indexing. Default: exclude `inbox/dreams/` from the relay entirely; graph shows a sealed node.
4. **Listener transport** — buzz-cli subscription loop vs. relay workflow → webhook → mini. Start with cli loop (fewer moving parts); webhook path if reliability demands.
5. **Multi-operator later** — when Erica-class users enter, manifests signed by non-operator npubs need a policy (proposal vs. authority). Park until Phase 4.
6. **Server-side manifest enforcement** — the only item that would ever justify a relay fork. Explicitly deferred; revisit only if third-party agents join a relay.

---

## 8. decision log

| Date | Decision | Rationale |
|---|---|---|
| 2026-08-05 | No fork; stock relay + custom client | Protocol-native design makes the client the extension point; divergence is debt |
| 2026-08-05 | Vault content never touches relay | Sovereignty by construction; relay holds map, not territory |
| 2026-08-05 | Context manifest as signed event | Scope becomes inspectable artifact; enables agent-context auditability |
| 2026-08-05 | Deny-by-tier default (canon only) | Nothing widens silently |
| 2026-08-05 | Hermes remains sole runtime | Buzz is an interface layer, not a brain replacement |

---

*graph brain // arkhitek — draft v0.1*
*next action: none until Phase 0 verdict*
