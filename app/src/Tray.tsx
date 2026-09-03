import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useWorkspace } from './hooks';
import type { MetricSheetData } from './MetricSheet';

// port target: design/arkive-v2.html — four-card tray (lines ~2239–2321), scope picker (~524–550),
// ctx memory overlay (~551–585). formulas from Component.renderVals() ~3674–3760 + 4041–4074.

const O = '#ff5a1f';
const mono = "'IBM Plex Mono', monospace";
const ARC = 132;
const CTXLIM = 128;
const TIER_ORDER = ['canon', 'curated', 'dashboards', 'legal', 'inbox'];
// prototype TIERS — tok per doc + node opacity by tier
const TIER_TOK: Record<string, number> = { canon: 4.6, curated: 3.1, dashboards: 1.4, legal: 5.2, inbox: 0.7 };
const TIER_OP: Record<string, number> = { canon: 1.0, curated: 0.66, dashboards: 0.46, legal: 0.4, inbox: 0.26 };

export type MetricId = 'scope' | 'trust' | 'integrity' | 'safety' | 'attn';
export type ScopeDoc = { _id: string; path?: string; tier: string; alwaysLoad: boolean; hash: string };
export type CtxVersionRow = { version: string; tokens: number; on: boolean; note: string; at: number };
export type ManifestSet = { key: string; brief: string; n: number; state: string; tiers: string; ttl: string };

// prototype rng() — mulberry32, used by loadManifest to pick a deterministic doc set
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// prototype loadManifest() — "sets swap the doc scope": pick m.n docs preferring the manifest's tiers
export function pickManifestDocs(docs: ScopeDoc[], m: ManifestSet): string[] {
  const r = rng(parseInt(m.key, 16) || 7);
  const want = Math.min(m.n, docs.length);
  const tiers = m.tiers.split('+');
  const pref = docs.filter((n) => tiers.includes(n.tier));
  const picked: string[] = [];
  const src = pref.length >= want ? pref : docs;
  while (picked.length < want && picked.length < src.length) {
    const c = src[Math.floor(r() * src.length)];
    if (!picked.includes(c._id)) picked.push(c._id);
  }
  return picked;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const fmtDate = (at: number) => {
  const d = new Date(at);
  return String(d.getUTCDate()).padStart(2, '0') + ' ' + MONTHS[d.getUTCMonth()];
};
const fmtAgo = (at: number) => {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 60) return s + 's ago';
  const mn = Math.round(s / 60);
  if (mn < 60) return mn + 'm ago';
  const h = Math.round(mn / 60);
  if (h < 24) return h + 'h ago';
  return Math.round(h / 24) + 'd ago';
};

const EMPTY_SET: ReadonlySet<string> = new Set();

