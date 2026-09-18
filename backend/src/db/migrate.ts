import 'dotenv/config';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';
import { env } from '../config/env.js';

async function run() {
  const sql = postgres(env.DATABASE_URL, { max: 1 });

  await sql`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id serial PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;

  const migrationsDir = join(process.cwd(), 'drizzle');
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const hash = file;
    const existing = await sql`
      SELECT id FROM "__drizzle_migrations" WHERE hash = ${hash} LIMIT 1
    `;

    if (existing.length > 0) {
      console.log(`Skipping ${file}`);
      continue;
    }

    const content = readFileSync(join(migrationsDir, file), 'utf8');
    console.log(`Applying ${file}...`);
    await sql.unsafe(content);
    await sql`
      INSERT INTO "__drizzle_migrations" (hash, created_at)
      VALUES (${hash}, ${Date.now()})
    `;
    console.log(`Applied ${file}`);
  }

  await sql.end();
  console.log('Migrations complete.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
