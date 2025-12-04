#!/usr/bin/env node
/**
 * Transform database.ts from sql.js to better-sqlite3
 * Handles all mechanical pattern replacements
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'database.ts.orig');
let content = fs.readFileSync(filePath, 'utf-8');

// ============================================================================
// Step 1: Imports
// ============================================================================
content = content.replace(
  /\/\*\*\n \* SQLite Database Service for SidStack\n \*\n \* Simplified storage for core features:\n \* - Projects \(workspace management\)\n \* - Tasks \(task delegation\)\n \* - Work History \(progress tracking\)\n \*\n \* Uses sql\.js \(pure JavaScript SQLite\) for zero-installation experience\.\n \*\/\n\n\/\/ @ts-ignore - sql\.js doesn't have proper types\nimport initSqlJs from 'sql\.js';\n\ntype SqlJsDatabase = any;\ntype SqlJsStatic = any;\nimport \* as path from 'path';\nimport \* as fs from 'fs';/,
  `/**
 * SQLite Database Service for SidStack
 *
 * Simplified storage for core features:
 * - Projects (workspace management)
 * - Tasks (task delegation)
 * - Work History (progress tracking)
 *
 * Uses better-sqlite3 (native SQLite binding) for performance and WAL support.
 */

import Database from 'better-sqlite3';
import type { Database as BetterSqlite3Database } from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';`
);