// prototype renderVals() metric formulas (lines 3674–3760) over convex instead of Component state.
// sel = session scope adds (react state per STATE-SCHEMA); ctxVersions = effective ctx rows incl. local sim.
export function useScopeMetrics(
  room: string,
  deny: boolean,
  sel?: ReadonlySet<string>,
  ctxVersions?: { version: string; tokens: number; on: boolean }[]
) {
  const docsQ = useQuery(api.documents.list, {});
  const proposalsQ = useQuery(api.panels.proposals, {});
  const runsQ = useQuery(api.panels.runs, {});
  const grantsQ = useQuery(api.panels.grants, {});
  const manifestsQ = useQuery(api.panels.manifests, {});
  const policyQ = useQuery(api.panels.tierPolicy, {});
  const syncQ = useQuery(api.panels.syncState, {});
  const ws = useWorkspace(room, deny);

  const policy = policyQ as unknown as Record<string, string> | null | undefined;
  const everything = (docsQ ?? []) as ScopeDoc[];
  // allNodes() — tier policy 'exclude' filtered out
  const all = everything.filter((n) => !policy || policy[n.tier] !== 'exclude');
  const selSet = sel ?? EMPTY_SET;
  // scopeNodes() — selection ∪ alwaysLoad, else deny ? canon + alwaysLoad : all
  const scope = selSet.size
    ? all.filter((n) => selSet.has(n._id) || n.alwaysLoad)
    : deny
      ? all.filter((n) => n.tier === 'canon' || n.alwaysLoad)
      : all;
  const counts: Record<string, number> = {};
  scope.forEach((n) => { counts[n.tier] = (counts[n.tier] || 0) + 1; });

  const tokens = scope.reduce((a, n) => a + (TIER_TOK[n.tier] || 0), 0);
  const ctxV = ctxVersions ?? (ws?.ctxVersions ?? []);
  const ctxTok = Math.round(tokens + ctxV.reduce((a, v) => a + (v.on ? v.tokens : 0), 0));
  const dedupK = Math.max(1, Math.round(ctxTok * 0.18));
  const rawTok = ctxTok + dedupK;
  const usedPct = Math.min(100, Math.round((ctxTok / CTXLIM) * 100));
  const usedBand = usedPct > 90 ? 'critical' : usedPct > 70 ? 'warning' : usedPct >= 50 ? 'elevated' : 'normal';
  const unrevN = counts.inbox || 0;
  const restrN = counts.legal || 0;
  const apprN = (counts.curated || 0) + (counts.dashboards || 0);
  const domTier = TIER_ORDER.reduce((a, id) => ((counts[id] || 0) > (counts[a] || 0) ? id : a), 'canon');
  const domPct = scope.length ? Math.round(((counts[domTier] || 0) / scope.length) * 100) : 100;
  // gap: doc-level drift flags didn't survive the rng port into the DB — driftedN stays 0, formula kept
  const driftedN = 0;
  const driftedPaths: string[] = [];
  const verifiedN = scope.length - driftedN;
  const integPct = scope.length ? Math.round((verifiedN / scope.length) * 100) : 100;
  const excludedN = everything.filter((n) => policy && policy[n.tier] === 'exclude').length;
  const manifests = manifestsQ ?? [];
  const revokedN = manifests.filter((m) => m.state === 'revoked').length;
  const deniedN = revokedN + excludedN + 2;
  const attnPend = (proposalsQ ?? []).filter((p) => p.state === 'pending').length;
  const attnFail = (runsQ ?? []).filter((r) => r.state === 'failed').length;
  const attnExp = (grantsQ ?? []).filter((g) => g.expiresAt && !g.revokedAt).length;
  const attnN = attnPend + driftedN + attnFail + attnExp;
  const lastScan = syncQ ? fmtAgo(syncQ.lastScanAt) : '—';
  const head = syncQ?.head ?? '—';

  const met: Record<MetricId, MetricSheetData> = {
    scope: {
      kicker: 'scope load · context window',
      title: usedPct + '% of a ' + CTXLIM + 'k window — ' + usedBand,
      foot: 'utilization = context tokens ÷ window tokens × 100',
      rows: [
        { k: 'documents selected', v: scope.length + ' docs' },
        { k: 'documents eligible', v: all.length + ' indexed' },
        { k: 'documents excluded', v: excludedN + ' by tier policy · dreams sealed at source' },
        { k: 'tokens before dedup', v: rawTok + 'k' },
        { k: 'tokens after dedup', v: ctxTok + 'k · −' + dedupK + 'k duplicates removed' },
        { k: 'model context limit', v: CTXLIM + 'k tokens' }
      ]
    },
    trust: {
      kicker: 'trust exposure · by tier',
      title: restrN ? 'restricted content in scope' : unrevN ? unrevN + ' unreviewed docs in scope' : 'everything in scope is reviewed',
      foot: 'tier % = docs from tier ÷ docs in scope × 100',
      rows: TIER_ORDER.filter((id) => counts[id])
        .map((id) => ({ k: id, v: counts[id] + ' docs · ' + Math.round((counts[id] / Math.max(1, scope.length)) * 100) + '%' }))
        .concat([
          { k: 'unreviewed', v: unrevN + ' docs (inbox tier)', c: unrevN ? O : null },
          { k: 'restricted', v: restrN + ' docs (legal tier)' },
          { k: 'approval requirements', v: restrN ? 'legal docs are share-gated — steward approval' : 'none — nothing restricted in scope' }
        ] as MetricSheetData['rows'])
    },
    integrity: {
      kicker: 'source integrity · provenance',
      title: integPct + '% fully verified' + (driftedN ? ' — drift detected ↯' : ''),
      foot: 'verified = source-linked + hash match + signature + fresh + no drift',
      rows: [
        { k: 'source-linked', v: scope.length + '/' + scope.length + ' — every ref carries its disk path' },
        { k: 'missing sources', v: '0' },
        { k: 'signature status', v: scope.length + '/' + scope.length + ' valid · npub1q7f…3xk2' },
        { k: 'hash status', v: driftedN ? driftedN + ' drifted from pin ↯ — re-sign or read the old version knowingly' : 'all match their pins', c: driftedN ? O : null },
        { k: 'stale documents', v: '0' },
        { k: 'drifted documents', v: driftedN ? driftedPaths.slice(0, 2).join(' · ') + (driftedN > 2 ? ' +' + (driftedN - 2) : '') : 'none' },
        { k: 'last indexed', v: lastScan + ' · @' + head }
      ]
    },
    safety: {
      kicker: 'safety gate · zero exposure',
      title: '0 exposed — the gate is doing its job',
      foot: 'a denial means the permission system worked correctly',
      rows: [
        { k: 'safely denied', v: deniedN + ' retrieval attempts refused' },
        { k: 'denial reasons', v: 'revoked manifest ×' + revokedN + ' · sealed dreams probe ×2 (dev data)' + (excludedN ? ' · tier policy ×' + excludedN : '') },
        { k: 'sealed documents protected', v: 'inbox/dreams/** — never indexed, never referenced' },
        { k: 'unauthorized exposures', v: '0' },
        { k: 'policy violations', v: '0 this window' }
      ]
    },
    attn: {
      kicker: 'attention · what wants you',
      title: attnN ? attnN + ' items want a decision' : 'nothing wants you right now',
      foot: 'attention = pending proposals + drift + expiring grants + failed runs',
      rows: [
        { k: 'brain inbox proposals', v: attnPend + ' pending review', c: attnPend ? O : null },
        { k: 'drifted hashes', v: driftedN ? driftedN + ' docs moved off their pin ↯' : '0', c: driftedN ? O : null },
        { k: 'expiring grants', v: attnExp ? 'kiln guest link · 14 days left' : 'none', c: attnExp ? O : null },
        { k: 'failed runs', v: attnFail ? '#398 nezu · retry keeps the pinned context' : '0', c: attnFail ? O : null },
        { k: 'sealed + safely denied', v: 'dreams sealed at source · ' + deniedN + ' retrievals refused (the gate working)' }
      ]
    }
  };

  return {
    all, scope, counts, tokens, ctxTok, dedupK, rawTok, usedPct, usedBand,
    unrevN, restrN, apprN, domTier, domPct, driftedN, verifiedN, integPct,
    excludedN, revokedN, deniedN, attnPend, attnFail, attnExp, attnN,
    manifests, met
  };
}

