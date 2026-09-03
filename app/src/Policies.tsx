import type { CSSProperties } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';

// port target: design/arkive-v2.html [data-screen-label='brain-policies'] (lines 1630–1652)
// + brPolicyRows (~4808–4817). tier toggles write ops.policySet (exclude ↔ allow) and feed
// retrieval + the graph immediately; dreams is sealed at the index layer — a row, not a toggle.

const mono = "'IBM Plex Mono', monospace";
const TIERS = ['canon', 'curated', 'dashboards', 'legal', 'inbox'];

const btnReset: CSSProperties = { background: 'transparent', border: 'none', margin: 0, padding: 0, font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer' };

export function Policies() {
  const tierPolicy = useQuery(api.panels.tierPolicy);
  const policySet = useMutation(api.ops.policySet);
  const policy = (tierPolicy ?? {}) as unknown as Record<string, string>;

  const brPolicyRows = TIERS.map((t) => {
    const ex = policy[t] === 'exclude';
    return {
      tier: t, open: true, locked: false,
      note: t === 'canon' ? 'identity — brightest on the graph, first into scope' : t === 'legal' ? 'restricted — share-gated, steward approval to expose' : t === 'inbox' ? 'unreviewed — dimmest, quarantined from canon answers' : 'working knowledge',
      mode: ex ? 'excluded from retrieval' : 'allowed in retrieval',
      pillBg: ex ? '#111' : '#1c1c1c', pillFg: ex ? '#f0f0f0' : '#6ec48a',
      onToggle: () => void policySet({ tier: t, mode: ex ? 'allow' : 'exclude' })
    };
  }).concat([{ tier: 'dreams', open: false, locked: true, note: 'sealed at source — excluded from indexing itself, not just retrieval', mode: '', pillBg: '', pillFg: '', onToggle: () => {} }]);

  return (
    <div data-screen-label="brain-policies" style={{ flex: 1, minHeight: 0, padding: '0 18px 18px 18px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, minHeight: 0, borderRadius: 14, background: '#0d0d0d', border: '1px solid #191919', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 'none', padding: '14px 18px', borderBottom: '1px solid #191919' }}>
          <div style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: '.16em', textTransform: 'uppercase', color: '#5c5c5c' }}>brain · policies — four dimensions, never conflated</div>
          <div style={{ fontFamily: mono, fontSize: 10, color: '#8a8a8a', marginTop: 6, lineHeight: 1.7 }}>authority (how settled) · sensitivity/tier (who may see) · lifecycle (where it lives) · provenance (where it came from). tier toggles here feed retrieval + the graph immediately.</div>
        </div>
        <div className="ark-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {brPolicyRows.map((r) => (
            <div key={r.tier} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: '1px solid #131313' }}>
              <div style={{ width: 120, flex: 'none', fontFamily: mono, fontSize: 10.5, color: '#c8c8c8' }}>{r.tier}</div>
              <div style={{ flex: 1, minWidth: 0, fontFamily: mono, fontSize: 9.5, color: '#5c5c5c' }}>{r.note}</div>
              {r.locked ? (
                <div style={{ padding: '4px 11px', borderRadius: 5, background: '#111', border: '1px solid #232323', fontFamily: mono, fontSize: 9.5, color: '#5c5c5c', flex: 'none' }}>sealed at source</div>
              ) : (
                <button onClick={r.onToggle} role="switch" aria-checked={r.mode === 'allowed in retrieval'} style={{ ...btnReset, padding: '4px 11px', borderRadius: 5, background: r.pillBg, fontFamily: mono, fontSize: 9.5, color: r.pillFg, flex: 'none' }}>{r.mode}</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
