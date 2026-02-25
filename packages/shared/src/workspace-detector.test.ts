/**
 * Tests for workspace-detector module
 */

import * as path from 'path';
import * as fs from 'fs';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import {
  detectWorkspace,
  isInsideWorkspace,
  getWorkspaceRoot,
  getProjectId,
  getProjectIdSafe,
  isWorktree,
  listWorktrees,
  getWorktreeStatus,
  updateWorktreeStatus,
  ensureSidstackLocal,
  getSidstackLocalPath,
  loadWorkspaceConfig,
  saveWorkspaceConfig,
  listAgentDesks,
  getAgentDeskStatus,
  updateAgentDeskStatus,
  type WorkspaceConfig,
} from './workspace-detector';

// Test fixtures
const TEST_DIR = path.join(__dirname, '../../../..', '.test-workspace');
const WORKSPACE_ROOT = path.join(TEST_DIR, 'my-workspace');
const DESKS_DIR = path.join(WORKSPACE_ROOT, 'desks');
const WORKTREE_1 = path.join(DESKS_DIR, 'wt-1');
const WORKTREE_2 = path.join(DESKS_DIR, 'wt-2');
const WORKTREE_MAIN = path.join(DESKS_DIR, 'main');
const NESTED_DIR = path.join(WORKTREE_1, 'src', 'components');

const TEST_CONFIG: WorkspaceConfig = {
  projectId: 'test-workspace-id',
  projectName: 'Test Workspace',
  projectPath: '.',
  version: '1.0.0',
  createdAt: new Date().toISOString(),
  isWorkspace: true,
};

