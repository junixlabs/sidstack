#!/usr/bin/env npx ts-node
/**
 * SQLite to PostgreSQL Data Migration Script
 *
 * Migrates all data from ~/.sidstack/sidstack.db to a PostgreSQL database.
 *
 * Usage:
 *   npx ts-node migrate-sqlite-to-pg.ts [options]
 *
 * Options:
 *   --database-url <url>  PostgreSQL connection URL (or set DATABASE_URL env var)
 *   --sqlite-path <path>  SQLite DB path (default: ~/.sidstack/sidstack.db)
 *   --dry-run             Show what would be migrated without writing
 *   --verbose             Show per-row details
 */

import Database from 'better-sqlite3';
import { Pool } from 'pg';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// ============================================================================
// CLI Argument Parsing
// ============================================================================

interface CliArgs {
  databaseUrl: string;
  sqlitePath: string;
  dryRun: boolean;
  verbose: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let databaseUrl = process.env.DATABASE_URL || '';
  let sqlitePath = path.join(os.homedir(), '.sidstack', 'sidstack.db');
  let dryRun = false;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--database-url':
        databaseUrl = args[++i] || '';
        break;
      case '--sqlite-path':
        sqlitePath = args[++i] || '';
        break;
      case '--dry-run':
        dryRun = true;
        break;
      case '--verbose':
        verbose = true;
        break;
      case '--help':
      case '-h':
        console.log(`
SQLite to PostgreSQL Migration Script

Usage: npx ts-node migrate-sqlite-to-pg.ts [options]

Options:
  --database-url <url>  PostgreSQL connection URL (or set DATABASE_URL)
  --sqlite-path <path>  SQLite DB path (default: ~/.sidstack/sidstack.db)
  --dry-run             Show what would be migrated without writing
  --verbose             Show per-row details
  -h, --help            Show this help
`);
        process.exit(0);
    }
  }

  if (!databaseUrl && !dryRun) {
    console.error('Error: --database-url or DATABASE_URL is required (unless --dry-run)');
    process.exit(1);
  }

  return { databaseUrl, sqlitePath, dryRun, verbose };
}

// ============================================================================
// Table Definitions
// ============================================================================

/**
 * Columns that store JSON as TEXT in SQLite and need JSONB in PostgreSQL.
 * Keyed by table name → set of column names.
 */
const JSON_COLUMNS: Record<string, Set<string>> = {
  tasks: new Set(['governance', 'acceptanceCriteria', 'validation', 'context']),
  governance_violations: new Set(['blockers']),
  work_entries: new Set(['details']),
  task_progress_log: new Set(['artifacts']),
  tickets: new Set(['labels', 'attachments', 'linkedIssues', 'externalUrls']),
  training_sessions: new Set([]),
  incidents: new Set(['context']),
  lessons: new Set(['incidentIds', 'applicability']),
  skills: new Set(['lessonIds', 'triggerConfig', 'applicability']),
  rules: new Set(['skillIds', 'applicability']),
  entity_references: new Set(['metadata']),
  knowledge_documents: new Set(['tags', 'related', 'dependsOn', 'covers']),
  impact_analyses: new Set(['inputJson', 'parsedJson', 'scopeJson', 'dataFlowsJson', 'risksJson', 'gateJson']),
  impact_validations: new Set(['resultJson']),
  gate_approvals: new Set(['approvedBlockersJson']),
  analysis_history: new Set(['actualIssuesJson']),
  claude_sessions: new Set(['resumeContext']),
  session_events: new Set(['details']),
  test_rooms: new Set([]),
  test_messages: new Set(['metadata']),
  module_architectures: new Set(['entryPoints', 'diagrams']),
  module_decisions: new Set(['alternatives', 'relatedFiles', 'tags']),
  module_tech_debt: new Set(['relatedFiles', 'relatedDecisions']),
};

/**
 * Columns that are INTEGER 0/1 in SQLite but BOOLEAN in PostgreSQL.
 */
const BOOLEAN_COLUMNS: Record<string, Set<string>> = {
  governance_violations: new Set(['resolved']),
  impact_validations: new Set(['isBlocking', 'autoVerifiable']),
  claude_sessions: new Set(['canResume']),
};

/**
 * Column name mapping: SQLite (unquoted camelCase) → PostgreSQL (quoted "camelCase").
 * For entity_references which uses snake_case in both schemas, no mapping needed.
 * The PostgreSQL schema uses quoted identifiers for camelCase columns.
 */

/**
 * Tables to migrate in dependency order (respecting foreign keys).
 * Only includes tables that exist in both SQLite and PostgreSQL schemas.
 */
