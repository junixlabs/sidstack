/**
 * TanStack Query key factory for the Tauri app.
 * Provides structured, typesafe query keys for cache management.
 */

export const queryKeys = {
  tasks: {
    all: (projectId: string) => ['tasks', projectId] as const,
    list: (projectId: string) => ['tasks', projectId, 'list'] as const,
    detail: (projectId: string, taskId: string) =>
      ['tasks', projectId, 'detail', taskId] as const,
    progress: (projectId: string, taskId: string) =>
      ['tasks', projectId, 'progress', taskId] as const,
  },
  knowledge: {
    all: (projectPath: string) => ['knowledge', projectPath] as const,
    list: (projectPath: string) =>
      ['knowledge', projectPath, 'list'] as const,
    doc: (projectPath: string, docId: string) =>
      ['knowledge', projectPath, 'doc', docId] as const,
  },
};
