/*eslint-disable*/

import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowUpRight, Activity, Clock, CheckCircle2, AlertCircle, MapPin, Plus, TrendingUp } from "lucide-react";
import { CATEGORIES, REPORTS, getStats, timeAgo } from "@/data/reports";
import { StatusBadge, CategoryBadge } from "@/components/civic/StatusBadge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview — CivicSpot" },
      { name: "description", content: "Overview of city reports, statuses, and response performance." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const stats = getStats(REPORTS);
  const recent = [...REPORTS].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 6);

  const statCards = [
    { label: "Total Reports", value: stats.total, sub: "+12 this week", icon: Activity, accent: "var(--primary)" },
    { label: "Open", value: stats.open, sub: "Awaiting review", icon: AlertCircle, accent: "var(--status-new)" },
    { label: "In Progress", value: stats.progress, sub: "Crews dispatched", icon: Clock, accent: "var(--status-progress)" },
    { label: "Resolved", value: stats.resolved, sub: "Avg. 2.4h response", icon: CheckCircle2, accent: "var(--status-resolved)" },
  ];

  return (
    <main className="flex-1 px-5 md:px-10 py-8 max-w-[1500px] w-full mx-auto">
      {/* Hero */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-accent mb-2">tayangan nyata pengaduan · Indonesia</div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-gradient leading-tight">
            Pengaduan Masyarakat, Indonesia<br className="hidden md:block" /> secara nyata.
          </h1>
          <p className="text-muted-foreground mt-3 max-w-xl text-sm md:text-base">
            Track reports across Jakarta, Bandung, Surabaya and Bali. Coordinate response, measure impact, and keep citizens informed.
          </p>
        </div>
        <div className="flex gap-3">
          <Link to="/map" className="px-4 py-2.5 rounded-xl glass-strong text-sm font-medium hover:bg-white/10 transition-smooth flex items-center gap-2">
            Buka Peta <ArrowUpRight size={15} />
          </Link>
          <Link to="/submit" className="px-4 py-2.5 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold shadow-glow hover:scale-[1.02] transition-smooth flex items-center gap-2">
            <Plus size={15} /> Buat Pengaduan
          </Link>
        </div>
      </header>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.4 }}
            className="glass rounded-2xl p-5 hover:-translate-y-0.5 transition-smooth shadow-soft relative overflow-hidden group"
          >
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-20 blur-2xl transition-smooth group-hover:opacity-40"
                 style={{ background: s.accent }} />
            <div className="flex items-center justify-between mb-4 relative">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</span>
              <s.icon size={16} style={{ color: s.accent }} />
            </div>
            <div className="font-display text-3xl font-bold relative">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-1 relative">{s.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Two-col */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent feed */}
        <div className="lg:col-span-2 glass rounded-2xl p-6 shadow-soft">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-display text-xl font-semibold">Pengaduan Sebelumnya</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Live citizen submissions across the network</p>
            </div>
            <Link to="/my-reports" className="text-xs text-accent hover:underline">Lihat Semua →</Link>
          </div>
          <div className="space-y-2">
            {recent.map((r) => {
              const cat = CATEGORIES[r.category];
              return (
                <Link
                  key={r.id}
                  to="/map"
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-smooth border border-transparent hover:border-border"
                >
                  <img src={r.image} alt={r.title} loading="lazy" className="h-14 w-14 rounded-lg object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <CategoryBadge category={cat.color} label={cat.label} />
                      <StatusBadge status={r.status} />
                    </div>
                    <div className="text-sm font-medium truncate">{r.title}</div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <MapPin size={11} /> {r.region.subdistrict}, {r.region.city} · {timeAgo(r.createdAt)}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Side column */}
        <div className="space-y-6">
          <div className="glass rounded-2xl p-6 shadow-soft relative overflow-hidden">
            <div className="absolute -bottom-12 -right-12 h-48 w-48 rounded-full gradient-primary opacity-30 blur-3xl" />
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-accent mb-3 relative">
              <TrendingUp size={14} /> performa pengaduan
            </div>
            <div className="font-display text-3xl font-bold relative">24 Jam</div>
            <div className="text-sm text-muted-foreground relative">rata rata pengaduan</div>
            <div className="mt-5 grid grid-cols-2 gap-3 relative">
              {[
                { l: "Resolution rate", v: "87%" },
                { l: "Citizen rating", v: "4.6 / 5" },
              ].map((m) => (
                <div key={m.l} className="rounded-xl bg-white/5 p-3">
                  <div className="text-[11px] text-muted-foreground">{m.l}</div>
                  <div className="font-semibold mt-0.5">{m.v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-2xl p-6 shadow-soft">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">jenis category</h3>
              <Link to="/analytics" className="text-xs text-accent hover:underline">Detail →</Link>
            </div>
            <div className="space-y-3">
              {(Object.keys(CATEGORIES) as Array<keyof typeof CATEGORIES>).map((k) => {
                const cat = CATEGORIES[k];
                const count = REPORTS.filter((r) => r.category === k).length;
                const pct = Math.round((count / REPORTS.length) * 100);
                return (
                  <div key={k}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: cat.color }} />
                        {cat.label}
                      </span>
                      <span className="text-muted-foreground">{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: cat.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}