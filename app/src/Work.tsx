import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';

// port target: design/arkive-v2.html [data-screen-label='work'] — task rows with status pill, source, due, assignee.
// assign → ops.workAssign (per-run grant, scoped to the task's cited docs); evidence button → onOpenRun(runKey).

const O = '#ff5a1f';
const mono = "'IBM Plex Mono', monospace";

// prototype C map — [stBg, stFg, dot]
const C: Record<string, [string, string, string]> = {
  queued: ['#e8e8e4', '#7a7a76', '#c0c0bc'],
  running: ['#2a1a12', O, O],
  blocked: ['#1c1c1c', '#cf4a3a', '#cf4a3a'],
  done: ['#1c1c1c', '#6ec48a', '#3a7a4a']
};

export function Work({ onOpenRun }: { onOpenRun: (runKey: string) => void }) {
  const tasks = useQuery(api.panels.tasks) ?? [];
  const runs = useQuery(api.panels.runs) ?? [];
  const workAssign = useMutation(api.ops.workAssign);

  return (
    <div data-screen-label="work" style={{ flex: 1, minHeight: 0, padding: '0 18px 18px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ flex: 1, minHeight: 0, borderRadius: 14, background: '#0d0d0d', border: '1px solid #191919', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 'none', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid #191919' }}>
          <div style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: '.16em', textTransform: 'uppercase', color: '#5c5c5c' }}>work · tasks, assignments, evidence</div>
          <div style={{ marginLeft: 'auto', fontFamily: mono, fontSize: 9, color: '#4a4a4a' }}>runs + approvals live in agents · assigning never widens an agent's access</div>
        </div>
        <div className="ark-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {tasks.map((t) => {
            const c = C[t.status] || C.queued;
            const evRun = t.evidenceRunId ? runs.find((r) => r._id === t.evidenceRunId) : undefined;
            const canAssign = t.status === 'queued' && !t.assignee;
            return (
              <div key={t._id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', borderBottom: '1px solid #131313' }}>
                <div style={{ width: 5, height: 5, borderRadius: 999, background: c[2], flex: 'none' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: mono, fontSize: 11, color: '#e0e0e0' }}>{t.title}</div>
                  <div style={{ fontFamily: mono, fontSize: 9, color: '#5c5c5c', marginTop: 4 }}>{'source: ' + t.sourceRef + ' · due ' + (t.due ?? '—') + ' · ' + (t.assignee ? 'assigned: ' + t.assignee : 'unassigned')}</div>
                </div>
                <div style={{ padding: '3px 9px', borderRadius: 4, background: t.status === 'queued' ? '#1c1c1c' : c[0], fontFamily: mono, fontSize: 9, color: t.status === 'queued' ? '#8a8a8a' : c[1], textTransform: 'uppercase', letterSpacing: '.08em', flex: 'none' }}>{t.status}</div>
                {canAssign && (
                  <button onClick={() => void workAssign({ taskId: t._id })} style={{ padding: '6px 12px', borderRadius: 6, background: '#ff5a1f', border: 'none', fontFamily: mono, fontSize: 9.5, color: '#0a0a0a', cursor: 'pointer', flex: 'none' }}>assign → hermes</button>
                )}
                {evRun && (
                  <button onClick={() => onOpenRun(evRun.key)} style={{ padding: '6px 12px', borderRadius: 6, background: '#1c1c1c', border: 'none', fontFamily: mono, fontSize: 9.5, color: '#c8b4a6', cursor: 'pointer', flex: 'none' }}>{'evidence · run ' + evRun.key}</button>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderTop: '1px solid #171717' }}>
          <div style={{ fontFamily: mono, fontSize: 9, color: '#4a4a4a' }}>a task carries its source · an assignment carries a per-run grant · completion carries evidence — the chain never breaks</div>
        </div>
      </div>
    </div>
  );
}
