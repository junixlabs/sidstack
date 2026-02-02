/**
 * CreateTaskDialog - Shared dialog for creating tasks with user input
 *
 * Used by ProjectOverview and CapabilityActions to replace hardcoded task creation.
 */

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { showSuccess, showError } from '@/lib/toast';
import { useOnboardingStore } from '@/stores/onboardingStore';

const API_BASE = 'http://localhost:19432';

const TASK_TYPES = [
  { value: 'feature', label: 'Feature' },
  { value: 'bugfix', label: 'Bugfix' },
  { value: 'refactor', label: 'Refactor' },
  { value: 'test', label: 'Test' },
  { value: 'docs', label: 'Docs' },
  { value: 'infra', label: 'Infra' },
  { value: 'perf', label: 'Performance' },
  { value: 'debt', label: 'Tech Debt' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  /** Pre-fill values from capability or other context */
  defaults?: {
    title?: string;
    description?: string;
    taskType?: string;
    moduleId?: string;
    tags?: string[];
  };
  onCreated?: () => void;
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  projectId,
  defaults,
  onCreated,
}: CreateTaskDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState('feature');
  const [priority, setPriority] = useState('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const completeMilestone = useOnboardingStore((s) => s.completeMilestone);

  // Reset form when dialog opens with new defaults
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen && defaults) {
      setTitle(defaults.title || '');
      setDescription(defaults.description || '');
      setTaskType(defaults.taskType || 'feature');
    }
    if (!nextOpen) {
      setTitle('');
      setDescription('');
      setTaskType('feature');
      setPriority('medium');
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          title: title.trim(),
          description: description.trim() || title.trim(),
          taskType,
          priority,
          moduleId: defaults?.moduleId,
          tags: defaults?.tags,
          createdBy: 'ui',
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      showSuccess('Task created', title.trim());
      completeMilestone('taskCreated');
      handleOpenChange(false);
      onCreated?.();
    } catch (err: any) {
      showError('Failed to create task', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    'w-full px-3 py-1.5 text-xs bg-[var(--surface-2)] border border-[var(--border-muted)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">Create Task</DialogTitle>
          <DialogDescription>Fill in task details before creating.</DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-3">
          {/* Title */}
          <div>
            <label className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
              Title <span className="text-[var(--color-error)]">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title..."
              className={inputClass + ' mt-1'}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && title.trim()) handleSubmit();
              }}
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What needs to be done..."
              rows={3}
              className={inputClass + ' mt-1 resize-none'}
            />
          </div>

          {/* Type + Priority row */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
                Type
              </label>
              <Select value={taskType} onValueChange={setTaskType}>
                <SelectTrigger className="mt-1 w-full h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
                Priority
              </label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="mt-1 w-full h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSubmit}
            disabled={!title.trim() || isSubmitting}
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