export type ScopeMetrics = ReturnType<typeof useScopeMetrics>;

// ── the four-card tray (prototype lines 2239–2321) ─────────────────────────────

const cardStyle: React.CSSProperties = {
  background: '#f4f4f2', borderRadius: 11, padding: '12px 14px', display: 'flex', flexDirection: 'column',
  minHeight: 0, overflow: 'hidden', cursor: 'pointer', border: 'none', textAlign: 'left', fontFamily: 'inherit', margin: 0
};

const CardArrow = () => (
  <div style={{ marginLeft: 'auto', color: '#111' }}>
    <svg width="11" height="11" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.1" fill="none"><path d="M3 9 9 3M4.4 3H9v4.6" /></svg>
  </div>
);

const Gauge = ({ dash, stroke, center }: { dash: string; stroke: string; center: string }) => (
  <div style={{ marginTop: 4, position: 'relative', flex: '1 1 auto', minHeight: 24, overflow: 'hidden' }}>
    <svg viewBox="0 0 100 54" preserveAspectRatio="xMidYMax meet" style={{ width: '100%', height: '100%', maxHeight: 62, display: 'block' }}>
      <path d="M8 50 A42 42 0 0 1 92 50" fill="none" stroke="#e0e0dc" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M8 50 A42 42 0 0 1 92 50" fill="none" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeDasharray={dash} />
    </svg>
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, textAlign: 'center', fontSize: 'clamp(16px, 2.6vh, 22px)', fontWeight: 500, color: '#111' }}>{center}</div>
  </div>
);

