import { connect, runMigrations } from './client';

const url = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/fnaf';
const h = connect(url);
await runMigrations(h);
console.log('Migrations applied.');
await h.close();
