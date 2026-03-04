import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import {
  tasks,
  tickets,
  knowledge,
  projects,
  impact,
  traceability,
  training,
  type CreateKnowledgeDoc,
  type UpdateKnowledgeDoc,
  type TicketUpdate,
} from '@/lib/api';

export function useTasks(projectId: string, filters?: Record<string, string | number>) {
  return useQuery({
    queryKey: queryKeys.tasks.list(projectId, filters),
    queryFn: () => tasks.list(projectId, filters),
    staleTime: 15_000,
    enabled: !!projectId,
  });
}

export function useTask(projectId: string, taskId: string) {
  return useQuery({
    queryKey: queryKeys.tasks.detail(projectId, taskId),
    queryFn: () => tasks.get(taskId),
    staleTime: 15_000,
    enabled: !!projectId && !!taskId,
  });
}

export function useTickets(projectId: string, filters?: Record<string, string | number>) {
  return useQuery({
    queryKey: queryKeys.tickets.list(projectId, filters),
    queryFn: () => tickets.list(projectId, filters),
    staleTime: 30_000,
    enabled: !!projectId,
  });
}

export function useKnowledge(projectId: string, filters?: Record<string, string | number>) {
  return useQuery({
    queryKey: queryKeys.knowledge.list(projectId, filters),
    queryFn: () => knowledge.list(projectId, filters),
    staleTime: 60_000,
    enabled: !!projectId,
  });
}

export function useKnowledgeDoc(projectId: string, docId: string) {
  return useQuery({
    queryKey: queryKeys.knowledge.detail(projectId, docId),
    queryFn: () => knowledge.get(docId),
    staleTime: 60_000,
    enabled: !!projectId && !!docId,
  });
}

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects.all(),
    queryFn: () => projects.list(),
    staleTime: 120_000,
  });
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: queryKeys.projects.detail(projectId),
    queryFn: () => projects.get(projectId),
    staleTime: 120_000,
    enabled: !!projectId,
  });
}

export function useActivity(projectId: string) {
  return useQuery({
    queryKey: queryKeys.activity.all(projectId),
    queryFn: () => tasks.list(projectId, { preset: 'all', fields: 'standard', limit: 100 }),
    staleTime: 30_000,
    enabled: !!projectId,
  });
}

export function useImpact(projectId: string, filters?: Record<string, string | number>) {
  return useQuery({
    queryKey: queryKeys.impact.list(projectId, filters),
    queryFn: () => impact.list(projectId, filters),
    staleTime: 60_000,
    enabled: !!projectId,
  });
}

export function useTraceability(projectId: string) {
  return useQuery({
    queryKey: queryKeys.traceability.all(projectId),
    queryFn: () => traceability.matrix(projectId),
    staleTime: 120_000,
    enabled: !!projectId,
  });
}

export function useTraining(projectId: string) {
  return useQuery({
    queryKey: queryKeys.training.all(projectId),
    queryFn: () =>
      Promise.all([
        training.stats().catch(() => null),
        training.incidents.list().catch(() => ({ incidents: [] as never[] })),
        training.lessons.list().catch(() => ({ lessons: [] as never[] })),
        training.skills.list().catch(() => ({ skills: [] as never[] })),
        training.rules.list().catch(() => ({ rules: [] as never[] })),
      ]).then(([stats, inc, les, sk, ru]) => ({
        stats,
        incidents: inc.incidents,
        lessons: les.lessons,
        skills: sk.skills,
        rules: ru.rules,
      })),
    staleTime: 60_000,
    enabled: !!projectId,
  });
}

export function useDashboard(projectId: string) {
  return useQuery({
    queryKey: queryKeys.dashboard.all(projectId),
    queryFn: () =>
      Promise.all([
        tasks.list(projectId, { preset: 'all', fields: 'standard', limit: 100 }).catch(() => ({ tasks: [] as never[] })),
        tickets.list(projectId, { limit: 100 }).catch(() => ({ tickets: [] as never[], total: 0 })),
        knowledge.stats(projectId).catch(() => ({ totalDocuments: 0, byType: {}, byStatus: {}, byModule: {}, needsReview: [] as never[] })),
      ]).then(([t, tk, ks]) => ({
        tasks: t.tasks,
        tickets: tk.tickets,
        docCount: ks.totalDocuments,
        knowledgeStats: ks,
      })),
    staleTime: 30_000,
    enabled: !!projectId,
  });
}

// --- Task mutations ---

export function useUpdateTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, string | number> }) =>
      tasks.update(id, data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(projectId, variables.id) });
    },
  });
}

// --- Ticket queries ---

export function useTicket(projectId: string, ticketId: string) {
  return useQuery({
    queryKey: queryKeys.tickets.detail(projectId, ticketId),
    queryFn: () => tickets.get(ticketId),
    staleTime: 30_000,
    enabled: !!projectId && !!ticketId,
  });
}

// --- Ticket mutations ---

export function useUpdateTicket(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TicketUpdate> }) =>
      tickets.update(id, data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tickets.detail(projectId, variables.id) });
    },
  });
}

export function useConvertTicketToTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tickets.convertToTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all(projectId) });
    },
  });
}

// --- Knowledge mutations ---

export function useCreateKnowledge(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateKnowledgeDoc) => knowledge.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.all(projectId) });
    },
  });
}

export function useUpdateKnowledge(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateKnowledgeDoc }) =>
      knowledge.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.all(projectId) });
    },
  });
}

export function useDeleteKnowledge(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => knowledge.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.all(projectId) });
    },
  });
}
