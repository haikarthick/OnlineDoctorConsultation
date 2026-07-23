#!/usr/bin/env node
/**
 * Schema Validation Script
 * ────────────────────────
 * Catches column mismatches BEFORE deployment by cross-referencing:
 *   1. Table definitions in docker/init.sql
 *   2. ALTER TABLE ADD COLUMN statements in database.ts
 *   3. INSERT INTO statements across all backend services
 *
 * Run: node backend/scripts/schema-check.js
 *   or: npm run schema-check (from backend/)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const INIT_SQL = path.join(ROOT, 'docker', 'init.sql');
const DB_UTILS = path.join(ROOT, 'backend', 'src', 'utils', 'database.ts');
const SERVICES_DIR = path.join(ROOT, 'backend', 'src', 'services');
const CONTROLLERS_DIR = path.join(ROOT, 'backend', 'src', 'controllers');

let errors = 0;
let warnings = 0;

const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

// ── Step 1: Parse CREATE TABLE definitions from init.sql ────

function parseInitSql(filePath) {
  const sql = fs.readFileSync(filePath, 'utf-8');
  const tables = {};

  // Match CREATE TABLE IF NOT EXISTS <name> ( ... );
  const tableRegex = /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)\s*\(([\s\S]*?)\);/gi;
  let match;
  while ((match = tableRegex.exec(sql)) !== null) {
    const tableName = match[1].toLowerCase();
    const body = match[2];
    const columns = new Set();

    // Extract column names (first word on each line that isn't a constraint keyword)
    const lines = body.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('--')) continue;
      // Skip constraint lines (UNIQUE followed by ( is a table constraint, not a column)
      if (/^(PRIMARY\s+KEY|UNIQUE\s*\(|CHECK\s*\(|CONSTRAINT\s|FOREIGN\s+KEY|INDEX)/i.test(trimmed)) continue;
      // Extract column name (first identifier)
      const colMatch = trimmed.match(/^(\w+)\s+/);
      if (colMatch) {
        const colName = colMatch[1].toLowerCase();
        // Skip SQL keywords that might appear at start of line
        if (['primary', 'unique', 'check', 'constraint', 'foreign', 'index', 'create', 'on', 'references'].includes(colName)) continue;
        columns.add(colName);
      }
    }
    tables[tableName] = columns;
  }
  return tables;
}

// ── Step 2: Parse ALTER TABLE ADD COLUMN from database.ts ───

function parseAlterColumns(filePath, tables) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf-8');

  // Match: ALTER TABLE <table> ADD COLUMN IF NOT EXISTS <column>
  const alterRegex = /ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+(\w+)/gi;
  let match;
  while ((match = alterRegex.exec(content)) !== null) {
    const table = match[1].toLowerCase();
    const column = match[2].toLowerCase();
    if (!tables[table]) {
      tables[table] = new Set();
    }
    tables[table].add(column);
  }
}

// ── Step 3: Parse migration files for additional tables ─────

function parseMigrations(migrationsDir, tables) {
  if (!fs.existsSync(migrationsDir)) return;
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    const tableRegex = /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)\s*\(([\s\S]*?)\);/gi;
    let match;
    while ((match = tableRegex.exec(sql)) !== null) {
      const tableName = match[1].toLowerCase();
      const body = match[2];
      if (!tables[tableName]) tables[tableName] = new Set();
      const lines = body.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('--')) continue;
        if (/^(PRIMARY\s+KEY|UNIQUE\s*\(|CHECK\s*\(|CONSTRAINT\s|FOREIGN\s+KEY|INDEX)/i.test(trimmed)) continue;
        const colMatch = trimmed.match(/^(\w+)\s+/);
        if (colMatch) {
          const colName = colMatch[1].toLowerCase();
          if (!['primary', 'unique', 'check', 'constraint', 'foreign', 'index', 'create', 'on', 'references'].includes(colName)) {
            tables[tableName].add(colName);
          }
        }
      }
    }

    // Also parse ALTER TABLE ADD COLUMN in migrations
    const alterRegex = /ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi;
    let altMatch;
    while ((altMatch = alterRegex.exec(sql)) !== null) {
      const table = altMatch[1].toLowerCase();
      const column = altMatch[2].toLowerCase();
      if (!tables[table]) tables[table] = new Set();
      tables[table].add(column);
    }
  }
}

// ── Step 4: Scan services for INSERT INTO statements ────────

function scanInsertStatements(dir) {
  const inserts = [];
  if (!fs.existsSync(dir)) return inserts;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));

  for (const file of files) {
    const filePath = path.join(dir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Find INSERT INTO statements (may span multiple lines)
    // We join the full content and use regex
    const insertRegex = /INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)/gi;
    let match;
    while ((match = insertRegex.exec(content)) !== null) {
      const table = match[1].toLowerCase();
      const columnsRaw = match[2];
      const columns = columnsRaw
        .split(',')
        .map(c => c.trim().toLowerCase())
        .filter(c => c && !c.startsWith('$') && !c.startsWith('--'));

      // Find line number
      const beforeMatch = content.substring(0, match.index);
      const lineNumber = beforeMatch.split('\n').length;

      inserts.push({
        file: path.relative(ROOT, filePath),
        line: lineNumber,
        table,
        columns,
      });
    }
  }
  return inserts;
}

// ── Step 5: Cross-reference and report ──────────────────────

function validate(tables, inserts) {
  console.log(`\n${CYAN}━━━ VetCare Schema Validation ━━━${RESET}\n`);
  console.log(`${DIM}Tables found in schema:${RESET} ${Object.keys(tables).length}`);
  console.log(`${DIM}INSERT statements found:${RESET} ${inserts.length}\n`);

  const mismatches = [];

  for (const insert of inserts) {
    const tableSchema = tables[insert.table];
    if (!tableSchema) {
      // Table doesn't exist at all — could be created by tier migrations
      continue;
    }

    for (const col of insert.columns) {
      if (!tableSchema.has(col)) {
        mismatches.push({
          file: insert.file,
          line: insert.line,
          table: insert.table,
          column: col,
        });
      }
    }
  }

  if (mismatches.length === 0) {
    console.log(`${GREEN}✓ All INSERT columns match their table schemas${RESET}\n`);
    return 0;
  }

  console.log(`${RED}✗ Found ${mismatches.length} column mismatch(es):${RESET}\n`);

  // Group by file for readability
  const byFile = {};
  for (const m of mismatches) {
    if (!byFile[m.file]) byFile[m.file] = [];
    byFile[m.file].push(m);
  }

  for (const [file, items] of Object.entries(byFile)) {
    console.log(`  ${YELLOW}${file}${RESET}`);
    for (const item of items) {
      console.log(`    ${RED}Line ${item.line}:${RESET} column "${item.column}" does not exist in table "${item.table}"`);
      console.log(`    ${DIM}Fix: Add column to docker/init.sql AND backend/src/utils/database.ts${RESET}`);
    }
    console.log('');
  }

  return mismatches.length;
}

// ── Step 6: Check for UPDATE references to missing columns ──

function scanUpdateStatements(dir, tables) {
  const problems = [];
  if (!fs.existsSync(dir)) return problems;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));

  for (const file of files) {
    const filePath = path.join(dir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Match: UPDATE <table> SET <col> = ...
    const updateRegex = /UPDATE\s+(\w+)\s+SET\s+([\s\S]*?)(?:WHERE|RETURNING|$)/gi;
    let match;
    while ((match = updateRegex.exec(content)) !== null) {
      const table = match[1].toLowerCase();
      const setClause = match[2];
      const tableSchema = tables[table];
      if (!tableSchema) continue;

      // Extract column names from SET clause (col = $N patterns)
      const colRegex = /(\w+)\s*=/g;
      let colMatch;
      while ((colMatch = colRegex.exec(setClause)) !== null) {
        const col = colMatch[1].toLowerCase();
        // Skip SQL noise and JS variable names commonly used in dynamic query building
        if (['set', 'and', 'or', 'not', 'null', 'true', 'false', 'now', 'current_timestamp', 'excluded',
             'idx', 'paramidx', 'i', 'j', 'n', 'let', 'const', 'var', 'fields', 'sql'].includes(col)) continue;
        if (col.startsWith('$')) continue;
        // Skip if it looks like a JS number assignment (e.g., idx = 2)
        const afterEq = setClause.substring(colMatch.index + colMatch[0].length).trim();
        if (/^\d+/.test(afterEq)) continue;
        if (!tableSchema.has(col)) {
          const beforeMatch = content.substring(0, match.index);
          const lineNumber = beforeMatch.split('\n').length;
          problems.push({
            file: path.relative(ROOT, filePath),
            line: lineNumber,
            table,
            column: col,
            type: 'UPDATE',
          });
        }
      }
    }
  }
  return problems;
}

// ── Step 7: Check for forward FK references in init.sql ─────

function checkFkOrder(filePath) {
  const sql = fs.readFileSync(filePath, 'utf-8');
  const lines = sql.split('\n');

  // Track table definition order (line number each table is first defined)
  const tableDefinedAtLine = {};
  const forwardFkErrors = [];

  // First pass: find line number of each CREATE TABLE
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)/i);
    if (m) {
      const tbl = m[1].toLowerCase();
      if (!tableDefinedAtLine[tbl]) {
        tableDefinedAtLine[tbl] = i + 1; // 1-based
      }
    }
  }

  // Second pass: find REFERENCES inside each CREATE TABLE block,
  // check that the referenced table was already defined before the current table
  let currentTable = null;
  let currentTableLine = 0;
  for (let i = 0; i < lines.length; i++) {
    const createMatch = lines[i].match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)/i);
    if (createMatch) {
      currentTable = createMatch[1].toLowerCase();
      currentTableLine = i + 1;
    }
    if (!currentTable) continue;

    // Look for REFERENCES <table>
    const refMatch = lines[i].match(/REFERENCES\s+(\w+)\s*\(/i);
    if (refMatch) {
      const refTable = refMatch[1].toLowerCase();
      if (refTable === currentTable) continue; // self-ref OK
      const refDefinedAt = tableDefinedAtLine[refTable];
      if (refDefinedAt !== undefined && refDefinedAt > currentTableLine) {
        forwardFkErrors.push({
          table: currentTable,
          tableDefinedAt: currentTableLine,
          referencesTable: refTable,
          referencesDefinedAt: refDefinedAt,
          onLine: i + 1,
        });
      }
    }
  }

  return forwardFkErrors;
}

// ── Check for banned SQL patterns ────────────────────────────
// uuid_generate_v4() requires the uuid-ossp extension, and Render's managed
// PostgreSQL runs the app as a restricted (non-superuser) role — CREATE
// EXTENSION always fails there. This has caused two separate production
// incidents (see memories/repo/past-bugs.md, memories/repo/lessons.md
// LESSON-001): once when it aborted init.sql entirely (zero tables
// created), and once when it silently failed two migrations for an
// unknown length of time (the migration runner used to catch and log a
// warning rather than fail — see the MIGRATIONS_FAIL_FAST fix). Always use
// gen_random_uuid() (built into PostgreSQL 13+ core, no extension needed).
function checkBannedSqlPatterns() {
  const violations = [];
  const BANNED = [
    { pattern: /uuid_generate_v4\s*\(/i, name: 'uuid_generate_v4()', fix: 'gen_random_uuid()' },
    { pattern: /CREATE\s+EXTENSION/i, name: 'CREATE EXTENSION', fix: 'nothing — Render managed PostgreSQL does not permit CREATE EXTENSION; use only functions built into PostgreSQL core (gen_random_uuid(), etc.)' },
  ];

  const sqlDirs = [
    path.join(ROOT, 'docker'),
    path.join(ROOT, 'backend', 'migrations'),
  ];

  function walkSqlFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...walkSqlFiles(full));
      else if (entry.name.endsWith('.sql')) out.push(full);
    }
    return out;
  }

  const files = sqlDirs.flatMap(walkSqlFiles);
  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf-8').split('\n');
    lines.forEach((line, idx) => {
      // cube/earthdistance/pgcrypto etc. ARE allowed — Render permits some
      // extensions via CASCADE for the app role; only the pattern name
      // itself is banned when it's specifically uuid-ossp/uuid_generate_v4.
      if (/CREATE\s+EXTENSION/i.test(line) && !/uuid-ossp/i.test(line)) return;
      for (const banned of BANNED) {
        if (banned.pattern.test(line)) {
          violations.push({
            file: path.relative(ROOT, file),
            line: idx + 1,
            found: banned.name,
            fix: banned.fix,
            text: line.trim(),
          });
        }
      }
    });
  }
  return violations;
}

function main() {
  console.log(`\n${CYAN}🔍 Running pre-deployment schema validation...${RESET}`);

  // Parse all schema sources
  const tables = parseInitSql(INIT_SQL);
  parseAlterColumns(DB_UTILS, tables);
  parseMigrations(path.join(ROOT, 'backend', 'migrations'), tables);

  // Scan all service and controller files for SQL
  const inserts = [
    ...scanInsertStatements(SERVICES_DIR),
    ...scanInsertStatements(CONTROLLERS_DIR),
  ];

  // Validate INSERT columns
  const insertErrors = validate(tables, inserts);

  // Validate UPDATE columns
  const updateProblems = scanUpdateStatements(SERVICES_DIR, tables);
  if (updateProblems.length > 0) {
    console.log(`${RED}✗ Found ${updateProblems.length} UPDATE column mismatch(es):${RESET}\n`);
    const byFile = {};
    for (const m of updateProblems) {
      if (!byFile[m.file]) byFile[m.file] = [];
      byFile[m.file].push(m);
    }
    for (const [file, items] of Object.entries(byFile)) {
      console.log(`  ${YELLOW}${file}${RESET}`);
      for (const item of items) {
        console.log(`    ${RED}Line ${item.line}:${RESET} UPDATE sets column "${item.column}" — not in table "${item.table}"`);
      }
      console.log('');
    }
  }

  // Check for forward FK references (table defined after the table that references it)
  const fkErrors = checkFkOrder(INIT_SQL);
  if (fkErrors.length > 0) {
    console.log(`\n${RED}✗ Found ${fkErrors.length} forward FK reference(s) in init.sql:${RESET}\n`);
    for (const e of fkErrors) {
      console.log(`  ${RED}Line ${e.onLine}:${RESET} Table "${e.table}" (defined line ${e.tableDefinedAtLine}) REFERENCES "${e.referencesTable}" (defined line ${e.referencesDefinedAt})`);
      console.log(`  ${DIM}  Fix: Move "${e.referencesTable}" CREATE TABLE to BEFORE line ${e.tableDefinedAtLine} in init.sql${RESET}`);
    }
    console.log('');
  } else {
    console.log(`${GREEN}✓ No forward FK references in init.sql${RESET}\n`);
  }

  // Check for banned SQL patterns (uuid_generate_v4, CREATE EXTENSION "uuid-ossp")
  const bannedViolations = checkBannedSqlPatterns();
  if (bannedViolations.length > 0) {
    console.log(`\n${RED}✗ Found ${bannedViolations.length} banned SQL pattern(s):${RESET}\n`);
    for (const v of bannedViolations) {
      console.log(`  ${YELLOW}${v.file}:${v.line}${RESET}`);
      console.log(`    ${RED}${v.found}${RESET} — ${DIM}${v.text}${RESET}`);
      console.log(`    ${DIM}Fix: use ${v.fix}${RESET}\n`);
    }
  } else {
    console.log(`${GREEN}✓ No banned SQL patterns (uuid_generate_v4, CREATE EXTENSION uuid-ossp)${RESET}\n`);
  }

  // Summary
  const totalErrors = insertErrors + updateProblems.length + fkErrors.length + bannedViolations.length;
  if (totalErrors > 0) {
    console.log(`${RED}━━━ FAILED: ${totalErrors} schema error(s) found ━━━${RESET}`);
    console.log(`${DIM}Fix all errors before deploying. Every column in an INSERT/UPDATE must exist in docker/init.sql or a migration.${RESET}\n`);
    process.exit(1);
  } else {
    console.log(`${GREEN}━━━ PASSED: Schema validation complete ━━━${RESET}\n`);
    process.exit(0);
  }
}

main();