// ============================================================================
// Step 2: Class properties
// ============================================================================
content = content.replace(
  /export class SidStackDB \{\n  private db: SqlJsDatabase \| null = null;\n  private SQL: SqlJsStatic \| null = null;\n  private dbPath: string;\n  private initialized: boolean = false;\n  private lastModifiedTime: number = 0;/,
  `export class SidStackDB {
  private db: BetterSqlite3Database | null = null;
  private dbPath: string;
  private initialized: boolean = false;`
);

// ============================================================================
// Step 3: init() method
// ============================================================================
content = content.replace(
  /  async init\(\): Promise<void> \{\n    if \(this\.initialized\) return;\n\n    console\.log\('\[SidStackDB\] Initializing database at:', this\.dbPath\);\n    this\.SQL = await initSqlJs\(\);\n[\s\S]*?this\.initialized = true;\n  \}/,
  `  async init(): Promise<void> {
    if (this.initialized) return;

    console.log('[SidStackDB] Initializing database at:', this.dbPath);

    // Handle 0-byte / corrupt database files
    if (fs.existsSync(this.dbPath)) {
      const stats = fs.statSync(this.dbPath);
      if (stats.size === 0) {
        console.log('[SidStackDB] Database file is 0 bytes, recreating...');
        fs.unlinkSync(this.dbPath);
      }
    }

    const isExisting = fs.existsSync(this.dbPath);
    this.db = new Database(this.dbPath);

    // Set WAL mode and pragmas for concurrent access
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    this.db.pragma('foreign_keys = ON');

    if (isExisting) {
      console.log('[SidStackDB] Opened existing database');
      try {
        const row = this.db.prepare('SELECT COUNT(*) as count FROM tasks').get() as any;
        console.log('[SidStackDB] Tasks in database:', row?.count || 0);
      } catch {
        console.log('[SidStackDB] Tasks table not found in existing db, will create via initSchema');
      }
    } else {
      console.log('[SidStackDB] Creating new database');
    }

    if (isExisting) {
      this.runMigrations();
    }
    this.initSchema();
    if (!isExisting) {
      this.runMigrations();
    }
    this.initialized = true;
  }`
);

// ============================================================================
// Step 4: runMigrations() - replace PRAGMA table_info patterns
// ============================================================================
// Replace: this.db!.exec("PRAGMA table_info(X)") -> this.db!.pragma('table_info(X)')
content = content.replace(
  /const columns = this\.db!\.exec\("PRAGMA table_info\((\w+)\)"\);\n\s*if \(columns\.length > 0\) \{\n\s*const columnNames = columns\[0\]\.values\.map\(\(row: any\[\]\) => row\[1\]\);/g,
  (match, tableName) => {
    return `const cols = this.db!.pragma('table_info(${tableName})') as any[];
      if (cols.length > 0) {
        const columnNames = cols.map((col: any) => col.name);`;
  }
);

// Replace: this.db!.run("ALTER TABLE ...) -> this.db!.exec("ALTER TABLE ...")
content = content.replace(/this\.db!\.run\("(ALTER TABLE[^"]+)"\)/g, 'this.db!.exec("$1")');
content = content.replace(/this\.db!\.run\("(CREATE UNIQUE INDEX[^"]+)"\)/g, 'this.db!.exec("$1")');

// Remove needsSave logic
content = content.replace(/\s*let needsSave = false;\n/g, '\n');
content = content.replace(/\s*needsSave = true;\n/g, '\n');
content = content.replace(/\s*if \(needsSave\) \{\n\s*this\.save\(\);\n\s*\}\n/g, '\n');

// Remove remaining this.save() calls
content = content.replace(/\n\s*this\.save\(\);\n/g, '\n');
// catch standalone this.save(); lines
content = content.replace(/^\s*this\.save\(\);$/gm, '');

// ============================================================================
// Step 5: Remove reload(), forceReload(), save() methods
// ============================================================================
content = content.replace(
  /  \/\*\*\n   \* Reload database from disk if it has been modified externally[\s\S]*?return true;\n  \}\n\n  \/\*\*\n   \* Force reload database from disk regardless of modification time\n   \*\/\n  forceReload\(\): void \{[\s\S]*?  \}\n\n  private ensureInit/,
  '  private ensureInit'
);

// Remove save() method
content = content.replace(
  /\n  private save\(\): void \{\n    if \(this\.db\) \{\n      const data = this\.db\.export\(\);\n      const buffer = Buffer\.from\(data\);\n      fs\.writeFileSync\(this\.dbPath, buffer\);\n    \}\n  \}\n/,
  '\n'
);

// ============================================================================
// Step 6: initSchema - change this.db!.run(` to this.db!.exec(`
// ============================================================================
// The two big initSchema blocks
content = content.replace(
  /this\.db!\.run\(`\n      -- =======================================================================\n      -- PROJECTS/,
  "this.db!.exec(`\n      -- =======================================================================\n      -- PROJECTS"
);
content = content.replace(
  /\/\/ Training Room tables \(lessons-learned system\)\n    this\.db(?:!)?\.run\(`\n      CREATE TABLE IF NOT EXISTS training_sessions/,
  "// Training Room tables (lessons-learned system)\n    this.db!.exec(`\n      CREATE TABLE IF NOT EXISTS training_sessions"
);

// Remove the trailing this.save() after initSchema closing
// Already handled by bulk save removal

// ============================================================================
// Step 7: Remove rowToObject method
// ============================================================================
content = content.replace(
  /\n  private rowToObject<T>\(columns: string\[\], row: unknown\[\]\): T \{\n    const obj: Record<string, unknown> = \{\};\n    columns\.forEach\(\(col, i\) => \{\n      obj\[col\] = row\[i\];\n    \}\);\n    return obj as T;\n  \}\n/,
  '\n'
);

// ============================================================================
// Step 8: Convert all this.db!.run( with params to this.db!.prepare().run(
// These are INSERT/UPDATE/DELETE statements with parameters
// Pattern: this.db!.run(\n      `SQL`,\n      [params]\n    );
// or: this.db!.run(`SQL`, [params]);
// -> this.db!.prepare('SQL').run(...params);
// ============================================================================

// Multi-line run with array parameter on next lines
content = content.replace(
  /this\.db!\.run\(\n\s*(`[^`]+`),\n\s*(\[[^\]]*?\])\n\s*\)/g,
  (match, sql, params) => {
    return `this.db!.prepare(${sql}).run(${params.slice(1, -1)})`;
  }
);

// Multi-line run with array parameter spanning multiple lines
content = content.replace(
  /this\.db!\.run\(\n\s*(`[^`]+`),\n\s*\[\n([\s\S]*?)\n\s*\]\n\s*\)/g,
  (match, sql, params) => {
    return `this.db!.prepare(${sql}).run(\n${params}\n    )`;
  }
);

// Single-line run: this.db!.run(`SQL`, [params])
content = content.replace(
  /this\.db!\.run\((`[^`]+`),\s*\[([^\]]*)\]\)/g,
  (match, sql, params) => {
    return `this.db!.prepare(${sql}).run(${params})`;
  }
);

// Run with values variable (not array literal): this.db!.run(`UPDATE ... WHERE id = ?`, values)
content = content.replace(
  /this\.db!\.run\((`[^`]+`),\s*(values|params)\)/g,
  (match, sql, varName) => {
    return `this.db!.prepare(${sql}).run(...${varName})`;
  }
);

// ============================================================================
// Step 9: Convert DELETE + SELECT changes() pattern (Pattern D)
// ============================================================================
// Pattern:
//   this.db!.prepare(...).run(...);\n\n    const result = this.db!.exec(`SELECT changes() as count`);\n    return result.length > 0 && Number(result[0].values[0][0]) > 0;
// Need to capture the prepare().run() call and make it: const info = ...; return info.changes > 0;

// First handle the general pattern where DELETE is followed by changes check
content = content.replace(
  /this\.db!\.prepare\((`DELETE[^`]*`)\)\.run\(([^)]*)\);\n\n\s*const result = this\.db!\.exec\(`SELECT changes\(\) as count`\);\n\s*return result\.length > 0 && Number\(result\[0\]\.values\[0\]\[0\]\) > 0;/g,
  (match, sql, params) => {
    return `const info = this.db!.prepare(${sql}).run(${params});\n    return info.changes > 0;`;
  }
);

// ============================================================================
// Step 10: Convert SELECT exec with params - single row (Pattern A)
// ============================================================================
// Pattern: const result = this.db!.exec(`SELECT * FROM X WHERE id = ?`, [id]);
//          if (result.length === 0 || result[0].values.length === 0) return null;
//          return this.rowToObject<T>(result[0].columns, result[0].values[0]);
// -> const row = this.db!.prepare('SELECT * FROM X WHERE id = ?').get(id) as T | undefined;
//    return row ?? null;

// Multi-line: result -> rowToObject<Type> with generic
content = content.replace(
  /const result = this\.db!\.exec\((`[^`]+`),\s*\[([^\]]*)\]\);\n\s*if \(result\.length === 0 \|\| result\[0\]\.values\.length === 0\) return null;\n\n\s*return this\.rowToObject<(\w+)>\(result\[0\]\.columns, result\[0\]\.values\[0\]\);/g,
  (match, sql, params, type) => {
    return `const row = this.db!.prepare(${sql}).get(${params}) as ${type} | undefined;\n    return row ?? null;`;
  }
);

// Without blank line between check and return
content = content.replace(
  /const result = this\.db!\.exec\((`[^`]+`),\s*\[([^\]]*)\]\);\n\s*if \(result\.length === 0 \|\| result\[0\]\.values\.length === 0\) return null;\n\s*return this\.rowToObject<(\w+)>\(result\[0\]\.columns, result\[0\]\.values\[0\]\);/g,
  (match, sql, params, type) => {
    return `const row = this.db!.prepare(${sql}).get(${params}) as ${type} | undefined;\n    return row ?? null;`;
  }
);

// rowToObject without generic type (returns any)
content = content.replace(
  /const result = this\.db!\.exec\((`[^`]+`),\s*\[([^\]]*)\]\);\n\s*if \(result\.length === 0 \|\| result\[0\]\.values\.length === 0\) return null;\n\n\s*return this\.rowToObject\(result\[0\]\.columns, result\[0\]\.values\[0\]\);/g,
  (match, sql, params) => {
    return `const row = this.db!.prepare(${sql}).get(${params}) as any;\n    return row ?? null;`;
  }
);

content = content.replace(
  /const result = this\.db!\.exec\((`[^`]+`),\s*\[([^\]]*)\]\);\n\s*if \(result\.length === 0 \|\| result\[0\]\.values\.length === 0\) return null;\n\s*return this\.rowToObject\(result\[0\]\.columns, result\[0\]\.values\[0\]\);/g,
  (match, sql, params) => {
    return `const row = this.db!.prepare(${sql}).get(${params}) as any;\n    return row ?? null;`;
  }
);

// ============================================================================
// Step 10b: Multi-line SQL single row fetch with params array on separate lines
// ============================================================================
content = content.replace(
  /const result = this\.db!\.exec\(\n\s*(`[^`]+`),\n\s*\[([^\]]*)\]\n\s*\);\n\s*if \(result\.length === 0 \|\| result\[0\]\.values\.length === 0\) return null;\n\n?\s*return this\.rowToObject<(\w+)>\(result\[0\]\.columns, result\[0\]\.values\[0\]\);/g,
  (match, sql, params, type) => {
    return `const row = this.db!.prepare(${sql}).get(${params}) as ${type} | undefined;\n    return row ?? null;`;
  }
);

