const BASE_URL = 'http://localhost:8000/api';

export interface ApiOptions extends RequestInit {
  token?: string;
}

export async function apiClient<T = any>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const token = options.token || localStorage.getItem('careerlens_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith('http')
    ? endpoint
    : `${BASE_URL}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || data.detail || `HTTP Error ${res.status}`);
  }

  return data as T;
}