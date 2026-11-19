import { parseContract, findMigrationsDir } from '../../src/utils/database/schemaContract';
import * as fs from 'fs';
import * as path from 'path';

describe('schema contract', () => {
  it('reads the columns and tables a migration promises', () => {
    const { columns, tables } = parseContract([{ name: '053.sql', sql:
      `-- c\nALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS state VARCHAR(80);\nCREATE TABLE IF NOT EXISTS foo (id int);` }]);
    expect(columns.map(c => `${c.table}.${c.column}`)).toEqual(['marketplace_listings.state']);
    expect(tables).toEqual(['foo']);
  });
  it('ignores a column a later migration drops', () => {
    const { columns } = parseContract([
      { name: '1.sql', sql: 'ALTER TABLE t ADD COLUMN IF NOT EXISTS old_col INT;' },
      { name: '2.sql', sql: 'ALTER TABLE t DROP COLUMN IF EXISTS old_col;' }]);
    expect(columns).toHaveLength(0);
  });
  it('finds the real migrations folder and the 053 state column in it', () => {
    const dir = findMigrationsDir();
    expect(dir).toBeTruthy();
    const files = fs.readdirSync(dir!).filter(f => f.endsWith('.sql')).map(name => ({ name, sql: fs.readFileSync(path.join(dir!, name), 'utf8') }));
    const { columns } = parseContract(files);
    expect(columns.some(c => c.table === 'marketplace_listings' && c.column === 'state')).toBe(true);
  });
});

import { checkSchemaContract } from '../../src/utils/database/schemaContract';

describe('checkSchemaContract against a database missing a column', () => {
  function fakePool(initial: string[]) {
    const cols = new Set(initial);
    const ran: string[] = [];
    const client = {
      query: async (sql: string) => {
        if (/information_schema\.columns/.test(sql)) {
          return { rows: [...cols].map(k => { const [t, c] = k.split('.'); return { table_name: t, column_name: c }; }) };
        }
        ran.push(sql);
        const m = /ADD COLUMN IF NOT EXISTS (\w+)/i.exec(sql); const t = /ALTER TABLE (?:IF EXISTS )?(?:public\.)?(\w+)/i.exec(sql);
        if (m && t) cols.add(`${t[1]}.${m[1]}`);
        return { rows: [] };
      },
      release: () => undefined,
    };
    return { pool: { connect: async () => client } as any, ran };
  }

  it('re-applies the missing column and reports it healed (the 2026-11-19 failure)', async () => {
    const { pool } = fakePool(['marketplace_listings.id']);
    const r = await checkSchemaContract(pool);
    expect(r.healed).toContain('marketplace_listings.state');
    expect(r.missingColumns).not.toContain('marketplace_listings.state');
  });

  it('reports drift without healing when heal is off', async () => {
    const { pool, ran } = fakePool(['marketplace_listings.id']);
    const r = await checkSchemaContract(pool, { heal: false });
    expect(r.missingColumns).toContain('marketplace_listings.state');
    expect(ran).toHaveLength(0);
  });
});
