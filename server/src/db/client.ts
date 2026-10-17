import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from './schema';

export type Db = PostgresJsDatabase<typeof schema>;

export interface DbHandle {
  db: Db;
  sql: postgres.Sql;
  close(): Promise<void>;
}

export function connect(url: string): DbHandle {
  const sql = postgres(url, { max: 10, onnotice: () => {} });
  const db = drizzle(sql, { schema });
  return { db, sql, close: () => sql.end({ timeout: 5 }) };
}

/** Migrations ship next to the bundle in production, and live in src/db/migrations in dev. */
export function migrationsFolder(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [join(here, 'migrations'), join(here, '../db/migrations'), join(here, 'db/migrations'), join(process.cwd(), 'server/src/db/migrations')];
  const found = candidates.find((c) => existsSync(join(c, 'meta/_journal.json')));
  if (!found) throw new Error(`Couldn't find Drizzle migrations (looked in ${candidates.join(', ')})`);
  return found;
}

export async function runMigrations(h: DbHandle): Promise<void> {
  await migrate(h.db, { migrationsFolder: migrationsFolder() });
}