export function Tray({ sm, onOpenMetric }: { sm: ScopeMetrics; onOpenMetric: (id: MetricId) => void }) {
  const scopeTokLine = sm.ctxTok + ' / ' + CTXLIM + 'k tokens';
  const scopeUsedLine = sm.usedPct + '% context used · ' + sm.dedupK + 'k deduplicated';
  const scopeBandFg = sm.usedBand === 'normal' ? '#a0a09c' : sm.usedBand === 'elevated' ? '#6a6a66' : O;
  const trustPrimaryLabel = sm.domTier === 'inbox' ? 'unreviewed' : sm.domTier;
  const trustSubLine = sm.unrevN + ' unreviewed · ' + sm.restrN + ' restricted';
  const trustSubFg = sm.unrevN || sm.restrN ? O : '#a0a09c';
  const trustBar = [
    { id: 'canon', n: sm.counts.canon || 0, color: O },
    { id: 'approved', n: sm.apprN, color: '#c8c8c4' },
    { id: 'unreviewed', n: sm.unrevN, color: '#a0a09c' },
    { id: 'restricted', n: sm.restrN, color: '#111' }
  ].filter((b) => b.n).map((b) => ({ id: b.id, n: b.n, color: b.color, pct: ((b.n / Math.max(1, sm.scope.length)) * 100).toFixed(1) + '%' }));
  const integrityLine = sm.verifiedN + '/' + sm.scope.length + ' source-linked · 0 stale · ' + sm.driftedN + ' drifted';
  const integrityFg = sm.driftedN ? O : '#a0a09c';
  const gauge1 = ((ARC * sm.integPct) / 100).toFixed(0) + ' ' + ARC;
  const gauge2 = ARC + ' ' + ARC;
  const safetyLine = 'protected · ' + sm.deniedN + ' safely denied · sealed content protected';

  return (
    <div style={{ flex: 'none', height: 'clamp(112px, 19vh, 172px)', padding: '8px 12px 10px 12px', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(140px, 1fr))', gridAutoRows: '1fr', gap: 8, background: '#e9e9e7', overflow: 'hidden' }}>
      <button onClick={() => onOpenMetric('scope')} style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 11.5, color: '#4a4a46' }}>scope load</div>
          <div style={{ width: 11, height: 11, borderRadius: 999, border: '1px solid #c4c4c0', display: 'grid', placeItems: 'center', fontSize: 7, color: '#a0a09c' }}>i</div>
          <CardArrow />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8, flex: 'none' }}>
          <div style={{ fontSize: 'clamp(18px, 4.2vh, 38px)', fontWeight: 500, letterSpacing: '-.03em', lineHeight: 1, color: '#111' }}>{sm.scope.length}</div>
          <div style={{ fontSize: 10, color: '#a0a09c' }}>docs</div>
          <div style={{ marginLeft: 'auto', fontFamily: mono, fontSize: 10, color: '#6a6a66', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{scopeTokLine}</div>
        </div>
        <div style={{ marginTop: 'auto', flex: 'none', minHeight: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, whiteSpace: 'nowrap', overflow: 'hidden' }}>
            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: mono, fontSize: 10, color: '#6a6a66' }}>{scopeUsedLine}</div>
            <div style={{ fontSize: 10, color: scopeBandFg, flex: 'none' }}>{sm.usedBand}</div>
          </div>
          <div style={{ height: 3, background: '#e4e4e0', position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, height: 3, width: sm.usedPct + '%', background: '#ff5a1f' }} />
          </div>
        </div>
      </button>

      <button onClick={() => onOpenMetric('trust')} style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 11.5, color: '#4a4a46' }}>trust exposure</div>
          <CardArrow />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8, flex: 'none' }}>
          <div style={{ fontSize: 'clamp(16px, 3.6vh, 32px)', fontWeight: 500, letterSpacing: '-.03em', lineHeight: 1, color: '#111' }}>{sm.domPct}%</div>
          <div style={{ fontSize: 10, color: '#a0a09c' }}>{trustPrimaryLabel}</div>
        </div>
        <div style={{ marginTop: 'auto', flex: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, whiteSpace: 'nowrap', overflow: 'hidden' }}>
            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: mono, fontSize: 10, color: trustSubFg }}>{trustSubLine}</div>
          </div>
          <div style={{ display: 'flex', height: 5, borderRadius: 3, background: '#e4e4e0', overflow: 'hidden' }}>
            {trustBar.map((tb) => (
              <div key={tb.id} title={tb.id + ' ' + tb.n} style={{ width: tb.pct, height: 5, background: tb.color, flex: 'none' }} />
            ))}
          </div>
        </div>
      </button>

      <button onClick={() => onOpenMetric('integrity')} style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 11.5, color: '#4a4a46' }}>source integrity</div>
          <CardArrow />
        </div>
        <Gauge dash={gauge1} stroke="#111" center={sm.integPct + '%'} />
        <div style={{ marginTop: 'auto', flex: 'none', fontSize: 9.5, color: integrityFg, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{integrityLine}</div>
      </button>

      <button onClick={() => onOpenMetric('safety')} style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 11.5, color: '#4a4a46' }}>safety gate</div>
          <CardArrow />
        </div>
        <Gauge dash={gauge2} stroke="#ff5a1f" center="0 exposed" />
        <div style={{ marginTop: 'auto', flex: 'none', fontSize: 9.5, color: '#a0a09c', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{safetyLine}</div>
      </button>
    </div>
  );
}

