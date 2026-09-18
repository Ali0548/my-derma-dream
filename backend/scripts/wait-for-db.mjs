import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const maxAttempts = 60;

async function main() {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const sql = postgres(url, { max: 1, connect_timeout: 3 });
    try {
      await sql`select 1`;
      await sql.end({ timeout: 1 });
      console.log(`Database ready (attempt ${attempt})`);
      return;
    } catch (err) {
      await sql.end({ timeout: 1 }).catch(() => undefined);
      console.log(
        `Database not ready (${attempt}/${maxAttempts}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.error('Database did not become ready in time');
  process.exit(1);
}

void main();
