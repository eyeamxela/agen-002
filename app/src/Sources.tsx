import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';

// port target: design/arkive-v2.html [data-screen-label='brain-sources'] (lines 1610–1629)
// + the synced folders block from the settings sync pane (lines 1693–1733) — folders live in
// panels.watchedFolders here (add via ops.folderAdd, remove via ops.folderRemove).
// bindings: brSourceRows (~4800–4806) · folderRows/folderTierOpts (~3839–3863).

const O = '#ff5a1f';
const mono = "'IBM Plex Mono', monospace";

const btnReset: CSSProperties = { background: 'transparent', border: 'none', margin: 0, padding: 0, font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer' };

const ago = (ts: number) => {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return s + 's ago';
  const m = Math.round(s / 60);
  if (m < 60) return m + 'm ago';
  const h = Math.round(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.round(h / 24) + 'd ago';
};

export function Sources() {
  const folders = useQuery(api.panels.watchedFolders);
  const sync = useQuery(api.panels.syncState);
  const folderAdd = useMutation(api.ops.folderAdd);
  const folderRemove = useMutation(api.ops.folderRemove);
  const [addingFolder, setAddingFolder] = useState(false);
  const [folderPath, setFolderPath] = useState('');
  const [folderTier, setFolderTier] = useState('auto');

  const macOnline = sync?.macOnline ?? true;
  const queued = sync?.queued ?? 0;
  const head = sync?.head ?? '—';
  const lastScan = sync ? ago(sync.lastScanAt) : '—';

  // — brSourceRows, verbatim —
  const brSourceRows = [
    { k: 'mac watcher', v: (macOnline ? 'live' : 'offline') + ' · ~/vault + ~/notes · ' + queued + ' queued', dot: macOnline ? '#3a7a4a' : '#4a4a4a' },
    { k: 'droplet mirror', v: 'synced @ ' + head + ' · serves agents while the mac sleeps (simulated)', dot: '#3a7a4a' },
    { k: 'recordings', v: 'audio raw + immutable · transcripts derived + versioned', dot: O },
    { k: 'file drops', v: 'originals preserved byte-for-byte · indexing proposed via inbox', dot: O },
    { k: 'last scan', v: lastScan + ' · 128 originals · 0 modified by derivation (invariant)', dot: '#3a7a4a' },
    { k: 'sealed', v: 'inbox/dreams/** — never indexed, never referenced, sealed at source', dot: '#4a4a4a' }
  ];

  const confirmFolder = () => {
    let p = folderPath.trim();
    if (!p) return;
    if (!p.startsWith('~') && !p.startsWith('/')) p = '~/' + p;
    void folderAdd({ path: p, tier: folderTier });
    setAddingFolder(false);
    setFolderPath('');
  };
  const cancelAddFolder = () => { setAddingFolder(false); setFolderPath(''); };

  const folderRows = (folders ?? []).map((f, i) => ({
    id: f._id, path: f.path,
    sep: i === 0 ? 'transparent' : '#1e1e1c',
    dot: f.status === 'scanning' ? O : (macOnline ? '#3a7a4a' : '#4a4a4a'),
    anim: f.status === 'scanning' ? 'arkPulse .9s ease-in-out infinite' : 'none',
    tier: f.tier === 'auto' ? 'by subfolder' : f.tier,
    tierFg: f.tier === 'canon' ? O : '#a8a8a4',
    stat: f.status === 'scanning' ? 'scanning…' : (macOnline ? f.docs + ' docs' : 'paused'),
    statFg: f.status === 'scanning' ? O : '#5c5c58',
    primary: !!f.primary,
    removable: !f.primary
  }));
  const folderCount = (folders?.length ?? 0) + ' watched';
  const folderGoBg = folderPath.trim() ? O : '#232320';
  const folderGoFg = folderPath.trim() ? '#0f0f0e' : '#5c5c58';

  return (
    <div data-screen-label="brain-sources" style={{ flex: 1, minHeight: 0, padding: '0 18px 18px 18px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, minHeight: 0, borderRadius: 14, background: '#0d0d0d', border: '1px solid #191919', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 'none', padding: '14px 18px', borderBottom: '1px solid #191919' }}>
          <div style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: '.16em', textTransform: 'uppercase', color: '#5c5c5c' }}>brain · sources — originals, watch + sync</div>
          <div style={{ fontFamily: mono, fontSize: 10, color: '#8a8a8a', marginTop: 6 }}>everything derived traces back here. originals are never edited by derivation.</div>
        </div>
        <div className="ark-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {brSourceRows.map((r) => (
            <div key={r.k} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: '1px solid #131313' }}>
              <div style={{ width: 5, height: 5, borderRadius: 999, background: r.dot, flex: 'none' }} />
              <div style={{ width: 190, flex: 'none', fontFamily: mono, fontSize: 10, color: '#5c5c5c' }}>{r.k}</div>
              <div style={{ flex: 1, minWidth: 0, fontFamily: mono, fontSize: 10.5, color: '#c8c8c8' }}>{r.v}</div>
            </div>
          ))}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 11, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 17, fontWeight: 500 }}>synced folders</div>
              <div style={{ fontFamily: mono, fontSize: 10, color: '#5c5c58' }}>{folderCount}</div>
              <button onClick={() => { setAddingFolder(true); setFolderPath(''); setFolderTier('auto'); }} style={{ ...btnReset, marginLeft: 'auto', padding: '8px 14px', borderRadius: 7, background: '#232320', color: '#e8e8e4', fontSize: 12.5, whiteSpace: 'nowrap' }}>add folder</button>
            </div>
            <div style={{ borderRadius: 11, background: '#151514', overflow: 'hidden' }}>
              {folderRows.map((f) => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px', borderTop: '1px solid ' + f.sep }}>
                  <div style={{ width: 6, height: 6, borderRadius: 999, background: f.dot, animation: f.anim, flex: 'none' }} />
                  <div style={{ fontFamily: mono, fontSize: 11.5, color: '#e8e8e4', flex: '1 1 auto', minWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.path}</div>
                  <div style={{ padding: '3px 9px', borderRadius: 4, background: '#1e1e1c', fontFamily: mono, fontSize: 9.5, color: f.tierFg, flex: '0 1 auto', minWidth: 34, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.tier}</div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: f.statFg, flex: '0 1 auto', minWidth: 0, textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.stat}</div>
                  {f.primary && <div style={{ fontFamily: mono, fontSize: 9, color: '#4a4a46', flex: 'none', width: 22, textAlign: 'center' }}>pri</div>}
                  {f.removable && (
                    <button onClick={() => void folderRemove({ id: f.id })} title="unsync folder" style={{ ...btnReset, width: 22, height: 22, borderRadius: 5, display: 'grid', placeItems: 'center', color: '#5c5c58', flex: 'none' }}>
                      <svg width="9" height="9" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.2"><path d="M1.5 1.5 10.5 10.5M10.5 1.5 1.5 10.5" /></svg>
                    </button>
                  )}
                </div>
              ))}
              {addingFolder && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 18px', borderTop: '1px solid #1e1e1c', background: '#17170f' }}>
                  <div style={{ fontFamily: mono, fontSize: 11, color: '#4a4a46', flex: 'none' }}>›</div>
                  <input
                    value={folderPath} onChange={(e) => setFolderPath(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') confirmFolder(); if (e.key === 'Escape') { e.stopPropagation(); cancelAddFolder(); } }}
                    placeholder="~/path/to/folder" autoFocus
                    style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: '#f2f2f0', fontSize: 12, fontFamily: mono }}
                  />
                  <div style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 8, background: '#1c1c1a', flex: 'none' }}>
                    {['auto', 'canon', 'curated', 'inbox'].map((v) => (
                      <button key={v} onClick={() => setFolderTier(v)} style={{ ...btnReset, padding: '5px 10px', borderRadius: 6, background: folderTier === v ? O : 'transparent', fontFamily: mono, fontSize: 10, color: folderTier === v ? '#0f0f0e' : '#5c5c58', whiteSpace: 'nowrap' }}>{v}</button>
                    ))}
                  </div>
                  <button onClick={confirmFolder} style={{ ...btnReset, padding: '7px 13px', borderRadius: 6, background: folderGoBg, color: folderGoFg, fontFamily: mono, fontSize: 10, flex: 'none' }}>sync</button>
                  <button onClick={cancelAddFolder} aria-label="cancel add folder" style={{ ...btnReset, width: 22, height: 22, borderRadius: 5, display: 'grid', placeItems: 'center', color: '#5c5c58', flex: 'none' }}>
                    <svg width="9" height="9" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.2"><path d="M1.5 1.5 10.5 10.5M10.5 1.5 1.5 10.5" /></svg>
                  </button>
                </div>
              )}
            </div>
            <div style={{ fontFamily: mono, fontSize: 10.5, color: '#5c5c58', lineHeight: 1.5 }}>folders sync one-way into the index. auto maps by top-level subfolder; a fixed tier overrides. unsyncing removes references — files on disk are never touched.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
