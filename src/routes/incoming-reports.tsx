/*eslint-disable*/
// src/routes/incoming-reports.tsx

import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import {
  Search, Loader2, AlertTriangle, FileX, Inbox,
  ChevronDown, X, CheckCircle2, Clock, CircleDot,
  Ban, RefreshCw, Filter, MoreHorizontal, Bot,
} from "lucide-react";
import { authFetch } from "@/data/login";
import { CategoryBadge, StatusBadge } from "@/components/civic/StatusBadge";
import { AIBadgeAdmin, DINAS_LABELS, DINAS_CONFIG } from "@/components/civic/AIBadge";

export const Route = createFileRoute("/incoming-reports")({
  head: () => ({
    meta: [
      { title: "Laporan Masuk — AduinKota" },
      { name: "description", content: "Kelola semua laporan masuk dari masyarakat." },
    ],
  }),
  component: IncomingReports,
});

// ─── Types ────────────────────────────────────────────────────────────────────
type DbStatus   = "PENDING" | "IN_REVIEW" | "IN_PROGRESS" | "RESOLVED" | "REJECTED";
type DbCategory = "WASTE" | "INFRA" | "DISTURB" | "LAND";

interface ApiReport {
  id:               string;
  title:            string;
  description:      string;
  category:         DbCategory;
  status:           DbStatus;
  province:         string;
  city:             string;
  district:         string;
  village:          string;
  address:          string | null;
  imageUrl:         string | null;
  createdAt:        string;
  updatedAt:        string;
  user:             { id: string; name: string; avatar: string | null };
  _count:           { joins: number };
  // ── AI Smart Routing ──
  ai_label?:         string | null;
  confidence_score?: number | null;
  ai_overridden?:    boolean;
}

interface ApiMeta { total: number; page: number; limit: number; totalPages: number; }
interface Stats   { total: number; pending: number; inProgress: number; resolved: number; rejected: number; }

// ─── Mappings ─────────────────────────────────────────────────────────────────
const CATEGORY_DISPLAY: Record<DbCategory, { label: string; color: string }> = {
  WASTE:   { label: "Pengelolaan Sampah",  color: "red"   },
  INFRA:   { label: "Infrastruktur",       color: "blue"  },
  DISTURB: { label: "Gangguan Ketertiban", color: "amber" },
  LAND:    { label: "Tanah / Sosial",      color: "green" },
};

const STATUS_OPTIONS: { value: DbStatus; label: string; variant: string; icon: React.ReactNode }[] = [
  { value: "PENDING",     label: "Baru",         variant: "new",      icon: <CircleDot    size={13} /> },
  { value: "IN_REVIEW",   label: "Dalam Review", variant: "progress", icon: <Clock        size={13} /> },
  { value: "IN_PROGRESS", label: "Dalam Proses", variant: "progress", icon: <Clock        size={13} /> },
  { value: "RESOLVED",    label: "Selesai",      variant: "resolved", icon: <CheckCircle2 size={13} /> },
  { value: "REJECTED",    label: "Ditolak",      variant: "rejected", icon: <Ban          size={13} /> },
];

const STATUS_DISPLAY: Record<DbStatus, { label: string; variant: string }> = {
  PENDING:     { label: "Baru",         variant: "new"      },
  IN_REVIEW:   { label: "Dalam Review", variant: "progress" },
  IN_PROGRESS: { label: "Dalam Proses", variant: "progress" },
  RESOLVED:    { label: "Selesai",      variant: "resolved" },
  REJECTED:    { label: "Ditolak",      variant: "rejected" },
};

type FilterStatus = "all" | DbStatus;
const FILTER_TABS: { key: FilterStatus; label: string }[] = [
  { key: "all",         label: "Semua"        },
  { key: "PENDING",     label: "Baru"         },
  { key: "IN_REVIEW",   label: "Dalam Review" },
  { key: "IN_PROGRESS", label: "Dalam Proses" },
  { key: "RESOLVED",    label: "Selesai"      },
  { key: "REJECTED",    label: "Ditolak"      },
];

const PLACEHOLDER_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%231e293b'/%3E%3Ctext x='32' y='36' text-anchor='middle' fill='%2364748b' font-size='10' font-family='sans-serif'%3ENo img%3C/text%3E%3C/svg%3E";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86_400_000), h = Math.floor(diff / 3_600_000), m = Math.floor(diff / 60_000);
  if (m < 1) return "Baru saja"; if (h < 1) return `${m}m ago`;
  if (d < 1) return `${h}h ago`; if (d === 1) return "Kemarin"; return `${d}d ago`;
}
function toShortId(id: string) { return `RPT-${id.slice(-4).toUpperCase()}`; }
function toTitle(s: string)    { return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()); }

