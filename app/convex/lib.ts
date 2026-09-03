import { QueryCtx } from './_generated/server';

// prototype TIERS tok values — tokens per doc by tier
export const TIER_TOK: Record<string, number> = { canon: 4.6, curated: 3.1, dashboards: 1.4, legal: 5.2, inbox: 0.7 };

// scopeNodes() from the prototype, minus graph selection (no graph until 04):
// deny ? canon + alwaysLoad : all indexed. tier policy 'exclude' filtered like allNodes().
export async function scopeDocs(ctx: QueryCtx, deny: boolean) {
  const policy = await ctx.db.query('tierPolicy').first();
  const docs = (await ctx.db.query('brainObjects').collect())
    .filter((r) => r.path && (r.type === 'source' || r.type === 'note'))
    .filter((r) => !policy || (policy as unknown as Record<string, string>)[r.tier] !== 'exclude');
  return deny ? docs.filter((d) => d.tier === 'canon' || d.alwaysLoad) : docs;
}
