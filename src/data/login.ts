/*eslint-disable*/
// src/data/login.ts
// Menyimpan accessToken di memori (tidak di localStorage agar aman XSS)
// Token otomatis di-refresh lewat cookie refresh token

const API = "/api/auth";

// ─── In-memory token store ────────────────────────────────────────────────────
let _accessToken: string | null = null;

export function getAccessToken(): string | null {
  return _accessToken;
}
export function setAccessToken(token: string | null): void {
  _accessToken = token;
}

// ─── Helper: fetch dengan Bearer token otomatis ───────────────────────────────
// Gunakan ini di seluruh app untuk semua request yang butuh auth
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAccessToken();
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
    credentials: "include", // kirim cookie refresh token
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface AuthUser {
  id:    string;
  name:  string;
  email: string;
  role:  string;
  city:  string;
}

// ─── authenticate (login) ─────────────────────────────────────────────────────
export async function authenticate(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API}/login`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ email, password }),
    credentials: "include",
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Login gagal.");

  setAccessToken(json.accessToken);
  return json.user as AuthUser;
}

// ─── register ─────────────────────────────────────────────────────────────────
export async function register(
  name: string,
  email: string,
  password: string,
  city: string,
): Promise<{ success: true; user: AuthUser } | { success: false; error: string }> {
  try {
    const res = await fetch(`${API}/register`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name, email, password, city }),
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
  setAccessToken(null);
}

// ─── refresh — panggil saat app pertama kali load ─────────────────────────────
export async function refreshSession(): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${API}/refresh`, {
      method:      "POST",
      credentials: "include",
    });
    if (!res.ok) return null;
    const json = await res.json();
    setAccessToken(json.accessToken);
    return json.user as AuthUser;
  } catch {
    return null;
  }
}