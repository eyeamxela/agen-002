import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';

// port target: design/arkive-v2.html [data-screen-label='audit'] — header stats + week bars, the
// what-the-agent-saw table. db auditEvents (latest 50, newest first) merge on top of the prototype's
// seeded rows; rows expand to raw event json + "what the agent saw"; kind chips filter the feed.

const O = '#ff5a1f';
const mono = "'IBM Plex Mono', monospace";

const fmtTs = (at: number) => {
  const d = new Date(at);
  return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
};

// prototype seededAudit — static rows, verbatim. marked simulated in the raw view.
const SEEDED = [
  { time: '21:33', scope: 'dm:hermes', mid: 'a7f2c1', docs: ['canon/*', '9 docs'], tiers: 'canon', state: 'active' },
  { time: '21:31', scope: 'dm:hermes', mid: 'a7f2c1', docs: ['canon/*', '9 docs'], tiers: 'canon', state: 'active' },
  { time: '09:14', scope: 'dm:hermes', mid: '4b90de', docs: ['canon/xela.md', 'curated/jrny-proposal-brief.md', '+22'], tiers: 'canon+cur', state: 'superseded' },
  { time: '08:02', scope: '#xela', mid: '4b90de', docs: ['dashboards/night-desk-2026-w31.md', '+3'], tiers: 'dash', state: 'superseded' },
  { time: '02 aug', scope: 'dm:hermes', mid: 'c31a77', docs: ['legal/msa-jrny.md', 'canon/brands.md', '+5'], tiers: 'legal+canon', state: 'revoked' }
];

type Row = {
  id: string; kind: string; time: string; scope: string; mid: string; docs: string[];
  tiers: string; state: string; raw: unknown; saw: string;
};

