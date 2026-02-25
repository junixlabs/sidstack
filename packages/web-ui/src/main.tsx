import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import Layout from '@/components/Layout';
import ProjectsPage from '@/pages/ProjectsPage';
import KnowledgePage from '@/pages/KnowledgePage';
import TasksPage from '@/pages/TasksPage';
import TicketsPage from '@/pages/TicketsPage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProjectsPage />} />
        <Route element={<Layout />}>
          <Route path="/knowledge" element={<KnowledgePage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/tickets" element={<TicketsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
