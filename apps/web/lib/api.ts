'use client';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export async function api(path: string, init: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(init.headers as Record<string, string> || {}),
  };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'request failed');
  }
  if (res.status === 204) return null;
  return res.json();
}