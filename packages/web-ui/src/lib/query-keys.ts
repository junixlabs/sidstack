export const queryKeys = {
  tasks: {
    all: (projectId: string) => ['tasks', projectId] as const,
    list: (projectId: string, filters?: Record<string, unknown>) =>
      ['tasks', projectId, 'list', filters] as const,
    detail: (projectId: string, id: string) =>
      ['tasks', projectId, 'detail', id] as const,
  },
  tickets: {
    all: (projectId: string) => ['tickets', projectId] as const,
    list: (projectId: string, filters?: Record<string, unknown>) =>
      ['tickets', projectId, 'list', filters] as const,
    detail: (projectId: string, id: string) =>
      ['tickets', projectId, 'detail', id] as const,
  },
  knowledge: {
    all: (projectId: string) => ['knowledge', projectId] as const,
    list: (projectId: string, filters?: Record<string, unknown>) =>
      ['knowledge', projectId, 'list', filters] as const,
    detail: (projectId: string, id: string) =>
      ['knowledge', projectId, 'detail', id] as const,
    tree: (projectId: string) => ['knowledge', projectId, 'tree'] as const,
    stats: (projectId: string) => ['knowledge', projectId, 'stats'] as const,
  },
  projects: {
    all: () => ['projects'] as const,
    detail: (id: string) => ['projects', 'detail', id] as const,
  },
  activity: {
    all: (projectId: string) => ['activity', projectId] as const,
  },
  impact: {
    all: (projectId: string) => ['impact', projectId] as const,
    list: (projectId: string, filters?: Record<string, unknown>) =>
      ['impact', projectId, 'list', filters] as const,
  },
  traceability: {
    all: (projectId: string) => ['traceability', projectId] as const,
  },
  training: {
    all: (projectId: string) => ['training', projectId] as const,
  },
  dashboard: {
    all: (projectId: string) => ['dashboard', projectId] as const,
  },
};
