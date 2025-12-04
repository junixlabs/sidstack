/**
 * Ticket Store - Ticket to Release management
 *
 * Fetches tickets from API server and provides filtering/selection.
 */

import { create } from "zustand";

// ============================================================================
// Types
// ============================================================================

export type TicketStatus = "new" | "reviewing" | "approved" | "in_progress" | "completed" | "rejected";
export type TicketType = "bug" | "feature" | "improvement" | "task" | "epic";
export type TicketPriority = "low" | "medium" | "high" | "critical";
export type TicketSource = "api" | "jira" | "github" | "linear" | "manual";

export interface TicketAttachment {
  name: string;
  url?: string;
  path?: string;
  mimeType?: string;
  size?: number;
}

export interface TicketLinkedIssue {
  id: string;
  type: "blocks" | "blocked_by" | "relates_to" | "duplicates";
  title?: string;
  url?: string;
}

export interface Ticket {
  id: string;
  projectId: string;
  externalId?: string;
  source: TicketSource;
  title: string;
  description: string;
  type: TicketType;
  priority: TicketPriority;
  status: TicketStatus;
  labels: string[];
  attachments: TicketAttachment[];
  linkedIssues: TicketLinkedIssue[];
  externalUrls: string[];
  taskId?: string;
  sessionId?: string;
  reporter?: string;
  assignee?: string;
  createdAt: number;
  updatedAt: number;
}

export type TicketStatusFilter = "all" | TicketStatus;

interface TicketFilters {
  status: TicketStatusFilter;
  projectId: string;
  searchQuery: string;
  type?: TicketType;
  priority?: TicketPriority;
}

interface TicketStoreState {
  // Data
  tickets: Ticket[];
  selectedTicketId: string | null;
  total: number;

  // UI State
  filters: TicketFilters;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchTickets: (projectId?: string) => Promise<void>;
  selectTicket: (ticketId: string | null) => void;
  setStatusFilter: (status: TicketStatusFilter) => void;
  setSearchQuery: (query: string) => void;
  setTypeFilter: (type: TicketType | undefined) => void;
  setPriorityFilter: (priority: TicketPriority | undefined) => void;
  updateTicketStatus: (ticketId: string, status: TicketStatus) => Promise<void>;
  startSession: (ticketId: string, workspacePath: string) => Promise<{ sessionId?: string; contextPrompt?: string; error?: string }>;
  convertToTask: (ticketId: string) => Promise<{ taskId?: string; error?: string }>;
  clearError: () => void;
}

const API_BASE = "http://localhost:19432";

export const useTicketStore = create<TicketStoreState>((set, get) => ({
  // Initial state
  tickets: [],
  selectedTicketId: null,
  total: 0,
  filters: {
    status: "all",
    projectId: "default",
    searchQuery: "",
  },
  isLoading: false,
  error: null,

  // Actions
  fetchTickets: async (projectId) => {
    const { filters } = get();
    const pid = projectId || filters.projectId;

    set({ isLoading: true, error: null });

    try {
      const params = new URLSearchParams({ projectId: pid });
      if (filters.status !== "all") {
        params.append("status", filters.status);
      }
      if (filters.type) {
        params.append("type", filters.type);
      }
      if (filters.priority) {
        params.append("priority", filters.priority);
      }

      const response = await fetch(`${API_BASE}/api/tickets?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch tickets");
      }

      set({
        tickets: data.tickets,
        total: data.total,
        isLoading: false,
        filters: { ...filters, projectId: pid },
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  selectTicket: (ticketId) => {
    set({ selectedTicketId: ticketId });
  },

  setStatusFilter: (status) => {
    set((state) => ({
      filters: { ...state.filters, status },
    }));
    get().fetchTickets();
  },

  setSearchQuery: (query) => {
    set((state) => ({
      filters: { ...state.filters, searchQuery: query },
    }));
  },

  setTypeFilter: (type) => {
    set((state) => ({
      filters: { ...state.filters, type },
    }));
    get().fetchTickets();
  },

  setPriorityFilter: (priority) => {
    set((state) => ({
      filters: { ...state.filters, priority },
    }));
    get().fetchTickets();
  },

  updateTicketStatus: async (ticketId, status) => {
    try {
      const response = await fetch(`${API_BASE}/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update ticket");
      }

      // Update local state
      set((state) => ({
        tickets: state.tickets.map((t) =>
          t.id === ticketId ? { ...t, status } : t
        ),
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  startSession: async (ticketId, workspacePath) => {
    try {
      const response = await fetch(
        `${API_BASE}/api/tickets/${ticketId}/start-session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspacePath }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || "Failed to start session" };
      }

      // Update local state with session link
      set((state) => ({
        tickets: state.tickets.map((t) =>
          t.id === ticketId
            ? { ...t, sessionId: data.session.id, status: "in_progress" as TicketStatus }
            : t
        ),
      }));

      return {
        sessionId: data.session.id,
        contextPrompt: data.contextPrompt,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  convertToTask: async (ticketId) => {
    try {
      const response = await fetch(
        `${API_BASE}/api/tickets/${ticketId}/convert-to-task`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || "Failed to convert ticket" };
      }

      // Update local state
      set((state) => ({
        tickets: state.tickets.map((t) =>
          t.id === ticketId
            ? { ...t, taskId: data.task.id, status: "approved" as TicketStatus }
            : t
        ),
      }));

      return { taskId: data.task.id };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));

// ============================================================================
// Selectors
// ============================================================================

export const useTickets = () => useTicketStore((state) => state.tickets);
export const useSelectedTicket = () => {
  const tickets = useTicketStore((state) => state.tickets);
  const selectedId = useTicketStore((state) => state.selectedTicketId);
  return tickets.find((t) => t.id === selectedId) || null;
};
export const useTicketFilters = () => useTicketStore((state) => state.filters);
export const useTicketLoading = () => useTicketStore((state) => state.isLoading);
export const useTicketError = () => useTicketStore((state) => state.error);

// Filtered tickets based on search query
export const useFilteredTickets = () => {
  const tickets = useTicketStore((state) => state.tickets);
  const searchQuery = useTicketStore((state) => state.filters.searchQuery);

  if (!searchQuery) return tickets;

  const query = searchQuery.toLowerCase();
  return tickets.filter(
    (t) =>
      t.title.toLowerCase().includes(query) ||
      t.description.toLowerCase().includes(query) ||
      t.externalId?.toLowerCase().includes(query) ||
      t.labels.some((l) => l.toLowerCase().includes(query))
  );
};

// Group tickets by status
export const useTicketsByStatus = () => {
  const tickets = useTicketStore((state) => state.tickets);
  return tickets.reduce((acc, ticket) => {
    if (!acc[ticket.status]) {
      acc[ticket.status] = [];
    }
    acc[ticket.status].push(ticket);
    return acc;
  }, {} as Record<TicketStatus, Ticket[]>);
};

// Stats
export const useTicketStats = () => {
  const tickets = useTicketStore((state) => state.tickets);
  return {
    total: tickets.length,
    new: tickets.filter((t) => t.status === "new").length,
    reviewing: tickets.filter((t) => t.status === "reviewing").length,
    approved: tickets.filter((t) => t.status === "approved").length,
    inProgress: tickets.filter((t) => t.status === "in_progress").length,
    completed: tickets.filter((t) => t.status === "completed").length,
    rejected: tickets.filter((t) => t.status === "rejected").length,
  };
};
