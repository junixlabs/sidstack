import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { SessionData } from "@/types/block";

interface SessionStore {
  // Sessions per block (blockId -> session data)
  sessions: Record<string, SessionData>;

  // Recent sessions for resume (up to 10)
  recentSessions: SessionData[];

  // Actions
  saveSession: (blockId: string, data: SessionData) => void;
  getSession: (blockId: string) => SessionData | null;
  clearSession: (blockId: string) => void;

  // Recent sessions
  addRecentSession: (session: SessionData) => void;
  clearRecentSessions: () => void;
  getResumableSessions: () => SessionData[];
}

const MAX_RECENT_SESSIONS = 10;

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      sessions: {},
      recentSessions: [],

      saveSession: (blockId, data) => {
        set((state) => ({
          sessions: {
            ...state.sessions,
            [blockId]: {
              ...data,
              lastActive: Date.now(),
            },
          },
        }));
      },

      getSession: (blockId) => {
        return get().sessions[blockId] || null;
      },

      clearSession: (blockId) => {
        set((state) => {
          const { [blockId]: removed, ...rest } = state.sessions;

          // Move to recent if it has a Claude session
          if (removed?.claudeSessionId) {
            get().addRecentSession(removed);
          }

          return { sessions: rest };
        });
      },

      addRecentSession: (session) => {
        if (!session.claudeSessionId) return;

        set((state) => {
          // Remove duplicates
          const filtered = state.recentSessions.filter(
            (s) => s.claudeSessionId !== session.claudeSessionId
          );

          // Add to front, limit size
          const updated = [session, ...filtered].slice(0, MAX_RECENT_SESSIONS);

          return { recentSessions: updated };
        });
      },

      clearRecentSessions: () => {
        set({ recentSessions: [] });
      },

      getResumableSessions: () => {
        const { recentSessions } = get();

        // Only return sessions less than 24 hours old
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        return recentSessions.filter((s) => s.lastActive > cutoff);
      },
    }),
    {
      name: "sidstack-sessions",
    }
  )
);
