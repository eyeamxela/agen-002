export type RoomView = 'chat' | 'canvas';

export type CanvasLayers = {
  memory: boolean;
  agents: boolean;
  tools: boolean;
  graphFloor: boolean;
  audit: boolean;
};

export const DEFAULT_CANVAS_LAYERS: CanvasLayers = {
  memory: true,
  agents: true,
  tools: true,
  graphFloor: false,
  audit: false
};

export const isRoomView = (value: unknown): value is RoomView => value === 'chat' || value === 'canvas';

export function readCanvasLayers(value: unknown): CanvasLayers {
  if (!value || typeof value !== 'object') return DEFAULT_CANVAS_LAYERS;
  const source = value as Record<string, unknown>;
  return {
    memory: typeof source.memory === 'boolean' ? source.memory : DEFAULT_CANVAS_LAYERS.memory,
    agents: typeof source.agents === 'boolean' ? source.agents : DEFAULT_CANVAS_LAYERS.agents,
    tools: typeof source.tools === 'boolean' ? source.tools : DEFAULT_CANVAS_LAYERS.tools,
    graphFloor: typeof source.graphFloor === 'boolean' ? source.graphFloor : DEFAULT_CANVAS_LAYERS.graphFloor,
    audit: typeof source.audit === 'boolean' ? source.audit : DEFAULT_CANVAS_LAYERS.audit
  };
}
