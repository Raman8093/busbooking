const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('busbooker_token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };

  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (response.status === 401 && token) {
    clearSession();
    window.dispatchEvent(new CustomEvent('busbooker:unauthorized', { detail: data.message || 'Session expired' }));
  }

  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}

export function saveSession(session) {
  localStorage.setItem('busbooker_token', session.token);
  localStorage.setItem('busbooker_user', JSON.stringify(session.user));
}

export function clearSession() {
  localStorage.removeItem('busbooker_token');
  localStorage.removeItem('busbooker_user');
}

export function getSavedUser() {
  try { return JSON.parse(localStorage.getItem('busbooker_user')); } catch { return null; }
}