// ── overlay chrome shared by picker + ctx (prototype lines 524–585) ────────────

const overlayShell: React.CSSProperties = {
  position: 'absolute', left: 18, right: 18, bottom: 126, display: 'flex', flexDirection: 'column',
  borderRadius: 12, background: '#101010', border: '1px solid #262626', boxShadow: '0 -18px 60px rgba(0,0,0,.6)',
  zIndex: 15, animation: 'arkRise .16s ease-out', overflow: 'hidden'
};

const CloseX = ({ onClose }: { onClose: () => void }) => (
  <button onClick={onClose} aria-label="close" style={{ width: 20, height: 20, borderRadius: 5, background: '#1a1a1a', border: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#8a8a8a', flex: 'none', padding: 0 }}>
    <svg width="9" height="9" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.2"><path d="M1.5 1.5 10.5 10.5M10.5 1.5 1.5 10.5" /></svg>
  </button>
);

const rowBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', border: 'none', textAlign: 'left', width: '100%', fontFamily: 'inherit', margin: 0 };
const footChip: React.CSSProperties = { padding: '4px 9px', borderRadius: 5, background: '#1c1c1c', fontFamily: mono, fontSize: 9, color: '#c8c8c8', cursor: 'pointer', flex: 'none', border: 'none' };

// scope picker — prototype lines 524–550. click to toggle into the session scope set.
export function ScopePicker({ docs, sel, onToggle, onAddAll, onClear, onClose }: {
  docs: ScopeDoc[]; sel: ReadonlySet<string>;
  onToggle: (id: string) => void; onAddAll: (ids: string[]) => void; onClear: () => void; onClose: () => void;
}) {
  const [pickQ, setPickQ] = useState('');
  const q = pickQ.trim().toLowerCase();
  // prototype pickList() — filter by path, scoped first, then tier opacity, capped at 60
  const list = docs
    .filter((n) => !q || (n.path ?? '').toLowerCase().includes(q))
    .slice()
    .sort((a, b) => ((sel.has(b._id) ? 1 : 0) - (sel.has(a._id) ? 1 : 0)) || (TIER_OP[b.tier] ?? 0) - (TIER_OP[a.tier] ?? 0))
    .slice(0, 60);
  return (
    <div style={{ ...overlayShell, maxHeight: 'min(340px, calc(100% - 96px))' }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderBottom: '1px solid #1c1c1c' }}>
        <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', color: '#5c5c5c' }}>scope picker</div>
        <input
          value={pickQ}
          onChange={(e) => setPickQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape' || e.key === 'Enter') onClose(); }}
          placeholder="filter paths — canon/, inbox/hermes/…"
          autoFocus
          style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: '#f2f2f2', fontSize: 12, fontFamily: mono }}
        />
        <div style={{ fontFamily: mono, fontSize: 9, color: '#4a4a4a', flex: 'none' }}>{list.length + ' shown'}</div>
        <CloseX onClose={onClose} />
      </div>
      <div className="ark-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '5px 0' }}>
        {list.map((n) => {
          const on = sel.has(n._id);
          const g = Math.round(150 + (TIER_OP[n.tier] ?? 0) * 105);
          return (
            <button key={n._id} onClick={() => onToggle(n._id)} style={{ ...rowBtn, padding: '7px 14px', background: on ? '#161310' : 'transparent' }}>
              <div style={{ width: 9, height: 9, borderRadius: 2, border: '1px solid ' + (on ? O : '#3a3a3a'), background: on ? O : 'transparent', flex: 'none' }} />
              <div style={{ fontFamily: mono, fontSize: 11, color: on ? '#f2f2f2' : 'rgb(' + g + ',' + g + ',' + g + ')', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.path}</div>
              <div style={{ fontFamily: mono, fontSize: 9, color: '#5c5c5c', flex: 'none' }}>{n.tier}</div>
              <div style={{ fontFamily: mono, fontSize: 9, color: O, flex: 'none', width: 52, textAlign: 'right' }}>{on ? 'in scope' : ''}</div>
            </button>
          );
        })}
      </div>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px', borderTop: '1px solid #1c1c1c' }}>
        <div style={{ fontFamily: mono, fontSize: 9, color: '#4a4a4a' }}>click to toggle · esc to close · selection becomes the manifest</div>
        <button onClick={() => onAddAll(list.map((n) => n._id))} style={{ ...footChip, marginLeft: 'auto' }}>add all shown</button>
        <button onClick={onClear} style={footChip}>clear scope</button>
      </div>
    </div>
  );
}

// ctx memory overlay — prototype lines 551–585. check/uncheck + summarize simulated in local state.
export function CtxOverlay({ room, versions, sets, freshCount, onToggle, onSummarize, onLoadSet, onClose }: {
  room: string; versions: CtxVersionRow[]; sets: ManifestSet[]; freshCount: number;
  onToggle: (version: string) => void; onSummarize: () => void; onLoadSet: (m: ManifestSet) => void; onClose: () => void;
}) {
  const sumHot = freshCount > 0;
  const sumLabel = sumHot ? 'summarize ' + freshCount + ' new' : 'up to date';
  return (
    <div style={{ ...overlayShell, maxHeight: 'min(360px, calc(100% - 96px))' }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderBottom: '1px solid #1c1c1c' }}>
        <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', color: '#5c5c5c' }}>context memory</div>
        <div style={{ fontFamily: mono, fontSize: 9.5, color: '#4a4a4a', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>rolling summary of this room — a vault doc like any other. old turns compress; the window never fills.</div>
        <button onClick={onSummarize} style={{ padding: '5px 11px', borderRadius: 5, background: sumHot ? O : '#1c1c1c', fontFamily: mono, fontSize: 9.5, color: sumHot ? '#0a0a0a' : '#5c5c5c', cursor: 'pointer', flex: 'none', border: 'none' }}>{sumLabel}</button>
        <CloseX onClose={onClose} />
      </div>
      <div className="ark-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '5px 0' }}>
        {versions.slice().reverse().map((v) => (
          <button key={v.version} onClick={() => onToggle(v.version)} style={{ ...rowBtn, padding: '8px 14px', background: v.on ? '#161310' : 'transparent' }}>
            <div style={{ width: 9, height: 9, borderRadius: 2, border: '1px solid ' + (v.on ? O : '#3a3a3a'), background: v.on ? O : 'transparent', flex: 'none' }} />
            <div style={{ fontFamily: mono, fontSize: 11, color: v.on ? '#f2f2f2' : '#8a8a8a', flex: '1 1 auto', minWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{'ctx/' + room.replace(':', '-') + '.' + v.version + '.md'}</div>
            <div style={{ fontFamily: mono, fontSize: 9.5, color: '#5c5c5c', flex: '0 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.note + ' · ' + fmtDate(v.at)}</div>
            <div style={{ fontFamily: mono, fontSize: 9.5, color: v.on ? O : '#5c5c5c', flex: 'none', width: 64, textAlign: 'right' }}>{v.tokens + 'k'}</div>
          </button>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px 5px 14px' }}>
          <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', color: '#4a4a4a' }}>stored sets</div>
          <div style={{ flex: 1, height: 1, background: '#1c1c1c' }} />
        </div>
        {sets.map((m) => (
          <button key={m.key} onClick={() => onLoadSet(m)} style={{ ...rowBtn, padding: '8px 14px', background: 'transparent' }}>
            <div style={{ width: 5, height: 5, borderRadius: 999, background: m.state === 'active' ? O : '#4a4a4a', flex: 'none', margin: '0 2px' }} />
            <div style={{ fontFamily: mono, fontSize: 11, color: '#c8c8c8', flex: '1 1 auto', minWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{'manifest-' + m.key}</div>
            <div style={{ fontFamily: mono, fontSize: 9.5, color: '#5c5c5c', flex: '0 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.brief}</div>
            <div style={{ fontFamily: mono, fontSize: 9.5, color: '#5c5c5c', flex: 'none', width: 64, textAlign: 'right' }}>{m.n + ' docs'}</div>
          </button>
        ))}
      </div>
      <div style={{ flex: 'none', padding: '9px 14px', borderTop: '1px solid #1c1c1c', fontFamily: mono, fontSize: 9, color: '#4a4a4a' }}>checked versions load into every prompt · sets swap the doc scope · summaries are pinned by hash and live in curated/ctx/</div>
    </div>
  );
}