const MIGRATION_ORDER: string[] = [
  // No dependencies
  'projects',
  'modules',

  // Depends on projects
  'tasks',
  'tickets',
  'knowledge_documents',
  'impact_analyses',

  // Depends on tasks
  'governance_violations',
  'task_progress_log',
  'task_spec_links',
  'task_knowledge_links',
  'dismissed_suggestions',

  // Depends on modules
  'module_architectures',
  'module_decisions',
  'module_tech_debt',
  'module_links',
  'module_spec_links',
  'module_knowledge_links',

  // Work history
  'work_sessions',
  'work_entries',

  // Impact sub-tables
  'impact_validations',
  'gate_approvals',
  'analysis_history',

  // Training room
  'training_sessions',
  'incidents',
  'lessons',
  'skills',
  'rules',
  'training_feedback',

  // Entity references (no FK constraints)
  'entity_references',

  // Test rooms
  'test_rooms',
  'test_items',
  'test_messages',
  'test_artifacts',

  // Claude sessions
  'claude_sessions',
  'session_events',
];

// ============================================================================
// Column Name Mapping (SQLite camelCase → PG quoted camelCase)
// ============================================================================

/**
 * Map SQLite column names to PostgreSQL column names.
 * Most are the same, but PG schema uses quoted identifiers for camelCase.
 * entity_references uses snake_case in both.
 */
function pgColumnName(table: string, sqliteCol: string): string {
  // entity_references uses snake_case — no quoting needed
  if (table === 'entity_references') {
    return sqliteCol;
  }
  // Simple all-lowercase columns don't need quoting
  if (sqliteCol === sqliteCol.toLowerCase()) {
    return sqliteCol;
  }
  // CamelCase columns need quoting in PG
  return `"${sqliteCol}"`;
}

// ============================================================================
// Data Transformation
// ============================================================================

/**
 * Transform a single row value from SQLite format to PostgreSQL format.
 */
function transformValue(
  table: string,
  column: string,
  value: unknown,
): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  // JSON columns: ensure valid JSON string for JSONB
  const jsonCols = JSON_COLUMNS[table];
  if (jsonCols?.has(column)) {
    if (typeof value === 'string') {
      // Validate it's parseable JSON; if not, wrap as JSON string
      try {
        JSON.parse(value);
        return value; // Already valid JSON string
      } catch {
        return JSON.stringify(value);
      }
    }
    // If it's already an object (shouldn't happen from SQLite), stringify
    return JSON.stringify(value);
  }

  // Boolean columns: SQLite INTEGER 0/1 → boolean
  const boolCols = BOOLEAN_COLUMNS[table];
  if (boolCols?.has(column)) {
    return value === 1 || value === true;
  }

  return value;
}

// ============================================================================
// Migration Logic
// ============================================================================

const BATCH_SIZE = 100;

interface MigrationResult {
  table: string;
  rowCount: number;
  skipped: boolean;
  error?: string;
}

/**
 * Get all column names for a table from SQLite.
 */
function getTableColumns(sqliteDb: Database.Database, table: string): string[] {
  const info = sqliteDb.pragma(`table_info(${table})`) as Array<{ name: string }>;
  return info.map((col) => col.name);
}

/**
 * Check if a table exists in SQLite.
 */
function tableExists(sqliteDb: Database.Database, table: string): boolean {
  const row = sqliteDb
    .prepare("SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name=?")
    .get(table) as { cnt: number } | undefined;
  return (row?.cnt ?? 0) > 0;
}

/**
 * Migrate a single table from SQLite to PostgreSQL.
 */
async function migrateTable(
  sqliteDb: Database.Database,
  pgPool: Pool,
  table: string,
  dryRun: boolean,
  verbose: boolean,
): Promise<MigrationResult> {
  // Check if table exists in SQLite
  if (!tableExists(sqliteDb, table)) {
    console.log(`  Skipping ${table} — not found in SQLite`);
    return { table, rowCount: 0, skipped: true };
  }

  // Get all rows from SQLite
  const columns = getTableColumns(sqliteDb, table);
  const rows = sqliteDb.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
  const rowCount = rows.length;

  if (rowCount === 0) {
    console.log(`  Table: ${table} — 0 rows (empty)`);
    return { table, rowCount: 0, skipped: false };
  }

  if (dryRun) {
    console.log(`  Table: ${table} — ${rowCount} rows would be migrated`);
    if (verbose && rows.length > 0) {
      console.log(`    Columns: ${columns.join(', ')}`);
      console.log(`    Sample row:`, JSON.stringify(rows[0], null, 2).substring(0, 200));
    }
    return { table, rowCount, skipped: false };
  }

  // Build PostgreSQL column names
  const pgCols = columns.map((col) => pgColumnName(table, col));

  // Migrate in batches within a transaction
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');

    // Truncate target table (idempotent)
    await client.query(`TRUNCATE TABLE ${table} CASCADE`);

    // Batch insert
    for (let batchStart = 0; batchStart < rows.length; batchStart += BATCH_SIZE) {
      const batch = rows.slice(batchStart, batchStart + BATCH_SIZE);

      // Build parameterized INSERT
      const valuePlaceholders: string[] = [];
      const allValues: unknown[] = [];
      let paramIndex = 1;

      for (const row of batch) {
        const rowPlaceholders: string[] = [];
        for (const col of columns) {
          const transformed = transformValue(table, col, row[col]);
          // For JSONB columns, cast the parameter
          const jsonCols = JSON_COLUMNS[table];
          if (jsonCols?.has(col) && transformed !== null) {
            rowPlaceholders.push(`$${paramIndex}::jsonb`);
          } else {
            rowPlaceholders.push(`$${paramIndex}`);
          }
          allValues.push(transformed);
          paramIndex++;
        }
        valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
      }

      const insertSql = `INSERT INTO ${table} (${pgCols.join(', ')}) VALUES ${valuePlaceholders.join(', ')}`;
      await client.query(insertSql, allValues);

      if (verbose) {
        console.log(`    Inserted batch ${batchStart + 1}-${Math.min(batchStart + BATCH_SIZE, rows.length)} of ${rowCount}`);
      }
    }

    await client.query('COMMIT');
    console.log(`  Table: ${table} — ${rowCount} rows migrated`);
    return { table, rowCount, skipped: false };
  } catch (error) {
    await client.query('ROLLBACK');
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`  Table: ${table} — ERROR: ${msg}`);
    return { table, rowCount: 0, skipped: false, error: msg };
  } finally {
    client.release();
  }
}

