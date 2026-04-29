/* eslint-disable */
// src/lib/apiFetch.ts

const ACCESS_TOKEN_KEY = "aduinkota_at";
const IDLE_MS          = 30 * 60 * 1000; // 30 menit

// ─── Idle Timer ───────────────────────────────────────────────────────────────
let _idleTimer: ReturnType<typeof setTimeout> | null = null;

function _onIdleTimeout() {
  clearAccessToken();
  if (!window.location.pathname.startsWith("/login")) {
    window.location.href = "/login";
  }
}

/**
 * Reset idle timer 30 menit.
 * Dipanggil: tiap apiFetch berhasil + tiap aktivitas user di __root.tsx
 */
export function resetIdleTimer(): void {
  if (!getAccessToken()) return; // jangan set timer kalau belum login
  if (_idleTimer) clearTimeout(_idleTimer);
  _idleTimer = setTimeout(_onIdleTimeout, IDLE_MS);
}

/**
 * Hentikan idle timer (saat logout).
 */
export function clearIdleTimer(): void {
  if (_idleTimer) clearTimeout(_idleTimer);
  _idleTimer = null;
}

// ─── Token Storage ────────────────────────────────────────────────────────────
export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
  resetIdleTimer(); // mulai/reset timer setiap token baru disimpan
}

export function clearAccessToken(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  clearIdleTimer();
}

// ─── Token Refresh ────────────────────────────────────────────────────────────
let _isRefreshing = false;
let _pendingQueue: Array<{
  resolve: (token: string) => void;
  reject:  (err: unknown)  => void;
}> = [];

function _redirectToLogin(): void {
  clearAccessToken();
  if (!window.location.pathname.startsWith("/login")) {
    window.location.href = "/login";
  }
}

async function _doRefresh(): Promise<string> {
  const res = await fetch("/api/auth/refresh", {
    method:      "POST",
    credentials: "include",
  });

  if (!res.ok) {
    _redirectToLogin();
    throw new Error("Sesi habis. Silakan login kembali.");
  }

  const data     = await res.json();
  const newToken = data.accessToken as string;
  setAccessToken(newToken); // ini juga memanggil resetIdleTimer()
  return newToken;
}

// ─── apiFetch — wrapper utama ─────────────────────────────────────────────────
export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const token   = getAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(input, {
    ...init,
    credentials: "include",
    headers,
  });

  // Bukan 401 → kembalikan langsung + reset idle
  if (res.status !== 401) {
    if (res.ok) resetIdleTimer();
    return res;
  }

  // ── 401: perlu refresh ───────────────────────────────────────────────────
  if (_isRefreshing) {
    // Sudah ada proses refresh → antri, tunggu hasilnya
    return new Promise<Response>((resolve, reject) => {
      _pendingQueue.push({
        resolve: (newToken) => {
          const retryHeaders = new Headers(init.headers);
          retryHeaders.set("Content-Type", "application/json");
          retryHeaders.set("Authorization", `Bearer ${newToken}`);
          resolve(fetch(input, { ...init, credentials: "include", headers: retryHeaders }));
        },
        reject,
      });
    });
  }

  // Mulai proses refresh
  _isRefreshing = true;
  try {
    const newToken = await _doRefresh();
    _pendingQueue.forEach((p) => p.resolve(newToken));
    _pendingQueue = [];

    // Retry request asli dengan token baru
    const retryHeaders = new Headers(init.headers);
    retryHeaders.set("Content-Type", "application/json");
    retryHeaders.set("Authorization", `Bearer ${newToken}`);
    return fetch(input, { ...init, credentials: "include", headers: retryHeaders });
  } catch (err) {
    _pendingQueue.forEach((p) => p.reject(err));
    _pendingQueue = [];
    throw err;
  } finally {
    _isRefreshing = false;
  }
}