content = content.replace(
  /const result = this\.db!\.exec\(\n\s*(`[^`]+`),\n\s*\[([^\]]*)\]\n\s*\);\n\s*if \(result\.length === 0 \|\| result\[0\]\.values\.length === 0\) return null;\n\n?\s*return this\.rowToObject\(result\[0\]\.columns, result\[0\]\.values\[0\]\);/g,
  (match, sql, params) => {
    return `const row = this.db!.prepare(${sql}).get(${params}) as any;\n    return row ?? null;`;
  }
);

// ============================================================================
// Step 11: Convert SELECT exec with params - multiple rows (Pattern B)
// ============================================================================
// Multi-line SQL:
// const result = this.db!.exec(\n      `SQL`,\n      [params]\n    );
// if (result.length === 0) return [];
// return result[0].values.map((row: unknown[]) => this.rowToObject<T>(result[0].columns, row));

content = content.replace(
  /const result = this\.db!\.exec\(\n\s*(`[^`]+`),\n\s*\[([^\]]*)\]\n\s*\);\n\s*if \(result\.length === 0\) return \[\];\n\n?\s*return result\[0\]\.values\.map\(\(row: unknown\[\]\) =>\n?\s*this\.rowToObject<(\w+)>\(result\[0\]\.columns, row\)\n?\s*\);/g,
  (match, sql, params, type) => {
    return `return this.db!.prepare(${sql}).all(${params}) as ${type}[];`;
  }
);

// Without type generic
content = content.replace(
  /const result = this\.db!\.exec\(\n\s*(`[^`]+`),\n\s*\[([^\]]*)\]\n\s*\);\n\s*if \(result\.length === 0\) return \[\];\n\n?\s*return result\[0\]\.values\.map\(\(row: unknown\[\]\) => this\.rowToObject\(result\[0\]\.columns, row\)\);/g,
  (match, sql, params) => {
    return `return this.db!.prepare(${sql}).all(${params}) as any[];`;
  }
);

// Single-line SQL version
content = content.replace(
  /const result = this\.db!\.exec\((`[^`]+`),\s*\[([^\]]*)\]\);\n\s*if \(result\.length === 0\) return \[\];\n\n?\s*return result\[0\]\.values\.map\(\(row: unknown\[\]\) =>\s*this\.rowToObject<(\w+)>\(result\[0\]\.columns, row\)\);/g,
  (match, sql, params, type) => {
    return `return this.db!.prepare(${sql}).all(${params}) as ${type}[];`;
  }
);

content = content.replace(
  /const result = this\.db!\.exec\((`[^`]+`),\s*\[([^\]]*)\]\);\n\s*if \(result\.length === 0\) return \[\];\n\n?\s*return result\[0\]\.values\.map\(\(row: unknown\[\]\) => this\.rowToObject\(result\[0\]\.columns, row\)\);/g,
  (match, sql, params) => {
    return `return this.db!.prepare(${sql}).all(${params}) as any[];`;
  }
);

// ============================================================================
// Step 12: Convert COUNT queries (Pattern C)
// ============================================================================
// Single line: const countResult = this.db!.exec(`SELECT COUNT(*) FROM X WHERE ...`, params);
//              const total = countResult.length > 0 ? Number(countResult[0].values[0][0]) : 0;
content = content.replace(
  /const countResult = this\.db!\.exec\((`SELECT COUNT\(\*\)[^`]+`),\s*(params|[\w.]+)\);\n\s*const total = countResult\.length > 0 \? Number\(countResult\[0\]\.values\[0\]\[0\]\) : 0;/g,
  (match, sql, paramsVar) => {
    // Add "as count" alias if not present
    let newSql = sql;
    if (!sql.includes(' as count')) {
      newSql = sql.replace('SELECT COUNT(*)', 'SELECT COUNT(*) as count');
    }
    return `const countRow = this.db!.prepare(${newSql}).get(...${paramsVar}) as any;\n    const total = countRow?.count ?? 0;`;
  }
);

// With array literal params
content = content.replace(
  /const countResult = this\.db!\.exec\((`SELECT COUNT\(\*\)[^`]+`),\s*\[([^\]]*)\]\);\n\s*const total = countResult\.length > 0 \? Number\(countResult\[0\]\.values\[0\]\[0\]\) : 0;/g,
  (match, sql, params) => {
    let newSql = sql;
    if (!sql.includes(' as count')) {
      newSql = sql.replace('SELECT COUNT(*)', 'SELECT COUNT(*) as count');
    }
    return `const countRow = this.db!.prepare(${newSql}).get(${params}) as any;\n    const total = countRow?.count ?? 0;`;
  }
);

// ============================================================================
// Step 13: Dynamic query exec with params variable (listTasks, listTickets, etc.)
// ============================================================================
// Pattern: const result = this.db!.exec(query, params);
//          if (result.length === 0) return [];
//          return result[0].values.map((row: unknown[]) => this.rowToObject<T>(result[0].columns, row));
content = content.replace(
  /const result = this\.db!\.exec\(query, params\);\n\s*if \(result\.length === 0\) return \[\];\n\n?\s*return result\[0\]\.values\.map\(\(row: unknown\[\]\) =>\s*this\.rowToObject<(\w+)>\(result\[0\]\.columns, row\)\);/g,
  (match, type) => {
    return `return this.db!.prepare(query).all(...params) as ${type}[];`;
  }
);

content = content.replace(
  /const result = this\.db!\.exec\(query, params\);\n\s*if \(result\.length === 0\) return \[\];\n\n?\s*return result\[0\]\.values\.map\(\(row: unknown\[\]\) => this\.rowToObject\(result\[0\]\.columns, row\)\);/g,
  'return this.db!.prepare(query).all(...params) as any[];'
);

// ============================================================================
// Step 14: Remaining exec with params that return empty arrays (no type)
// ============================================================================
// listModules uses exec with no params and complex SQL
content = content.replace(
  /const result = this\.db!\.exec\(`\n\s*SELECT\n\s*m\.\*[\s\S]*?ORDER BY m\.updatedAt DESC\n\s*`\);\n\s*if \(result\.length === 0\) return \[\];\n\n?\s*return result\[0\]\.values\.map\(\(row: unknown\[\]\) => this\.rowToObject<ModuleWithStats>\(result\[0\]\.columns, row\)\);/,
  (match) => {
    // Extract the SQL from the match
    const sqlMatch = match.match(/this\.db!\.exec\((`[\s\S]*?`)\)/);
    if (sqlMatch) {
      return `return this.db!.prepare(${sqlMatch[1]}).all() as ModuleWithStats[];`;
    }
    return match;
  }
);

// ============================================================================
// Step 15: No-params exec for SELECT (like listProjects, listTestRooms without status)
// ============================================================================
content = content.replace(
  /const result = this\.db!\.exec\((`SELECT [^`]+`)\);\n\s*if \(result\.length === 0\) return \[\];\n\n?\s*return result\[0\]\.values\.map\(\(row: unknown\[\]\) => this\.rowToObject<(\w+)>\(result\[0\]\.columns, row\)\);/g,
  (match, sql, type) => {
    return `return this.db!.prepare(${sql}).all() as ${type}[];`;
  }
);

