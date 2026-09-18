import postgres from 'postgres';

const url = process.env.DATABASE_URL ?? 'postgresql://lumora:lumora@localhost:5432/lumora';

async function main() {
  const sql = postgres(url, { max: 1 });
  try {
    const rows = await sql`select current_database() as db, current_user as user`;
    console.log('CONNECTED', rows[0]);
  } catch (err) {
    console.error('FAIL', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 1 });
  }
}

void main();
