import { Fragment, useEffect, useRef, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';

// port target: design/arkive-v2.html [data-screen-label='canvas'] (lines 1967–2065) — five views over one object list.
// renderVals: cnvSeg/cnvFree/cnvCols/cnvTime/wfNodes/cnvSel* (Component lines 4644–4677); handlers 2958–2970.
// cards reference BrainObjects; card layout (x, y, group) is layout-only per HANDOFF §5 annotation 2 — no object fields duplicated.
// GAP (simulated): the `canvasLayout` convex table exists but has no mutations yet, so drag positions and grouping
// persist only in local react state for this slice. wiring layout writes to `canvasLayout` is a later slice.

const O = '#ff5a1f';
const mono = "'IBM Plex Mono', monospace";

type CnvCard = { id: string; type: string; title: string; path?: string; x: number; y: number; when: string; col: string };

// prototype Component.CNV (lines 2863–2870) — canvas seed objects. path-bearing cards map onto real docs by path.
const CNV: CnvCard[] = [
  { id: 'c1', type: 'note', title: 'red park concept', path: 'curated/red-park-concept.md', x: 12, y: 16, when: 'aug 06', col: 'ideas' },
  { id: 'c2', type: 'task', title: 'brief nezu — moodboard', x: 50, y: 28, when: 'aug 06', col: 'doing' },
  { id: 'c3', type: 'recording', title: 'rec 2026-08-06 · 05:12', x: 27, y: 54, when: 'aug 06', col: 'ideas' },
  { id: 'c4', type: 'person', title: 'nezu · npub1nz0…7ta1', x: 68, y: 60, when: 'jan 12', col: 'done' },
  { id: 'c5', type: 'source', title: 'canon/xela.md', path: 'canon/xela.md', x: 42, y: 10, when: 'may 02', col: 'done' },
  { id: 'c6', type: 'decision', title: 'aerochrome = campaign spine', x: 74, y: 18, when: 'aug 10', col: 'done' }
];

// prototype Component.WF (lines 2871–2877)
const WF = [
  { kind: 'trigger', l: 'new capture in inbox/' },
  { kind: 'condition', l: 'mentions jrny?' },
  { kind: 'agent', l: 'hermes: draft brief' },
  { kind: 'approval', l: 'operator gate' },
  { kind: 'output', l: 'post → #xela' }
];

const MODES = ['freeform', 'board', 'graph', 'timeline', 'workflow'] as const;
type Mode = (typeof MODES)[number];

// layout-only card state — mirrors canvasLayout {objectId, x, y, w, h, group}
type Layout = { x: number; y: number; w?: number; h?: number; group?: string };

const btnReset = { border: 'none', font: 'inherit', textAlign: 'left', padding: 0, background: 'transparent', color: 'inherit' } as const;

export function CanvasMode({ onUseInChat }: { onUseInChat?: (paths: string[]) => void }) {
  const [canvasMode, setCanvasMode] = useState<Mode>('freeform');
  const [canvasSel, setCanvasSel] = useState<string[]>([]);
  const [wfStep, setWfStep] = useState(0);
  // simulated canvasLayout persistence — seeded from CNV positions/columns, survives view switches, dies with the session
  const [layout, setLayout] = useState<Record<string, Layout>>(() =>
    Object.fromEntries(CNV.map((o) => [o.id, { x: o.x, y: o.y, group: o.col }])));

  const docs = useQuery(api.documents.list, {});
  const objects = useQuery(api.panels.brainObjects, {});

  const freeRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; sx: number; sy: number; bx: number; by: number; moved: boolean } | null>(null);
  const wfTimer = useRef<number | null>(null);

  // freeform drag — move updates layout only; a click without movement toggles selection (prototype cnvSelToggle)
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragRef.current, el = freeRef.current;
      if (!d || !el) return;
      if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4) return;
      d.moved = true;
      const r = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(90, d.bx + ((e.clientX - d.sx) / r.width) * 100));
      const y = Math.max(0, Math.min(90, d.by + ((e.clientY - d.sy) / r.height) * 100));
      setLayout((s) => ({ ...s, [d.id]: { ...s[d.id], x, y } }));
    };
    const up = () => {
      const d = dragRef.current;
      if (!d) return;
      dragRef.current = null;
      if (!d.moved) setCanvasSel((s) => (s.includes(d.id) ? s.filter((x) => x !== d.id) : s.concat([d.id])));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, []);

  useEffect(() => () => { if (wfTimer.current) window.clearInterval(wfTimer.current); }, []);

  const cardDown = (id: string) => (e: React.PointerEvent) => {
    const l = layout[id];
    if (!l) return;
    e.preventDefault();
    dragRef.current = { id, sx: e.clientX, sy: e.clientY, bx: l.x, by: l.y, moved: false };
  };

  // prototype cnvToChat (lines 2959–2963): selected path-bearing cards resolve against real docs; unresolved paths drop out.
  // journey B: session scope only — no manifest is written unless "sign + publish manifest" over in the graph.
  const cnvToChat = () => {
    const paths = CNV.filter((o) => canvasSel.includes(o.id) && o.path)
      .map((o) => (docs ?? []).find((d) => d.path === o.path)?.path)
      .filter((p): p is string => !!p);
    if (paths.length && onUseInChat) onUseInChat(paths);
    setCanvasSel([]);
  };

  const wfGo = () => {
    setWfStep(1);
    if (wfTimer.current) window.clearInterval(wfTimer.current);
    wfTimer.current = window.setInterval(() => {
      setWfStep((s) => {
        if (s >= 4) { if (wfTimer.current) window.clearInterval(wfTimer.current); return s; }
        return s + 1;
      });
    }, 800);
  };
  const wfApprove = () => setWfStep(6);
  const wfReset = () => { if (wfTimer.current) window.clearInterval(wfTimer.current); setWfStep(0); };

  const cnvFree = CNV.map((o) => ({
    ...o,
    left: (layout[o.id]?.x ?? o.x) + '%', top: (layout[o.id]?.y ?? o.y) + '%',
    ring: canvasSel.includes(o.id) ? O : '#232323',
    dot: o.path ? O : '#5c5c5c',
    live: o.path ? '● live ref' : 'canvas-only',
    liveFg: o.path ? '#c8b4a6' : '#4a4a4a',
    objectId: (objects ?? []).find((b) => b.path && b.path === o.path)?._id
  }));
  const cnvCols = ['ideas', 'doing', 'done'].map((c) => ({
    title: c,
    items: CNV.filter((o) => (layout[o.id]?.group ?? o.col) === c).map((o) => ({ t: o.title, type: o.type, dot: o.path ? O : '#5c5c5c' }))
  }));
  const cnvTime = CNV.slice().sort((a, b) => (a.when < b.when ? -1 : 1)).map((o) => ({ when: o.when, t: o.title, type: o.type, dot: o.path ? O : '#5c5c5c' }));
  const wfNodes = WF.map((n, i) => {
    const st = wfStep === 0 ? 'idle' : (wfStep >= 6 ? 'done' : (i + 1 < wfStep ? 'done' : (i + 1 === wfStep ? (n.kind === 'approval' ? 'waiting for you' : 'running') : 'queued')));
    return {
      kind: n.kind, l: n.l, st,
      stFg: st === 'running' || st === 'waiting for you' ? O : (st === 'done' ? '#6ec48a' : '#4a4a4a'),
      ring: st === 'running' || st === 'waiting for you' ? '#2a1a12' : '#1c1c1c',
      arrow: i < 4
    };
  });
  const wfRunLabel = wfStep === 0 ? 'run workflow' : (wfStep >= 6 ? 'ran · posted after your gate' : 'running…');

  return (
    <div data-screen-label="canvas" style={{ position: 'absolute', left: 0, right: 0, top: 74, bottom: 0, padding: '0 18px 18px 18px', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden', background: '#070707', zIndex: 2, animation: 'arkFade .16s ease-out' }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', gap: 2, padding: 4, borderRadius: 9, background: '#141414' }}>
          {MODES.map((m) => (
            <button key={m} role="tab" onClick={() => setCanvasMode(m)} style={{ ...btnReset, padding: '7px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: canvasMode === m ? '#2a2a2a' : 'transparent', color: canvasMode === m ? '#f6f6f6' : '#7a7a7a' }}>{m}</button>
          ))}
        </div>
        <div style={{ fontFamily: mono, fontSize: 9.5, color: '#4a4a4a' }}>five views over the same objects — the card IS the object; nothing duplicates on mode switch</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, borderRadius: 14, background: '#0d0d0d', border: '1px solid #191919', position: 'relative', overflow: 'hidden' }}>
        {canvasMode === 'freeform' && (
          <div ref={freeRef} style={{ position: 'absolute', inset: 0 }}>
            {cnvFree.map((o) => (
              <button key={o.id} onPointerDown={cardDown(o.id)} style={{ ...btnReset, position: 'absolute', left: o.left, top: o.top, width: 176, borderRadius: 9, background: '#111', border: '1px solid ' + o.ring, padding: '9px 11px', cursor: 'pointer', touchAction: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 5, height: 5, borderRadius: 999, background: o.dot, flex: 'none' }} />
                  <div style={{ fontFamily: mono, fontSize: 8.5, color: '#5c5c5c', textTransform: 'uppercase', letterSpacing: '.08em' }}>{o.type}</div>
                  <div style={{ marginLeft: 'auto', fontFamily: mono, fontSize: 8.5, color: o.liveFg }}>{o.live}</div>
                </div>
                <div style={{ fontFamily: mono, fontSize: 10.5, color: '#c8c8c8', marginTop: 6, lineHeight: 1.5 }}>{o.title}</div>
              </button>
            ))}
          </div>
        )}
        {canvasMode === 'board' && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, padding: 14 }}>
            {cnvCols.map((c) => (
              <div key={c.title} style={{ borderRadius: 11, background: '#0a0a0a', border: '1px solid #171717', padding: 12, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0, overflowY: 'auto' }}>
                <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: '#5c5c5c' }}>{c.title}</div>
                {c.items.map((it, i) => (
                  <div key={i} style={{ borderRadius: 8, background: '#111', border: '1px solid #1c1c1c', padding: '9px 11px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 5, height: 5, borderRadius: 999, background: it.dot }} />
                      <div style={{ fontFamily: mono, fontSize: 8.5, color: '#5c5c5c', textTransform: 'uppercase' }}>{it.type}</div>
                    </div>
                    <div style={{ fontFamily: mono, fontSize: 10.5, color: '#c8c8c8', marginTop: 5 }}>{it.t}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        {canvasMode === 'graph' && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
            <div style={{ textAlign: 'center', maxWidth: 440 }}>
              <div style={{ fontFamily: mono, fontSize: 11, color: '#e8e8e8' }}>graph mode uses the original arkive graph</div>
              <div style={{ fontFamily: mono, fontSize: 10, color: '#8a8a8a', marginTop: 8, lineHeight: 1.7 }}>same physics, lasso, tier filters and scope tools — over the same objects this canvas shows. lasso a cluster there and sign it into scope.</div>
              {/* prototype cnvGraphOpenFn = toggleGraph — the affordance flips back to the real graph; the overlay owns that toggle, so no handler here */}
              <button style={{ ...btnReset, display: 'inline-block', padding: '9px 18px', borderRadius: 7, background: O, fontFamily: mono, fontSize: 10.5, color: '#0a0a0a', cursor: 'pointer', marginTop: 14 }}>open the graph · ⌘g</button>
            </div>
          </div>
        )}
        {canvasMode === 'timeline' && (
          <div className="ark-scroll" style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '18px 22px' }}>
            {cnvTime.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, padding: '10px 0', borderBottom: '1px solid #131313' }}>
                <div style={{ fontFamily: mono, fontSize: 9.5, color: '#5c5c5c', width: 58, flex: 'none', paddingTop: 2 }}>{r.when}</div>
                <div style={{ width: 5, height: 5, borderRadius: 999, background: r.dot, flex: 'none', marginTop: 5 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: mono, fontSize: 10.5, color: '#c8c8c8' }}>{r.t}</div>
                  <div style={{ fontFamily: mono, fontSize: 8.5, color: '#5c5c5c', textTransform: 'uppercase', marginTop: 3 }}>{r.type}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {canvasMode === 'workflow' && (
          <div style={{ position: 'absolute', inset: 0, padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {wfNodes.map((n, i) => (
                <Fragment key={i}>
                  <div style={{ borderRadius: 9, background: '#111', border: '1px solid ' + n.ring, padding: '10px 13px', minWidth: 132 }}>
                    <div style={{ fontFamily: mono, fontSize: 8.5, color: '#5c5c5c', textTransform: 'uppercase', letterSpacing: '.08em' }}>{n.kind}</div>
                    <div style={{ fontFamily: mono, fontSize: 10.5, color: '#c8c8c8', marginTop: 5 }}>{n.l}</div>
                    <div style={{ fontFamily: mono, fontSize: 9, color: n.stFg, marginTop: 5 }}>{n.st}</div>
                  </div>
                  {n.arrow && <div style={{ color: '#4a4a4a', fontSize: 12 }}>→</div>}
                </Fragment>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={wfGo} style={{ ...btnReset, padding: '8px 15px', borderRadius: 7, background: '#171717', fontFamily: mono, fontSize: 10, color: '#c8c8c8', cursor: 'pointer' }}>{wfRunLabel}</button>
              {wfStep === 4 && (
                <button onClick={wfApprove} style={{ ...btnReset, padding: '8px 15px', borderRadius: 7, background: O, fontFamily: mono, fontSize: 10, color: '#0a0a0a', cursor: 'pointer' }}>approve the gate</button>
              )}
              <button onClick={wfReset} style={{ ...btnReset, padding: '8px 15px', borderRadius: 7, background: '#141414', fontFamily: mono, fontSize: 10, color: '#6a6a6a', cursor: 'pointer' }}>reset</button>
              <div style={{ fontFamily: mono, fontSize: 9, color: '#4a4a4a' }}>the approval node is the same operator gate agents use — nothing sends without you</div>
            </div>
          </div>
        )}
        {canvasSel.length > 0 && (
          <div style={{ position: 'absolute', left: 14, right: 14, bottom: 14, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 11, background: '#141414', border: '1px dashed #3a3a3a', animation: 'arkRise .14s ease-out' }}>
            <div style={{ fontFamily: mono, fontSize: 10, color: '#c8c8c8' }}>{canvasSel.length + ' selected — session-only context'}</div>
            <div style={{ fontFamily: mono, fontSize: 9, color: '#5c5c5c' }}>temporary — dies with the session unless signed into a manifest</div>
            <button onClick={() => setCanvasSel([])} style={{ ...btnReset, marginLeft: 'auto', padding: '6px 12px', borderRadius: 6, background: '#1c1c1c', fontFamily: mono, fontSize: 9.5, color: '#c8c8c8', cursor: 'pointer' }}>clear</button>
            <button onClick={cnvToChat} style={{ ...btnReset, padding: '6px 12px', borderRadius: 6, background: O, fontFamily: mono, fontSize: 9.5, color: '#0a0a0a', cursor: 'pointer' }}>use in chat temporarily</button>
          </div>
        )}
      </div>
    </div>
  );
}