// ============================================================================
// Step 16: Handle the special getClaudeSession pattern with canResume transform
// ============================================================================
content = content.replace(
  /const result = this\.db!\.exec\(`SELECT \* FROM claude_sessions WHERE id = \?`, \[id\]\);\n\s*if \(result\.length === 0 \|\| result\[0\]\.values\.length === 0\) return null;\n\n\s*const session = this\.rowToObject<any>\(result\[0\]\.columns, result\[0\]\.values\[0\]\);\n\s*return \{\n\s*\.\.\.session,\n\s*canResume: Boolean\(session\.canResume\),\n\s*resumeContext: session\.resumeContext \? session\.resumeContext : undefined,\n\s*\} as ClaudeSession;/,
  `const session = this.db!.prepare(\`SELECT * FROM claude_sessions WHERE id = ?\`).get(id) as any;
    if (!session) return null;
    return {
      ...session,
      canResume: Boolean(session.canResume),
      resumeContext: session.resumeContext ? session.resumeContext : undefined,
    } as ClaudeSession;`
);

// ============================================================================
// Step 17: Handle getGovernanceViolation (resolved boolean conversion)
// ============================================================================
content = content.replace(
  /const result = this\.db!\.exec\(`SELECT \* FROM governance_violations WHERE id = \?`, \[id\]\);\n\s*if \(result\.length === 0 \|\| result\[0\]\.values\.length === 0\) return null;\n\n\s*const row = this\.rowToObject<any>\(result\[0\]\.columns, result\[0\]\.values\[0\]\);\n\s*return \{\n\s*\.\.\.row,\n\s*resolved: row\.resolved === 1,\n\s*\};/,
  `const row = this.db!.prepare(\`SELECT * FROM governance_violations WHERE id = ?\`).get(id) as any;
    if (!row) return null;
    return {
      ...row,
      resolved: row.resolved === 1,
    };`
);

// ============================================================================
// Step 18: Handle getTaskViolations (array with resolved transform)
// ============================================================================
content = content.replace(
  /const result = this\.db!\.exec\(\n\s*`SELECT \* FROM governance_violations WHERE taskId = \? ORDER BY timestamp DESC`,\n\s*\[taskId\]\n\s*\);\n\s*if \(result\.length === 0\) return \[\];\n\n\s*return result\[0\]\.values\.map\(\(row: unknown\[\]\) => \{\n\s*const obj = this\.rowToObject<any>\(result\[0\]\.columns, row\);\n\s*return \{ \.\.\.obj, resolved: obj\.resolved === 1 \};\n\s*\}\);/,
  `const rows = this.db!.prepare(\`SELECT * FROM governance_violations WHERE taskId = ? ORDER BY timestamp DESC\`).all(taskId) as any[];
    return rows.map((obj: any) => ({ ...obj, resolved: obj.resolved === 1 }));`
);

// ============================================================================
// Step 19: Handle listGovernanceViolations (dynamic query with resolved transform)
// ============================================================================
content = content.replace(
  /const result = this\.db!\.exec\(query, params\);\n\s*if \(result\.length === 0\) return \[\];\n\n\s*return result\[0\]\.values\.map\(\(row: unknown\[\]\) => \{\n\s*const obj = this\.rowToObject<any>\(result\[0\]\.columns, row\);\n\s*return \{ \.\.\.obj, resolved: obj\.resolved === 1 \};\n\s*\}\);/,
  `const rows = this.db!.prepare(query).all(...params) as any[];
    return rows.map((obj: any) => ({ ...obj, resolved: obj.resolved === 1 }));`
);

// ============================================================================
// Step 20: Handle listClaudeSessions with canResume transform
// ============================================================================
content = content.replace(
  /const result = this\.db!\.exec\(\n\s*`SELECT \* FROM claude_sessions WHERE \$\{whereClause\} ORDER BY startedAt DESC LIMIT \? OFFSET \?`,\n\s*\[\.\.\.params, limit, offset\]\n\s*\);\n\n\s*const sessions = result\.length > 0\n\s*\? result\[0\]\.values\.map\(\(row: unknown\[\]\) => \{\n\s*const session = this\.rowToObject<any>\(result\[0\]\.columns, row\);\n\s*return \{\n\s*\.\.\.session,\n\s*canResume: Boolean\(session\.canResume\),\n\s*resumeContext: session\.resumeContext \? session\.resumeContext : undefined,\n\s*\} as ClaudeSession;\n\s*\}\)\n\s*: \[\];/,
  `const rows = this.db!.prepare(
      \`SELECT * FROM claude_sessions WHERE \${whereClause} ORDER BY startedAt DESC LIMIT ? OFFSET ?\`
    ).all(...params, limit, offset) as any[];

    const sessions = rows.map((session: any) => ({
      ...session,
      canResume: Boolean(session.canResume),
      resumeContext: session.resumeContext ? session.resumeContext : undefined,
    } as ClaudeSession));`
);

// ============================================================================
// Step 21: Handle getClaudeSessionStats
// ============================================================================
content = content.replace(
  /const statsResult = this\.db!\.exec\(`\n\s*SELECT\n\s*COUNT\(\*\) as total[\s\S]*?FROM claude_sessions WHERE \$\{whereClause\}\n\s*`, params\);\n\n\s*const stats = statsResult\.length > 0 \? statsResult\[0\]\.values\[0\] : \[0, 0, 0, 0, 0, 0\];\n\s*const total = Number\(stats\[0\]\) \|\| 0;\n\s*const active = Number\(stats\[1\]\) \|\| 0;\n\s*const completed = Number\(stats\[2\]\) \|\| 0;\n\s*const error = Number\(stats\[3\]\) \|\| 0;\n\s*const terminated = Number\(stats\[4\]\) \|\| 0;\n\s*const totalDuration = Number\(stats\[5\]\) \|\| 0;/,
  `const statsRow = this.db!.prepare(\`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' OR status = 'launching' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error,
        SUM(CASE WHEN status = 'terminated' THEN 1 ELSE 0 END) as terminated,
        SUM(CASE WHEN endedAt IS NOT NULL THEN endedAt - startedAt ELSE 0 END) as totalDuration
      FROM claude_sessions WHERE \${whereClause}
    \`).get(...params) as any;

    const total = Number(statsRow?.total) || 0;
    const active = Number(statsRow?.active) || 0;
    const completed = Number(statsRow?.completed) || 0;
    const error = Number(statsRow?.error) || 0;
    const terminated = Number(statsRow?.terminated) || 0;
    const totalDuration = Number(statsRow?.totalDuration) || 0;`
);

// Terminal stats
content = content.replace(
  /const terminalResult = this\.db!\.exec\(`\n\s*SELECT terminal, COUNT\(\*\) as count\n\s*FROM claude_sessions WHERE \$\{whereClause\}\n\s*GROUP BY terminal\n\s*`, params\);\n\n\s*const byTerminal: Record<string, number> = \{\};\n\s*if \(terminalResult\.length > 0\) \{\n\s*for \(const row of terminalResult\[0\]\.values\) \{\n\s*byTerminal\[row\[0\] as string\] = Number\(row\[1\]\);\n\s*\}\n\s*\}/,
  `const terminalRows = this.db!.prepare(\`
      SELECT terminal, COUNT(*) as count
      FROM claude_sessions WHERE \${whereClause}
      GROUP BY terminal
    \`).all(...params) as any[];

    const byTerminal: Record<string, number> = {};
    for (const row of terminalRows) {
      byTerminal[row.terminal as string] = Number(row.count);
    }`
);

