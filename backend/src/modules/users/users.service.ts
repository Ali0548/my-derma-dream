import { desc, eq } from 'drizzle-orm';
import { cache, cached, CacheKeys } from '../../cache/index.js';
import { db } from '../../db/client.js';
import { users } from '../../db/schema/index.js';
import { AppError } from '../../errors/AppError.js';

function toPublicUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export class UsersService {
  async list() {
    const { data, fromCache } = await cached(CacheKeys.usersList, async () => {
      const rows = await db.select().from(users).orderBy(desc(users.createdAt));
      return rows.map(toPublicUser);
    });

    return { users: data, fromCache };
  }

  async getById(id: string) {
    const cacheKey = CacheKeys.user(id);
    const { data, fromCache } = await cached(cacheKey, async () => {
      const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      if (!user) {
        throw AppError.notFound('User not found');
      }
      return toPublicUser(user);
    });

    return { user: data, fromCache };
  }
}

export const usersService = new UsersService();

export async function invalidateUsersCache() {
  await cache.del(CacheKeys.usersList);
  await cache.delByPrefix('users:');
}
