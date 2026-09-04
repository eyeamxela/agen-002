import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { ChatPanel } from './ChatPanel';
import type { CanvasLayers } from './roomCanvas';

const O = '#ff5a1f';
const WAIT = '#d9a13a';
const mono = "'IBM Plex Mono', monospace";

type Props = {
  room: string;
  layers: CanvasLayers;
  onOpenChat: () => void;
  onOpenCapture: () => void;
  onOpenDoc: (path: string) => void;
  onOpenVault: () => void;
  onOpenContext: () => void;
  onOpenGraph: () => void;
  onOpenRun: (key: string) => void;
  onOpenSettings: () => void;
  onOpenLibrary: () => void;
  onOpenAudit: () => void;
};

type LinkState = { id: string; from: string; to: string; color: string; dashed?: boolean; dotted?: boolean; label: string };
type DrawnLink = LinkState & { d: string };

export function RoomCanvasView(props: Props) {
  const rooms = useQuery(api.panels.rooms, {}) ?? [];
  const manifests = useQuery(api.panels.manifests, {}) ?? [];
  const docs = useQuery(api.panels.brainObjects, {}) ?? [];
  const context = useQuery(api.panels.contextSummaries, { room: props.room }) ?? [];
  const agents = useQuery(api.panels.agents, {}) ?? [];
  const runs = useQuery(api.panels.runs, {}) ?? [];
  const grants = useQuery(api.panels.grants, {}) ?? [];
  const skills = useQuery(api.panels.skills, {}) ?? [];
  const cartridges = useQuery(api.panels.cartridges, {}) ?? [];
  const audit = useQuery(api.panels.auditEvents, { limit: 100 }) ?? [];
  const policy = useQuery(api.panels.tierPolicy, {});
  const setPaused = useMutation(api.ops.agentSetPaused);
  const approve = useMutation(api.ops.approvalDecide);

  const room = rooms.find((r) => r.key === props.room);
  const manifest = manifests.find((m) => room?.activeManifestId && String(m._id) === String(room.activeManifestId));
  const manifestPaths = new Set(manifest?.docHashes ?? []);
  const scopedDocs = docs.filter((d) => d.path && manifestPaths.has(d.path));
  const canon = docs.filter((d) => d.tier === 'canon' && d.alwaysLoad);
  const scopedTierCounts = Object.entries(scopedDocs.reduce<Record<string, number>>((counts, doc) => ({ ...counts, [doc.tier]: (counts[doc.tier] ?? 0) + 1 }), {}));
  const ctxOn = context.filter((c) => c.on);
  const denied = audit.filter((e) => e.kind === 'deny').length;
  const roomRuns = runs.filter((run) => {
    const runManifest = run.saw.manifestId ? manifests.find((m) => String(m._id) === String(run.saw.manifestId)) : undefined;
    return runManifest?.room === props.room || (!run.saw.manifestId && props.room === 'dm:' + run.agentKey);
  });
  const running = roomRuns.find((r) => r.state === 'running');
  const waiting = roomRuns.find((r) => r.state === 'waiting');
  const currentRun = running ?? waiting ?? roomRuns[0];
  const agentKey = currentRun?.agentKey ?? (props.room.startsWith('dm:') ? props.room.slice(3) : 'hermes');
  const agent = agents.find((a) => a.key === agentKey);
  const currentGrant = grants.find((g) => currentRun && String(g.runId) === String(currentRun._id) && !g.revokedAt);
  const roomSkills = skills.filter((s) => s.on && (s.scope === 'all' || s.scope === agentKey));
  const mounted = cartridges.filter((c) => c.rel === 'installed' || c.rel === 'temp');
  const latestPack = mounted.find((c) => c.updatePending) ?? mounted[0];
  const runningReadsScope = !!running && scopedDocs.some((d) => d.path && running.saw.docHashes.includes(d.path));

  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [drawnLinks, setDrawnLinks] = useState<DrawnLink[]>([]);
  const setCardRef = (id: string) => (element: HTMLDivElement | null) => { cardRefs.current[id] = element; };

  // Connectors are a read-only projection. They are never BrainObjects or persisted rows.
  const linkStates = useMemo<LinkState[]>(() => {
    const links: LinkState[] = [];
    if (props.layers.memory) {
      links.push({ id: 'canon', from: 'canon', to: 'room', color: '#5c5c5c', label: 'canon: always-loaded context' });
      links.push({ id: 'scope', from: 'scope', to: 'room', color: runningReadsScope ? O : '#5c5c5c', dashed: runningReadsScope, label: runningReadsScope ? 'manifest scope: simulated run is reading the manifest' : 'manifest scope: allowed manifest membership' });
      links.push({ id: 'summary', from: 'summary', to: 'room', color: ctxOn.length ? '#c8b4a6' : '#3a3a3a', label: ctxOn.length ? 'context summary: enabled' : 'context summary: off' });
      links.push({ id: 'sealed', from: 'sealed', to: 'room', color: '#3a3a3a', dotted: true, label: 'sealed: excluded, no content exposed' });
    }
    if (props.layers.agents) {
      links.push({ id: 'agent', from: 'room', to: 'agent', color: running ? O : '#5c5c5c', dashed: !!running, label: running ? 'agent: simulated run' : 'agent: no live runtime connected' });
      links.push({ id: 'gate', from: 'room', to: 'gate', color: waiting ? WAIT : '#3a3a3a', label: waiting ? 'approval gate: waiting on you' : 'approval gate: nothing waiting' });
    }
    if (props.layers.tools) {
      links.push({ id: 'skills', from: 'room', to: 'skills', color: '#3a3a3a', label: 'skills: scoped prototype configuration' });
      links.push({ id: 'cartridges', from: 'room', to: 'cartridges', color: '#3a3a3a', label: 'cartridges: mounted references' });
    }
    return links;
  }, [props.layers.memory, props.layers.agents, props.layers.tools, runningReadsScope, !!running, !!waiting, ctxOn.length]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const bounds = stage.getBoundingClientRect();
      const next = linkStates.flatMap((link) => {
        const from = cardRefs.current[link.from]?.getBoundingClientRect();
        const to = cardRefs.current[link.to]?.getBoundingClientRect();
        if (!from || !to) return [];
        const x1 = from.left + from.width / 2 - bounds.left;
        const y1 = from.bottom - bounds.top;
        const x2 = to.left + to.width / 2 - bounds.left;
        const y2 = to.top - bounds.top;
        const mid = (y1 + y2) / 2;
        return [{ ...link, d: `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}` }];
      });
      setDrawnLinks(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    Object.values(cardRefs.current).forEach((element) => { if (element) observer.observe(element); });
    window.addEventListener('resize', measure);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [linkStates, props.layers.graphFloor, props.layers.audit, room?.key]);

  const paths = (items: typeof docs) => items.slice(0, 2).map((d) => d.path?.split('/').pop() ?? d.title).join(' · ') || 'none in this room';
  const openFirst = (items: typeof docs) => items[0]?.path ? props.onOpenDoc(items[0].path) : props.onOpenVault();

  return (
    <div className="ark-room-canvas ark-scroll" aria-label={'canvas view of ' + props.room}>
      <div className="ark-room-canvas-mobile-summary">reads {scopedDocs.length} docs · {running ? 1 : 0} simulated run · {waiting ? 1 : 0} gate</div>
      <div ref={stageRef} className={'ark-room-canvas-stage' + (props.layers.graphFloor ? ' ark-room-canvas-stage--floor' : '')}>
        <svg className="ark-room-connectors" aria-label="derived room connections">
          {drawnLinks.map((link) => <path key={link.id} d={link.d} fill="none" stroke={link.color} strokeWidth={link.dashed ? 1.4 : 1.2} strokeDasharray={link.dashed ? '6 6' : link.dotted ? '3 4' : undefined} className={link.dashed ? 'ark-room-link--running' : undefined}><title>{link.label}</title></path>)}
        </svg>

        {props.layers.memory && (
          <section className="ark-room-band-section">
            <BandHeading>memory layers · what the room can read</BandHeading>
            <div className="ark-room-canvas-band">
              <div ref={setCardRef('canon')}><CanvasCard title="canon" badge="always" color={O} number={String(canon.length)} body={paths(canon)}><CanvasButton onClick={() => openFirst(canon)}>open in vault</CanvasButton></CanvasCard></div>
              <div ref={setCardRef('scope')}><CanvasCard title="manifest scope" badge={manifest ? 'm-' + manifest.key.slice(0, 4) + ' · ' + manifest.tiers : 'no manifest'} number={manifest ? scopedDocs.length + '/' + manifest.n : '0'} body={(scopedTierCounts.map(([tier, count]) => tier + ' ' + count).join(' · ') || 'no mapped objects') + '\n' + paths(scopedDocs)}><CanvasButton onClick={props.onOpenGraph}>lasso ⌘g</CanvasButton><CanvasButton onClick={props.onOpenVault}>inspect</CanvasButton></CanvasCard></div>
              <div ref={setCardRef('summary')}><CanvasCard title="context summary" badge={ctxOn.length ? ctxOn.map((c) => c.version).join('+') + ' · on' : 'off'} color="#c8b4a6" number={ctxOn.reduce((n, c) => n + c.tokens, 0).toFixed(1) + 'k'} body={context.length + ' versions · local summarization remains simulated'}><CanvasButton onClick={props.onOpenContext}>summarize / versions</CanvasButton></CanvasCard></div>
              <div ref={setCardRef('sealed')}><CanvasCard title="inbox · sealed" badge={policy?.inbox === 'exclude' ? 'excluded' : 'policy boundary'} color="#3a3a3a" number="0" dashed body={denied + ' recorded refusals · dreams ⊘ excluded at source'}><span style={{ fontFamily: mono, fontSize: 8.5, color: '#5c5c5c' }}>exposed · protected</span></CanvasCard></div>
            </div>
          </section>
        )}

        <div ref={setCardRef('room')} className="ark-room-canvas-chat">
          <ChatPanel key={props.room} room={props.room} compact onExitCompact={props.onOpenChat} onOpenCapture={props.onOpenCapture} onOpenDoc={props.onOpenDoc} />
        </div>

        {(props.layers.agents || props.layers.tools) && (
          <section className="ark-room-band-section">
            <BandHeading>agents + tools · what the room can do</BandHeading>
            <div className="ark-room-canvas-band">
              {props.layers.agents && <>
                <div ref={setCardRef('agent')}><CanvasCard title={agent?.name ?? agentKey} badge={agent?.paused ? 'paused · simulated' : 'simulated'} color={running ? O : '#8a8a8a'} body={(currentRun ? currentRun.key + ' · ' + currentRun.task : 'no run in this room') + '\n' + (currentGrant ? currentGrant.objectIds.length + ' explicit object grants' : 'no active grant') + '\n' + (agent?.model ?? 'no model') + ' · runtime not connected'}><CanvasButton onClick={() => currentRun ? props.onOpenRun(currentRun.key) : props.onOpenSettings()}>what it sees</CanvasButton><CanvasButton onClick={() => { if (agent) void setPaused({ key: agent.key, paused: !agent.paused }); }} disabled={!agent}>{agent?.paused ? 'resume' : 'pause'}</CanvasButton></CanvasCard></div>
                <div ref={setCardRef('gate')}><CanvasCard title="approval gate" badge={waiting ? '1 waiting' : 'clear'} color={waiting ? WAIT : '#5c5c5c'} body={waiting ? waiting.key + ' · ' + waiting.task + '\nsaw ' + waiting.saw.docHashes.length + ' pinned references · simulated send' : 'nothing waiting in this room\nno external action is connected'}><CanvasButton primary disabled={!waiting || waiting.key !== '#413'} onClick={() => { void approve({ approve: true }); }}>approve</CanvasButton><CanvasButton disabled={!waiting} onClick={() => { if (waiting) props.onOpenRun(waiting.key); }}>preflight</CanvasButton></CanvasCard></div>
              </>}
              {props.layers.tools && <>
                <div ref={setCardRef('skills')}><CanvasCard title="skills · connectors" badge="scoped" body={(roomSkills.map((s) => s.key).join(' · ') || 'no scoped skills') + '\nno live connector health check\n▣ no runtime capability connected'}><CanvasButton onClick={props.onOpenSettings}>manage</CanvasButton></CanvasCard></div>
                <div ref={setCardRef('cartridges')}><CanvasCard title="cartridges" badge={mounted.length + ' mounted'} color="#c8b4a6" body={latestPack ? latestPack.name + ' v' + latestPack.version + '\n' + (latestPack.updatePending ? 'update v' + latestPack.updatePending + ' pending' : 'no update pending') + ' · ' + (latestPack.execConsented ? '▣ configured (simulated)' : '▣ declined') : 'no mounted cartridge in the prototype'}><CanvasButton onClick={props.onOpenLibrary}>{latestPack?.updatePending ? 'review v' + latestPack.updatePending : 'open library'}</CanvasButton><CanvasButton onClick={props.onOpenLibrary}>load</CanvasButton></CanvasCard></div>
              </>}
            </div>
          </section>
        )}

        {props.layers.audit && <button onClick={props.onOpenAudit} className="ark-room-audit-strip">audit trail · {audit.length} loaded events · inspect →</button>}
        {props.layers.graphFloor && <div className="ark-room-floor-note">graph floor is a visual grid only in v1 · vault graph stays locked</div>}
        <div className="ark-room-canvas-footnote">prototype projection · Hermes is not connected · hiding a layer never revokes access</div>
      </div>
    </div>
  );
}

function BandHeading({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: mono, fontSize: 8.5, letterSpacing: '.14em', textTransform: 'uppercase', color: '#5c5c5c', marginBottom: 10 }}>{children}</div>;
}

