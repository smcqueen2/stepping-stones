import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import type { SQLInputValue } from 'node:sqlite';

/** Real SQLite executes the production migration and SQL, rather than imitating their results. */
export function reportsDatabase() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync('workers/reports/migrations/0001_observations.sql', 'utf8'));
  return {
    sqlite,
    prepare(sql: string) {
      const statement = sqlite.prepare(sql);
      return { bind: (...values: SQLInputValue[]) => ({
        all: async () => ({ success: true, results: statement.all(...values) }),
        first: async () => statement.get(...values) ?? null,
        run: async () => ({ success: true, meta: statement.run(...values) }),
      }) };
    },
  };
}