/**
 * Validate migration by comparing row counts.
 */
async function validateMigration(
  sqliteDb: Database.Database,
  pgPool: Pool,
  tables: string[],
): Promise<{ passed: boolean; mismatches: string[] }> {
  const mismatches: string[] = [];

  for (const table of tables) {
    if (!tableExists(sqliteDb, table)) continue;

    const sqliteCount = (
      sqliteDb.prepare(`SELECT count(*) as cnt FROM ${table}`).get() as { cnt: number }
    ).cnt;

    try {
      const pgResult = await pgPool.query(`SELECT count(*) as cnt FROM ${table}`);
      const pgCount = parseInt(pgResult.rows[0].cnt, 10);

      if (sqliteCount !== pgCount) {
        mismatches.push(`${table}: SQLite=${sqliteCount}, PostgreSQL=${pgCount}`);
      }
    } catch {
      mismatches.push(`${table}: Could not query PostgreSQL`);
    }
  }

  return { passed: mismatches.length === 0, mismatches };
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const args = parseArgs();

  console.log('=== SidStack: SQLite → PostgreSQL Migration ===\n');
  console.log(`SQLite path:    ${args.sqlitePath}`);
  console.log(`PostgreSQL URL: ${args.dryRun ? '(dry-run, not connected)' : args.databaseUrl.replace(/:[^:@]+@/, ':***@')}`);
  console.log(`Dry run:        ${args.dryRun}`);
  console.log(`Verbose:        ${args.verbose}`);
  console.log('');

  // Validate SQLite file exists
  if (!fs.existsSync(args.sqlitePath)) {
    console.error(`Error: SQLite database not found at ${args.sqlitePath}`);
    process.exit(1);
  }

  // Open SQLite
  const sqliteDb = new Database(args.sqlitePath, { readonly: true });
  console.log('SQLite database opened.\n');

  // Connect to PostgreSQL (unless dry-run)
  let pgPool: Pool | null = null;
  if (!args.dryRun) {
    pgPool = new Pool({ connectionString: args.databaseUrl });
    // Verify connection
    try {
      const client = await pgPool.connect();
      client.release();
      console.log('PostgreSQL connection verified.\n');
    } catch (error) {
      console.error(`Error: Could not connect to PostgreSQL: ${error instanceof Error ? error.message : error}`);
      sqliteDb.close();
      process.exit(1);
    }
  }

  // Run migration
  console.log('--- Migrating Tables ---\n');

  const results: MigrationResult[] = [];
  for (const table of MIGRATION_ORDER) {
    const result = await migrateTable(
      sqliteDb,
      pgPool as Pool,
      table,
      args.dryRun,
      args.verbose,
    );
    results.push(result);
  }

  // Summary
  console.log('\n--- Migration Summary ---\n');

  const migrated = results.filter((r) => !r.skipped && !r.error);
  const skipped = results.filter((r) => r.skipped);
  const errors = results.filter((r) => r.error);
  const totalRows = migrated.reduce((sum, r) => sum + r.rowCount, 0);

  console.log(`Tables migrated: ${migrated.length}`);
  console.log(`Tables skipped:  ${skipped.length}`);
  console.log(`Tables errored:  ${errors.length}`);
  console.log(`Total rows:      ${totalRows}`);

  if (errors.length > 0) {
    console.log('\nErrors:');
    for (const e of errors) {
      console.log(`  ${e.table}: ${e.error}`);
    }
  }

  // Validate row counts (unless dry-run)
  if (!args.dryRun && pgPool) {
    console.log('\n--- Validation ---\n');
    const migratedTables = migrated
      .filter((r) => r.rowCount > 0)
      .map((r) => r.table);

    const validation = await validateMigration(sqliteDb, pgPool, migratedTables);
    if (validation.passed) {
      console.log('Row count validation: PASSED');
    } else {
      console.log('Row count validation: FAILED');
      for (const m of validation.mismatches) {
        console.log(`  Mismatch: ${m}`);
      }
    }
  }

  // Cleanup
  sqliteDb.close();
  if (pgPool) {
    await pgPool.end();
  }

  console.log('\nDone.');

  if (errors.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