// ─── Admin AI Cell — badge + override dropdown per baris ──────────────────────
function AdminAICell({ report }: { report: ApiReport }) {
  const [label, setLabel] = useState(report.ai_label ?? null);
  return (
    <AIBadgeAdmin
      label={label}
      score={report.confidence_score ?? null}
      overridden={report.ai_overridden ?? false}
      reportId={report.id}
      size="sm"
      showScore
      onOverride={newLabel => setLabel(newLabel)}
    />
  );
}

// ─── Filter Dinas AI ──────────────────────────────────────────────────────────
function DinasFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none pl-7 pr-7 py-1.5 rounded-lg border border-border text-xs font-medium transition-smooth focus:border-accent outline-none"
        style={{
          backgroundColor: "rgba(15,23,42,0.85)",
          color: value ? "rgb(226,232,240)" : "rgb(100,116,139)",
        }}
      >
        <option value="">Semua Dinas</option>
        {DINAS_LABELS.map(lbl => {
          const cfg = DINAS_CONFIG[lbl];
          return <option key={lbl} value={lbl} style={{ backgroundColor: "#0f172a" }}>{cfg?.emoji} {lbl}</option>;
        })}
      </select>
      <Bot size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-accent pointer-events-none" />
      <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
    </div>
  );
}

// ─── Status Dropdown dengan React Portal ──────────────────────────────────────
function StatusDropdown({ reportId, currentStatus, onUpdated }: {
  reportId: string; currentStatus: DbStatus;
  onUpdated: (id: string, status: DbStatus) => void;
}) {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [note,    setNote]    = useState("");
  const [pos,     setPos]     = useState({ top: 0, left: 0, width: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      const portal = document.getElementById("status-portal");
      if (portal?.contains(target)) return;
      if (btnRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => setOpen(false);
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [open]);

  function handleToggle() {
    if (!btnRef.current) return;
    const rect       = btnRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropH      = 240;
    const top        = spaceBelow >= dropH ? rect.bottom + 6 : rect.top - dropH - 6;
    setPos({ top, left: rect.left, width: rect.width });
    setOpen(p => !p);
  }

  async function handleSelect(newStatus: DbStatus) {
    if (newStatus === currentStatus) { setOpen(false); return; }
    setLoading(true); setOpen(false);
    try {
      const res = await authFetch(`/api/reports/${reportId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, note }),
      });
      if (!res.ok) { const body = await res.json().catch(() => ({})); alert(body?.error ?? "Gagal mengubah status."); return; }
      onUpdated(reportId, newStatus);
      setNote("");
    } catch { alert("Tidak dapat terhubung ke server."); }
    finally  { setLoading(false); }
  }

  const current = STATUS_OPTIONS.find(o => o.value === currentStatus);

  const dropdown = open ? ReactDOM.createPortal(
    <div id="status-portal" style={{ position: "fixed", top: pos.top, left: pos.left, minWidth: Math.max(pos.width, 210), zIndex: 9999 }}
      className="glass-strong border border-border rounded-xl shadow-lg overflow-hidden">
      <div className="p-2 border-b border-border/50">
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Catatan admin (opsional)…"
          className="w-full bg-transparent text-[11px] text-muted-foreground placeholder:text-muted-foreground/50 outline-none px-1"
          onClick={e => e.stopPropagation()} />
      </div>
      {STATUS_OPTIONS.map(opt => (
        <button key={opt.value} onClick={() => handleSelect(opt.value)}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium transition-smooth hover:bg-white/10 ${
            opt.value === currentStatus ? "text-accent bg-accent/10" : "text-foreground"
          }`}>
          {opt.icon}
          <span className="flex-1 text-left">{opt.label}</span>
          {opt.value === currentStatus && <span className="text-[10px] opacity-50 bg-accent/20 px-1.5 py-0.5 rounded-full">aktif</span>}
        </button>
      ))}
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button ref={btnRef} onClick={handleToggle} disabled={loading}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium glass hover:bg-white/10 transition-smooth border border-border/50 min-w-[130px] justify-between">
        <span className="flex items-center gap-1.5">
          {loading ? <Loader2 size={12} className="animate-spin" /> : current?.icon}
          <span>{current?.label ?? currentStatus}</span>
        </span>
        <ChevronDown size={11} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {dropdown}
    </>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="glass rounded-2xl px-5 py-4 flex items-center gap-4">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>{icon}</div>
      <div>
        <div className="text-2xl font-bold font-display leading-none">{value}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
      </div>
    </div>
  );
}

