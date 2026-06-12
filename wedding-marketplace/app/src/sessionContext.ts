import { createContext, useContext } from 'react';
import type { SessionUser } from './types';

export interface SessionState {
  user: SessionUser | null;
  loading: boolean;
  setUser: (u: SessionUser | null) => void;
}

export const SessionContext = createContext<SessionState | null>(null);

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession outside provider');
  return ctx;
}
