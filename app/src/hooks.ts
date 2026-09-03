import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';

export function useChatMessages(room: string) {
  return useQuery(api.messages.list, { room });
}

export function useWorkspace(room: string, deny: boolean) {
  return useQuery(api.workspace.get, { room, deny });
}

export function useDocuments() {
  return useQuery(api.documents.list, {});
}
