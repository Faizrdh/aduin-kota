/*eslint-disable*/

import { Link, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, Map as MapIcon, PlusCircle, FileText, BarChart3, Radio, Inbox } from "lucide-react";
import { motion } from "framer-motion";

const NAV = [
  { to: "/",                label: "Dashboard",      icon: LayoutDashboard },
  { to: "/map",             label: "Peta Pengajuan", icon: MapIcon         },
  { to: "/submit",          label: "Buat Laporan",   icon: PlusCircle      },
  { to: "/my-reports",      label: "Laporan Saya",   icon: FileText        },
  { to: "/incoming-reports",label: "Laporan Masuk",  icon: Inbox           },
  { to: "/analytics",       label: "Data Analitik",  icon: BarChart3       },
] as const;

export function Sidebar() {
  const { pathname } = useLocation();
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col glass-strong border-r border-border z-30">
      <div className="px-6 py-7 flex items-center gap-3">
        <div className="relative">
          <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
            <Radio className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-accent animate-pulse-ring" />
        </div>
        <div>
          <div className="font-display font-bold text-lg leading-none text-gradient">AduinKota</div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground mt-1">Aduin Keluhanmu Disini</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-2 space-y-1">
        {NAV.map((item) => {
          const active = pathname === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-smooth text-sm font-medium ${
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="active-pill"
                  className="absolute inset-0 rounded-xl gradient-primary shadow-glow"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              <Icon className={`h-4.5 w-4.5 relative z-10 ${active ? "text-primary-foreground" : ""}`} size={18} />
              <span className={`relative z-10 ${active ? "text-primary-foreground" : ""}`}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 m-3 rounded-2xl glass border border-accent/20">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-2 w-2 rounded-full bg-status-resolved animate-pulse" />
          <span className="text-xs font-semibold text-foreground">sistem daring</span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          aduan masyarakat secara nyata.
        </p>
      </div>

      <div className="px-5 py-4 border-t border-border flex items-center gap-3">
        <div className="h-9 w-9 rounded-full gradient-accent flex items-center justify-center text-xs font-bold text-primary-foreground">DA</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">demo</div>
          <div className="text-[11px] text-muted-foreground truncate">Demo Akun</div>
        </div>
      </div>
    </aside>
  );
}

export function MobileTopbar() {
  const { pathname } = useLocation();
  return (
    <div className="md:hidden sticky top-0 z-40 glass-strong border-b border-border">
      <div className="flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
            <Radio className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-gradient">AduinKota</span>
        </div>
      </div>
      <nav className="flex overflow-x-auto px-2 pb-2 gap-1 scrollbar-none">
        {NAV.map((item) => {
          const active = pathname === item.to;
          const Icon = item.icon;
          return (
            <Link key={item.to} to={item.to}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-smooth ${
                active ? "gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground bg-white/5"
              }`}>
              <Icon size={14} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}