import axios, { AxiosError, type AxiosRequestConfig } from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api';

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('lumora_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export type ApiErrorBody = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
};

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function toApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const ax = error as AxiosError<ApiErrorBody>;
    const payload = ax.response?.data;
    return new ApiError(
      payload?.error?.message ?? ax.message ?? 'Request failed',
      payload?.error?.code ?? 'REQUEST_FAILED',
      ax.response?.status ?? 500,
      payload?.error?.details,
    );
  }

  return new ApiError('Unexpected error', 'UNEXPECTED', 500);
}

export async function apiRequest<T>(config: AxiosRequestConfig): Promise<ApiSuccess<T>> {
  try {
    const response = await apiClient.request<ApiSuccess<T>>(config);
    return response.data;
  } catch (error) {
    throw toApiError(error);
  }
}

export const api = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    apiRequest<T>({ ...config, method: 'GET', url }),
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    apiRequest<T>({ ...config, method: 'POST', url, data }),
  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    apiRequest<T>({ ...config, method: 'PUT', url, data }),
  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    apiRequest<T>({ ...config, method: 'PATCH', url, data }),
  delete: <T>(url: string, config?: AxiosRequestConfig) =>
    apiRequest<T>({ ...config, method: 'DELETE', url }),
};
