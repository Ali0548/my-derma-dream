import { api } from './client';
import type { AuthUser } from './auth';

export type UserRow = AuthUser & {
  updatedAt?: string;
};

export const usersApi = {
  list: () => api.get<UserRow[]>('/users'),
  getById: (id: string) => api.get<UserRow>(`/users/${id}`),
};
