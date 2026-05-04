/* eslint-disable */
// src/data/login.ts

import { useState, useEffect } from "react";
import {
  getAccessToken,
  setAccessToken,
  clearAccessToken,
  apiFetch,
} from "@/lib/apiFetch";

export { getAccessToken, setAccessToken, clearAccessToken };
export { apiFetch as authFetch };

const API = "/api/auth";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface AuthUser {
  id:      string;
  name:    string;
  email:   string;
  role:    "CITIZEN" | "OFFICER" | "ADMIN";
  city:    string;
  avatar?: string;
}

// ─── Minimal reactive store (tanpa Zustand) ───────────────────────────────────
// Module-level state yang bisa di-subscribe oleh banyak komponen sekaligus.
// Saat _currentUser berubah, semua subscriber di-notify dan re-render.

let _currentUser: AuthUser | null = null;
const _listeners = new Set<() => void>();

/** Internal: update store dan notify semua subscriber */
function _setCurrentUser(user: AuthUser | null) {
  _currentUser = user;
  _listeners.forEach((cb) => cb());
}

/**
 * Hook reaktif — gunakan seperti Zustand:
 *   const user = useAuthStore(s => s.user);
 *   const role = useAuthStore(s => s.user?.role);
 */
export function useAuthStore<T>(selector: (s: { user: AuthUser | null }) => T): T {
  const [, rerender] = useState(0);

  useEffect(() => {
    const notify = () => rerender((n) => n + 1);
    _listeners.add(notify);
    return () => { _listeners.delete(notify); };
  }, []);

  return selector({ user: _currentUser });
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
  _setCurrentUser(json.user as AuthUser); // ← update store
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
    _setCurrentUser(json.user as AuthUser); // ← update store
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
  _setCurrentUser(null); // ← update store
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
      _setCurrentUser(null); // ← update store
      return null;
    }
    const json = await res.json();
    setAccessToken(json.accessToken);
    _setCurrentUser(json.user as AuthUser); // ← update store
    return json.user as AuthUser;
  } catch {
    clearAccessToken();
    _setCurrentUser(null);
    return null;
  }
}