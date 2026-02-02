/**
 * Capability Actions - Launch Session, Create Task, Open Source
 */

import { useState } from 'react';
import { Play, Plus, FileCode, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { showSuccess, showError } from '@/lib/toast';
import { useProjectHubStore } from '@/stores/projectHubStore';
import { CreateTaskDialog } from './CreateTaskDialog';
import type { CapabilityDefinition } from '@sidstack/shared';

const API_BASE = 'http://localhost:19432';

interface CapabilityActionsProps {
  capability: CapabilityDefinition;
}

export function CapabilityActions({ capability }: CapabilityActionsProps) {
  const projectPath = useProjectHubStore((s) => s.projectPath);
  const projectId = projectPath.split('/').pop() || 'default';
  const [isLaunching, setIsLaunching] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const handleLaunchSession = async () => {
    setIsLaunching(true);
    try {
      const prompt = `Working on capability: ${capability.name} (${capability.id}). Module: ${capability.modules?.join(', ') || 'none'}`;
      const res = await fetch(`${API_BASE}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspacePath: projectPath,
          prompt,
          moduleId: capability.modules?.[0],
          tags: capability.tags,
        }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      showSuccess('Session launched', `Working on ${capability.name}`);
    } catch (err: any) {
      showError('Failed to launch session', err.message);
    } finally {
      setIsLaunching(false);
    }
  };

  const handleOpenSource = async () => {
    const filePath = `.sidstack/capabilities/${capability.id}.yaml`;
    try {
      // Try Tauri shell open
      const tauri = (window as any).__TAURI__;
      if (tauri?.shell?.open) {
        await tauri.shell.open(filePath);
      } else if (tauri?.opener?.openPath) {
        await tauri.opener.openPath(filePath);
      } else {
        showError('Cannot open file', 'Tauri shell not available');
      }
    } catch (err: any) {
      showError('Failed to open file', err.message);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="default"
        size="sm"
        onClick={handleLaunchSession}
        disabled={isLaunching}
      >
        {isLaunching ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Play className="w-3.5 h-3.5" />
        )}
        {isLaunching ? 'Launching...' : 'Launch Session'}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setShowCreateDialog(true)}
      >
        <Plus className="w-3.5 h-3.5" />
        Task
      </Button>
      <CreateTaskDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        projectId={projectId}
        defaults={{
          title: `[${capability.name}] `,
          description: `Task for capability: ${capability.name}`,
          moduleId: capability.modules?.[0],
          tags: capability.tags,
        }}
      />
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleOpenSource}
        title="Open YAML source"
      >
        <FileCode className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}
