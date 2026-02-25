/**
 * Tests for projectStore - worktree management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useProjectStore, PORT_RANGES } from './projectStore';
import type { Project, Worktree } from '@/types';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockImplementation((cmd: string, args?: Record<string, unknown>) => {
    if (cmd === 'run_git_command') {
      const gitArgs = args?.args as string[];
      if (gitArgs?.includes('rev-parse')) {
        return Promise.resolve('main\n');
      }
      if (gitArgs?.includes('worktree') && gitArgs?.includes('list')) {
        return Promise.resolve('');
      }
      if (gitArgs?.includes('config') && gitArgs?.includes('remote.origin.url')) {
        return Promise.resolve('git@github.com:user/test-project.git\n');
      }
      if (gitArgs?.includes('worktree') && gitArgs?.includes('remove')) {
        return Promise.resolve('');
      }
      return Promise.resolve('');
    }
    if (cmd === 'create_folder' || cmd === 'create_file') {
      return Promise.resolve(undefined);
    }
    if (cmd === 'path_exists') {
      return Promise.resolve(false);
    }
    return Promise.resolve(undefined);
  }),
}));

// Mock Tauri path
vi.mock('@tauri-apps/api/path', () => ({
  homeDir: vi.fn().mockResolvedValue('/Users/test'),
  join: vi.fn().mockImplementation((...parts: string[]) => parts.join('/')),
}));

// =============================================================================
// Helpers
// =============================================================================

function createMockWorktree(overrides: Partial<Worktree> = {}): Worktree {
  return {
    id: 'main',
    path: '/test/project',
    branch: 'main',
    ports: { dev: 3000, api: 19432, preview: 4000 },
    isActive: true,
    lastActive: new Date().toISOString(),
    ...overrides,
  };
}

function createMockProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'test-project-id',
    name: 'test-project',
    gitRemote: 'git@github.com:user/test-project.git',
    worktrees: [createMockWorktree()],
    activeWorktreeId: 'main',
    sharedContextPath: '/Users/test/.sidstack/projects/test-project-id',
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('projectStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useProjectStore.setState({
      projects: [],
      activeProjectId: null,
    });
  });

  // ===========================================================================
  // Port Allocation
  // ===========================================================================

  describe('allocatePorts', () => {
    it('should allocate first available ports when no worktrees exist', () => {
      const ports = useProjectStore.getState().allocatePorts();
      expect(ports.dev).toBe(PORT_RANGES.dev.start);
      expect(ports.api).toBe(PORT_RANGES.api.start);
      expect(ports.preview).toBe(PORT_RANGES.preview.start);
    });

    it('should avoid port collisions with existing worktrees', () => {
      // Set up a project with one worktree using first ports
      const existingProject = createMockProject({
        worktrees: [
          createMockWorktree({
            ports: { dev: 3000, api: 19432, preview: 4000 },
          }),
        ],
      });

      useProjectStore.setState({ projects: [existingProject] });

      const ports = useProjectStore.getState().allocatePorts();
      expect(ports.dev).toBe(3001);
      expect(ports.api).toBe(19433);
      expect(ports.preview).toBe(4001);
    });

    it('should avoid collisions across multiple projects', () => {
      const project1 = createMockProject({
        id: 'proj-1',
        worktrees: [
          createMockWorktree({ ports: { dev: 3000, api: 19432, preview: 4000 } }),
          createMockWorktree({ id: 'feat-1', branch: 'feat-1', ports: { dev: 3001, api: 19433, preview: 4001 } }),
        ],
      });

      const project2 = createMockProject({
        id: 'proj-2',
        worktrees: [
          createMockWorktree({ ports: { dev: 3002, api: 19434, preview: 4002 } }),
        ],
      });

      useProjectStore.setState({ projects: [project1, project2] });

      const ports = useProjectStore.getState().allocatePorts();
      expect(ports.dev).toBe(3003);
      expect(ports.api).toBe(19435);
      expect(ports.preview).toBe(4003);
    });

    it('should skip ports with value 0 (unallocated)', () => {
      const project = createMockProject({
        worktrees: [
          createMockWorktree({ ports: { dev: 0, api: 0, preview: 0 } }),
        ],
      });

      useProjectStore.setState({ projects: [project] });

      const ports = useProjectStore.getState().allocatePorts();
      expect(ports.dev).toBe(PORT_RANGES.dev.start);
    });
  });

  // ===========================================================================
  // getAllocatedPorts
  // ===========================================================================

  describe('getAllocatedPorts', () => {
    it('should return empty set when no projects exist', () => {
      const used = useProjectStore.getState().getAllocatedPorts('dev');
      expect(used.size).toBe(0);
    });

    it('should return all used ports across projects', () => {
      const project1 = createMockProject({
        id: 'p1',
        worktrees: [
          createMockWorktree({ ports: { dev: 3000, api: 19432, preview: 4000 } }),
        ],
      });
      const project2 = createMockProject({
        id: 'p2',
        worktrees: [
          createMockWorktree({ ports: { dev: 3005, api: 19437, preview: 4005 } }),
        ],
      });

      useProjectStore.setState({ projects: [project1, project2] });

      const devPorts = useProjectStore.getState().getAllocatedPorts('dev');
      expect(devPorts.has(3000)).toBe(true);
      expect(devPorts.has(3005)).toBe(true);
      expect(devPorts.has(3001)).toBe(false);
    });
  });

  // ===========================================================================
  // removeWorktree
  // ===========================================================================

  describe('removeWorktree', () => {
    it('should remove worktree from project', () => {
      const project = createMockProject({
        worktrees: [
          createMockWorktree({ id: 'main', branch: 'main' }),
          createMockWorktree({ id: 'feature-auth', branch: 'feature/auth', path: '/test/feature-auth' }),
        ],
        activeWorktreeId: 'main',
      });

      useProjectStore.setState({ projects: [project] });
      useProjectStore.getState().removeWorktree('test-project-id', 'feature-auth');

      const updated = useProjectStore.getState().projects[0];
      expect(updated.worktrees.length).toBe(1);
      expect(updated.worktrees[0].id).toBe('main');
    });

    it('should switch active worktree when removing the active one', () => {
      const project = createMockProject({
        worktrees: [
          createMockWorktree({ id: 'main', branch: 'main' }),
          createMockWorktree({ id: 'feature-auth', branch: 'feature/auth', path: '/test/feature-auth' }),
        ],
        activeWorktreeId: 'feature-auth',
      });

      useProjectStore.setState({ projects: [project] });
      useProjectStore.getState().removeWorktree('test-project-id', 'feature-auth');

      const updated = useProjectStore.getState().projects[0];
      expect(updated.activeWorktreeId).toBe('main');
    });

    it('should not affect other projects', () => {
      const project1 = createMockProject({ id: 'p1' });
      const project2 = createMockProject({
        id: 'p2',
        worktrees: [
          createMockWorktree({ id: 'main' }),
          createMockWorktree({ id: 'feat', branch: 'feat', path: '/test/feat' }),
        ],
      });

      useProjectStore.setState({ projects: [project1, project2] });
      useProjectStore.getState().removeWorktree('p2', 'feat');

      expect(useProjectStore.getState().projects[0].worktrees.length).toBe(1); // p1 untouched
      expect(useProjectStore.getState().projects[1].worktrees.length).toBe(1); // p2 reduced
    });
  });

  // ===========================================================================
  // removeWorktreeFromDisk
  // ===========================================================================

  describe('removeWorktreeFromDisk', () => {
    it('should find main worktree as reference (not by index)', async () => {
      const { invoke } = await import('@tauri-apps/api/core');

      const project = createMockProject({
        worktrees: [
          // Index 0 is NOT main
          createMockWorktree({ id: 'feature-auth', branch: 'feature/auth', path: '/test/feature-auth' }),
          // Index 1 IS main
          createMockWorktree({ id: 'main', branch: 'main', path: '/test/main' }),
          // Target to remove
          createMockWorktree({ id: 'bugfix', branch: 'bugfix/fix-1', path: '/test/bugfix' }),
        ],
        activeWorktreeId: 'main',
      });

      useProjectStore.setState({ projects: [project] });

      await useProjectStore.getState().removeWorktreeFromDisk('test-project-id', 'bugfix');

      // Should use main worktree's path as cwd, not index 0
      expect(invoke).toHaveBeenCalledWith('run_git_command', {
        cwd: '/test/main',
        args: ['worktree', 'remove', '/test/bugfix'],
      });
    });

    it('should fallback to another worktree if main not found', async () => {
      const { invoke } = await import('@tauri-apps/api/core');

      const project = createMockProject({
        worktrees: [
          createMockWorktree({ id: 'dev', branch: 'dev', path: '/test/dev' }),
          createMockWorktree({ id: 'staging', branch: 'staging', path: '/test/staging' }),
        ],
        activeWorktreeId: 'dev',
      });

      useProjectStore.setState({ projects: [project] });

      await useProjectStore.getState().removeWorktreeFromDisk('test-project-id', 'staging');

      // Should use dev (the remaining worktree) as cwd
      expect(invoke).toHaveBeenCalledWith('run_git_command', {
        cwd: '/test/dev',
        args: ['worktree', 'remove', '/test/staging'],
      });
    });

    it('should remove worktree from state after disk removal', async () => {
      const project = createMockProject({
        worktrees: [
          createMockWorktree({ id: 'main', branch: 'main', path: '/test/main' }),
          createMockWorktree({ id: 'feat', branch: 'feat', path: '/test/feat' }),
        ],
      });

      useProjectStore.setState({ projects: [project] });

      await useProjectStore.getState().removeWorktreeFromDisk('test-project-id', 'feat');

      const updated = useProjectStore.getState().projects[0];
      expect(updated.worktrees.length).toBe(1);
      expect(updated.worktrees[0].id).toBe('main');
    });

    it('should do nothing for non-existent worktree', async () => {
      const project = createMockProject();
      useProjectStore.setState({ projects: [project] });

      await useProjectStore.getState().removeWorktreeFromDisk('test-project-id', 'does-not-exist');

      expect(useProjectStore.getState().projects[0].worktrees.length).toBe(1);
    });
  });

  // ===========================================================================
  // switchWorktree
  // ===========================================================================

  describe('switchWorktree', () => {
    it('should update active worktree and isActive flags', () => {
      const project = createMockProject({
        worktrees: [
          createMockWorktree({ id: 'main', branch: 'main', isActive: true }),
          createMockWorktree({ id: 'feat', branch: 'feat', path: '/test/feat', isActive: false }),
        ],
        activeWorktreeId: 'main',
      });

      useProjectStore.setState({ projects: [project], activeProjectId: 'test-project-id' });

      useProjectStore.getState().switchWorktree('feat');

      const updated = useProjectStore.getState().projects[0];
      expect(updated.activeWorktreeId).toBe('feat');
      expect(updated.worktrees.find(w => w.id === 'feat')!.isActive).toBe(true);
      expect(updated.worktrees.find(w => w.id === 'main')!.isActive).toBe(false);
    });

    it('should do nothing for non-existent worktree', () => {
      const project = createMockProject();
      useProjectStore.setState({ projects: [project], activeProjectId: 'test-project-id' });

      useProjectStore.getState().switchWorktree('does-not-exist');

      const updated = useProjectStore.getState().projects[0];
      expect(updated.activeWorktreeId).toBe('main');
    });

    it('should update lastActive timestamp', () => {
      const oldTimestamp = '2020-01-01T00:00:00.000Z';
      const project = createMockProject({
        worktrees: [
          createMockWorktree({ id: 'main', lastActive: oldTimestamp }),
          createMockWorktree({ id: 'feat', branch: 'feat', path: '/test/feat', lastActive: oldTimestamp }),
        ],
      });

      useProjectStore.setState({ projects: [project], activeProjectId: 'test-project-id' });

      useProjectStore.getState().switchWorktree('feat');

      const updated = useProjectStore.getState().projects[0];
      const featWorktree = updated.worktrees.find(w => w.id === 'feat')!;
      expect(new Date(featWorktree.lastActive).getTime()).toBeGreaterThan(new Date(oldTimestamp).getTime());
    });
  });

  // ===========================================================================
  // releasePorts
  // ===========================================================================

  describe('releasePorts', () => {
    it('should reset ports to 0', () => {
      const project = createMockProject({
        worktrees: [
          createMockWorktree({ id: 'main', ports: { dev: 3000, api: 19432, preview: 4000 } }),
        ],
      });

      useProjectStore.setState({ projects: [project] });

      useProjectStore.getState().releasePorts('test-project-id', 'main');

      const updated = useProjectStore.getState().projects[0];
      expect(updated.worktrees[0].ports).toEqual({ dev: 0, api: 0, preview: 0 });
    });
  });

  // ===========================================================================
  // closeProject
  // ===========================================================================

  describe('closeProject', () => {
    it('should remove project from state', () => {
      const project = createMockProject();
      useProjectStore.setState({ projects: [project], activeProjectId: 'test-project-id' });

      useProjectStore.getState().closeProject('test-project-id');

      expect(useProjectStore.getState().projects.length).toBe(0);
      expect(useProjectStore.getState().activeProjectId).toBeNull();
    });

    it('should switch to another project when closing active', () => {
      const p1 = createMockProject({ id: 'p1' });
      const p2 = createMockProject({ id: 'p2' });
      useProjectStore.setState({ projects: [p1, p2], activeProjectId: 'p2' });

      useProjectStore.getState().closeProject('p2');

      expect(useProjectStore.getState().activeProjectId).toBe('p1');
    });
  });

  // ===========================================================================
  // getActiveProject / getActiveWorktree
  // ===========================================================================

  describe('getActiveProject', () => {
    it('should return active project', () => {
      const project = createMockProject();
      useProjectStore.setState({ projects: [project], activeProjectId: 'test-project-id' });

      const active = useProjectStore.getState().getActiveProject();
      expect(active?.id).toBe('test-project-id');
    });

    it('should return null when no active project', () => {
      expect(useProjectStore.getState().getActiveProject()).toBeNull();
    });
  });

  describe('getActiveWorktree', () => {
    it('should return active worktree', () => {
      const project = createMockProject({ activeWorktreeId: 'main' });
      useProjectStore.setState({ projects: [project], activeProjectId: 'test-project-id' });

      const worktree = useProjectStore.getState().getActiveWorktree();
      expect(worktree?.id).toBe('main');
    });

    it('should return null when no active project', () => {
      expect(useProjectStore.getState().getActiveWorktree()).toBeNull();
    });
  });
});