describe('workspace-detector', () => {
  beforeAll(() => {
    // Create test workspace structure with desks/ directory
    fs.mkdirSync(path.join(WORKSPACE_ROOT, '.sidstack'), { recursive: true });
    fs.mkdirSync(DESKS_DIR, { recursive: true });
    fs.mkdirSync(path.join(WORKTREE_1, '.sidstack-local'), { recursive: true });
    fs.mkdirSync(path.join(WORKTREE_2, '.sidstack-local'), { recursive: true });
    fs.mkdirSync(NESTED_DIR, { recursive: true });

    // Write config
    fs.writeFileSync(
      path.join(WORKSPACE_ROOT, '.sidstack', 'config.json'),
      JSON.stringify(TEST_CONFIG, null, 2)
    );
  });

  afterAll(() => {
    // Cleanup
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  // ===========================================================================
  // detectWorkspace
  // ===========================================================================

  describe('detectWorkspace', () => {
    it('should detect workspace from root', () => {
      const info = detectWorkspace(WORKSPACE_ROOT);
      expect(info).not.toBeNull();
      expect(info!.workspaceRoot).toBe(WORKSPACE_ROOT);
      expect(info!.projectId).toBe('test-workspace-id');
      expect(info!.isWorktree).toBe(false);
      expect(info!.isWorkspaceStructure).toBe(true);
    });

    it('should detect workspace from worktree', () => {
      const info = detectWorkspace(WORKTREE_1);
      expect(info).not.toBeNull();
      expect(info!.workspaceRoot).toBe(WORKSPACE_ROOT);
      expect(info!.isWorktree).toBe(true);
      expect(info!.worktreeName).toBe('wt-1');
      expect(info!.worktreePath).toBe(WORKTREE_1);
    });

    it('should detect workspace from nested path in worktree', () => {
      const info = detectWorkspace(NESTED_DIR);
      expect(info).not.toBeNull();
      expect(info!.workspaceRoot).toBe(WORKSPACE_ROOT);
      expect(info!.isWorktree).toBe(true);
      expect(info!.worktreeName).toBe('wt-1');
    });

    it('should return null for path outside workspace', () => {
      const info = detectWorkspace('/tmp');
      expect(info).toBeNull();
    });

    it('should throw when throwOnNotFound is true', () => {
      expect(() => {
        detectWorkspace('/tmp', { throwOnNotFound: true });
      }).toThrow();
    });

    it('should respect maxDepth option', () => {
      // Use a unique deeply nested path to avoid cache hit from earlier tests
      const deepPath = path.join(WORKTREE_1, 'src', 'components', 'deep');
      fs.mkdirSync(deepPath, { recursive: true });

      // With maxDepth=0, should not traverse up
      const info = detectWorkspace(deepPath, { maxDepth: 0 });
      expect(info).toBeNull();

      // Cleanup
      fs.rmSync(deepPath, { recursive: true, force: true });
    });

    it('should preserve queriedPath in result', () => {
      const info = detectWorkspace(NESTED_DIR);
      expect(info!.queriedPath).toBe(NESTED_DIR);
    });

    it('should detect non-workspace structure (no .bare/)', () => {
      // Create a legacy project (no .bare)
      const legacyDir = path.join(TEST_DIR, 'legacy-project');
      fs.mkdirSync(path.join(legacyDir, '.sidstack'), { recursive: true });
      fs.writeFileSync(
        path.join(legacyDir, '.sidstack', 'config.json'),
        JSON.stringify({ ...TEST_CONFIG, projectId: 'legacy-id' }, null, 2)
      );

      const info = detectWorkspace(legacyDir);
      expect(info).not.toBeNull();
      expect(info!.isWorkspaceStructure).toBe(false);
      expect(info!.isWorktree).toBe(false);

      // Cleanup
      fs.rmSync(legacyDir, { recursive: true, force: true });
    });

    it('should return null for invalid config', () => {
      const badDir = path.join(TEST_DIR, 'bad-config');
      fs.mkdirSync(path.join(badDir, '.sidstack'), { recursive: true });
      fs.writeFileSync(
        path.join(badDir, '.sidstack', 'config.json'),
        '{ invalid json'
      );

      const info = detectWorkspace(badDir);
      expect(info).toBeNull();

      // Cleanup
      fs.rmSync(badDir, { recursive: true, force: true });
    });

    it('should throw for invalid config when throwOnNotFound is true', () => {
      const badDir = path.join(TEST_DIR, 'bad-config-2');
      fs.mkdirSync(path.join(badDir, '.sidstack'), { recursive: true });
      fs.writeFileSync(
        path.join(badDir, '.sidstack', 'config.json'),
        '{ "noProjectId": true }'
      );

      expect(() => {
        detectWorkspace(badDir, { throwOnNotFound: true });
      }).toThrow();

      // Cleanup
      fs.rmSync(badDir, { recursive: true, force: true });
    });
  });

  // ===========================================================================
  // isInsideWorkspace
  // ===========================================================================

  describe('isInsideWorkspace', () => {
    it('should return true for workspace root', () => {
      expect(isInsideWorkspace(WORKSPACE_ROOT)).toBe(true);
    });

    it('should return true for worktree', () => {
      expect(isInsideWorkspace(WORKTREE_1)).toBe(true);
    });

    it('should return false for outside path', () => {
      expect(isInsideWorkspace('/tmp')).toBe(false);
    });
  });

  // ===========================================================================
  // getWorkspaceRoot / getProjectId / getProjectIdSafe
  // ===========================================================================

  describe('getWorkspaceRoot', () => {
    it('should return workspace root from worktree', () => {
      expect(getWorkspaceRoot(WORKTREE_1)).toBe(WORKSPACE_ROOT);
    });

    it('should throw for path outside workspace', () => {
      expect(() => getWorkspaceRoot('/tmp')).toThrow();
    });
  });

  describe('getProjectId', () => {
    it('should return projectId from worktree', () => {
      expect(getProjectId(WORKTREE_1)).toBe('test-workspace-id');
    });

    it('should throw for path outside workspace', () => {
      expect(() => getProjectId('/tmp')).toThrow();
    });
  });

  describe('getProjectIdSafe', () => {
    it('should return projectId when valid', () => {
      expect(getProjectIdSafe(WORKTREE_1)).toBe('test-workspace-id');
    });

    it('should return null for invalid path', () => {
      expect(getProjectIdSafe('/tmp')).toBeNull();
    });
  });

  // ===========================================================================
  // isWorktree / listWorktrees
  // ===========================================================================

  describe('isWorktree', () => {
    it('should return true for worktree folder', () => {
      expect(isWorktree(WORKTREE_1)).toBe(true);
    });

    it('should return false for workspace root', () => {
      expect(isWorktree(WORKSPACE_ROOT)).toBe(false);
    });

    it('should return false for non-existent path', () => {
      expect(isWorktree('/tmp/does-not-exist')).toBe(false);
    });
  });

  describe('listWorktrees', () => {
    it('should list all worktrees with .sidstack-local marker', () => {
      const worktrees = listWorktrees(WORKSPACE_ROOT);
      expect(worktrees).toContain('wt-1');
      expect(worktrees).toContain('wt-2');
      expect(worktrees.length).toBe(2);
    });

    it('should not include hidden directories', () => {
      // .sidstack should not appear in desk listing
      const worktrees = listWorktrees(WORKSPACE_ROOT);
      expect(worktrees).not.toContain('.sidstack');
    });

    it('should include main worktree if it has .sidstack-local', () => {
      // Create main with .sidstack-local
      fs.mkdirSync(path.join(WORKTREE_MAIN, '.sidstack-local'), { recursive: true });

      const worktrees = listWorktrees(WORKSPACE_ROOT);
      expect(worktrees).toContain('main');

      // Verify no duplicates - main should appear exactly once
      const mainCount = worktrees.filter(w => w === 'main').length;
      expect(mainCount).toBe(1);

      // Cleanup
      fs.rmSync(WORKTREE_MAIN, { recursive: true, force: true });
    });

    it('should not include directories without .sidstack-local', () => {
      const regularDir = path.join(WORKSPACE_ROOT, 'not-a-worktree');
      fs.mkdirSync(regularDir, { recursive: true });

      const worktrees = listWorktrees(WORKSPACE_ROOT);
      expect(worktrees).not.toContain('not-a-worktree');

      // Cleanup
      fs.rmSync(regularDir, { recursive: true, force: true });
    });
  });

  // ===========================================================================
  // Worktree Status (session.json)
  // ===========================================================================

  describe('getWorktreeStatus', () => {
    it('should return idle status when no session.json exists', () => {
      const status = getWorktreeStatus(WORKTREE_2);
      expect(status.name).toBe('wt-2');
      expect(status.path).toBe(WORKTREE_2);
      expect(status.status).toBe('idle');
      expect(status.branch).toBeUndefined();
      expect(status.taskId).toBeUndefined();
    });

    it('should read status from session.json', () => {
      const sessionPath = path.join(WORKTREE_1, '.sidstack-local', 'session.json');
      fs.writeFileSync(sessionPath, JSON.stringify({
        status: 'working',
        branch: 'feature/auth',
        taskId: 'task-123',
        agentRole: 'worker',
        lastActivity: '2025-01-01T00:00:00.000Z',
      }));

      const status = getWorktreeStatus(WORKTREE_1);
      expect(status.status).toBe('working');
      expect(status.branch).toBe('feature/auth');
      expect(status.taskId).toBe('task-123');
      expect(status.agentRole).toBe('worker');
      expect(status.lastActivity).toBe('2025-01-01T00:00:00.000Z');

      // Cleanup
      fs.unlinkSync(sessionPath);
    });

    it('should return idle status for corrupted session.json', () => {
      const sessionPath = path.join(WORKTREE_1, '.sidstack-local', 'session.json');
      fs.writeFileSync(sessionPath, '{ bad json }}}');

      const status = getWorktreeStatus(WORKTREE_1);
      expect(status.status).toBe('idle');

      // Cleanup
      fs.unlinkSync(sessionPath);
    });
  });

  describe('updateWorktreeStatus', () => {
    afterEach(() => {
      // Clean session files
      const sessionPath = path.join(WORKTREE_1, '.sidstack-local', 'session.json');
      if (fs.existsSync(sessionPath)) {
        fs.unlinkSync(sessionPath);
      }
    });

    it('should create session.json if it does not exist', () => {
      updateWorktreeStatus(WORKTREE_1, { status: 'assigned', branch: 'dev' });

      const sessionPath = path.join(WORKTREE_1, '.sidstack-local', 'session.json');
      expect(fs.existsSync(sessionPath)).toBe(true);

      const session = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
      expect(session.status).toBe('assigned');
      expect(session.branch).toBe('dev');
      expect(session.lastActivity).toBeDefined();
    });

    it('should merge updates into existing session', () => {
      // Write initial session
      updateWorktreeStatus(WORKTREE_1, { status: 'idle', branch: 'main' });

      // Update only status
      updateWorktreeStatus(WORKTREE_1, { status: 'working', taskId: 'task-456' });

      const sessionPath = path.join(WORKTREE_1, '.sidstack-local', 'session.json');
      const session = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
      expect(session.status).toBe('working');
      expect(session.branch).toBe('main'); // Preserved from initial write
      expect(session.taskId).toBe('task-456');
    });

    it('should always update lastActivity timestamp', () => {
      updateWorktreeStatus(WORKTREE_1, { status: 'idle' });

      const sessionPath = path.join(WORKTREE_1, '.sidstack-local', 'session.json');
      const session = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
      const timestamp = new Date(session.lastActivity).getTime();
      expect(timestamp).toBeGreaterThan(Date.now() - 5000);
    });
  });

  // ===========================================================================
  // Path Utilities
  // ===========================================================================

  describe('ensureSidstackLocal', () => {
    it('should create .sidstack-local if it does not exist', () => {
      const tmpDir = path.join(TEST_DIR, 'new-wt');
      fs.mkdirSync(tmpDir, { recursive: true });

      const localPath = ensureSidstackLocal(tmpDir);
      expect(fs.existsSync(localPath)).toBe(true);
      expect(localPath).toBe(path.join(tmpDir, '.sidstack-local'));

      // Cleanup
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should not fail if .sidstack-local already exists', () => {
      expect(() => ensureSidstackLocal(WORKTREE_1)).not.toThrow();
    });
  });

  describe('getSidstackLocalPath', () => {
    it('should return correct path', () => {
      expect(getSidstackLocalPath('/some/path')).toBe('/some/path/.sidstack-local');
    });
  });

  // ===========================================================================
  // Config Loading / Saving
  // ===========================================================================

  describe('loadWorkspaceConfig', () => {
    it('should load valid config', () => {
      const config = loadWorkspaceConfig(WORKSPACE_ROOT);
      expect(config.projectId).toBe('test-workspace-id');
      expect(config.projectName).toBe('Test Workspace');
      expect(config.version).toBe('1.0.0');
    });

    it('should throw for missing config', () => {
      expect(() => loadWorkspaceConfig('/tmp/no-workspace')).toThrow();
    });
  });

  describe('saveWorkspaceConfig', () => {
    it('should save and load config round-trip', () => {
      const tmpDir = path.join(TEST_DIR, 'save-test');
      const config: WorkspaceConfig = {
        projectId: 'save-test-id',
        projectName: 'Save Test',
        projectPath: '.',
        version: '2.0.0',
        createdAt: '2025-01-01T00:00:00.000Z',
      };

      saveWorkspaceConfig(tmpDir, config);

      const loaded = loadWorkspaceConfig(tmpDir);
      expect(loaded.projectId).toBe('save-test-id');
      expect(loaded.projectName).toBe('Save Test');
      expect(loaded.version).toBe('2.0.0');

      // Cleanup
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  // ===========================================================================
  // Agent Desk Aliases
  // ===========================================================================

  describe('Agent Desk aliases', () => {
    it('getAgentDeskStatus should be same as getWorktreeStatus', () => {
      expect(getAgentDeskStatus).toBe(getWorktreeStatus);
    });

    it('updateAgentDeskStatus should be same as updateWorktreeStatus', () => {
      expect(updateAgentDeskStatus).toBe(updateWorktreeStatus);
    });

    it('listAgentDesks should return desks with status', () => {
      // Write session for wt-1
      const sessionPath = path.join(WORKTREE_1, '.sidstack-local', 'session.json');
      fs.writeFileSync(sessionPath, JSON.stringify({
        status: 'working',
        branch: 'feature/test',
        agentRole: 'worker',
      }));

      // listAgentDesks falls back to directory scan when git is not available
      const desks = listAgentDesks(WORKSPACE_ROOT);
      expect(desks.length).toBeGreaterThanOrEqual(2);

      const desk1 = desks.find(d => d.name === 'wt-1');
      expect(desk1).toBeDefined();
      expect(desk1!.status).toBe('working');
      expect(desk1!.agentRole).toBe('worker');

      // Cleanup
      fs.unlinkSync(sessionPath);
    });
  });

  // ===========================================================================
  // Git Fallback (Mode B) — Integration test
  // Note: These tests require a real git repo setup which is complex in unit tests.
  // The resolveViaGit function is tested indirectly through the fallback path.
  // ===========================================================================

  describe('detectWorkspace - git fallback', () => {
    it('should return null for non-git directory', () => {
      const tmpDir = path.join(TEST_DIR, 'non-git-dir');
      fs.mkdirSync(tmpDir, { recursive: true });

      // No .sidstack/ and not a git repo — should return null
      const info = detectWorkspace(tmpDir);
      expect(info).toBeNull();

      // Cleanup
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should still work via traversal for Mode A (primary path)', () => {
      // Mode A: .sidstack/ is found via directory traversal
      const info = detectWorkspace(WORKTREE_1);
      expect(info).not.toBeNull();
      expect(info!.workspaceRoot).toBe(WORKSPACE_ROOT);
      expect(info!.isWorktree).toBe(true);
      // Git fallback should NOT be needed here
    });
  });
});
