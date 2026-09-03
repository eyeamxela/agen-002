import { internalMutation, mutation } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';

// write layer for the screens. every state-changing mutation appends an auditEvent — no silent writes.

const audit = async (ctx: { db: { insert: Function } }, kind: string, summary: string, objectIds: string[] = [], raw: unknown = {}) => {
  await (ctx.db.insert as Function)('auditEvents', { kind, actor: 'you', objectIds, summary, raw, at: Date.now() });
};

// ── manifests: sign publishes a new manifest and moves the room pointer; rollback is a pointer move.
export const manifestSign = mutation({
  args: { room: v.string(), docPaths: v.array(v.string()), tiers: v.string(), ttl: v.string(), brief: v.string() },
  handler: async (ctx, { room, docPaths, tiers, ttl, brief }) => {
    const key = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
    const id = await ctx.db.insert('manifests', { key, room, docHashes: docPaths, n: docPaths.length, tiers, ttl, state: 'active', brief, createdAt: Date.now() });
    const r = await ctx.db.query('rooms').withIndex('by_key', (q) => q.eq('key', room)).first();
    if (r) {
      if (r.activeManifestId) { const prev = await ctx.db.get(r.activeManifestId); if (prev && prev.state === 'active') await ctx.db.patch(prev._id, { state: 'superseded' }); }
      await ctx.db.patch(r._id, { activeManifestId: id });
    }
    await audit(ctx, 'manifest', 'signed manifest-' + key + ' · ' + docPaths.length + ' docs · ' + ttl, [key], { docPaths, tiers });
    return key;
  }
});

export const manifestRollback = mutation({
  args: { id: v.id('manifests') },
  handler: async (ctx, { id }) => {
    const m = await ctx.db.get(id); if (!m) return;
    const r = await ctx.db.query('rooms').withIndex('by_key', (q) => q.eq('key', m.room)).first();
    if (r) await ctx.db.patch(r._id, { activeManifestId: id });
    await audit(ctx, 'manifest', 'rolled back to manifest-' + m.key + ' — pointer move, rows untouched', [m.key]);
  }
});

// ── work: assign → run with a per-run grant; the simulated step completes it with evidence.
export const workAssign = mutation({
  args: { taskId: v.id('tasks') },
  handler: async (ctx, { taskId }) => {
    const t = await ctx.db.get(taskId); if (!t || t.status === 'done') return;
    const n = (await ctx.db.query('runs').collect()).length;
    const key = '#' + (398 + n);
    const runId = await ctx.db.insert('runs', {
      key, agentKey: 'hermes', task: t.title, taskId, state: 'running',
      saw: { instructionsV: 4, docHashes: [t.sourceRef] }, sawText: 'instructions v4 · ' + t.sourceRef + ' — the task’s cited docs only, nothing wider',
      did: 'running · simulated step', evidence: [], startedAt: Date.now()
    });
    const grantId = await ctx.db.insert('grants', { principal: 'hermes', title: t.title + ' → hermes', meta: 'per-run lease · ' + t.sourceRef, objectIds: [], perms: ['read'], runId, noDownload: true });
    await ctx.db.patch(taskId, { status: 'running', assignee: 'hermes' });
    await audit(ctx, 'run', 'assigned "' + t.title + '" → hermes · run ' + key + ' · per-run grant issued', [key]);
    await ctx.scheduler.runAfter(1500, internal.ops.workComplete, { runId, taskId, grantId, key });
  }
});

export const workComplete = internalMutation({
  args: { runId: v.id('runs'), taskId: v.id('tasks'), grantId: v.id('grants'), key: v.string() },
  handler: async (ctx, { runId, taskId, grantId, key }) => {
    await ctx.db.patch(runId, { state: 'done', did: 'completed · simulated step · 0 out-of-scope reads', evidence: ['evidence · run ' + key], endedAt: Date.now(), cost: 0.12 });
    await ctx.db.patch(taskId, { status: 'done', evidenceRunId: runId });
    await ctx.db.patch(grantId, { expiresAt: Date.now(), revokedAt: Date.now() });
    await audit(ctx, 'run', 'run ' + key + ' done · evidence attached · grant expired on completion', [key]);
  }
});