// Module stats
content = content.replace(
  /const moduleResult = this\.db!\.exec\(`\n\s*SELECT moduleId, COUNT\(\*\) as count\n\s*FROM claude_sessions WHERE \$\{whereClause\} AND moduleId IS NOT NULL\n\s*GROUP BY moduleId\n\s*`, params\);\n\n\s*const byModule: Record<string, number> = \{\};\n\s*if \(moduleResult\.length > 0\) \{\n\s*for \(const row of moduleResult\[0\]\.values\) \{\n\s*byModule\[row\[0\] as string\] = Number\(row\[1\]\);\n\s*\}\n\s*\}/,
  `const moduleRows = this.db!.prepare(\`
      SELECT moduleId, COUNT(*) as count
      FROM claude_sessions WHERE \${whereClause} AND moduleId IS NOT NULL
      GROUP BY moduleId
    \`).all(...params) as any[];

    const byModule: Record<string, number> = {};
    for (const row of moduleRows) {
      byModule[row.moduleId as string] = Number(row.count);
    }`
);

// ============================================================================
// Step 22: Handle cleanupWorkHistory (three DELETE + changes)
// ============================================================================
content = content.replace(
  /\/\/ Delete old progress logs\n\s*this\.db!\.prepare\(`DELETE FROM task_progress_log WHERE createdAt < \?`\)\.run\(cutoff\);\n\s*const progressResult = this\.db!\.exec\(`SELECT changes\(\) as count`\);\n\s*const progressLogs = progressResult\.length > 0 \? Number\(progressResult\[0\]\.values\[0\]\[0\]\) : 0;\n\n\s*\/\/ Delete old work entries\n\s*this\.db!\.prepare\(`DELETE FROM work_entries WHERE timestamp < \?`\)\.run\(cutoff\);\n\s*const entriesResult = this\.db!\.exec\(`SELECT changes\(\) as count`\);\n\s*const entries = entriesResult\.length > 0 \? Number\(entriesResult\[0\]\.values\[0\]\[0\]\) : 0;\n\n\s*\/\/ Delete old sessions\n\s*this\.db!\.prepare\(`DELETE FROM work_sessions WHERE createdAt < \?`\)\.run\(cutoff\);\n\s*const sessionsResult = this\.db!\.exec\(`SELECT changes\(\) as count`\);\n\s*const sessions = sessionsResult\.length > 0 \? Number\(sessionsResult\[0\]\.values\[0\]\[0\]\) : 0;/,
  `// Delete old progress logs
    const progressInfo = this.db!.prepare(\`DELETE FROM task_progress_log WHERE createdAt < ?\`).run(cutoff);
    const progressLogs = progressInfo.changes;

    // Delete old work entries
    const entriesInfo = this.db!.prepare(\`DELETE FROM work_entries WHERE timestamp < ?\`).run(cutoff);
    const entries = entriesInfo.changes;

    // Delete old sessions
    const sessionsInfo = this.db!.prepare(\`DELETE FROM work_sessions WHERE createdAt < ?\`).run(cutoff);
    const sessions = sessionsInfo.changes;`
);

// ============================================================================
// Step 23: Handle cleanupClaudeSessions (two DELETE + changes)
// ============================================================================
content = content.replace(
  /this\.db!\.prepare\(\n\s*`DELETE FROM session_events WHERE claudeSessionId IN \(SELECT id FROM claude_sessions WHERE createdAt < \?\)`\n?\s*\)\.run\(cutoff\);\n\s*const eventsResult = this\.db!\.exec\(`SELECT changes\(\) as count`\);\n\s*const events = eventsResult\.length > 0 \? Number\(eventsResult\[0\]\.values\[0\]\[0\]\) : 0;\n\n\s*\/\/ Delete old sessions\n\s*this\.db!\.prepare\(`DELETE FROM claude_sessions WHERE createdAt < \?`\)\.run\(cutoff\);\n\s*const sessionsResult = this\.db!\.exec\(`SELECT changes\(\) as count`\);\n\s*const sessions = sessionsResult\.length > 0 \? Number\(sessionsResult\[0\]\.values\[0\]\[0\]\) : 0;/,
  `const eventsInfo = this.db!.prepare(
      \`DELETE FROM session_events WHERE claudeSessionId IN (SELECT id FROM claude_sessions WHERE createdAt < ?)\`
    ).run(cutoff);
    const events = eventsInfo.changes;

    // Delete old sessions
    const sessionsInfo = this.db!.prepare(\`DELETE FROM claude_sessions WHERE createdAt < ?\`).run(cutoff);
    const sessions = sessionsInfo.changes;`
);

// ============================================================================
// Step 24: Handle updateImpactAnalysis - mutation + changes check
// ============================================================================
content = content.replace(
  /this\.db!\.prepare\(`UPDATE impact_analyses SET \$\{sets\.join\(', '\)\} WHERE id = \?`\)\.run\(\.\.\.values\);\n\n\s*const result = this\.db!\.exec\(`SELECT changes\(\) as count`\);\n\s*return result\.length > 0 && Number\(result\[0\]\.values\[0\]\[0\]\) > 0;/,
  `const info = this.db!.prepare(\`UPDATE impact_analyses SET \${sets.join(', ')} WHERE id = ?\`).run(...values);
    return info.changes > 0;`
);

// Handle updateImpactValidation - mutation + changes check
content = content.replace(
  /this\.db!\.prepare\(`UPDATE impact_validations SET \$\{sets\.join\(', '\)\} WHERE id = \?`\)\.run\(\.\.\.values\);\n\n\s*const result = this\.db!\.exec\(`SELECT changes\(\) as count`\);\n\s*return result\.length > 0 && Number\(result\[0\]\.values\[0\]\[0\]\) > 0;/,
  `const info = this.db!.prepare(\`UPDATE impact_validations SET \${sets.join(', ')} WHERE id = ?\`).run(...values);
    return info.changes > 0;`
);

