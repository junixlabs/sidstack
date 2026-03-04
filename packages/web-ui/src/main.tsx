import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import './index.css';
import Layout from '@/components/Layout';
import ProjectsPage from '@/pages/ProjectsPage';
import DashboardPage from '@/pages/DashboardPage';
import TasksPage from '@/pages/TasksPage';
import TaskDetailPage from '@/pages/TaskDetailPage';
import KanbanPage from '@/pages/KanbanPage';
import TicketsPage from '@/pages/TicketsPage';
import KnowledgePage from '@/pages/KnowledgePage';
import ImpactPage from '@/pages/ImpactPage';
import TrainingPage from '@/pages/TrainingPage';
import TraceabilityPage from '@/pages/TraceabilityPage';
import ActivityPage from '@/pages/ActivityPage';
import SettingsPage from '@/pages/SettingsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 300_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ProjectsPage />} />
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/tasks/:id" element={<TaskDetailPage />} />
            <Route path="/board" element={<KanbanPage />} />
            <Route path="/tickets" element={<TicketsPage />} />
            <Route path="/knowledge" element={<KnowledgePage />} />
            <Route path="/impact" element={<ImpactPage />} />
            <Route path="/training" element={<TrainingPage />} />
            <Route path="/traceability" element={<TraceabilityPage />} />
            <Route path="/activity" element={<ActivityPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  </StrictMode>,
);