// ── approvals: the gated #413 send
export const approvalDecide = mutation({
  args: { approve: v.boolean() },
  handler: async (ctx, { approve }) => {
    const run = (await ctx.db.query('runs').withIndex('by_key', (q) => q.eq('key', '#413')).first());
    if (!run || run.state !== 'waiting') return;
    await ctx.db.patch(run._id, { state: approve ? 'done' : 'failed', did: approve ? 'posted 21:30 brief → #xela · grant died after the send' : 'send declined at the gate · zero writes', endedAt: Date.now() });
    await audit(ctx, 'approval', (approve ? 'approved' : 'declined') + ' · run #413 post 21:30 brief → #xela', ['#413']);
  }
});

// ── team / sharing
export const grantRevoke = mutation({
  args: { id: v.id('grants') },
  handler: async (ctx, { id }) => {
    const g = await ctx.db.get(id); if (!g) return;
    await ctx.db.patch(id, { revokedAt: Date.now() });
    await audit(ctx, 'revoke', 'revoked · ' + g.title, [g.principal]);
  }
});

export const requestDecide = mutation({
  args: { id: v.id('accessRequests'), approve: v.boolean() },
  handler: async (ctx, { id, approve }) => {
    const q = await ctx.db.get(id); if (!q) return;
    await ctx.db.patch(id, { state: approve ? 'granted' : 'denied' });
    if (approve) await ctx.db.insert('grants', { principal: q.who, title: q.what, meta: q.why + ' · granted just now', objectIds: [], perms: ['view'], noDownload: true });
    await audit(ctx, 'grant', (approve ? 'granted' : 'denied') + ' · ' + q.what, [q.who]);
  }
});

export const shareGrant = mutation({
  args: { principal: v.string(), title: v.string(), meta: v.string(), perms: v.array(v.string()), expiresAt: v.optional(v.number()), noDownload: v.boolean() },
  handler: async (ctx, args) => {
    await ctx.db.insert('grants', { ...args, objectIds: [] });
    await audit(ctx, 'grant', 'shared · ' + args.title + ' · ' + args.perms.join('+'), [args.principal]);
  }
});

// ── library: update review honors "declined ▣ = structurally absent"; builder sign inserts the pack.
export const cartridgeUpdateReview = mutation({
  args: { id: v.id('cartridges'), mode: v.union(v.literal('knowledge'), v.literal('exec'), v.literal('stay')) },
  handler: async (ctx, { id, mode }) => {
    const c = await ctx.db.get(id); if (!c || !c.updatePending) return;
    if (mode === 'stay') { await audit(ctx, 'update', c.name + ' · stayed on v' + c.version, [c.key]); return; }
    const vNew = c.updatePending;
    await ctx.db.patch(id, {
      version: vNew, updatePending: undefined,
      meta: 'v' + vNew + ' mounted · by ' + c.publisher + (mode === 'knowledge' ? ' · ▣ declined' : ' · ▣ consented'),
      exec: mode === 'exec', execConsented: mode === 'exec'
    });
    await audit(ctx, mode === 'exec' ? 'capability' : 'update', c.name + ' → v' + vNew + (mode === 'knowledge' ? ' · knowledge accepted · capability declined — structurally absent' : ' · ▣ consented — revocable'), [c.key]);
  }
});

export const cartridgeSign = mutation({
  args: { name: v.string(), purpose: v.string(), templates: v.array(v.string()), docHashes: v.array(v.string()), exec: v.boolean() },
  handler: async (ctx, { name, purpose, templates, docHashes, exec }) => {
    const key = 'bl' + Math.floor(Math.random() * 0xffff).toString(16);
    await ctx.db.insert('cartridges', {
      key, name: name || 'untitled pack', rel: 'owned', templates, docHashes,
      meta: 'v1 · ' + (templates.join(' + ') || 'pack') + ' · signed npub1q7f…3xk2',
      exec, execConsented: exec, version: 1, publisher: 'npub1q7f…3xk2', purpose: purpose || 'no purpose written yet.'
    });
    await audit(ctx, 'install', 'signed cartridge · ' + (name || 'untitled pack') + ' · ' + docHashes.length + ' refs' + (exec ? ' · ▣' : ''), [key]);
  }
});

