import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useDocuments } from './hooks';

// port target: design/arkive-v2.html [data-screen-label='library'] (lines 1328–1498) —
// cartridge cards (owned / installed / temp), the nezu-desk update review (journey D),
// and the 6-step cartridge builder (journey C). declined ▣ = structurally absent (ops.cartridgeUpdateReview).

const O = '#ff5a1f';
const mono = "'IBM Plex Mono', monospace";

// prototype BTPL (lines 2878–2886)
const BTPL = [
  ['knowledge pack', 'documents + relations, read-only', false],
  ['memory pack', 'operator preferences + habits', false],
  ['protocol', 'a way of working, step by step', false],
  ['skill', 'instructions a receiver can run', true],
  ['creator brain', 'a whole voice, mountable', false],
  ['project pack', 'handoff: sources + decisions + tasks', false],
  ['agent kit', 'starter identity + boundaries', true]
] as const;

const BSTEPS = ['template', 'purpose', 'sources', 'guidance', 'scopes', 'preview'];

type Builder = {
  step: number; tpls: string[]; name: string; purpose: string;
  srcs: string[]; instr: string; excl: string; execOn: boolean; published: boolean;
};

// locally-simulated cards (fork has no convex write yet — simulated)
type SimCart = { id: string; name: string; rel: string; purpose: string; docHashes: string[]; meta: string; exec: boolean };

type Card = SimCart & { updatePending?: number };

const actBtn = (bg: string, fg: string) => ({
  padding: '7px 12px', borderRadius: 6, background: bg, fontFamily: mono, fontSize: 10,
  lineHeight: 1.2, cursor: 'pointer', color: fg, flex: 'none', border: 'none'
} as const);

const inputStyle = {
  padding: '12px 14px', borderRadius: 8, background: '#fff', border: '1px solid #d8d8d4',
  color: '#111', fontFamily: mono, fontSize: 11.5, outline: 'none'
} as const;

