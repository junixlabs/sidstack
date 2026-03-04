/**
 * Agent Desk v2 — Error Hierarchy
 */

import { SidStackError } from '../errors.js';

export class DeskError extends SidStackError {
  constructor(message: string, code: string, cause?: Error) {
    super(message, code, cause);
    this.name = 'DeskError';
  }
}

export class DeskNotFoundError extends DeskError {
  constructor(name: string) {
    super(`Desk not found: ${name}`, 'DESK_NOT_FOUND');
    this.name = 'DeskNotFoundError';
  }
}

export class DeskAlreadyExistsError extends DeskError {
  constructor(name: string) {
    super(`Desk already exists: ${name}`, 'DESK_ALREADY_EXISTS');
    this.name = 'DeskAlreadyExistsError';
  }
}

export class DeskDirtyError extends DeskError {
  constructor(name: string, modified: number, untracked: number) {
    super(
      `Desk '${name}' has uncommitted changes (${modified} modified, ${untracked} untracked). Use force to override.`,
      'DESK_DIRTY'
    );
    this.name = 'DeskDirtyError';
  }
}

export class DeskGitError extends DeskError {
  constructor(command: string, cause?: Error) {
    super(`Git command failed: ${command}`, 'DESK_GIT_ERROR', cause);
    this.name = 'DeskGitError';
  }
}

export class BranchNotFoundError extends DeskError {
  constructor(branch: string) {
    super(`Branch not found: ${branch}`, 'BRANCH_NOT_FOUND');
    this.name = 'BranchNotFoundError';
  }
}

export class BranchExistsError extends DeskError {
  constructor(branch: string) {
    super(`Branch already exists: ${branch}`, 'BRANCH_EXISTS');
    this.name = 'BranchExistsError';
  }
}
