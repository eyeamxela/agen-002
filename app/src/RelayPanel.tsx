import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';

// port target: design/arkive-v2.html [data-screen-label='relay'] (tab 'relay': health cards + signed
// event log) and [data-screen-label='system'] (overview · policies · integrations · storage · models ·
// advanced). droplet/postgres/redis figures are simulated state, labeled as such in the footer.

const O = '#ff5a1f';
const mono = "'IBM Plex Mono', monospace";

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const fmtTs = (at: number) => {
  const d = new Date(at);
  return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
};
const fmtDay = (at: number) => {
  const d = new Date(at);
  return String(d.getUTCDate()).padStart(2, '0') + ' ' + MONTHS[d.getUTCMonth()] + ' ' + fmtTs(at);
};
const fmtRel = (at: number) => {
  const diff = Date.now() - at;
  if (diff < 60_000) return Math.max(1, Math.round(diff / 1000)) + 's ago';
  if (diff < 3_600_000) return Math.round(diff / 60_000) + 'm ago';
  return fmtDay(at);
};

const KIND_CHIPS = ['all', 'vault-ref', 'ctx-manifest', 'message', 'accept', 'run', 'grant', 'revoke'];
const ID_PREFIX: Record<string, string> = { manifest: 'manifest', revoke: 'rev', grant: 'gr', run: 'run', accept: 'acc', approval: 'apr', capture: 'cap', policy: 'pol', 'model-swap': 'mod', install: 'ins', update: 'upd', capability: 'cap' };

const SYS_NOTE: Record<string, string> = {
  overview: 'one glance: is capture safe, is the index fresh, is anything waiting on you.',
  policies: 'the rules that outrank everything else. narrower always wins; every evaluation is loggable.',
  integrations: 'connections in and out. a broken integration never threatens capture safety.',
  storage: 'originals stay yours, on your disk. indexes are disposable; sources are not.',
  models: 'models are swappable parts. identity, memory and grants never live in the model.',
  advanced: 'sharp tools. everything here is reversible except what says it isn\'t.'
};

type SysRow = { k: string; v: React.ReactNode; vFg: string; onClick?: () => void };

