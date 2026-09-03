// architectural boundaries for the relay phase. interfaces only — no implementation, no keys, no crypto claims.

export interface Principal { id: string; label: string }            // later: npub
export interface SignedEvent { id: string; kind: string; author: string; payload: unknown; at: number; simulated: true }

export interface IdentityProvider { current(): Promise<Principal>; }
export interface RelayAdapter { publish(e: SignedEvent): Promise<void>; subscribe(channel: string, on: (e: SignedEvent) => void): () => void; }
export interface EventVerifier { verify(e: SignedEvent): Promise<boolean>; }
export interface EventProjector { project(e: SignedEvent): Promise<void>; }      // event → convex state
export interface WorkflowEngine { run(workflowId: string, input: unknown): Promise<{ runId: string }>; approve(runId: string, stepId: string): Promise<void>; }
export interface NotificationProvider { notify(kind: string, summary: string): Promise<void>; }

// dev stubs — everything labeled simulated. replace in the relay phase.
export const devIdentity: IdentityProvider = { current: async () => ({ id: 'dev', label: 'you' }) };
export const devRelay: RelayAdapter = { publish: async () => {}, subscribe: () => () => {} };
export const devVerifier: EventVerifier = { verify: async () => true };
export const devProjector: EventProjector = { project: async () => {} };
export const devWorkflow: WorkflowEngine = { run: async () => ({ runId: 'sim-' + Date.now() }), approve: async () => {} };
export const devNotify: NotificationProvider = { notify: async () => {} };
