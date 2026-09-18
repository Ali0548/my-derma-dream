import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

async function main() {
  const sql = postgres(url, { max: 1 });

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
    const existing = await sql`
      SELECT id FROM "__drizzle_migrations" WHERE hash = ${file} LIMIT 1
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
      VALUES (${file}, ${Date.now()})
    `;
    console.log(`Applied ${file}`);
  }

  await sql.end({ timeout: 5 });
  console.log('Migrations complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
