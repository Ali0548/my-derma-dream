import { eq } from 'drizzle-orm';
import { env } from '../config/env.js';
import { db, pgClient } from './client.js';
import { users } from './schema/index.js';
import { hashPassword } from '../utils/password.js';

async function seed() {
  const passwordHash = await hashPassword(env.ADMIN_PASSWORD);

  const adminEmail = env.ADMIN_EMAIL.toLowerCase();

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, adminEmail))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(users)
      .set({
        passwordHash,
        name: env.ADMIN_NAME,
        role: 'admin',
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(users.email, adminEmail));

    console.log(`Updated admin user: ${adminEmail}`);
  } else {
    await db.insert(users).values({
      email: adminEmail,
      passwordHash,
      name: env.ADMIN_NAME,
      role: 'admin',
      isActive: true,
    });

    console.log(`Seeded admin user: ${adminEmail}`);
  }

  await pgClient.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
