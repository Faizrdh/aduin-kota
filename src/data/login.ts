/*eslint-disable*/
export interface User {
  id: string;
  name: string;
  email: string;
  password: string; // plain-text for mock only — never do this in production
  role: "citizen" | "admin" | "officer";
  city: string;
  avatar?: string;
}

export const USERS: User[] = [
  {
    id: "usr_001",
    name: "demo",
    email: "demo@aduinkota.id",
    password: "demo123",
    role: "citizen",
    city: "Jakarta",
  },
  {
    id: "usr_002",
    name: "officer",
    email: "officer@aduinkota.id",
    password: "officer123",
    role: "officer",
    city: "Bandung",
  },
  {
    id: "usr_003",
    name: "Admin Kota",
    email: "admin@aduinkota.id",
    password: "admin123",
    role: "admin",
    city: "Jakarta",
  },
  // ── Add more users here ───
  // {
  //   id: "usr_004",
  //   name: "Nama Lengkap",
  //   email: "email@domain.com",
  //   password: "password",
  //   role: "citizen",
  //   city: "Surabaya",
  // },
];

// ─── Auth helpers ─────────────────────────────────────────────────────────────

/** Find a user by email + password. Returns the user or null. */
export function authenticate(email: string, password: string): User | null {
  return (
    USERS.find(
      (u) =>
        u.email.toLowerCase() === email.toLowerCase() &&
        u.password === password
    ) ?? null
  );

}

/** Register a new user (adds to in-memory list; resets on page refresh). */
export function register(
  name: string,
  email: string,
  password: string,
  city = "Jakarta"
): { success: boolean; error?: string; user?: User } {
  const exists = USERS.find(
    (u) => u.email.toLowerCase() === email.toLowerCase()
  );
  if (exists) return { success: false, error: "Email sudah terdaftar." };

  const newUser: User = {
    id: `usr_${String(USERS.length + 1).padStart(3, "0")}`,
    name,
    email,
    password,
    role: "citizen",
    city,
  };
  USERS.push(newUser);
  return { success: true, user: newUser };
}

// ─── Session helpers (sessionStorage — clears on tab close) ──────────────────

const SESSION_KEY = "aduinkota_user";

export function saveSession(user: User) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function getSession(): User | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}