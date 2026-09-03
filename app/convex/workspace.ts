import { query } from './_generated/server';
import { v } from 'convex/values';
import { scopeDocs, TIER_TOK } from './lib';

// everything the chat header + scope bar reads: manifest pointer, vault head, ctx versions, scope shape.
export const get = query({
  args: { room: v.string(), deny: v.boolean() },
  handler: async (ctx, { room, deny }) => {
    const r = await ctx.db.query('rooms').withIndex('by_key', (q) => q.eq('key', room)).first();
    const manifest = r?.activeManifestId ? await ctx.db.get(r.activeManifestId) : null;
    const sync = await ctx.db.query('syncState').first();
    const ctxVersions = await ctx.db.query('contextSummaries').withIndex('by_room', (q) => q.eq('room', room)).collect();
    const scope = await scopeDocs(ctx, deny);
    const counts: Record<string, number> = {};
    scope.forEach((d) => { counts[d.tier] = (counts[d.tier] || 0) + 1; });
    const tokens = scope.reduce((a, d) => a + (TIER_TOK[d.tier] || 0), 0);
    return {
      manifestKey: manifest?.key ?? null,
      manifestState: manifest?.state ?? null,
      vaultHead: sync?.head ?? '—',
      ctxVersions: ctxVersions.map((c) => ({ version: c.version, tokens: c.tokens, on: c.on })),
      scopeCount: scope.length,
      counts,
      tokens
    };
  }
});
