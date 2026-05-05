/*eslint-disable*/
// src/components/civic/Sidebar.tsx

import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Map as MapIcon, PlusCircle, FileText,
  BarChart3, Radio, Inbox, LogOut, UserPlus,
} from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV = [
  { to: "/",                 label: "Dashboard",      icon: LayoutDashboard },
  { to: "/map",              label: "Peta Pengajuan", icon: MapIcon         },
  { to: "/submit",           label: "Buat Laporan",   icon: PlusCircle      },
  { to: "/my-reports",       label: "Laporan Saya",   icon: FileText        },
] as const;

const NAV_ADMIN = [
  { to: "/analytics",         label: "Data Analitik", icon: BarChart3 }, 
  { to: "/admin-create-user", label: "Pengguna", icon: UserPlus  },
  { to: "/incoming-reports", label: "Laporan Masuk",  icon: Inbox           },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface JwtPayload {
  sub  : string;
  email: string;
  role : string;
  name : string;
  exp  : number;
}

interface CurrentUser {
  name : string;
  email: string;
  role : string;
}

const FALLBACK_USER: CurrentUser = { name: "Pengguna", email: "", role: "akun" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const clean = name.trim();
  const base  = clean.includes("@") ? clean.split("@")[0] : clean;
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function parseJwt(token: string): JwtPayload | null {
  try {
    const b64 = token.split(".")[1]?.replace(/-/g, "+").replace(/_/g, "/");
    if (!b64) return null;
    const json = JSON.parse(atob(b64));
    if (json.exp && json.exp * 1000 < Date.now()) return null;
    return json as JwtPayload;
  } catch {
    return null;
  }
}

function findStoredToken(): string | null {
  const KEYS = ["accessToken", "access_token", "token", "aduinkota_at", "authToken", "jwt"];
  for (const key of KEYS) {
    const val = localStorage.getItem(key) ?? sessionStorage.getItem(key);
    if (val) return val;
  }
  return null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

function useCurrentUser(): CurrentUser {
  const [user, setUser] = useState<CurrentUser>(FALLBACK_USER);

  useEffect(() => {
    const token   = findStoredToken();
    const payload = token ? parseJwt(token) : null;

    if (payload?.name) {
      setUser({ name: payload.name, email: payload.email, role: payload.role });
      return;
    }

    fetch("/api/auth/refresh", { method: "POST", credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        if (data.accessToken) localStorage.setItem("accessToken", data.accessToken);
        const u = data.user;
        if (u?.name) setUser({ name: u.name, email: u.email, role: u.role });
      })
      .catch(() => null);
  }, []);

  return user;
}

// ─── Logout ───────────────────────────────────────────────────────────────────

async function doLogout() {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => null);
  ["accessToken", "access_token", "token", "aduinkota_at", "authToken", "jwt"]
    .forEach((k) => { localStorage.removeItem(k); sessionStorage.removeItem(k); });
}

// ─── Reusable NavLink — seragam untuk semua item ──────────────────────────────

function SideNavLink({
  to, label, icon: Icon, active,
}: {
  to    : string;
  label : string;
  icon  : React.ElementType;
  active: boolean;
}) {
  return (
    <Link
      to={to as any}
      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-smooth text-sm font-medium ${
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-white/5"
      }`}
    >
      {active && (
        <motion.span
          layoutId="active-pill"
          className="absolute inset-0 rounded-xl gradient-primary shadow-glow"
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
        />
      )}
      <Icon
        className={`relative z-10 ${active ? "text-primary-foreground" : ""}`}
        size={18}
      />
      <span className={`relative z-10 ${active ? "text-primary-foreground" : ""}`}>
        {label}
      </span>
    </Link>
  );
}

// ─── Sidebar (Desktop) ────────────────────────────────────────────────────────

export function Sidebar() {
  const { pathname } = useLocation();
  const navigate     = useNavigate();
  const user         = useCurrentUser();
  const initials     = getInitials(user.name);
  const isAdmin      = user.role.toUpperCase() === "ADMIN";

  const handleLogout = async () => {
    await doLogout();
    navigate({ to: "/login" });
  };

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-screen w-64 flex-col glass-strong border-r border-border z-30">

      {/* ── Logo ── */}
      <div className="px-6 py-7 flex items-center gap-3 shrink-0">
        <div className="relative">
          <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
            <Radio className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-accent animate-pulse-ring" />
        </div>
        <div>
          <div className="font-display font-bold text-lg leading-none text-gradient">AduinKota</div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground mt-1">
            Aduin Keluhanmu Disini
          </div>
        </div>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">

        {/* Nav umum */}
        {NAV.map((item) => (
          <SideNavLink
            key={item.to}
            to={item.to}
            label={item.label}
            icon={item.icon}
            active={pathname === item.to}
          />
        ))}

        {/* ── Divider + nav admin ── */}
        {isAdmin && (
          <>
            <div className="pt-3 pb-1 px-2">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                  Admin
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
            </div>

            {NAV_ADMIN.map((item) => (
              <SideNavLink
                key={item.to}
                to={item.to}
                label={item.label}
                icon={item.icon}
                active={pathname === item.to}
              />
            ))}
          </>
        )}
      </nav>

      {/* ── Status badge ── */}
      <div className="p-4 mx-3 mb-3 rounded-2xl glass border border-accent/20 shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-2 w-2 rounded-full bg-status-resolved animate-pulse" />
          <span className="text-xs font-semibold text-foreground">sistem daring</span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          aduan masyarakat secara nyata.
        </p>
      </div>

      {/* ── User info + tombol Keluar ── */}
      <div className="px-4 pt-3 pb-4 border-t border-border shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-9 w-9 rounded-full gradient-accent flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{user.name}</div>
            <div className="text-[11px] text-muted-foreground truncate capitalize">{user.role}</div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-red-400 border border-red-400/20 bg-red-400/5 hover:bg-red-400/15 hover:border-red-400/40 transition-smooth"
        >
          <LogOut size={15} />
          Keluar
        </button>
      </div>

    </aside>
  );
}

// ─── MobileTopbar ─────────────────────────────────────────────────────────────

export function MobileTopbar() {
  const { pathname } = useLocation();
  const navigate     = useNavigate();
  const user         = useCurrentUser();
  const initials     = getInitials(user.name);
  const isAdmin      = user.role.toUpperCase() === "ADMIN";

  const handleLogout = async () => {
    await doLogout();
    navigate({ to: "/login" });
  };

  const allNav = [...NAV, ...(isAdmin ? NAV_ADMIN : [])];

  return (
    <div className="md:hidden sticky top-0 z-40 glass-strong border-b border-border">

      {/* ── Header row ── */}
      <div className="flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
            <Radio className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-gradient">AduinKota</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full gradient-accent flex items-center justify-center text-[10px] font-bold text-primary-foreground shrink-0">
            {initials}
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-400 border border-red-400/20 bg-red-400/5 hover:bg-red-400/15 transition-smooth"
          >
            <LogOut size={13} />
            Keluar
          </button>
        </div>
      </div>

      {/* ── Nav tabs ── */}
      <nav className="flex overflow-x-auto px-2 pb-2 gap-1 scrollbar-none">
        {allNav.map((item) => {
          const active = pathname === item.to;
          const Icon   = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to as any}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-smooth ${
                active
                  ? "gradient-primary text-primary-foreground shadow-glow"
                  : "text-muted-foreground bg-white/5"
              }`}
            >
              <Icon size={14} />
              {item.label}
            </Link>
          );
        })}
      </nav>

    </div>
  );
}