// ============================================================================
// Step 25: Handle buildResumeContext special extraction
// ============================================================================
content = content.replace(
  /const entriesResult = this\.db!\.exec\(\n\s*`SELECT actionName, details FROM work_entries WHERE sessionId = \? ORDER BY timestamp DESC LIMIT 20`,\n\s*\[session\.workSessionId\]\n\s*\);\n\n\s*if \(entriesResult\.length > 0\) \{\n\s*for \(const row of entriesResult\[0\]\.values\) \{\n\s*lastActions\.push\(row\[0\] as string\);\n\s*if \(row\[1\]\) \{\n\s*try \{\n\s*const details = JSON\.parse\(row\[1\] as string\);/,
  `const entryRows = this.db!.prepare(
        \`SELECT actionName, details FROM work_entries WHERE sessionId = ? ORDER BY timestamp DESC LIMIT 20\`
      ).all(session.workSessionId) as any[];

      for (const row of entryRows) {
        lastActions.push(row.actionName as string);
        if (row.details) {
          try {
            const details = JSON.parse(row.details as string);`
);

// Also fix the closing of the entries block
content = content.replace(
  /if \(details\.filePath\) \{\n\s*filesTouched\.push\(details\.filePath\);\n\s*\}\n\s*\} catch \{\}\n\s*\}\n\s*\}\n\s*\}\n\s*\}\n\n\s*\/\/ Get task progress if linked to task/,
  `if (details.filePath) {
                filesTouched.push(details.filePath);
              }
            } catch {}
          }
        }
      }
    }

    // Get task progress if linked to task`
);

// Handle taskProgress query in buildResumeContext
content = content.replace(
  /const progressResult = this\.db!\.exec\(\n\s*`SELECT progress FROM tasks WHERE id = \?`,\n\s*\[session\.taskId\]\n\s*\);\n\s*if \(progressResult\.length > 0 && progressResult\[0\]\.values\.length > 0\) \{\n\s*taskProgress = Number\(progressResult\[0\]\.values\[0\]\[0\]\);\n\s*\}/,
  `const progressRow = this.db!.prepare(
        \`SELECT progress FROM tasks WHERE id = ?\`
      ).get(session.taskId) as any;
      if (progressRow) {
        taskProgress = Number(progressRow.progress);
      }`
);

// ============================================================================
// Step 26: Handle getTestRoomSummary
// ============================================================================
content = content.replace(
  /const result = this\.db!\.exec\(`\n\s*SELECT\n\s*COUNT\(\*\) as total[\s\S]*?FROM test_items WHERE roomId = \?\n\s*`, \[roomId\]\);\n\n\s*if \(result\.length === 0 \|\| result\[0\]\.values\.length === 0\) \{\n\s*return \{ totalItems: 0, passedItems: 0, failedItems: 0, pendingItems: 0, skippedItems: 0, inProgressItems: 0 \};\n\s*\}\n\n\s*const row = result\[0\]\.values\[0\];\n\s*return \{\n\s*totalItems: Number\(row\[0\]\) \|\| 0,\n\s*passedItems: Number\(row\[1\]\) \|\| 0,\n\s*failedItems: Number\(row\[2\]\) \|\| 0,\n\s*pendingItems: Number\(row\[3\]\) \|\| 0,\n\s*skippedItems: Number\(row\[4\]\) \|\| 0,\n\s*inProgressItems: Number\(row\[5\]\) \|\| 0,\n\s*\};/,
  `const summaryRow = this.db!.prepare(\`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress
      FROM test_items WHERE roomId = ?
    \`).get(roomId) as any;

    if (!summaryRow) {
      return { totalItems: 0, passedItems: 0, failedItems: 0, pendingItems: 0, skippedItems: 0, inProgressItems: 0 };
    }

    return {
      totalItems: Number(summaryRow.total) || 0,
      passedItems: Number(summaryRow.passed) || 0,
      failedItems: Number(summaryRow.failed) || 0,
      pendingItems: Number(summaryRow.pending) || 0,
      skippedItems: Number(summaryRow.skipped) || 0,
      inProgressItems: Number(summaryRow.in_progress) || 0,
    };`
);

// ============================================================================
// Step 27: Handle getSpecTaskIds, getKnowledgeTaskIds, getSpecModuleIds, getKnowledgeModuleIds
// ============================================================================
content = content.replace(
  /const result = this\.db!\.exec\(\n\s*`SELECT DISTINCT taskId FROM task_spec_links WHERE specPath = \?`,\n\s*\[specPath\]\n\s*\);\n\s*if \(result\.length === 0\) return \[\];\n\n\s*return result\[0\]\.values\.map\(\(row: unknown\[\]\) => String\(row\[0\]\)\);/,
  `const rows = this.db!.prepare(\`SELECT DISTINCT taskId FROM task_spec_links WHERE specPath = ?\`).all(specPath) as any[];
    return rows.map(row => String(row.taskId));`
);

content = content.replace(
  /const result = this\.db!\.exec\(\n\s*`SELECT DISTINCT taskId FROM task_knowledge_links WHERE knowledgePath = \?`,\n\s*\[knowledgePath\]\n\s*\);\n\s*if \(result\.length === 0\) return \[\];\n\n\s*return result\[0\]\.values\.map\(\(row: unknown\[\]\) => String\(row\[0\]\)\);/,
  `const rows = this.db!.prepare(\`SELECT DISTINCT taskId FROM task_knowledge_links WHERE knowledgePath = ?\`).all(knowledgePath) as any[];
    return rows.map(row => String(row.taskId));`
);

content = content.replace(
  /const result = this\.db!\.exec\(\n\s*`SELECT DISTINCT moduleId FROM module_spec_links WHERE specPath = \?`,\n\s*\[specPath\]\n\s*\);\n\s*if \(result\.length === 0\) return \[\];\n\n\s*return result\[0\]\.values\.map\(\(row: unknown\[\]\) => String\(row\[0\]\)\);/,
  `const rows = this.db!.prepare(\`SELECT DISTINCT moduleId FROM module_spec_links WHERE specPath = ?\`).all(specPath) as any[];
    return rows.map(row => String(row.moduleId));`
);

content = content.replace(
  /const result = this\.db!\.exec\(\n\s*`SELECT DISTINCT moduleId FROM module_knowledge_links WHERE knowledgePath = \?`,\n\s*\[knowledgePath\]\n\s*\);\n\s*if \(result\.length === 0\) return \[\];\n\n\s*return result\[0\]\.values\.map\(\(row: unknown\[\]\) => String\(row\[0\]\)\);/,
  `const rows = this.db!.prepare(\`SELECT DISTINCT moduleId FROM module_knowledge_links WHERE knowledgePath = ?\`).all(knowledgePath) as any[];
    return rows.map(row => String(row.moduleId));`
);

// ============================================================================
// Step 28: Handle updateSkillSuccessRate
// ============================================================================
content = content.replace(
  /const result = this\.db!\.exec\(\n\s*`SELECT outcome, COUNT\(\*\) as count FROM training_feedback WHERE entityType = 'skill' AND entityId = \? GROUP BY outcome`,\n\s*\[skillId\]\n\s*\);\n\n\s*if \(result\.length === 0\) return;\n\n\s*let total = 0;\n\s*let helped = 0;\n\n\s*for \(const row of result\[0\]\.values\) \{\n\s*const outcome = row\[0\] as string;\n\s*const count = Number\(row\[1\]\);\n\s*total \+= count;\n\s*if \(outcome === 'helped'\) helped \+= count;\n\s*\}/,
  `const rows = this.db!.prepare(\`SELECT outcome, COUNT(*) as count FROM training_feedback WHERE entityType = 'skill' AND entityId = ? GROUP BY outcome\`).all(skillId) as any[];

    if (rows.length === 0) return;

    let total = 0;
    let helped = 0;

    for (const row of rows) {
      const outcome = row.outcome as string;
      const count = Number(row.count);
      total += count;
      if (outcome === 'helped') helped += count;
    }`
);