export function Audit() {
  const events = useQuery(api.panels.auditEvents, { limit: 50 });
  const manifests = useQuery(api.panels.manifests);
  const rooms = useQuery(api.panels.rooms);
  const [kindFilter, setKindFilter] = useState('all');
  const [open, setOpen] = useState<string | null>(null);

  // db events accumulate as the app is used — newest first, rendered in the prototype's row format.
  const dbRows: Row[] = (events ?? []).map((e) => ({
    id: e._id, kind: e.kind, time: fmtTs(e.at), scope: e.kind,
    mid: e.objectIds[0] ?? '—', docs: [e.summary], tiers: '—',
    state: e.kind === 'revoke' ? 'revoked' : 'active',
    raw: { kind: e.kind, actor: e.actor, objectIds: e.objectIds, summary: e.summary, raw: e.raw, at: e.at },
    saw: 'no prompt assembled — operator action, logged as ' + e.kind
  }));
  const seededRows: Row[] = SEEDED.map((a, i) => ({
    id: 'seed-' + i, kind: 'manifest', ...a,
    raw: { ...a, simulated: true },
    saw: 'manifest-' + a.mid + ' · ' + a.docs.join(' · ') + ' · tiers ' + a.tiers + ' — nothing outside the manifest entered the prompt'
  }));
  const all = dbRows.concat(seededRows);
  const chips = ['all', ...Array.from(new Set(all.map((r) => r.kind)))];
  const rows = all.filter((r) => kindFilter === 'all' || r.kind === kindFilter);

  const revokedN = (manifests ?? []).filter((m) => m.state === 'revoked').length;
  const stats = [
    { k: 'exchanges', v: 36, color: '#111' },
    { k: 'manifests', v: (manifests ?? []).length, color: '#111' },
    { k: 'revoked', v: revokedN, color: O },
    { k: 'unscoped', v: 0, color: '#111' }
  ];

  const dmRoom = (rooms ?? []).find((r) => r.key === 'dm:hermes');
  const scopeN = (manifests ?? []).find((m) => m._id === dmRoom?.activeManifestId)?.n ?? 9;
  const weekBars = ['31', '01', '02', '03', '04', '05', '06'].map((d, i) => {
    const v = [0.42, 0.3, 0.68, 0.55, 0.9, 0.74, Math.min(1, 0.2 + scopeN / 60)][i];
    return { d, h: Math.round(12 + v * 38), color: i === 6 ? O : '#c8c8c4' };
  });

  return (
    <div style={{ flex: 1, minHeight: 0, padding: '0 18px 18px 18px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, minHeight: 0, borderRadius: 14, background: '#f1f1ef', color: '#111', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 'none', padding: '20px 24px 16px 24px', display: 'flex', alignItems: 'flex-end', gap: 26, borderBottom: '1px solid #e0e0dd' }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: '.16em', textTransform: 'uppercase', color: '#8a8a86' }}>audit · what the agent saw</div>
            <div style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-.02em', marginTop: 7, lineHeight: 1 }}>week 32 · 2026</div>
          </div>
          <div style={{ display: 'flex', gap: 28, marginLeft: 'auto' }}>
            {stats.map((s) => (
              <div key={s.k} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ fontFamily: mono, fontSize: 9, color: '#8a8a86' }}>{s.k}</div>
                <div style={{ fontSize: 22, fontWeight: 500, lineHeight: 1, color: s.color }}>{s.v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 52 }}>
            {weekBars.map((w) => (
              <div key={w.d} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 12, height: w.h, borderRadius: 2, background: w.color }} />
                <div style={{ fontFamily: mono, fontSize: 8, color: '#a8a8a4' }}>{w.d}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: 'none', display: 'flex', gap: 5, padding: '9px 24px', borderBottom: '1px solid #e6e6e3' }}>
          {chips.map((k) => (
            <button key={k} onClick={() => setKindFilter(k)} style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: kindFilter === k ? '#111' : '#e2e2de', fontFamily: mono, fontSize: 9.5, color: kindFilter === k ? '#f2f2f2' : '#5a5a56', cursor: 'pointer' }}>{k}</button>
          ))}
        </div>
        <div className="ark-scroll-l" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '78px 128px 108px 1fr 96px 104px', gap: 0, padding: '11px 24px', fontFamily: mono, fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: '#a0a09c', borderBottom: '1px solid #e6e6e3' }}>
            <div>time</div><div>scope</div><div>manifest</div><div>docs in prompt</div><div>tiers</div><div>state</div>
          </div>
          {rows.map((a, i) => (
            <div key={a.id}>
              <div onClick={() => setOpen((x) => (x === a.id ? null : a.id))} style={{ display: 'grid', gridTemplateColumns: '78px 128px 108px 1fr 96px 104px', gap: 0, padding: '14px 24px', borderBottom: '1px solid #e6e6e3', alignItems: 'center', background: i % 2 ? '#efefec' : '#f1f1ef', cursor: 'pointer' }}>
                <div style={{ fontFamily: mono, fontSize: 11, color: '#111' }}>{a.time}</div>
                <div style={{ fontFamily: mono, fontSize: 11, color: '#5a5a56' }}>{a.scope}</div>
                <div style={{ fontFamily: mono, fontSize: 11, color: '#5a5a56' }}>{a.mid}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingRight: 14 }}>
                  {a.docs.map((d) => (
                    <div key={d} style={{ padding: '2px 7px', borderRadius: 4, background: '#e4e4e0', fontFamily: mono, fontSize: 9.5, color: '#4a4a46' }}>{d}</div>
                  ))}
                </div>
                <div style={{ fontFamily: mono, fontSize: 11, color: '#111' }}>{a.tiers}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 5, height: 5, borderRadius: 999, background: a.state === 'active' ? O : (a.state === 'revoked' ? '#111' : '#c0c0bc') }} />
                  <div style={{ fontFamily: mono, fontSize: 10, color: a.state === 'active' ? '#111' : '#8a8a86' }}>{a.state}</div>
                </div>
              </div>
              {open === a.id && (
                <div style={{ padding: '12px 24px', borderBottom: '1px solid #e6e6e3', background: '#eaeae7', animation: 'arkRise .16s ease-out' }}>
                  <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: '#a0a09c' }}>what the agent saw</div>
                  <div style={{ fontFamily: mono, fontSize: 10.5, color: '#5a5a56', lineHeight: 1.8, marginTop: 6 }}>{a.saw}</div>
                  <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: '#a0a09c', marginTop: 12 }}>raw event</div>
                  <pre style={{ margin: '6px 0 0 0', padding: '10px 12px', borderRadius: 9, background: '#f1f1ef', fontFamily: mono, fontSize: 9.5, color: '#7a7a76', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(a.raw, null, 2)}</pre>
                </div>
              )}
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 24px', background: '#eaeae7' }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, border: '1px dashed #a0a09c' }} />
            <div style={{ fontFamily: mono, fontSize: 10.5, color: '#7a7a76' }}>inbox/dreams/** — sealed at source. never indexed, never referenced, absent from every manifest in this window.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
