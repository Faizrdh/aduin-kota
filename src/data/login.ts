/* eslint-disable */
// src/data/login.ts

import {
  getAccessToken,
  setAccessToken,
  clearAccessToken,
  apiFetch,           // ← tambah ini
} from "@/lib/apiFetch";

// Re-export supaya komponen lain yang import dari sini tetap bisa pakai
export { getAccessToken, setAccessToken, clearAccessToken };

// ✅ Re-export authFetch sebagai alias apiFetch
// → file lain yang import { authFetch } from "@/data/login" tidak perlu diubah
export { apiFetch as authFetch };

const API = "/api/auth";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface AuthUser {
  id:      string;
  name:    string;
  email:   string;
  role:    string;
  city:    string;
  avatar?: string;
}

// ─── authenticate (login) ─────────────────────────────────────────────────────
export async function authenticate(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API}/login`, {
    method:      "POST",
    headers:     { "Content-Type": "application/json" },
    body:        JSON.stringify({ email, password }),
    credentials: "include",
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Login gagal.");

  setAccessToken(json.accessToken);
  return json.user as AuthUser;
}

// ─── register ─────────────────────────────────────────────────────────────────
export async function register(
  name:     string,
  email:    string,
  password: string,
  city:     string,
): Promise<{ success: true; user: AuthUser } | { success: false; error: string }> {
  try {
    const res = await fetch(`${API}/register`, {
      method:      "POST",
      headers:     { "Content-Type": "application/json" },
      body:        JSON.stringify({ name, email, password, city }),
      credentials: "include",
    });

    const json = await res.json();
    if (!res.ok) return { success: false, error: json.error ?? "Pendaftaran gagal." };

    setAccessToken(json.accessToken);
    return { success: true, user: json.user as AuthUser };
  } catch (err: any) {
    return { success: false, error: err?.message ?? "Terjadi kesalahan jaringan." };
  }
}

// ─── logout ───────────────────────────────────────────────────────────────────
export async function logout(): Promise<void> {
  await fetch(`${API}/logout`, {
    method:      "POST",
    credentials: "include",
  }).catch(() => {});
  clearAccessToken();
}

// ─── refreshSession — panggil saat app pertama kali load ─────────────────────
export async function refreshSession(): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${API}/refresh`, {
      method:      "POST",
      credentials: "include",
    });
    if (!res.ok) {
      clearAccessToken();
      return null;
    }
    const json = await res.json();
    setAccessToken(json.accessToken);
    return json.user as AuthUser;
  } catch {
    clearAccessToken();
    return null;
  }
}