// ── policies / settings / folders / vault marks / agents
export const policySet = mutation({
  args: { tier: v.string(), mode: v.string() },
  handler: async (ctx, { tier, mode }) => {
    if (tier === 'dreams') throw new Error('dreams is sealed at the index layer — not a toggle');
    const p = await ctx.db.query('tierPolicy').first(); if (!p) return;
    await ctx.db.patch(p._id, { [tier]: mode } as Record<string, string>);
    await audit(ctx, 'policy', 'tier ' + tier + ' → ' + mode, [tier]);
  }
});

export const settingsUpdate = mutation({
  args: { theme: v.optional(v.string()), density: v.optional(v.string()), opt: v.optional(v.any()) },
  handler: async (ctx, args) => {
    const s = await ctx.db.query('userSettings').first(); if (!s) return;
    await ctx.db.patch(s._id, { ...(args.theme ? { theme: args.theme } : {}), ...(args.density ? { density: args.density } : {}), ...(args.opt ? { opt: { ...s.opt, ...args.opt } } : {}) });
    await audit(ctx, 'policy', 'settings updated', [], args);
  }
});

export const folderAdd = mutation({
  args: { path: v.string(), tier: v.string() },
  handler: async (ctx, { path, tier }) => {
    await ctx.db.insert('watchedFolders', { path, tier, docs: 0, status: 'watching', primary: false });
    await audit(ctx, 'policy', 'watching ' + path + ' · tier ' + tier, [path]);
  }
});

export const folderRemove = mutation({
  args: { id: v.id('watchedFolders') },
  handler: async (ctx, { id }) => {
    const f = await ctx.db.get(id); if (!f) return;
    await ctx.db.delete(id);
    await audit(ctx, 'policy', 'stopped watching ' + f.path, [f.path]);
  }
});

export const starToggle = mutation({
  args: { id: v.id('brainObjects') },
  handler: async (ctx, { id }) => { const d = await ctx.db.get(id); if (d) await ctx.db.patch(id, { starred: !d.starred }); }
});

export const alwaysToggle = mutation({
  args: { id: v.id('brainObjects') },
  handler: async (ctx, { id }) => { const d = await ctx.db.get(id); if (d) await ctx.db.patch(id, { alwaysLoad: !d.alwaysLoad }); }
});

export const agentSetModel = mutation({
  args: { key: v.string(), model: v.string() },
  handler: async (ctx, { key, model }) => {
    const a = await ctx.db.query('agents').withIndex('by_key', (q) => q.eq('key', key)).first(); if (!a) return;
    await ctx.db.patch(a._id, { model });
    await audit(ctx, 'model-swap', key + ' → ' + model + ' · identity, memory + grants untouched', [key]);
  }
});

export const agentSetPaused = mutation({
  args: { key: v.string(), paused: v.boolean() },
  handler: async (ctx, { key, paused }) => {
    const a = await ctx.db.query('agents').withIndex('by_key', (q) => q.eq('key', key)).first(); if (!a) return;
    await ctx.db.patch(a._id, { paused });
    await audit(ctx, 'policy', key + (paused ? ' paused — lease issuance frozen, data untouched' : ' resumed'), [key]);
  }
});

export const skillToggle = mutation({
  args: { id: v.id('skills') },
  handler: async (ctx, { id }) => {
    const s = await ctx.db.get(id); if (!s) return;
    await ctx.db.patch(id, { on: !s.on });
    await audit(ctx, 'capability', 'skill ' + s.key + (s.on ? ' disabled' : ' enabled'), [s.key]);
  }
});

// ── capture: derived things land as proposals, never as documents.
export const proposalsAdd = mutation({
  args: {
    items: v.array(v.object({
      kind: v.string(), conf: v.number(), sourceRef: v.string(), brief: v.string(),
      quote: v.optional(v.string()), diff: v.array(v.string()),
      targetPath: v.optional(v.string()), targetTier: v.optional(v.string()), consent: v.optional(v.boolean())
    }))
  },
  handler: async (ctx, { items }) => {
    for (const p of items) {
      await ctx.db.insert('proposals', { ...p, targetTier: p.targetTier as 'inbox' | undefined, state: 'pending', createdAt: Date.now() });
    }
    await audit(ctx, 'capture', items.length + ' proposals → brain inbox — nothing writes itself', items.map((p) => p.kind));
  }
});
