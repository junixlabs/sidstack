import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Changed file status types
 */
export type FileStatus = "added" | "modified" | "deleted" | "renamed";

/**
 * Changed file representation
 */
export interface ChangedFile {
  path: string;
  oldPath?: string; // for renames
  status: FileStatus;
  additions: number;
  deletions: number;
  binary?: boolean;
}

/**
 * Diff hunk for navigation
 */
export interface DiffHunk {
  index: number;
  startLine: number;
  endLine: number;
}

/**
 * View mode for diff display
 */
export type DiffViewMode = "split" | "unified";

/**
 * Review state store
 */
interface ReviewState {
  // Files
  changedFiles: ChangedFile[];
  selectedFilePath: string | null;
  fileFilter: string;

  // View
  viewMode: DiffViewMode;
  sidebarCollapsed: boolean;
  sidebarWidth: number;

  // Navigation
  currentHunkIndex: number;
  totalHunks: number;

  // Loading states
  isLoading: boolean;
  error: string | null;

  // Actions - Files
  setChangedFiles: (files: ChangedFile[]) => void;
  selectFile: (path: string | null) => void;
  setFileFilter: (filter: string) => void;

  // Actions - Navigation
  nextFile: () => void;
  prevFile: () => void;
  nextHunk: () => void;
  prevHunk: () => void;
  setCurrentHunk: (index: number) => void;
  setTotalHunks: (total: number) => void;

  // Actions - View
  toggleViewMode: () => void;
  setViewMode: (mode: DiffViewMode) => void;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;

  // Actions - State
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

// Initial state for reset
const initialState = {
  changedFiles: [] as ChangedFile[],
  selectedFilePath: null as string | null,
  fileFilter: "",
  currentHunkIndex: 0,
  totalHunks: 0,
  isLoading: false,
  error: null as string | null,
};

export const useReviewStore = create<ReviewState>()(
  persist(
    (set, get) => ({
      // Initial state
      ...initialState,
      viewMode: "split" as DiffViewMode,
      sidebarCollapsed: false,
      sidebarWidth: 250,

      // Actions - Files
      setChangedFiles: (files) =>
        set({
          changedFiles: files,
          // Auto-select first file if none selected
          selectedFilePath:
            get().selectedFilePath && files.some((f) => f.path === get().selectedFilePath)
              ? get().selectedFilePath
              : files.length > 0
                ? files[0].path
                : null,
          currentHunkIndex: 0,
        }),

      selectFile: (path) =>
        set({
          selectedFilePath: path,
          currentHunkIndex: 0,
          totalHunks: 0,
        }),

      setFileFilter: (filter) => set({ fileFilter: filter }),

      // Actions - Navigation
      nextFile: () => {
        const { changedFiles, selectedFilePath, fileFilter } = get();
        const filteredFiles = fileFilter
          ? changedFiles.filter((f) => f.path.toLowerCase().includes(fileFilter.toLowerCase()))
          : changedFiles;

        if (filteredFiles.length === 0) return;

        const currentIndex = filteredFiles.findIndex((f) => f.path === selectedFilePath);
        const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % filteredFiles.length;

        set({
          selectedFilePath: filteredFiles[nextIndex].path,
          currentHunkIndex: 0,
          totalHunks: 0,
        });
      },

      prevFile: () => {
        const { changedFiles, selectedFilePath, fileFilter } = get();
        const filteredFiles = fileFilter
          ? changedFiles.filter((f) => f.path.toLowerCase().includes(fileFilter.toLowerCase()))
          : changedFiles;

        if (filteredFiles.length === 0) return;

        const currentIndex = filteredFiles.findIndex((f) => f.path === selectedFilePath);
        const prevIndex =
          currentIndex === -1
            ? filteredFiles.length - 1
            : (currentIndex - 1 + filteredFiles.length) % filteredFiles.length;

        set({
          selectedFilePath: filteredFiles[prevIndex].path,
          currentHunkIndex: 0,
          totalHunks: 0,
        });
      },

      nextHunk: () => {
        const { currentHunkIndex, totalHunks } = get();
        if (totalHunks === 0) return;
        set({ currentHunkIndex: (currentHunkIndex + 1) % totalHunks });
      },

      prevHunk: () => {
        const { currentHunkIndex, totalHunks } = get();
        if (totalHunks === 0) return;
        set({ currentHunkIndex: (currentHunkIndex - 1 + totalHunks) % totalHunks });
      },

      setCurrentHunk: (index) => set({ currentHunkIndex: index }),
      setTotalHunks: (total) => set({ totalHunks: total }),

      // Actions - View
      toggleViewMode: () =>
        set((state) => ({
          viewMode: state.viewMode === "split" ? "unified" : "split",
        })),

      setViewMode: (mode) => set({ viewMode: mode }),

      toggleSidebar: () =>
        set((state) => ({
          sidebarCollapsed: !state.sidebarCollapsed,
        })),

      setSidebarWidth: (width) => set({ sidebarWidth: width }),

      // Actions - State
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),

      reset: () => set(initialState),
    }),
    {
      name: "sidstack-review-store",
      storage: createJSONStorage(() => localStorage),
      // Only persist view preferences, not file data
      partialize: (state) => ({
        viewMode: state.viewMode,
        sidebarCollapsed: state.sidebarCollapsed,
        sidebarWidth: state.sidebarWidth,
      }),
    }
  )
);

/**
 * Computed selectors
 */
export const selectFilteredFiles = (state: ReviewState): ChangedFile[] => {
  if (!state.fileFilter) return state.changedFiles;
  return state.changedFiles.filter((f) =>
    f.path.toLowerCase().includes(state.fileFilter.toLowerCase())
  );
};

export const selectSelectedFile = (state: ReviewState): ChangedFile | null => {
  if (!state.selectedFilePath) return null;
  return state.changedFiles.find((f) => f.path === state.selectedFilePath) || null;
};

export const selectTotalStats = (
  state: ReviewState
): { files: number; additions: number; deletions: number } => {
  return state.changedFiles.reduce(
    (acc, file) => ({
      files: acc.files + 1,
      additions: acc.additions + file.additions,
      deletions: acc.deletions + file.deletions,
    }),
    { files: 0, additions: 0, deletions: 0 }
  );
};
