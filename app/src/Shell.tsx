import { useEffect, useState } from 'react';
import { ChatPanel } from './ChatPanel';
import { CaptureDock } from './CaptureDock';
import { GraphOverlay } from './GraphOverlay';
import { CanvasMode } from './CanvasMode';
import { VaultFiles } from './VaultFiles';
import { Sources } from './Sources';
import { Policies } from './Policies';
import { ProposalReview } from './ProposalReview';
import { Library } from './Library';
import { Shared } from './Shared';
import { AgentsScreen } from './AgentsScreen';
import { Work } from './Work';
import { Manifests } from './Manifests';
import { RelayPanel } from './RelayPanel';
import { Audit } from './Audit';
import { SettingsOverlay } from './SettingsOverlay';

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
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [focusRun, setFocusRun] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'g') { e.preventDefault(); setGraphOpen((g) => !g); }
      if ((e.metaKey || e.ctrlKey) && e.key === ',') { e.preventDefault(); setSettingsOpen((s) => !s); setGraphOpen(false); }
      if (e.key === 'Escape') { if (settingsOpen) setSettingsOpen(false); else { setGraphOpen(false); setCapDock(false); } }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [settingsOpen]);

  const openDoc = (path: string) => { setOpenPath(path); setView('vault'); setVaultTab('files'); setGraphOpen(false); };

  const pills: { id: View | 'graph'; label: string }[] = [
    { id: 'chat', label: 'chat' }, { id: 'graph', label: 'graph' }, { id: 'vault', label: 'vault' },
    { id: 'agents', label: 'agents' }, { id: 'manifests', label: 'manifests' }, { id: 'relay', label: 'relay' }, { id: 'audit', label: 'audit' }
  ];
  const sub = <T extends string>(tabs: T[], cur: T, set: (t: T) => void) => tabs.map((t) => (
    <button key={t} onClick={() => { set(t); setGraphOpen(false); }} style={{ ...pillStyle, background: cur === t ? '#231610' : '#161616', color: cur === t ? O : '#8a8a8a' }}>{t}</button>
  ));

  const vaultBody =
    vaultTab === 'files' ? <VaultFiles openPath={openPath} /> :
    vaultTab === 'inbox' ? <ProposalReview /> :
    vaultTab === 'library' ? <Library /> :
    vaultTab === 'shared' ? <Shared /> :
    vaultTab === 'sources' ? <Sources /> : <Policies />;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <header style={{ flex: 'none', height: 66, display: 'flex', alignItems: 'center', gap: 14, padding: '0 18px' }}>
        <div style={{ fontFamily: mono, fontSize: 11, color: '#6a6a6a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>dm:hermes</div>
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
        {view === 'chat' && <ChatPanel room="dm:hermes" onOpenCapture={() => setCapDock(true)} onOpenDoc={openDoc} />}
        {view === 'chat' && capDock && <CaptureDock onClose={() => setCapDock(false)} onGoInbox={() => { setCapDock(false); setView('vault'); setVaultTab('inbox'); }} />}
        {view === 'vault' && vaultBody}
        {view === 'agents' && (agentsTab === 'network'
          ? <AgentsScreen focusRun={focusRun} />
          : <Work onOpenRun={(key) => { setFocusRun(key); setAgentsTab('network'); }} />)}
        {view === 'manifests' && <Manifests />}
        {view === 'relay' && <RelayPanel tab={relayTab} />}
        {view === 'audit' && <Audit />}
      </main>

      {graphOpen && (
        <GraphOverlay
          mode={graphMode}
          setMode={setGraphMode}
          onClose={() => setGraphOpen(false)}
          canvas={<CanvasMode onUseInChat={() => { setGraphOpen(false); setView('chat'); }} />}
        />
      )}

      {settingsOpen && <SettingsOverlay onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

const pillStyle: React.CSSProperties = { padding: '7px 11px', borderRadius: 6, fontSize: 12, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit', transition: 'background .14s, color .14s' };
const iconBtn: React.CSSProperties = { width: 32, height: 32, borderRadius: 8, border: 'none', background: '#141414', color: '#9a9a9a', cursor: 'pointer', display: 'grid', placeItems: 'center' };