export function RelayPanel({ tab }: { tab: string }) {
  const sync = useQuery(api.panels.syncState);
  const folders = useQuery(api.panels.watchedFolders);
  const connectors = useQuery(api.panels.connectors);
  const agents = useQuery(api.panels.agents);
  const manifests = useQuery(api.panels.manifests);
  const events = useQuery(api.panels.auditEvents, { limit: 50 });
  const setModel = useMutation(api.ops.agentSetModel);
  const [kindFilter, setKindFilter] = useState('all');

  if (tab === 'relay') {
    const macOnline = sync?.macOnline ?? true;
    const queued = sync?.queued ?? 0;
    const health = [
      { name: 'droplet', v: '41d up', note: 'nyc3 · s-2vcpu-4gb', dot: O, color: '#f0f0f0' },
      { name: 'postgres', v: 'up', note: '14 · 212 MB', dot: '#5c5c5c', color: '#f0f0f0' },
      { name: 'redis', v: 'up', note: 'pub/sub 6 subs', dot: '#5c5c5c', color: '#f0f0f0' },
      { name: 'mini.local', v: macOnline ? 'awake' : 'asleep', note: (queued ? queued + ' queued · ' : '') + (macOnline ? 'watcher live' : 'watcher offline'), dot: macOnline ? '#3a7a4a' : '#4a4a4a', color: macOnline ? '#f0f0f0' : '#8a8a8a' },
      { name: 'relay patches', v: '0', note: 'stock block/buzz', dot: O, color: O }
    ];

    const ev: { kind: string; id: string; author: string; tags: string; at: string }[] = [];
    (events ?? []).forEach((e) => {
      ev.push({
        kind: e.kind === 'manifest' ? 'ctx-manifest' : e.kind,
        id: (ID_PREFIX[e.kind] ?? 'ev') + '-' + (e.objectIds[0] ?? String(e.at % 10000)),
        author: 'npub1q7f…', tags: e.summary, at: fmtTs(e.at)
      });
    });
    (manifests ?? []).forEach((m) => {
      ev.push({ kind: 'ctx-manifest', id: 'manifest-' + m.key, author: 'npub1q7f…', tags: 'scope ' + m.room + ' · ' + m.n + ' includes · ttl ' + m.ttl, at: fmtDay(m.createdAt).replace('06 aug ', '') });
      if (m.state === 'revoked') ev.push({ kind: 'revoke', id: 'rev-' + m.key, author: 'npub1q7f…', tags: 'supersedes manifest-' + m.key, at: fmtDay(m.createdAt).replace('06 aug ', '') });
    });
    const rows = ev
      .filter((e) => kindFilter === 'all' || e.kind === kindFilter)
      .slice(0, 90)
      .map((e, i) => ({
        ...e,
        kindFg: e.kind === 'ctx-manifest' || e.kind === 'accept' || e.kind === 'run' || e.kind === 'grant' ? O : (e.kind === 'revoke' ? '#f0f0f0' : '#8a8a8a'),
        bg: i % 2 ? '#0f0f0f' : 'transparent'
      }));

    return (
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12, padding: '0 18px 18px 18px' }}>
        <div style={{ flex: 'none', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
          {health.map((h) => (
            <div key={h.name} style={{ borderRadius: 11, background: '#0d0d0d', border: '1px solid #191919', padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 5, height: 5, borderRadius: 999, background: h.dot }} />
                <div style={{ fontFamily: mono, fontSize: 9.5, color: '#8a8a8a' }}>{h.name}</div>
              </div>
              <div style={{ fontSize: 19, fontWeight: 500, lineHeight: 1, color: h.color }}>{h.v}</div>
              <div style={{ fontFamily: mono, fontSize: 9, color: '#4a4a4a' }}>{h.note}</div>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, minHeight: 0, borderRadius: 14, background: '#0d0d0d', border: '1px solid #191919', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 'none', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid #191919' }}>
            <div style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: '.16em', textTransform: 'uppercase', color: '#5c5c5c' }}>signed event log</div>
            <div style={{ display: 'flex', gap: 5, marginLeft: 'auto' }}>
              {KIND_CHIPS.map((k) => (
                <button key={k} onClick={() => setKindFilter(k)} style={{ padding: '5px 10px', borderRadius: 6, background: kindFilter === k ? '#2a2a2a' : '#141414', border: 'none', fontFamily: mono, fontSize: 9.5, color: kindFilter === k ? '#f0f0f0' : '#6a6a6a', cursor: 'pointer' }}>{k}</button>
              ))}
            </div>
          </div>
          <div style={{ flex: 'none', display: 'grid', gridTemplateColumns: '96px 104px 92px minmax(0,1fr) 74px', gap: 8, padding: '9px 18px', fontFamily: mono, fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: '#4a4a4a', borderBottom: '1px solid #171717', whiteSpace: 'nowrap' }}>
            <div>kind</div><div>event</div><div>author</div><div>tags</div><div>at</div>
          </div>
          <div className="ark-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {rows.map((e, i) => (
              <div key={e.id + i} style={{ display: 'grid', gridTemplateColumns: '96px 104px 92px minmax(0,1fr) 74px', gap: 8, padding: '9px 18px', alignItems: 'center', borderBottom: '1px solid #131313', background: e.bg, whiteSpace: 'nowrap' }}>
                <div style={{ fontFamily: mono, fontSize: 10, color: e.kindFg, overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.kind}</div>
                <div style={{ fontFamily: mono, fontSize: 10, color: '#8a8a8a', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.id}</div>
                <div style={{ fontFamily: mono, fontSize: 10, color: '#5c5c5c', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.author}</div>
                <div style={{ fontFamily: mono, fontSize: 10, color: '#a8a8a8', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.tags}</div>
                <div style={{ fontFamily: mono, fontSize: 10, color: '#4a4a4a', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.at}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // system row panels — overview · policies · integrations · storage · models · advanced
  const head = sync?.head ?? '—';
  const lastScan = sync?.lastScanAt ? fmtRel(sync.lastScanAt) : '—';
  const hermes = (agents ?? []).find((a) => a.key === 'hermes');
  const activeN = (manifests ?? []).filter((m) => m.state === 'active').length;

  const seg = (agentKey: string, current: string) => (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      {['haiku', 'sonnet', 'opus'].map((m) => (
        <button key={m} onClick={() => void setModel({ key: agentKey, model: m })} style={{ padding: '4px 9px', borderRadius: 5, border: 'none', fontFamily: mono, fontSize: 9.5, cursor: 'pointer', background: current === m ? O : 'transparent', color: current === m ? '#0f0f0e' : '#6a6a66' }}>{m}</button>
      ))}
    </span>
  );

  const connLine = (st: string) => st === 'connected' ? 'web · connected · synced' : (st === 'error' ? 'web · needs attention — auth expired' : 'web · not connected');
  const connFg = (st: string) => st === 'connected' ? '#6ec48a' : (st === 'error' ? O : '#8a8a8a');

  const ROWS: Record<string, SysRow[]> = {
    overview: [
      { k: 'capture safety', v: 'safe — watcher live, queue empty, originals checksummed', vFg: '#6ec48a' },
      { k: 'index freshness', v: '128 docs @ ' + head + ' · last scan ' + lastScan, vFg: '#c8c8c8' },
      { k: 'events this session', v: ((events?.length ?? 0) + 12) + ' signed (simulated signatures)', vFg: '#c8c8c8' },
      { k: 'waiting on you', v: '6 proposals · 1 approval · 1 failed runs', vFg: O },
      { k: 'active manifests', v: activeN + ' active · rollback is a pointer move', vFg: '#c8c8c8' },
      { k: 'default model', v: (hermes?.model ?? 'sonnet') + ' via hermes harness · swappable', vFg: '#c8c8c8' }
    ],
    policies: [
      { k: 'tier policy', v: 'canon > curated > dashboards > legal > inbox · dreams sealed at source', vFg: '#c8c8c8' },
      { k: 'authority', v: 'draft → reviewed → canonical · promotion always via inbox review', vFg: '#c8c8c8' },
      { k: 'retention', v: 'originals: forever, yours · derived: superseded, never erased', vFg: '#c8c8c8' },
      { k: 'agents', v: 'per-run grants · sends approval-gated · zero standing access', vFg: '#c8c8c8' },
      { k: 'sharing', v: 'explicit, expiring, revocable · revoking seals content, citations survive', vFg: '#c8c8c8' },
      { k: 'executable (▣)', v: 'separate consent per person per capability · never rides an update', vFg: '#c8b4a6' }
    ],
    integrations: [
      { k: 'watched folders', v: 'connected · ' + ((folders ?? []).map((f) => f.path).join(' + ') || '—') + ' · originals never modified', vFg: '#6ec48a' },
      { k: 'droplet relay', v: 'connected · simulated in this prototype', vFg: '#6ec48a' },
      ...(connectors ?? []).map((c) => ({ k: c.key, v: connLine(c.status), vFg: connFg(c.status) })),
      { k: 'buzz / nostr transport', v: 'adapter seams ready (emitEvent · subscribeChannel · requestGrant · resolveObject) — no live relay in this pass', vFg: '#c8b4a6' }
    ],
    storage: [
      { k: 'originals', v: '~/vault · 128 files · 412 mb · checksummed on write', vFg: '#c8c8c8' },
      { k: 'indexes', v: 'embeddings 96 mb · rebuildable from originals at any time', vFg: '#c8c8c8' },
      { k: 'audio', v: 'recordings kept raw + immutable · transcripts are versioned derivations', vFg: '#c8c8c8' },
      { k: 'portability', v: 'everything exports as plain files + a signed event log', vFg: '#c8c8c8' },
      { k: 'quota', v: 'none — your disk is the limit', vFg: '#8a8a8a' }
    ],
    models: [
      ...(agents ?? []).map((a) => ({ k: a.key, v: seg(a.key, a.model), vFg: '#c8c8c8' })),
      { k: 'embeddings', v: 'local:nomic/embed-text · never leaves the machine', vFg: '#c8c8c8' },
      { k: 'fallback', v: 'on provider failure: queue, never silently degrade', vFg: '#c8c8c8' },
      { k: 'independence', v: 'an agent IS its identity + memory + grants — the model is a part you swap', vFg: '#c8b4a6' }
    ],
    advanced: [
      { k: 'hash pinning', v: 'on · manifests pin exact bytes', vFg: '#c8c8c8' },
      { k: 'approval gate', v: 'on · sends wait for the operator', vFg: '#c8c8c8' },
      { k: 'event inspector', v: 'open the audit log → any event expands to raw', vFg: '#c8c8c8' },
      { k: 'compatibility', v: 'package format v1 · older receivers read knowledge, skip ▣', vFg: '#8a8a8a' },
      { k: 'reset demo state', v: 'reloads the prototype — all in-memory state returns to seed', vFg: '#cf4a3a', onClick: () => window.location.reload() }
    ]
  };
  const rows = ROWS[tab] ?? [];

  return (
    <div style={{ flex: 1, minHeight: 0, padding: '0 18px 18px 18px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, minHeight: 0, borderRadius: 14, background: '#0d0d0d', border: '1px solid #191919', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 'none', padding: '14px 18px', borderBottom: '1px solid #191919' }}>
          <div style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: '.16em', textTransform: 'uppercase', color: '#5c5c5c' }}>system · {tab}</div>
          <div style={{ fontFamily: mono, fontSize: 10, color: '#8a8a8a', marginTop: 6, lineHeight: 1.6 }}>{SYS_NOTE[tab] ?? ''}</div>
        </div>
        <div className="ark-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {rows.map((r) => (
            <div key={r.k} onClick={r.onClick} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '11px 18px', borderBottom: '1px solid #131313', cursor: r.onClick ? 'pointer' : 'default' }}>
              <div style={{ width: 190, flex: 'none', fontFamily: mono, fontSize: 10, color: '#5c5c5c' }}>{r.k}</div>
              <div style={{ flex: 1, minWidth: 0, fontFamily: mono, fontSize: 10.5, color: r.vFg, lineHeight: 1.6 }}>{r.v}</div>
            </div>
          ))}
        </div>
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderTop: '1px solid #171717' }}>
          <div style={{ width: 9, height: 9, borderRadius: 2, border: '1px dashed #4a4a4a', flex: 'none' }} />
          <div style={{ fontFamily: mono, fontSize: 9, color: '#4a4a4a' }}>prototype — relay, signing, identity and storage figures are simulated state, labeled as such · adapter seams exist for the signed-event transport</div>
        </div>
      </div>
    </div>
  );
}