// ============================================================================
// Step 29: Handle countTickets
// ============================================================================
content = content.replace(
  /const result = this\.db!\.exec\(query, params\);\n\s*if \(result\.length === 0 \|\| result\[0\]\.values\.length === 0\) return 0;\n\n\s*return result\[0\]\.values\[0\]\[0\] as number;/,
  `const countRow = this.db!.prepare(query).get(...params) as any;
    return Number(countRow?.count) || 0;`
);

// Fix countTickets query to have alias
content = content.replace(
  /let query = `SELECT COUNT\(\*\) as count FROM tickets WHERE projectId = \?`;/,
  "let query = `SELECT COUNT(*) as count FROM tickets WHERE projectId = ?`;"
);

// ============================================================================
// Step 30: Handle isDismissed
// ============================================================================
content = content.replace(
  /const result = this\.db!\.exec\(\n\s*`SELECT COUNT\(\*\) as count FROM dismissed_suggestions WHERE taskId = \? AND suggestedPath = \?`,\n\s*\[taskId, suggestedPath\]\n\s*\);\n\s*return result\.length > 0 && Number\(result\[0\]\.values\[0\]\[0\]\) > 0;/,
  `const countRow = this.db!.prepare(\`SELECT COUNT(*) as count FROM dismissed_suggestions WHERE taskId = ? AND suggestedPath = ?\`).get(taskId, suggestedPath) as any;
    return (countRow?.count ?? 0) > 0;`
);

// ============================================================================
// Step 31: Handle getModuleLinks (outgoing/incoming)
// ============================================================================
content = content.replace(
  /const outgoingResult = this\.db!\.exec\(\n\s*`SELECT \* FROM module_links WHERE sourceModuleId = \? ORDER BY createdAt DESC`,\n\s*\[moduleId\]\n\s*\);\n\s*const outgoing = outgoingResult\.length > 0\n\s*\? outgoingResult\[0\]\.values\.map\(\(row: unknown\[\]\) => this\.rowToObject<ModuleLink>\(outgoingResult\[0\]\.columns, row\)\)\n\s*: \[\];\n\n\s*const incomingResult = this\.db!\.exec\(\n\s*`SELECT \* FROM module_links WHERE targetModuleId = \? ORDER BY createdAt DESC`,\n\s*\[moduleId\]\n\s*\);\n\s*const incoming = incomingResult\.length > 0\n\s*\? incomingResult\[0\]\.values\.map\(\(row: unknown\[\]\) => this\.rowToObject<ModuleLink>\(incomingResult\[0\]\.columns, row\)\)\n\s*: \[\];/,
  `const outgoing = this.db!.prepare(\`SELECT * FROM module_links WHERE sourceModuleId = ? ORDER BY createdAt DESC\`).all(moduleId) as ModuleLink[];
    const incoming = this.db!.prepare(\`SELECT * FROM module_links WHERE targetModuleId = ? ORDER BY createdAt DESC\`).all(moduleId) as ModuleLink[];`
);

// ============================================================================
// Step 32: Handle listTasksSmart (COUNT + paginated)
// ============================================================================
content = content.replace(
  /const countResult = this\.db!\.exec\(`SELECT COUNT\(\*\) FROM tasks WHERE \$\{whereClause\}`, params\);\n\s*const total = countResult\.length > 0 \? Number\(countResult\[0\]\.values\[0\]\[0\]\) : 0;/,
  `const countRow = this.db!.prepare(\`SELECT COUNT(*) as count FROM tasks WHERE \${whereClause}\`).get(...params) as any;
    const total = countRow?.count ?? 0;`
);

// Handle listTasksSmart paginated result
content = content.replace(
  /params\.push\(limit, offset\);\n\n\s*const result = this\.db!\.exec\(query, params\);\n\s*if \(result\.length === 0\) \{\n\s*return \{ tasks: \[\], total, hasMore: false \};\n\s*\}\n\n\s*const tasks = result\[0\]\.values\.map\(\(row: unknown\[\]\) =>\n\s*this\.rowToObject<Partial<Task>>\(result\[0\]\.columns, row\)\n\s*\);/,
  `const tasks = this.db!.prepare(query).all(...params, limit, offset) as Partial<Task>[];`
);

// ============================================================================
// Step 33: Handle updateTrainingSessionStats COUNT queries
// ============================================================================
content = content.replace(
  /\/\/ Count incidents\n\s*const incidentResult = this\.db!\.exec\(\n\s*`SELECT COUNT\(\*\) FROM incidents WHERE sessionId = \?`,\n\s*\[sessionId\]\n\s*\);\n\s*const totalIncidents = incidentResult\.length > 0 \? Number\(incidentResult\[0\]\.values\[0\]\[0\]\) : 0;/,
  `// Count incidents
    const incidentRow = this.db!.prepare(\`SELECT COUNT(*) as count FROM incidents WHERE sessionId = ?\`).get(sessionId) as any;
    const totalIncidents = incidentRow?.count ?? 0;`
);

content = content.replace(
  /\/\/ Count lessons\n\s*const lessonResult = this\.db!\.exec\(\n\s*`SELECT COUNT\(\*\) FROM lessons WHERE sessionId = \?`,\n\s*\[sessionId\]\n\s*\);\n\s*const totalLessons = lessonResult\.length > 0 \? Number\(lessonResult\[0\]\.values\[0\]\[0\]\) : 0;/,
  `// Count lessons
    const lessonRow = this.db!.prepare(\`SELECT COUNT(*) as count FROM lessons WHERE sessionId = ?\`).get(sessionId) as any;
    const totalLessons = lessonRow?.count ?? 0;`
);

content = content.replace(
  /\/\/ Count skills \(per project, not global\)\n\s*const skillResult = this\.db!\.exec\(\n\s*`SELECT COUNT\(\*\) FROM skills WHERE projectPath = \?`,\n\s*\[projectPath\]\n\s*\);\n\s*const totalSkills = skillResult\.length > 0 \? Number\(skillResult\[0\]\.values\[0\]\[0\]\) : 0;/,
  `// Count skills (per project, not global)
    const skillRow = this.db!.prepare(\`SELECT COUNT(*) as count FROM skills WHERE projectPath = ?\`).get(projectPath) as any;
    const totalSkills = skillRow?.count ?? 0;`
);

