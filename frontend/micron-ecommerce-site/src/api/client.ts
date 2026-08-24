import { type ApiError } from '../types/api-types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export const getAuthToken = (): string | null => localStorage.getItem('aura_auth_token');

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as ApiError;
    throw new Error(errorData.error || `HTTP Error ${response.status}`);
  }

  return data as T;
}