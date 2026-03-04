/**
 * Tests for projectStore - Desk v2: persistent dev machine model
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useProjectStore } from './projectStore';
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

// Mock Tauri plugin-fs
vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn().mockRejectedValue(new Error('not found')),
}));

// =============================================================================
// Helpers
// =============================================================================

function createMockWorktree(overrides: Partial<Worktree> = {}): Worktree {
  return {
    id: 'main',
    path: '/test/project',
    branch: 'main',
    ports: { api: 3100, mcp: 3200, web: 3300, dev: 5100 },
    isActive: true,
    lastActive: new Date().toISOString(),
    agentStatus: 'idle',
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
  // getDesks
  // ===========================================================================

  describe('getDesks', () => {
    it('should return worktrees from active project', () => {
      const project = createMockProject({
        worktrees: [
          createMockWorktree({ id: 'main' }),
          createMockWorktree({ id: 'desk-1', branch: 'feat/test', agentStatus: 'working' }),
        ],
      });

      useProjectStore.setState({ projects: [project], activeProjectId: 'test-project-id' });

      const desks = useProjectStore.getState().getDesks();
      expect(desks.length).toBe(2);
    });

    it('should return empty array when no active project', () => {
      const desks = useProjectStore.getState().getDesks();
      expect(desks).toEqual([]);
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
