import { query } from './_generated/server';

// useDocuments(): brainObjects that are file-backed. sealed tier never has rows (excluded at indexing).
export const list = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('brainObjects').collect();
    return rows.filter((r) => r.path && (r.type === 'source' || r.type === 'note'));
  }
});
