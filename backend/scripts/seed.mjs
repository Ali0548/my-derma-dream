import bcrypt from 'bcryptjs';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
const email = (process.env.ADMIN_EMAIL ?? 'abhai0548@gmail.com').toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? 'Lumora@Admin#2026$Kx9!';
const name = process.env.ADMIN_NAME ?? 'Abhai Admin';

if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

async function main() {
  const sql = postgres(url, { max: 1 });
  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await sql`
    SELECT id FROM users WHERE email = ${email} LIMIT 1
  `;

  if (existing.length > 0) {
    await sql`
      UPDATE users
      SET
        password_hash = ${passwordHash},
        name = ${name},
        role = 'admin',
        is_active = true,
        updated_at = now()
      WHERE email = ${email}
    `;
    console.log(`Updated admin user: ${email}`);
  } else {
    await sql`
      INSERT INTO users (email, password_hash, name, role, is_active)
      VALUES (${email}, ${passwordHash}, ${name}, 'admin', true)
    `;
    console.log(`Seeded admin user: ${email}`);
  }

  await sql.end({ timeout: 5 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