// ─── Halaman Utama ────────────────────────────────────────────────────────────
function IncomingReports() {
  const [reports,    setReports]    = useState<ApiReport[]>([]);
  const [meta,       setMeta]       = useState<ApiMeta | null>(null);
  const [stats,      setStats]      = useState<Stats | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [statsLoad,  setStatsLoad]  = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [filter,     setFilter]     = useState<FilterStatus>("all");
  const [dinasFilter,setDinasFilter]= useState("");   // ← filter dinas AI baru
  const [q,          setQ]          = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page,       setPage]       = useState(1);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => { setPage(1); }, [filter, dinasFilter]);

  const fetchStats = useCallback(async () => {
    setStatsLoad(true);
    try {
      const res = await authFetch("/api/reports/stats");
      if (res.ok) setStats(await res.json());
    } finally { setStatsLoad(false); }
  }, []);

  const fetchReports = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "15" });
      if (filter !== "all") params.set("status", filter);
      if (debouncedQ)       params.set("search", debouncedQ);
      if (dinasFilter)      params.set("ai_label", dinasFilter); // ← filter dinas

      const res = await authFetch(`/api/reports/all?${params}`);
      if (res.status === 401) { setError("Sesi habis. Silakan login kembali."); return; }
      if (res.status === 403) { setError("Akses ditolak. Halaman ini hanya untuk admin."); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? `Gagal memuat laporan (${res.status})`);
        return;
      }
      const json: { data: ApiReport[]; meta: ApiMeta } = await res.json();
      setReports(json.data ?? []);
      setMeta(json.meta);
    } catch { setError("Tidak dapat terhubung ke server."); }
    finally  { setLoading(false); }
  }, [filter, debouncedQ, dinasFilter, page]);

  useEffect(() => { fetchStats();   }, [fetchStats]);
  useEffect(() => { fetchReports(); }, [fetchReports]);

  const handleStatusUpdated = useCallback((id: string, newStatus: DbStatus) => {
    setReports(prev => prev.map(r => r.id === id ? { ...r, status: newStatus, updatedAt: new Date().toISOString() } : r));
    fetchStats();
  }, [fetchStats]);

  return (
    <main className="flex-1 px-5 md:px-10 py-8 max-w-[1400px] w-full mx-auto">

      {/* Header */}
      <header className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-accent mb-2">
            <Inbox size={13} /><span>Admin Panel</span>
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-gradient">Laporan Masuk</h1>
          <p className="text-muted-foreground mt-2 text-sm">Kelola & perbarui status semua laporan dari masyarakat.</p>
        </div>
        <button onClick={() => { fetchReports(); fetchStats(); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl glass text-xs font-medium text-muted-foreground hover:text-foreground transition-smooth border border-border/50">
          <RefreshCw size={13} />Refresh
        </button>
      </header>

      {/* Stat Cards */}
      {!statsLoad && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatCard label="Total Laporan"  value={stats.total}      icon={<Inbox        size={18} className="text-primary-foreground" />} color="gradient-primary"  />
          <StatCard label="Baru / Pending" value={stats.pending}    icon={<CircleDot    size={18} className="text-amber-300"          />} color="bg-amber-500/15"   />
          <StatCard label="Dalam Proses"   value={stats.inProgress} icon={<Clock        size={18} className="text-blue-300"           />} color="bg-blue-500/15"    />
          <StatCard label="Selesai"        value={stats.resolved}   icon={<CheckCircle2 size={18} className="text-emerald-300"        />} color="bg-emerald-500/15" />
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Search */}
        <div className="glass rounded-xl px-3.5 py-2 flex items-center gap-2 flex-1 max-w-sm">
          <Search size={14} className="text-muted-foreground shrink-0" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari laporan, kota…"
            className="bg-transparent outline-none text-sm w-full placeholder:text-muted-foreground/60" />
          {q && <button onClick={() => setQ("")} className="text-muted-foreground hover:text-foreground"><X size={13} /></button>}
        </div>

        {/* Filter Status */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Filter size={12} /><span>Filter:</span></div>
        <div className="glass rounded-xl p-1 flex items-center gap-1 overflow-x-auto scrollbar-none">
          {FILTER_TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-smooth ${
                filter === key ? "gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Filter Dinas AI ── */}
        <DinasFilter value={dinasFilter} onChange={setDinasFilter} />
        {dinasFilter && (
          <button onClick={() => setDinasFilter("")}
            className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-smooth">
            <X size={10} /> Reset dinas
          </button>
        )}
      </div>

      {/* Tabel */}
      <div className="glass rounded-2xl shadow-soft overflow-visible">

        {/* ── Header kolom desktop ── */}
        {/* PERUBAHAN: tambah kolom "Dinas AI" setelah Status */}
        <div className="hidden md:grid grid-cols-[72px_2.2fr_1.1fr_1fr_1.1fr_1.2fr_85px_155px_36px] gap-3 px-5 py-3 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border rounded-t-2xl">
          <div>Foto</div>
          <div>Laporan</div>
          <div>Kategori</div>
          <div>Status</div>
          <div className="flex items-center gap-1"><Bot size={10} /><span>Dinas AI</span></div>
          <div>Lokasi</div>
          <div>Masuk</div>
          <div>Ubah Status</div>
          <div />
        </div>

        <div className="divide-y divide-border">

          {loading && (
            <div className="p-14 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 size={24} className="animate-spin text-accent" />
              <span className="text-sm">Memuat laporan masuk…</span>
            </div>
          )}

          {!loading && error && (
            <div className="p-14 flex flex-col items-center justify-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <p className="text-sm text-red-300 text-center max-w-xs">{error}</p>
              <button onClick={fetchReports} className="text-xs text-accent hover:underline mt-1">Coba lagi</button>
            </div>
          )}

          {!loading && !error && reports.length === 0 && (
            <div className="p-14 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <div className="h-12 w-12 rounded-2xl bg-white/5 border border-border flex items-center justify-center">
                <FileX size={20} />
              </div>
              <p className="text-sm text-center">Tidak ada laporan yang cocok.</p>
            </div>
          )}

          {!loading && !error && reports.map(r => {
            const cat    = CATEGORY_DISPLAY[r.category] ?? { label: r.category, color: "gray" };
            const status = STATUS_DISPLAY[r.status]     ?? { label: r.status,   variant: "new" };
            return (
              <div key={r.id}
                className="grid grid-cols-[64px_1fr_auto] md:grid-cols-[72px_2.2fr_1.1fr_1fr_1.1fr_1.2fr_85px_155px_36px] gap-3 px-5 py-4 hover:bg-white/[0.03] transition-smooth items-center"
              >
                <img src={r.imageUrl ?? PLACEHOLDER_IMG} alt="" loading="lazy"
                  onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMG; }}
                  className="h-14 w-14 rounded-xl object-cover bg-white/5 border border-border/40" />

                <div className="min-w-0">
                  <div className="text-[10px] text-muted-foreground tracking-wider font-mono">
                    {toShortId(r.id)}<span className="ml-2 opacity-60">· {r.user?.name ?? "—"}</span>
                  </div>
                  <div className="text-sm font-medium truncate mt-0.5">{r.title}</div>
                  {/* Mobile: badges */}
                  <div className="md:hidden flex flex-wrap gap-1.5 mt-1.5">
                    <CategoryBadge category={cat.color} label={cat.label} />
                    <StatusBadge   status={status.variant as any} />
                    <AdminAICell   report={r} />
                  </div>
                </div>

                <div className="hidden md:block"><CategoryBadge category={cat.color} label={cat.label} /></div>
                <div className="hidden md:block"><StatusBadge   status={status.variant as any} /></div>

                {/* ── DINAS AI dengan override — desktop ── */}
                <div className="hidden md:block">
                  <AdminAICell report={r} />
                </div>

                <div className="hidden md:block text-xs text-muted-foreground truncate leading-snug">
                  <div>{toTitle(r.village)}</div>
                  <div className="opacity-70">{toTitle(r.city)}</div>
                </div>

                <div className="hidden md:block text-xs text-muted-foreground whitespace-nowrap">
                  {timeAgo(r.createdAt)}
                </div>

                <div className="hidden md:flex items-center">
                  <StatusDropdown reportId={r.id} currentStatus={r.status} onUpdated={handleStatusUpdated} />
                </div>

                <button className="hidden md:flex h-8 w-8 rounded-lg hover:bg-white/5 items-center justify-center transition-smooth">
                  <MoreHorizontal size={15} className="text-muted-foreground" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Paginasi */}
      {!loading && !error && meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 rounded-xl text-xs font-medium glass border border-border/50 text-muted-foreground hover:text-foreground disabled:opacity-40 transition-smooth">
            ← Sebelumnya
          </button>
          <span className="text-xs text-muted-foreground px-2">Halaman {meta.page} / {meta.totalPages}</span>
          <button disabled={page >= meta.totalPages} onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 rounded-xl text-xs font-medium glass border border-border/50 text-muted-foreground hover:text-foreground disabled:opacity-40 transition-smooth">
            Berikutnya →
          </button>
        </div>
      )}

      {!loading && !error && meta && (
        <p className="text-[11px] text-muted-foreground text-center mt-4">
          Menampilkan {reports.length} dari {meta.total} laporan
        </p>
      )}
    </main>
  );
}