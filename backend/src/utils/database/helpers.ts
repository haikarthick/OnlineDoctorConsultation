/**
 * Summarize query params for logging without leaking values - params can carry
 * medical notes, prescriptions, or other patient/contact data.
 */
export function describeParams(params?: any[]): Array<{ type: string; length?: number }> | undefined {
  if (!params) return undefined;
  return params.map((p) => {
    if (p === null || p === undefined) return { type: 'null' };
    if (typeof p === 'string') return { type: 'string', length: p.length };
    if (Array.isArray(p)) return { type: 'array', length: p.length };
    return { type: typeof p };
  });
}

/** Split multi-statement SQL respecting dollar-quoted function bodies ($$...$$) */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inDollarQuote = false;
  let dollarTag = '';

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    current += ch;

    // Detect start/end of dollar-quoting
    if (ch === '$' && !inDollarQuote) {
      const match = sql.slice(i).match(/^\$([^$]*)\$/);
      if (match) {
        inDollarQuote = true;
        dollarTag = match[0];
        current += match[0].slice(1);
        i += match[0].length - 1;
      }
    } else if (inDollarQuote && sql.slice(i).startsWith(dollarTag)) {
      current += dollarTag.slice(1);
      i += dollarTag.length - 1;
      inDollarQuote = false;
      dollarTag = '';
    } else if (!inDollarQuote && ch === ';') {
      const stmt = current.trim();
      if (stmt && stmt !== ';') {
        statements.push(stmt);
      }
      current = '';
    }
  }
  const remaining = current.trim();
  if (remaining && remaining !== ';') statements.push(remaining);
  return statements;
}
