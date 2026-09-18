import { eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { users, type User } from '../../db/schema/index.js';
import { AppError } from '../../errors/AppError.js';
import { verifyPassword } from '../../utils/password.js';
import { signToken } from '../../utils/jwt.js';
import type { LoginInput } from './auth.validation.js';

function toPublicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

export class AuthService {
  async login(input: LoginInput) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, input.email.toLowerCase()))
      .limit(1);

    if (!user || !user.isActive) {
      throw AppError.unauthorized('Invalid email or password');
    }

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      throw AppError.unauthorized('Invalid email or password');
    }

    const token = signToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      token,
      user: toPublicUser(user),
    };
  }

  async me(userId: string) {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user || !user.isActive) {
      throw AppError.unauthorized();
    }

    return toPublicUser(user);
  }
}

export const authService = new AuthService();
