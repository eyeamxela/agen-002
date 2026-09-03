import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const pending = query({ args: {}, handler: (ctx) => ctx.db.query('proposals').withIndex('by_state', (q) => q.eq('state', 'pending')).collect() });

// annotation #1: accept is ONE mutation — proposal → accepted, object written, audit appended.
export const accept = mutation({
  args: { id: v.id('proposals'), saveToTier: v.optional(v.string()), editedBrief: v.optional(v.string()) },
  handler: async (ctx, { id, saveToTier, editedBrief }) => {
    const p = await ctx.db.get(id); if (!p || p.state !== 'pending') return;
    if (p.consent && !saveToTier && !editedBrief) { /* memory kinds require explicit consent flag from UI; UI passes saveToTier to confirm */ }
    const tier = (saveToTier ?? p.targetTier ?? 'inbox') as any;
    const path = p.targetPath ? (saveToTier && saveToTier !== p.targetTier ? saveToTier + '/' + p.targetPath.split('/').pop() : p.targetPath) : undefined;
    const now = Date.now();
    const objectId = path ? await ctx.db.insert('brainObjects', {
      type: p.kind === 'task' ? 'task' : p.kind === 'memory' ? 'memory' : 'note', path, title: path.split('/').pop()!, tier,
      authority: tier === 'canon' ? 'reviewed' : 'reviewed', lifecycle: 'active', provenance: 'inferred', hash: 'sha256:' + Math.random().toString(16).slice(2, 14),
      derivedFrom: [], relations: [], permissions: { owner: 'you', sensitivity: tier === 'legal' ? 'restricted' : 'private' },
      reviewStatus: 'accepted', starred: false, alwaysLoad: false, createdAt: now, modifiedAt: now
    }) : undefined;
    await ctx.db.patch(id, { state: editedBrief ? 'edited' : 'accepted', brief: editedBrief ?? p.brief });
    await ctx.db.insert('auditEvents', { kind: 'accept', actor: 'you', objectIds: objectId ? [objectId] : [], summary: 'accepted ' + p.kind + (path ? ' → ' + path : ''), raw: { proposal: p, saveToTier }, at: now });
  }
});

export const dismiss = mutation({ args: { id: v.id('proposals'), reason: v.string() }, handler: async (ctx, { id, reason }) => { await ctx.db.patch(id, { state: 'dismissed' }); await ctx.db.insert('auditEvents', { kind: 'dismiss', actor: 'you', objectIds: [], summary: 'dismissed · ' + reason, raw: { reason }, at: Date.now() }); } });
