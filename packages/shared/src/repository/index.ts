/**
 * Repository Init
 *
 * Explicit initialization — each entry point calls initRepository() once at startup.
 * API Server → initRepository('postgres', { dbUrl })
 * CLI/Tauri  → initRepository('sqlite')
 *
 * Routes/handlers call getRepository() which throws if not initialized.
 */

import { createSQLiteRepository } from './sqlite';
import type { IRepository } from './types';

export type DatabaseType = 'sqlite' | 'postgres';

let repository: IRepository | null = null;

/**
 * Initialize the repository singleton. Call once at startup.
 * Subsequent calls return the existing instance (idempotent).
 */
export async function initRepository(
  type: 'sqlite' | 'postgres',
  options?: { dbUrl?: string; dbPath?: string },
): Promise<IRepository> {
  if (repository) return repository;

  if (type === 'postgres') {
    const { PostgresRepository } = await import('./postgres.js');
    const repo = new PostgresRepository(options?.dbUrl);
    await repo.initialize();
    repository = repo;
  } else {
    repository = await createSQLiteRepository(options?.dbPath);
  }

  return repository;
}

/**
 * Get the initialized repository. Throws if initRepository() hasn't been called.
 *
 * Returns a Promise for backward compatibility — all existing callers use `await getRepository()`.
 */
export async function getRepository(): Promise<IRepository> {
  if (!repository) {
    // Fallback: auto-init SQLite for backward compat (CLI, Tauri, tests)
    repository = await createSQLiteRepository();
  }
  return repository;
}

export async function closeRepository(): Promise<void> {
  if (repository) {
    await repository.close();
    repository = null;
  }
}

// Re-export types and implementations
export * from './types';
export { SQLiteRepository, createSQLiteRepository } from './sqlite';
