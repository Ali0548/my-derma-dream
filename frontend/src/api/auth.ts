import { api } from './client';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
};

export type LoginResponse = {
  token: string;
  user: AuthUser;
};

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password }),
  me: () => api.get<AuthUser>('/auth/me'),
};