export function Library() {
  const carts = useQuery(api.panels.cartridges);
  const docs = useDocuments();
  const updateReview = useMutation(api.ops.cartridgeUpdateReview);
  const cartridgeSign = useMutation(api.ops.cartridgeSign);
  const proposalsAdd = useMutation(api.ops.proposalsAdd);

  const [builder, setBuilder] = useState<Builder | null>(null);
  const [forks, setForks] = useState<SimCart[]>([]);          // simulated — no cartridgeFork mutation
  const [hidden, setHidden] = useState<string[]>([]);         // simulated — no cartridgeEject mutation
  const [stayed, setStayed] = useState(false);                // simulated — 'stay' mutation audits but leaves the row

  // ── cards (prototype cartCards, renderVals ~5014)
  const server: Card[] = (carts ?? []).map((c) => ({
    id: c.key, name: c.name, rel: c.rel, purpose: c.purpose, docHashes: c.docHashes,
    meta: stayed && c.updatePending ? c.meta.replace(' · update v3 proposed', ' · staying on v2') : c.meta,
    exec: c.exec, updatePending: c.updatePending
  }));
  const cards = [...forks, ...server].filter((c) => !hidden.includes(c.id));

  const upd = (carts ?? []).find((c) => c.updatePending);
  const cartUpdateOn = !!upd && !stayed && !hidden.includes(upd.key);

  // ── card verbs (cartShare/cartLoad navigate off-screen in the prototype — no-ops here)
  const cartShare = () => {};
  const cartLoad = () => {};
  const cartFork = (c: Card) => setForks((f) => [{
    id: 'fk' + Date.now(), name: c.name + ' (my fork)', rel: 'owned',
    purpose: 'independent copy — the tie to ' + c.name + ' becomes a footnote. edits are yours.',
    docHashes: c.docHashes, meta: 'v1 · forked just now · signed npub1q7f…3xk2', exec: false
  }, ...f]);
  const cartEject = (c: Card) => setHidden((h) => [...h, c.id]);
  const cartPromote = (c: Card) => {
    void proposalsAdd({ items: [{
      kind: 'promote', conf: 0.95, sourceRef: 'from cartridge · ' + c.name,
      brief: 'adopt print-specs.md out of the ' + c.name + ' boundary into curated/ — it becomes yours, marked imported, origin kept.',
      diff: ['creates curated/print-specs.md', 'marked imported · origin kept'],
      targetPath: 'curated/print-specs.md', targetTier: 'curated'
    }] });
  };

  // ── update review (journey D) — declined ▣ = structurally absent, handled by ops.cartridgeUpdateReview
  const updDecide = (mode: 'knowledge' | 'exec' | 'stay') => {
    if (!upd) return;
    void updateReview({ id: upd._id, mode });
    if (mode === 'stay') setStayed(true);
  };

  // ── builder (journey C) — prototype bOpen/bSet/bTpl/bTplAll/bStepGo/bSrc/bExec/bPublish (lines 2984–3010)
  const bOpen = () => setBuilder({ step: 1, tpls: [], name: '', purpose: '', srcs: [], instr: '', excl: '', execOn: false, published: false });
  const bClose = () => setBuilder(null);
  const bSet = (k: 'name' | 'purpose' | 'instr' | 'excl') => (e: React.ChangeEvent<HTMLInputElement>) =>
    setBuilder((b) => b && { ...b, [k]: e.target.value });
  const bTpl = (t: string) => setBuilder((b) => {
    if (!b) return b;
    const tpls = b.tpls.includes(t) ? b.tpls.filter((x) => x !== t) : [...b.tpls, t];
    const execOn = BTPL.some(([label, , exec]) => exec && tpls.includes(label));
    return { ...b, tpls, execOn };
  });
  const bTplAll = () => setBuilder((b) => {
    if (!b) return b;
    const all = b.tpls.length === BTPL.length;
    return { ...b, tpls: all ? [] : BTPL.map(([l]) => l), execOn: !all };
  });
  const bStepGo = (d: number) => setBuilder((b) => b && { ...b, step: Math.max(1, Math.min(6, b.step + d)) });
  const bSrc = (p: string) => setBuilder((b) => b && { ...b, srcs: b.srcs.includes(p) ? b.srcs.filter((x) => x !== p) : [...b.srcs, p] });
  const bExec = () => setBuilder((b) => b && { ...b, execOn: !b.execOn });
  const bPublish = () => {
    if (!builder) return;
    void cartridgeSign({ name: builder.name, purpose: builder.purpose, templates: builder.tpls, docHashes: builder.srcs, exec: builder.execOn });
    setBuilder({ ...builder, published: true });
  };

  const srcRows = (docs ?? []).filter((d) => d.path && d.tier !== 'legal').slice(0, 9);

  const b = builder;
  const gated = !!b && ((b.step === 1 && !b.tpls.length) || (b.step === 2 && !b.name.trim()) || (b.step === 3 && !b.srcs.length));
  const bPrevLines = b ? [
    { k: 'package', v: (b.name || 'untitled') + ' · v1 · ' + (b.tpls.join(' + ') || '—') },
    { k: 'purpose', v: b.purpose || '—' },
    { k: 'contents', v: b.srcs.length + ' refs at pinned hashes · relations included' },
    { k: 'use when', v: b.instr || '—' },
    { k: 'never for', v: b.excl || '—' },
    { k: 'can act (▣)', v: b.execOn ? 'YES — 1 capability, shipped OFF, per-receiver consent' : 'no — knowledge only' },
    { k: 'signature', v: 'npub1q7f…3xk2 · schnorr over the package body' },
    { k: 'receiver verbs', v: 'temporary · mount · subscribe · fork · promote (via their inbox)' }
  ] : [];

  return (
    <div data-screen-label="library" style={{ flex: 1, minHeight: 0, padding: '0 18px 18px 18px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, minHeight: 0, borderRadius: 14, background: '#f1f1ef', color: '#111', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 'none', padding: '20px 24px 16px 24px', display: 'flex', alignItems: 'flex-end', gap: 26, borderBottom: '1px solid #e0e0dd' }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: '.16em', textTransform: 'uppercase', color: '#8a8a86' }}>library · cartridges you own, mounted, or borrowed</div>
            <div style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-.02em', marginTop: 7, lineHeight: 1 }}>portable intelligence</div>
          </div>
          <button onClick={bOpen} style={{ marginLeft: 'auto', padding: '8px 14px', borderRadius: 7, background: '#111', color: '#f2f2f2', fontFamily: mono, fontSize: 10, cursor: 'pointer', flex: 'none', border: 'none' }}>new cartridge — builder</button>
        </div>

        {!b && (
          <div className="ark-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cards.map((c) => {
              const owned = c.rel === 'owned', inst = c.rel === 'installed';
              const chips = c.docHashes.slice(0, 3).concat(c.docHashes.length > 3 ? ['+' + (c.docHashes.length - 3)] : []);
              const acts = owned
                ? [{ label: 'share…', onClick: cartShare, bg: '#e2e2de', fg: '#333' }, { label: 'fork', onClick: () => cartFork(c), bg: '#e2e2de', fg: '#333' }, { label: 'load into scope', onClick: cartLoad, bg: '#111', fg: '#f2f2f2' }]
                : inst
                  ? [{ label: 'eject', onClick: () => cartEject(c), bg: '#e2e2de', fg: '#333' }, { label: 'promote → inbox', onClick: () => cartPromote(c), bg: '#111', fg: '#f2f2f2' }]
                  : [{ label: 'discard now', onClick: () => cartEject(c), bg: '#e2e2de', fg: '#333' }];
              return (
                <div key={c.id} style={{ borderRadius: 11, background: owned ? '#f6f6f4' : '#eeeeeb', border: '1px solid ' + (owned ? '#e0d2c8' : '#e4e4e0'), padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <div style={{ width: 6, height: 6, borderRadius: 999, background: owned ? O : (c.rel === 'temp' ? '#111' : '#c0c0bc'), flex: 'none' }} />
                    <div style={{ fontFamily: mono, fontSize: 11.5, color: '#111' }}>{c.name}</div>
                    <div style={{ padding: '2px 8px', borderRadius: 4, background: owned ? O : '#e0e0dc', fontFamily: mono, fontSize: 9, color: owned ? '#0f0f0f' : '#7a7a76', textTransform: 'uppercase', letterSpacing: '.08em' }}>{c.rel === 'temp' ? 'temp · session' : c.rel}</div>
                    {c.exec && (
                      <div title="carries executable capability — separate consent, off by default" style={{ padding: '2px 8px', borderRadius: 4, background: '#e4e4e0', fontFamily: mono, fontSize: 9, color: '#4a4a46' }}>▣ can act</div>
                    )}
                    <div style={{ marginLeft: 'auto', fontFamily: mono, fontSize: 10, color: '#a0a09c' }}>{c.meta}</div>
                  </div>
                  <div style={{ fontSize: 15, lineHeight: 1.45, color: '#333', textWrap: 'pretty' }}>{c.purpose}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {chips.map((d) => (
                      <div key={d} style={{ padding: '3px 8px', borderRadius: 4, background: '#e4e4e0', fontFamily: mono, fontSize: 9.5, color: '#4a4a46' }}>{d}</div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 11, borderTop: '1px solid #e4e4e0', whiteSpace: 'nowrap' }}>
                    <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', fontFamily: mono, fontSize: 10.5, color: '#5a5a56', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {owned ? 'yours — load it, fork it, or share it onward' : inst ? 'mounted behind nezu’s boundary — promote to adopt pieces into your vault' : 'this room only — never lands in the vault'}
                    </div>
                    <div style={{ display: 'flex', gap: 7, flex: 'none' }}>
                      {acts.map((a) => (
                        <button key={a.label} onClick={a.onClick} style={actBtn(a.bg, a.fg)}>{a.label}</button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}

            {cartUpdateOn && (
              <div style={{ borderRadius: 11, background: '#f6f6f4', border: '1px solid #e0d2c8', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 13 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <div style={{ width: 6, height: 6, borderRadius: 999, background: O, flex: 'none' }} />
                  <div style={{ fontFamily: mono, fontSize: 11.5, color: '#111' }}>nezu-desk pack · update v2 → v3</div>
                  <div style={{ padding: '2px 8px', borderRadius: 4, background: O, fontFamily: mono, fontSize: 9, color: '#0f0f0f', textTransform: 'uppercase', letterSpacing: '.08em' }}>review</div>
                  <div style={{ marginLeft: 'auto', fontFamily: mono, fontSize: 10, color: '#a0a09c' }}>nothing applies until you say so</div>
                </div>
                <div style={{ fontSize: 15, lineHeight: 1.45, color: '#333', textWrap: 'pretty' }}>v3 rewrites the tone guide and adds one executable capability. knowledge and behavior are separate consents — declining ▣ keeps the knowledge changes.</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 11, borderTop: '1px solid #e4e4e0', whiteSpace: 'nowrap' }}>
                  <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', fontFamily: mono, fontSize: 10.5, color: '#5a5a56', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>an update can never smuggle behavior — the ▣ consent is its own decision</div>
                  <div style={{ display: 'flex', gap: 7, flex: 'none' }}>
                    <button onClick={() => updDecide('stay')} style={actBtn('#e2e2de', '#333')}>stay on v2</button>
                    <button onClick={() => updDecide('exec')} style={actBtn('#e2e2de', '#333')}>apply + enable ▣</button>
                    <button onClick={() => updDecide('knowledge')} style={actBtn('#111', '#f2f2f2')}>apply knowledge only</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {b && (
          <div className="ark-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {BSTEPS.map((l, i) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 999, display: 'grid', placeItems: 'center', fontFamily: mono, fontSize: 9.5, background: b.step === i + 1 ? '#111' : (b.step > i + 1 ? '#c8b4a6' : '#e2e2de'), color: b.step > i ? (b.step === i + 1 ? '#f2f2f2' : '#111') : '#a0a09c' }}>{i + 1}</div>
                  <div style={{ fontFamily: mono, fontSize: 9, color: b.step === i + 1 ? '#111' : '#a0a09c' }}>{l}</div>
                </div>
              ))}
              <button onClick={bClose} style={{ marginLeft: 'auto', fontFamily: mono, fontSize: 10, color: '#a0a09c', cursor: 'pointer', background: 'transparent', border: 'none', padding: 0 }}>save draft + close ✕</button>
            </div>

            {b.step === 1 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                  <div style={{ fontSize: 19, fontWeight: 500 }}>what kind of package?</div>
                  <button onClick={bTplAll} style={{ marginLeft: 'auto', padding: '5px 11px', borderRadius: 6, background: '#e2e2de', fontFamily: mono, fontSize: 9.5, color: '#333', cursor: 'pointer', border: 'none' }}>{b.tpls.length === BTPL.length ? 'clear all' : 'select all'}</button>
                </div>
                <div style={{ fontFamily: mono, fontSize: 10, color: '#8a8a86', marginTop: 4 }}>{(b.tpls.length || 'none') + ' selected — pick one or several; the union becomes the package'}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8, marginTop: 14 }}>
                  {BTPL.map(([label, sub, exec]) => {
                    const on = b.tpls.includes(label);
                    return (
                      <button key={label} onClick={() => bTpl(label)} style={{ borderRadius: 10, background: on ? '#efe9e4' : '#f6f6f4', border: '1px solid ' + (on ? '#c8b4a6' : '#e4e4e0'), padding: '14px 15px', cursor: 'pointer', textAlign: 'left' }}>
                        <div style={{ fontFamily: mono, fontSize: 11, color: '#111' }}>{label}</div>
                        <div style={{ fontFamily: mono, fontSize: 9, color: '#8a8a86', marginTop: 5, lineHeight: 1.6 }}>{sub}</div>
                        {exec && (
                          <div style={{ display: 'inline-block', marginTop: 7, padding: '2px 7px', borderRadius: 4, background: '#e4e4e0', fontFamily: mono, fontSize: 8.5, color: '#4a4a46' }}>▣ includes executable scope</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {b.step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11, maxWidth: 560 }}>
                <div style={{ fontSize: 19, fontWeight: 500 }}>name + purpose</div>
                <input value={b.name} onChange={bSet('name')} placeholder="name — e.g. jrny voice pack" style={inputStyle} />
                <input value={b.purpose} onChange={bSet('purpose')} placeholder="purpose — the first thing a receiver reads" style={inputStyle} />
              </div>
            )}

            {b.step === 3 && (
              <div>
                <div style={{ fontSize: 19, fontWeight: 500 }}>sources — live vault objects, referenced by hash</div>
                <div style={{ fontFamily: mono, fontSize: 10, color: '#8a8a86', marginTop: 4 }}>{(b.srcs.length || 'no') + ' selected · referenced by pinned hash — a receiver sees drift, never silent change'}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 12, borderRadius: 10, background: '#f6f6f4', border: '1px solid #e4e4e0', overflow: 'hidden', maxWidth: 560 }}>
                  {srcRows.map((d) => {
                    const p = d.path ?? '';
                    const on = b.srcs.includes(p);
                    return (
                      <button key={p} role="checkbox" aria-checked={on} onClick={() => bSrc(p)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', border: 'none', borderBottom: '1px solid #e8e8e5', cursor: 'pointer', background: 'transparent', width: '100%', textAlign: 'left' }}>
                        <div style={{ width: 11, height: 11, borderRadius: 3, border: '1px solid ' + (on ? O : '#c4c4c0'), background: on ? O : 'transparent', flex: 'none' }} />
                        <div style={{ fontFamily: mono, fontSize: 10.5, color: '#333' }}>{p}</div>
                        <div style={{ marginLeft: 'auto', fontFamily: mono, fontSize: 9.5, color: '#a0a09c' }}>{d.hash}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {b.step === 4 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11, maxWidth: 560 }}>
                <div style={{ fontSize: 19, fontWeight: 500 }}>retrieval guidance</div>
                <input value={b.instr} onChange={bSet('instr')} placeholder="when to use — e.g. anything touching the jrny campaign voice" style={inputStyle} />
                <input value={b.excl} onChange={bSet('excl')} placeholder="what NOT to use it for — e.g. legal or budget questions" style={inputStyle} />
              </div>
            )}

            {b.step === 5 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560 }}>
                <div style={{ fontSize: 19, fontWeight: 500 }}>scopes + trust</div>
                <div style={{ borderRadius: 10, background: '#f6f6f4', border: '1px solid #e4e4e0', padding: '13px 15px' }}>
                  <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: '#8a8a86' }}>knowledge scope — read-only</div>
                  <div style={{ fontFamily: mono, fontSize: 10.5, color: '#5a5a56', marginTop: 6, lineHeight: 1.7 }}>{(b.srcs.join(' · ') || 'no sources yet') + ' — readable, citable, never executable'}</div>
                </div>
                <button role="checkbox" aria-checked={b.execOn} onClick={bExec} style={{ borderRadius: 10, background: '#f6f6f4', border: '1px solid ' + (b.execOn ? '#e0d2c8' : '#e4e4e0'), padding: '13px 15px', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div style={{ width: 11, height: 11, borderRadius: 3, border: '1px solid ' + (b.execOn ? O : '#c4c4c0'), background: b.execOn ? O : 'transparent', flex: 'none' }} />
                    <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: '#8a6a3a' }}>▣ executable capability — separate scope</div>
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 10.5, color: '#5a5a56', marginTop: 6, lineHeight: 1.7 }}>adds "watch for tone drift" instructions the receiver can run. shipped OFF — every receiver consents per capability, never as part of the knowledge install.</div>
                </button>
                <div style={{ fontFamily: mono, fontSize: 10, color: '#8a8a86' }}>license: reuse with attribution · no redistribution · expiry set by the receiver's grant</div>
              </div>
            )}

            {b.step === 6 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 620 }}>
                <div style={{ fontSize: 19, fontWeight: 500 }}>{b.published ? 'published' : 'what another brain will receive'}</div>
                <div style={{ borderRadius: 10, background: '#f6f6f4', border: '1px solid #e4e4e0', overflow: 'hidden' }}>
                  {bPrevLines.map((l) => (
                    <div key={l.k} style={{ display: 'flex', gap: 12, padding: '9px 15px', borderBottom: '1px solid #e8e8e5' }}>
                      <div style={{ fontFamily: mono, fontSize: 9.5, color: '#a0a09c', width: 120, flex: 'none' }}>{l.k}</div>
                      <div style={{ fontFamily: mono, fontSize: 10.5, color: '#333', flex: 1 }}>{l.v}</div>
                    </div>
                  ))}
                </div>
                {b.published && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 15px', borderRadius: 10, background: '#eaeae7' }}>
                    <div style={{ width: 6, height: 6, borderRadius: 999, background: '#3a7a4a' }} />
                    <div style={{ fontFamily: mono, fontSize: 10.5, color: '#5a5a56' }}>signed + published · now in your library and shareable from team → share</div>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 8 }}>
              <button onClick={() => bStepGo(-1)} style={{ padding: '8px 15px', borderRadius: 7, background: '#e2e2de', fontFamily: mono, fontSize: 10, color: '#333', cursor: 'pointer', border: 'none' }}>back</button>
              {b.step < 6 && (
                <button onClick={() => { if (!gated) bStepGo(1); }} style={{ padding: '8px 15px', borderRadius: 7, background: gated ? '#e8e8e4' : '#111', fontFamily: mono, fontSize: 10, color: gated ? '#a0a09c' : '#f2f2f2', cursor: 'pointer', border: 'none' }}>next</button>
              )}
              {b.step === 6 && !b.published && (
                <button onClick={bPublish} style={{ padding: '8px 18px', borderRadius: 7, background: '#111', fontFamily: mono, fontSize: 10, color: '#f2f2f2', cursor: 'pointer', border: 'none' }}>validate · sign · publish</button>
              )}
              <div style={{ marginLeft: 'auto', fontFamily: mono, fontSize: 9, color: '#a0a09c', alignSelf: 'center' }}>autosaves · validation blocks signing, never capture</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
