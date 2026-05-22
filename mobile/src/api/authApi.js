import { apiRequest, setToken, clearToken } from './http';

export async function login(identifier, password, role) {
  const body = { identifier, password };
  if (role) body.role = role;
  const data = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (data.token) await setToken(data.token);
  return data;
}

export async function getMe() {
  return apiRequest('/api/auth/me');
}

export async function logout() {
  try {
    await apiRequest('/api/auth/logout', { method: 'POST' });
  } finally {
    await clearToken();
  }
}
