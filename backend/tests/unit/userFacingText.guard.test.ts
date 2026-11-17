import fs from 'fs';
import path from 'path';

/**
 * HARNESS RULE H4 (docs/HARNESS.md), server side: text that goes back to a person must never be
 * developer setup ("set GROQ_API_KEY in your .env and restart"). The AI assistant did exactly that
 * to a farmer. The technical detail belongs in the log; the person gets what happened, why, and
 * what they can do next.
 *
 * Scans the fields a response puts in front of people (message / content / error / userMessage /
 * hint) for environment-variable and .env wording. A line that only logs is fine.
 */
const SRC = path.join(__dirname, '../../src');
const FORBIDDEN = /(\.env\b|_API_KEY|_SECRET\b|restart the backend|backend environment|set the [A-Z][A-Z_]{3,} )/;
const FIELD = /\b(message|content|error|userMessage|hint)\s*:\s*[`'"]/;

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? files(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : []);
}

describe('text shown to people', () => {
  it('scans the backend sources', () => {
    expect(files(SRC).length).toBeGreaterThan(100);
  });

  it('never tells a person to edit .env, set an API key or restart the backend', () => {
    const offenders: string[] = [];
    for (const file of files(SRC)) {
      fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (/logger\.|console\.|guard-ok|^\s*(\/\/|\*)/.test(line)) return;
        if (FIELD.test(line) && FORBIDDEN.test(line)) {
          offenders.push(`${path.relative(SRC, file)}:${i + 1}: ${line.trim().slice(0, 120)}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