// ============================================================================
// Step 34: Handle getWorkHistory COUNT + paginated
// ============================================================================
content = content.replace(
  /\/\/ Get total count\n\s*const countResult = this\.db!\.exec\(`SELECT COUNT\(\*\) FROM work_entries WHERE \$\{whereClause\}`, params\);\n\s*const total = countResult\.length > 0 \? Number\(countResult\[0\]\.values\[0\]\[0\]\) : 0;\n\n\s*\/\/ Get paginated results\n\s*const offset = \(page - 1\) \* pageSize;\n\s*const result = this\.db!\.exec\(\n\s*`SELECT \* FROM work_entries WHERE \$\{whereClause\} ORDER BY timestamp DESC LIMIT \? OFFSET \?`,\n\s*\[\.\.\.params, pageSize, offset\]\n\s*\);\n\n\s*const entries = result\.length > 0\n\s*\? result\[0\]\.values\.map\(\(row: unknown\[\]\) => this\.rowToObject<WorkEntry>\(result\[0\]\.columns, row\)\)\n\s*: \[\];/,
  `// Get total count
    const countRow = this.db!.prepare(\`SELECT COUNT(*) as count FROM work_entries WHERE \${whereClause}\`).get(...params) as any;
    const total = countRow?.count ?? 0;

    // Get paginated results
    const offset = (page - 1) * pageSize;
    const entries = this.db!.prepare(
      \`SELECT * FROM work_entries WHERE \${whereClause} ORDER BY timestamp DESC LIMIT ? OFFSET ?\`
    ).all(...params, pageSize, offset) as WorkEntry[];`
);

// ============================================================================
// Step 35: Handle listClaudeSessions COUNT
// ============================================================================
content = content.replace(
  /\/\/ Get total count\n\s*const countResult = this\.db!\.exec\(`SELECT COUNT\(\*\) FROM claude_sessions WHERE \$\{whereClause\}`, params\);\n\s*const total = countResult\.length > 0 \? Number\(countResult\[0\]\.values\[0\]\[0\]\) : 0;/,
  `// Get total count
    const countRow = this.db!.prepare(\`SELECT COUNT(*) as count FROM claude_sessions WHERE \${whereClause}\`).get(...params) as any;
    const total = countRow?.count ?? 0;`
);

// ============================================================================
// Step 36: Handle migrateTasksToGovernance
// ============================================================================
content = content.replace(
  /\/\/ Get all tasks that don't have taskType set\n\s*const result = this\.db!\.exec\(\n\s*`SELECT \* FROM tasks WHERE taskType IS NULL OR taskType = ''`\n\s*\);\n\n\s*if \(result\.length === 0\) \{\n\s*return \{ migrated: 0, skipped: 0, errors: \[\] \};\n\s*\}\n\n\s*const tasks = result\[0\]\.values\.map\(\(row: unknown\[\]\) =>\n\s*this\.rowToObject<Task>\(result\[0\]\.columns, row\)\n\s*\);/,
  `// Get all tasks that don't have taskType set
    const tasks = this.db!.prepare(
      \`SELECT * FROM tasks WHERE taskType IS NULL OR taskType = ''\`
    ).all() as Task[];

    if (tasks.length === 0) {
      return { migrated: 0, skipped: 0, errors: [] };
    }`
);

// ============================================================================
// Step 37: Handle close() - remove save call
// ============================================================================
content = content.replace(
  /  close\(\): void \{\n\s*if \(this\.db\) \{\n\s*this\.save\(\);\n\s*this\.db\.close\(\);\n\s*this\.db = null;\n\s*this\.initialized = false;\n\s*\}\n\s*\}/,
  `  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }`
);

// ============================================================================
// Step 38: Handle getDB singleton - remove reload call
// ============================================================================
content = content.replace(
  /\/\/ Always check for external changes and reload if needed\n\s*\/\/ This ensures API server sees updates from MCP server, direct SQLite, etc\.\n\s*\/\/ The reload\(\) method is efficient - it only reloads if file mtime changed\n\s*dbInstance\.reload\(\);\n\n\s*return dbInstance;/,
  `return dbInstance;`
);

// ============================================================================
// Step 39: Remove exported reloadDB and forceReloadDB functions
// ============================================================================
content = content.replace(
  /\n\/\*\*\n \* Reload database from disk if modified externally \(e\.g\., by MCP server\)\n \* Returns true if database was reloaded\n \*\/\nexport async function reloadDB\(\): Promise<boolean> \{\n  if \(dbInstance\) \{\n    return dbInstance\.reload\(\);\n  \}\n  return false;\n\}\n\n\/\*\*\n \* Force reload database from disk regardless of modification time\n \*\/\nexport async function forceReloadDB\(\): Promise<void> \{\n  if \(dbInstance\) \{\n    dbInstance\.forceReload\(\);\n  \}\n\}\n?$/,
  '\n'
);

// ============================================================================
// Step 40: Handle remaining deleteTicket/deleteClaudeSession that just run+return true
// ============================================================================
// These were: this.db!.run(`DELETE FROM X WHERE id = ?`, [id]); this.save(); return true;
// After save removal they became: this.db!.prepare(`DELETE...`).run(id); \n    return true;
// That's already correct for better-sqlite3. No change needed.

// ============================================================================
// Step 41: Handle deleteIncident (checks existence, then deletes, calls updateStats)
// ============================================================================
// Already correct after mechanical transforms

// ============================================================================
// Final cleanup: Remove any remaining empty lines from save() removal
// ============================================================================
content = content.replace(/\n\n\n+/g, '\n\n');

// ============================================================================
// Verify
// ============================================================================
const remaining_run = (content.match(/this\.db!\.run\(/g) || []).length;
const remaining_exec_with_params = (content.match(/this\.db!\.exec\([^)]+,\s*[\[a-z]/g) || []).length;
const remaining_rowToObject = (content.match(/rowToObject/g) || []).length;
const remaining_changes = (content.match(/SELECT changes\(\)/g) || []).length;
const remaining_save = (content.match(/this\.save\(\)/g) || []).length;
const remaining_reload = (content.match(/\.reload\(\)/g) || []).length;
const remaining_forceReload = (content.match(/\.forceReload\(\)/g) || []).length;

console.log('Remaining this.db!.run():', remaining_run);
console.log('Remaining exec with params:', remaining_exec_with_params);
console.log('Remaining rowToObject:', remaining_rowToObject);
console.log('Remaining SELECT changes():', remaining_changes);
console.log('Remaining this.save():', remaining_save);
console.log('Remaining .reload():', remaining_reload);
console.log('Remaining .forceReload():', remaining_forceReload);

// Write out
fs.writeFileSync(path.join(__dirname, 'database.ts'), content, 'utf-8');
console.log('\nTransformed file written to database.ts');
console.log('Total lines:', content.split('\n').length);
