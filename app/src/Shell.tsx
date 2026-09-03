import { useEffect, useState } from 'react';
import { ChatPanel } from './ChatPanel';

// port target: design/arkive-v2.html — header + nav + main area. see docs/HANDOFF.md §1.
export type View = 'chat' | 'vault' | 'agents' | 'manifests' | 'relay' | 'audit';
export type VaultTab = 'files' | 'inbox' | 'library' | 'shared' | 'sources' | 'policies';
export type AgentsTab = 'network' | 'work';
export type RelayTab = 'relay' | 'overview' | 'policies' | 'integrations' | 'storage' | 'models' | 'advanced';

const O = '#ff5a1f';
const mono = "'IBM Plex Mono', monospace";

export function Shell() {
  const [view, setView] = useState<View>('chat');
  const [vaultTab, setVaultTab] = useState<VaultTab>('files');
  const [agentsTab, setAgentsTab] = useState<AgentsTab>('network');
  const [relayTab, setRelayTab] = useState<RelayTab>('relay');
  const [graphOpen, setGraphOpen] = useState(false);
  const [graphMode, setGraphMode] = useState<'graph' | 'canvas'>('graph');
  const [capDock, setCapDock] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'g') { e.preventDefault(); setGraphOpen((g) => !g); }
      if ((e.metaKey || e.ctrlKey) && e.key === ',') { e.preventDefault(); setSettingsOpen((s) => !s); setGraphOpen(false); }
      if (e.key === 'Escape') { if (settingsOpen) setSettingsOpen(false); else { setGraphOpen(false); setCapDock(false); } }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [settingsOpen]);

  const pills: { id: View | 'graph'; label: string }[] = [
    { id: 'chat', label: 'chat' }, { id: 'graph', label: 'graph' }, { id: 'vault', label: 'vault' },
    { id: 'agents', label: 'agents' }, { id: 'manifests', label: 'manifests' }, { id: 'relay', label: 'relay' }, { id: 'audit', label: 'audit' }
  ];
  const sub = <T extends string>(tabs: T[], cur: T, set: (t: T) => void) => tabs.map((t) => (
    <button key={t} onClick={() => { set(t); setGraphOpen(false); }} style={{ ...pillStyle, background: cur === t ? '#231610' : '#161616', color: cur === t ? O : '#8a8a8a' }}>{t}</button>
  ));

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <header style={{ flex: 'none', height: 66, display: 'flex', alignItems: 'center', gap: 14, padding: '0 18px' }}>
        <div style={{ fontFamily: mono, fontSize: 11, color: '#6a6a6a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>dm:hermes · manifest —</div>
        <nav className="ark-scroll" style={{ margin: '0 auto', display: 'flex', gap: 2, padding: 4, borderRadius: 9, background: '#141414', minWidth: 0, overflowX: 'auto' }}>
          {pills.map((p) => {
            const on = p.id === 'graph' ? graphOpen : view === p.id && !graphOpen;
            return (
              <span key={p.id} style={{ display: 'contents' }}>
                <button onClick={() => p.id === 'graph' ? setGraphOpen((g) => !g) : (setView(p.id), setGraphOpen(false), setCapDock(false))} style={{ ...pillStyle, background: on ? '#2a2a2a' : 'transparent', color: on ? '#f6f6f6' : '#7a7a7a' }}>{p.label}</button>
                {p.id === 'vault' && view === 'vault' && !graphOpen && sub<VaultTab>(['files', 'inbox', 'library', 'shared', 'sources', 'policies'], vaultTab, setVaultTab)}
                {p.id === 'agents' && view === 'agents' && !graphOpen && sub<AgentsTab>(['network', 'work'], agentsTab, setAgentsTab)}
                {p.id === 'relay' && view === 'relay' && !graphOpen && sub<RelayTab>(['relay', 'overview', 'policies', 'integrations', 'storage', 'models', 'advanced'], relayTab, setRelayTab)}
              </span>
            );
          })}
        </nav>
        <button onClick={() => setSettingsOpen(true)} aria-label="settings" style={{ ...iconBtn, background: settingsOpen ? '#2a2a2a' : '#141414' }}>⚙</button>
      </header>

      <main style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {/* TODO port: CaptureDock(capDock) · VaultTree/ReadingView · ProposalReview · Library · Shared · Sources · Policies · AgentNetwork/AgentLog · Work · Manifests · RelayHealth · SystemPanel · Audit */}
        {view === 'chat'
          ? <ChatPanel room="dm:hermes" onOpenCapture={() => setCapDock(true)} onOpenDoc={() => { setView('vault'); setVaultTab('files'); }} />
          : <Placeholder label={view === 'vault' ? 'vault · ' + vaultTab : view === 'agents' ? 'agents · ' + agentsTab : view === 'relay' ? 'relay · ' + relayTab : view} />}
        {view === 'chat' && capDock && <Placeholder label="capture dock" overlay onClose={() => setCapDock(false)} />}
      </main>

      {graphOpen && (
        <div style={{ position: 'absolute', top: 66, left: 0, right: 0, bottom: 0, background: '#080808', zIndex: 20, animation: 'arkFade .18s ease-out' }}>
          {/* LOCKED: port the graph renderer verbatim from design/arkive-v2.html (Component.graph(), SIM, tick, lasso). */}
          <div style={{ position: 'absolute', right: 22, top: 20, display: 'flex', gap: 7 }}>
            {(['graph', 'canvas'] as const).map((m) => <button key={m} onClick={() => setGraphMode(m)} style={{ ...pillStyle, background: graphMode === m ? '#2a2a2a' : 'rgba(20,20,20,.9)', color: graphMode === m ? '#f6f6f6' : '#7a7a7a' }}>{m}</button>)}
            <button onClick={() => setGraphOpen(false)} aria-label="close graph" style={iconBtn}>✕</button>
          </div>
          <Placeholder label={graphMode === 'canvas' ? 'canvas · 5 views' : 'vault graph · lasso to scope'} />
        </div>
      )}

      {settingsOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: '#0a0a09', display: 'flex', animation: 'arkFade .16s ease-out' }}>
          {/* port: settings rail groups personal · vault · app · capabilities · workspace(team) */}
          <Placeholder label="settings" overlay onClose={() => setSettingsOpen(false)} />
        </div>
      )}
    </div>
  );
}

const pillStyle: React.CSSProperties = { padding: '7px 11px', borderRadius: 6, fontSize: 12, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit', transition: 'background .14s, color .14s' };
const iconBtn: React.CSSProperties = { width: 32, height: 32, borderRadius: 8, border: 'none', background: '#141414', color: '#9a9a9a', cursor: 'pointer', display: 'grid', placeItems: 'center' };
const chipStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', padding: '5px 11px', borderRadius: 6, background: '#141414', border: 'none', fontFamily: mono, fontSize: 9.5, color: '#c8c8c8', cursor: 'pointer' };

function Placeholder({ label, overlay, onClose }: { label: string; overlay?: boolean; onClose?: () => void }) {
  return (
    <div style={{ position: overlay ? 'absolute' : 'relative', inset: overlay ? 0 : undefined, flex: 1, display: 'grid', placeItems: 'center', background: overlay ? '#080808' : undefined, zIndex: overlay ? 8 : undefined }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: mono, fontSize: 10, color: '#4a4a4a' }}>{label}</div>
        <div style={{ fontFamily: mono, fontSize: 9, color: '#333', marginTop: 5 }}>port from design/arkive-v2.html · data-screen-label</div>
        {onClose && <button onClick={onClose} style={{ ...chipStyle, marginTop: 14 }}>close · esc</button>}
      </div>
    </div>
  );
}
