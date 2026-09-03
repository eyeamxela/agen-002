import type { CSSProperties } from 'react';
import type { Doc, Id } from '../convex/_generated/dataModel';

// port target: design/arkive-v2.html [data-screen-label='vault'] tree column (lines 718–743)
// + Component.renderVals vaultTree (~4147–4207): obsidian-style dirname grouping, tier order
// canon·curated·dashboards·legal·inbox, sealed `dreams ⊘` row after the inbox subtree.

const O = '#ff5a1f';
const mono = "'IBM Plex Mono', monospace";
const TIER_OP: Record<string, number> = { canon: 1, curated: 0.66, dashboards: 0.46, legal: 0.4, inbox: 0.26 };
const TIER_ORDER = ['canon', 'curated', 'dashboards', 'legal', 'inbox'];

type BrainDoc = Doc<'brainObjects'>;

type TreeRow =
  | { kind: 'folder'; dir: string; name: string; count: string; chev: string; pad: string }
  | { kind: 'file'; doc: BrainDoc; name: string; pad: string; fg: string; dot: string; bg: string; starred: boolean; always: boolean }
  | { kind: 'sealed'; pad: string };

const btnReset: CSSProperties = { background: 'transparent', border: 'none', margin: 0, padding: 0, font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer' };

export function VaultTree({ docs, vaultQ, vaultFilter, treeClosed, selDocId, scopeIds, policy, onToggleFolder, onPickDoc }: {
  docs: BrainDoc[];
  vaultQ: string;
  vaultFilter: string;
  treeClosed: Record<string, boolean>;
  selDocId: Id<'brainObjects'> | null;
  scopeIds: Set<string>;
  policy: Record<string, string>;
  onToggleFolder: (dir: string) => void;
  onPickDoc: (doc: BrainDoc) => void;
}) {
  // — prototype vaultTree formula, verbatim —
  const q = vaultQ.trim().toLowerCase();
  const forceOpen = !!q || vaultFilter !== 'all';
  const files: BrainDoc[] = [];
  const seen = new Set<string>();
  docs.forEach((n) => {
    const path = n.path ?? '';
    if (q && path.toLowerCase().indexOf(q) === -1) return;
    if (vaultFilter === 'starred' && !n.starred) return;
    if (vaultFilter === 'always' && !n.alwaysLoad) return;
    if (seen.has(path)) return;
    seen.add(path);
    files.push(n);
  });
  const dirs: Record<string, { n: BrainDoc; file: string }[]> = {};
  files.forEach((n) => {
    const segs = (n.path ?? '').split('/');
    const file = segs.pop() ?? '';
    const dir = segs.join('/');
    (dirs[dir] = dirs[dir] || []).push({ n, file });
  });
  const dirKeys = Object.keys(dirs).sort((a, b) => {
    const ta = TIER_ORDER.indexOf(a.split('/')[0]), tb = TIER_ORDER.indexOf(b.split('/')[0]);
    if (ta !== tb) return (ta === -1 ? 99 : ta) - (tb === -1 ? 99 : tb);
    return a < b ? -1 : 1;
  });
  const isOpen = (d: string) => forceOpen || !treeClosed[d];
  const countUnder = (p: string) => dirKeys.reduce((a, d) => a + ((d === p || d.indexOf(p + '/') === 0) ? dirs[d].length : 0), 0);
  const rows: TreeRow[] = [];
  const emitted = new Set<string>();
  dirKeys.forEach((dir) => {
    const segs = dir.split('/');
    for (let i = 0; i < segs.length; i++) {
      const pre = segs.slice(0, i + 1).join('/');
      if (emitted.has(pre)) continue;
      if (i > 0 && !isOpen(segs.slice(0, i).join('/'))) continue;
      emitted.add(pre);
      rows.push({ kind: 'folder', dir: pre, name: segs[i], count: String(countUnder(pre)), chev: isOpen(pre) ? '▾' : '▸', pad: (8 + i * 13) + 'px' });
    }
    const anc = segs.map((_, i) => segs.slice(0, i + 1).join('/'));
    if (anc.some((a) => !isOpen(a))) return;
    dirs[dir].sort((a, b) => (a.file < b.file ? -1 : 1)).forEach(({ n, file }) => {
      const on = scopeIds.has(n._id);
      const op = TIER_OP[n.tier] ?? 0.26;
      const g = Math.round(150 + op * 105);
      rows.push({
        kind: 'file', doc: n,
        name: policy[n.tier] === 'hash-titles' ? n.hash.slice(7, 13) + '…' : file,
        pad: (8 + segs.length * 13) + 'px',
        fg: n._id === selDocId ? '#f6f6f6' : 'rgb(' + g + ',' + g + ',' + g + ')',
        dot: on ? O : 'rgba(255,255,255,' + Math.max(0.16, op * 0.7) + ')',
        bg: n._id === selDocId ? '#1a1a1a' : 'transparent',
        starred: n.starred, always: n.alwaysLoad
      });
    });
  });
  if (!forceOpen && emitted.has('inbox') && isOpen('inbox')) {
    const topIdx = rows.findIndex((r) => r.kind === 'folder' && r.pad === '8px' && r.name === 'inbox');
    if (topIdx !== -1) {
      let end = rows.length;
      for (let i = topIdx + 1; i < rows.length; i++) { const r = rows[i]; if (r.kind === 'folder' && r.pad === '8px') { end = i; break; } }
      rows.splice(end, 0, { kind: 'sealed', pad: '21px' });
    }
  }
  const shown = rows.slice(0, 200);

  return (
    <div className="ark-scroll" style={{ flex: 'none', width: 232, minHeight: 0, overflowY: 'auto', borderRight: '1px solid #171717', padding: '8px 7px 14px 7px' }}>
      {shown.map((t, i) => t.kind === 'folder' ? (
        <button key={'d:' + t.dir} onClick={() => onToggleFolder(t.dir)} style={{ ...btnReset, width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', paddingLeft: t.pad, borderRadius: 6 }}>
          <div style={{ fontSize: 8, color: '#5c5c5c', flex: 'none', width: 9 }}>{t.chev}</div>
          <div style={{ fontFamily: mono, fontSize: 10.5, color: '#d8d8d8', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
          <div style={{ fontFamily: mono, fontSize: 8.5, color: '#4a4a4a', flex: 'none' }}>{t.count}</div>
        </button>
      ) : t.kind === 'file' ? (
        <button key={'f:' + (t.doc.path ?? i)} onClick={() => onPickDoc(t.doc)} style={{ ...btnReset, width: '100%', display: 'flex', alignItems: 'center', gap: 7, padding: '4px 8px', paddingLeft: t.pad, borderRadius: 6, background: t.bg }}>
          <div style={{ width: 4, height: 4, borderRadius: 999, background: t.dot, flex: 'none' }} />
          <div style={{ fontFamily: mono, fontSize: 10.5, color: t.fg, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
          {t.starred && <div style={{ fontSize: 9, color: O, flex: 'none', lineHeight: 1 }}>★</div>}
          {t.always && <div title="loads every session" style={{ fontFamily: mono, fontSize: 7.5, color: '#c8b4a6', flex: 'none' }}>A</div>}
        </button>
      ) : (
        <div key="sealed" title="excluded from indexing at source — no reference event is ever published" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', paddingLeft: t.pad, borderRadius: 6, opacity: 0.55 }}>
          <div style={{ fontSize: 9, color: '#5c5c5c', flex: 'none', width: 9 }}>⊘</div>
          <div style={{ fontFamily: mono, fontSize: 10.5, color: '#6a6a6a', flex: 1 }}>dreams</div>
          <div style={{ fontFamily: mono, fontSize: 8, color: '#4a4a4a' }}>sealed</div>
        </div>
      ))}
    </div>
  );
}