function CanvasCard({ title, badge, color = '#8a8a8a', number, body, dashed = false, children }: { title: string; badge: string; color?: string; number?: string; body: string; dashed?: boolean; children?: React.ReactNode }) {
  return <div className="ark-room-card" style={{ borderStyle: dashed ? 'dashed' : 'solid', opacity: dashed ? .8 : 1 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 5, height: 5, borderRadius: 999, background: color, flex: 'none' }} /><span style={{ fontFamily: mono, fontSize: 10, color: '#e8e8e8' }}>{title}</span><span style={{ marginLeft: 'auto', fontFamily: mono, fontSize: 8, color, textAlign: 'right' }}>{badge}</span></div>
    {number && <div style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-.02em' }}>{number}</div>}
    <div style={{ fontFamily: mono, fontSize: 9, color: '#8a8a8a', lineHeight: 1.65, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{body}</div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 'auto', paddingTop: 4 }}>{children}</div>
  </div>;
}

function CanvasButton({ children, onClick, primary = false, disabled = false }: { children: React.ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean }) {
  return <button onClick={onClick} disabled={disabled} style={{ padding: '5px 8px', borderRadius: 5, border: 'none', background: primary && !disabled ? O : '#171717', fontFamily: mono, fontSize: 8.5, color: primary && !disabled ? '#0a0a0a' : '#c8c8c8', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .4 : 1 }}>{children}</button>;
}
