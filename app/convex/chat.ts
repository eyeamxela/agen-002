import { internalMutation, mutation } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import { scopeDocs } from './lib';

// prototype REPLIES — verbatim. rotation: op-message count % length, {n} → scope doc count.
const REPLIES = [
  'reading {n} docs at the hashes you signed. nothing outside the manifest entered the prompt — if you want the rest, widen on the graph.',
  'that lands in phase 3. the manifest bar exists; server-side enforcement does not. agent-side honor system holds while every npub on this relay is yours.',
  'no. the relay holds references — path, title, tier, hash. content resolves from disk at the pinned hash. if the relay dies the vault is untouched.',
  'logged against {n} docs in scope. folding it into the 21:30 brief; it will post to #xela as a signed event.',
  'checked. one doc drifted from its pin since you signed — detectable, not silent. re-sign or read the old version knowingly.'
];

// prototype send(): append the op message, then the ag reply ~850ms later (scheduler = the setTimeout).
export const sendMessage = mutation({
  args: { room: v.string(), text: v.string(), deny: v.boolean() },
  handler: async (ctx, { room, text, deny }) => {
    const t = text.trim();
    if (!t) return;
    await ctx.db.insert('messages', { room, role: 'op', text: t, cites: [], snap: 'canon only', at: Date.now() });
    await ctx.scheduler.runAfter(850, internal.chat.reply, { room, deny });
  }
});

export const reply = internalMutation({
  args: { room: v.string(), deny: v.boolean() },
  handler: async (ctx, { room, deny }) => {
    const msgs = await ctx.db.query('messages').withIndex('by_room', (q) => q.eq('room', room)).collect();
    const scope = await scopeDocs(ctx, deny);
    const i = msgs.filter((m) => m.role === 'op').length % REPLIES.length;
    const body = REPLIES[i].replace('{n}', String(scope.length));
    const cites = scope.slice(0, 3).map((d) => d.path!);
    await ctx.db.insert('messages', { room, role: 'ag', text: body, cites, snap: 'canon only', at: Date.now() });
  }
});
