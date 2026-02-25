/**
 * Traceability Store
 *
 * Fetches spec → task → test result coverage matrix from API.
 */

import { create } from "zustand";
import { getApiBaseUrl, apiFetch } from '@/lib/api-config';

const API_BASE = getApiBaseUrl();

// =============================================================================
// Types
// =============================================================================

export interface TraceabilityTaskEntry {
  id: string;
  title: string;
  status: string;
  verdict: string | null;
  passRate: number | null;
}

export interface TraceabilityCoverage {
  totalTasks: number;
  tested: number;
  passed: number;
  rate: number;
}

export interface TraceabilityMatrixEntry {
  specId: string;
  specTitle: string;
  specStatus: string;
  tasks: TraceabilityTaskEntry[];
  coverage: TraceabilityCoverage;
}

export interface TraceabilitySummary {
  totalSpecs: number;
  fullyCovered: number;
  partial: number;
  uncovered: number;
  overallRate: number;
}

// =============================================================================
// Store
// =============================================================================

interface TraceabilityStore {
  matrix: TraceabilityMatrixEntry[];
  summary: TraceabilitySummary | null;
  isLoading: boolean;
  error: string | null;
  selectedSpecId: string | null;

  fetchMatrix: (projectId: string, projectPath: string) => Promise<void>;
  selectSpec: (specId: string | null) => void;
}

export const useTraceabilityStore = create<TraceabilityStore>((set) => ({
  matrix: [],
  summary: null,
  isLoading: false,
  error: null,
  selectedSpecId: null,

  fetchMatrix: async (projectId: string, projectPath: string) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams({ projectId, projectPath });
      const res = await apiFetch(`${API_BASE}/api/traceability/matrix?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      set({
        matrix: data.matrix || [],
        summary: data.summary || null,
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  selectSpec: (specId) => set({ selectedSpecId: specId }),
}));
