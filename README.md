# agen // 002 — arkive

sovereign relay + spatial context selection + a voice you can talk to.

this repo is the implementation of the arkive prototype. the design is the spec.

## layout

- `design/arkive-v2.html` — the standalone prototype. **source of truth for UI + behavior.** open it in a browser; every screen, state and handler is readable in its `Component` class.
- `docs/HANDOFF.md` — screen inventory, six journeys (acceptance tests), engineering annotations, deferred list.
- `docs/STATE-SCHEMA.md` — BrainObject model + every prototype state key → its convex home.
- `docs/GRAPH-BRAIN-ARCHITECTURE.md` — the original architecture spec.
- `.cursor/rules/arkive.mdc` — rules cursor follows while porting.
- `app/` — tauri + react + convex scaffold. `Shell.tsx` is the 7-pill shell skeleton.

## run

```
cd app
npm i
npx convex dev        # terminal 1 — creates .env.local with CONVEX_URL on first run
npm run tauri dev     # terminal 2 — vite on :1420 inside the tauri window
npm run typecheck
```

## staged plan (one PR each)

1. shell + nav (layout only)
2. BrainObject in convex — everything depends on this
3. vault: tree + reading view + inbox review
4. capture + recorder (real mic via tauri; extraction stubbed)
5. agents network + work + log
6. cartridges (library / shared)
7. relay phase — buzz/nostr fills the adapter seams. **not before.**

## rules that never bend

- originals are never modified by derivation
- no durable brain mutation without review — accepts are signed events
- assigning work never widens an agent's access — grants are per-run leases
- ▣ executable capability is a separate consent, never rides an install or update
- no crypto/relay claims in the UI until the relay phase ships them for real
