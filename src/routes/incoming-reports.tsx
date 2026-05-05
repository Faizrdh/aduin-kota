/*eslint-disable*/
// src/routes/incoming-reports.tsx

import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import {
  Search, Loader2, AlertTriangle, FileX, Inbox,
  ChevronDown, X, CheckCircle2, Clock, CircleDot,
  Ban, RefreshCw, Filter, MoreHorizontal, Bot,
  Zap, Flame, Send, History, ChevronRight,
  ArrowRight, User, StickyNote,
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
type DbStatus   = "PENDING" | "IN_REVIEW" | "IN_PROGRESS" | "DISPATCHED" | "RESOLVED" | "REJECTED";
type DbCategory = "WASTE" | "INFRA" | "DISTURB" | "LAND";
type DbPriority = "NORMAL" | "HIGH" | "EMERGENCY";

interface ApiReport {
  id:               string;
  title:            string;
  description:      string;
  category:         DbCategory;
  status:           DbStatus;
  priority:         DbPriority;
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
  ai_label?:        string | null;
  confidence_score?: number | null;
  ai_overridden?:   boolean;
}

interface StatusHistoryItem {
  id:         string;
  fromStatus: DbStatus | null;
  toStatus:   DbStatus;
  note:       string | null;
  createdAt:  string;
  admin:      { id: string; name: string; avatar: string | null } | null;
}

interface ApiMeta { total: number; page: number; limit: number; totalPages: number; }
interface Stats   { total: number; pending: number; inProgress: number; resolved: number; rejected: number; emergency: number; dispatched: number; }

// ─── Mappings ─────────────────────────────────────────────────────────────────
const CATEGORY_DISPLAY: Record<DbCategory, { label: string; color: string }> = {
  WASTE:   { label: "Pengelolaan Sampah",  color: "red"   },
  INFRA:   { label: "Infrastruktur",       color: "blue"  },
  DISTURB: { label: "Gangguan Ketertiban", color: "amber" },
  LAND:    { label: "Tanah / Sosial",      color: "green" },
};

// Default note hints — mirrored from server STATUS_NOTE_HINTS
const STATUS_NOTE_HINTS: Record<DbStatus, string> = {
  PENDING:     "Laporan telah diterima dan menunggu tinjauan.",
  IN_REVIEW:   "Laporan sedang ditinjau dan disaring oleh tim admin.",
  IN_PROGRESS: "Laporan telah diverifikasi dan sedang dikerjakan oleh petugas.",
  DISPATCHED:  "Laporan telah diteruskan kepada dinas terkait untuk ditindaklanjuti.",
  RESOLVED:    "Laporan telah diselesaikan. Terima kasih atas laporan Anda.",
  REJECTED:    "Laporan ditolak karena tidak memenuhi persyaratan atau duplikat.",
};

const STATUS_OPTIONS: { value: DbStatus; label: string; variant: string; icon: React.ReactNode; color: string }[] = [
  { value: "PENDING",     label: "Baru",           variant: "new",        icon: <CircleDot    size={13} />, color: "text-amber-400"   },
  { value: "IN_REVIEW",   label: "Sedang Ditinjau", variant: "progress",  icon: <Clock        size={13} />, color: "text-sky-400"     },
  { value: "IN_PROGRESS", label: "Dalam Proses",   variant: "progress",   icon: <Clock        size={13} />, color: "text-blue-400"    },
  { value: "DISPATCHED",  label: "Diteruskan",      variant: "dispatched", icon: <Send         size={13} />, color: "text-violet-400"  },
  { value: "RESOLVED",    label: "Selesai",         variant: "resolved",  icon: <CheckCircle2 size={13} />, color: "text-emerald-400" },
  { value: "REJECTED",    label: "Ditolak",         variant: "rejected",  icon: <Ban          size={13} />, color: "text-red-400"     },
];

const STATUS_DISPLAY: Record<DbStatus, { label: string; variant: string }> = {
  PENDING:     { label: "Baru",            variant: "new"        },
  IN_REVIEW:   { label: "Sedang Ditinjau", variant: "progress"   },
  IN_PROGRESS: { label: "Dalam Proses",    variant: "progress"   },
  DISPATCHED:  { label: "Diteruskan",      variant: "dispatched" },
  RESOLVED:    { label: "Selesai",         variant: "resolved"   },
  REJECTED:    { label: "Ditolak",         variant: "rejected"   },
};

const PRIORITY_CONFIG: Record<DbPriority, { label: string; icon: React.ReactNode; cls: string; pulse?: boolean }> = {
  NORMAL:    { label: "Normal",    icon: null,                           cls: ""                                                       },
  HIGH:      { label: "Prioritas", icon: <Zap  size={10} />,            cls: "bg-amber-500/15 text-amber-300 border-amber-500/30"      },
  EMERGENCY: { label: "Darurat",   icon: <Flame size={10} />,           cls: "bg-red-500/20 text-red-300 border-red-500/40 animate-pulse", pulse: true },
};

type FilterStatus = "all" | DbStatus;
const FILTER_TABS: { key: FilterStatus; label: string }[] = [
  { key: "all",         label: "Semua"          },
  { key: "PENDING",     label: "Baru"           },
  { key: "IN_REVIEW",   label: "Ditinjau"       },
  { key: "IN_PROGRESS", label: "Dalam Proses"   },
  { key: "DISPATCHED",  label: "Diteruskan"     },
  { key: "RESOLVED",    label: "Selesai"        },
  { key: "REJECTED",    label: "Ditolak"        },
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
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── Priority Badge ───────────────────────────────────────────────────────────
function PriorityBadge({ priority }: { priority: DbPriority }) {
  const cfg = PRIORITY_CONFIG[priority];
  if (priority === "NORMAL") return null;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-semibold tracking-wide ${cfg.cls}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

// ─── Priority Toggle (Admin) ──────────────────────────────────────────────────
function PriorityToggle({ reportId, current, onUpdated }: {
  reportId: string; current: DbPriority;
  onUpdated: (id: string, p: DbPriority) => void;
}) {
  const [loading, setLoading] = useState(false);

  const cycle: DbPriority[] = ["NORMAL", "HIGH", "EMERGENCY"];
  const next = cycle[(cycle.indexOf(current) + 1) % cycle.length];

  async function handleCycle(e: React.MouseEvent) {
    e.stopPropagation();
    setLoading(true);
    try {
      const res = await authFetch(`/api/reports/${reportId}/priority`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: next }),
      });
      if (res.ok) onUpdated(reportId, next);
      else alert("Gagal mengubah prioritas.");
    } catch { alert("Tidak dapat terhubung ke server."); }
    finally  { setLoading(false); }
  }

  return (
    <button
      onClick={handleCycle}
      disabled={loading}
      title={`Prioritas: ${current} → klik untuk ${next}`}
      className="flex items-center gap-1 px-1.5 py-0.5 rounded-md border transition-smooth hover:opacity-80 text-[10px] font-semibold tracking-wide
        border-border/50 text-muted-foreground hover:text-foreground"
    >
      {loading ? <Loader2 size={10} className="animate-spin" /> : (
        <>
          {current === "EMERGENCY" && <Flame size={10} className="text-red-400" />}
          {current === "HIGH"      && <Zap   size={10} className="text-amber-400" />}
          {current === "NORMAL"    && <Zap   size={10} className="opacity-30" />}
          <span className={
            current === "EMERGENCY" ? "text-red-300" :
            current === "HIGH"      ? "text-amber-300" : "opacity-50"
          }>
            {PRIORITY_CONFIG[current].label || "Normal"}
          </span>
        </>
      )}
    </button>
  );
}

// ─── Status History Modal ─────────────────────────────────────────────────────
function HistoryModal({ reportId, reportTitle, onClose }: {
  reportId: string; reportTitle: string; onClose: () => void;
}) {
  const [history, setHistory] = useState<StatusHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch(`/api/reports/${reportId}/history`)
      .then(r => r.json())
      .then(j => setHistory(j.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [reportId]);

  // Close on outside click
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const statusColor: Record<string, string> = {
    PENDING:     "bg-amber-500/20 text-amber-300 border-amber-500/30",
    IN_REVIEW:   "bg-sky-500/20 text-sky-300 border-sky-500/30",
    IN_PROGRESS: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    DISPATCHED:  "bg-violet-500/20 text-violet-300 border-violet-500/30",
    RESOLVED:    "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    REJECTED:    "bg-red-500/20 text-red-300 border-red-500/30",
  };

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="glass-strong border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2 text-xs text-accent mb-1">
              <History size={12} /><span>Riwayat Status</span>
            </div>
            <h3 className="font-semibold text-sm leading-snug truncate max-w-[340px]">{reportTitle}</h3>
          </div>
          <button onClick={onClose} className="h-7 w-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition-smooth shrink-0">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        {/* Timeline */}
        <div className="overflow-y-auto flex-1 p-5">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
              <Loader2 size={16} className="animate-spin" /><span className="text-sm">Memuat riwayat…</span>
            </div>
          )}
          {!loading && history.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-sm">Belum ada riwayat perubahan status.</div>
          )}
          {!loading && history.length > 0 && (
            <ol className="relative border-l border-border/50 ml-2 space-y-0">
              {history.map((h, i) => (
                <li key={h.id} className="ml-5 pb-6 last:pb-0">
                  {/* Circle on timeline */}
                  <span className="absolute -left-[5px] flex h-2.5 w-2.5 items-center justify-center rounded-full bg-accent border border-background ring-2 ring-accent/30" />

                  <div className="glass rounded-xl border border-border/50 p-3.5 space-y-2">
                    {/* Status transition */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {h.fromStatus && (
                        <>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-medium ${statusColor[h.fromStatus] ?? ""}`}>
                            {STATUS_DISPLAY[h.fromStatus]?.label ?? h.fromStatus}
                          </span>
                          <ArrowRight size={11} className="text-muted-foreground shrink-0" />
                        </>
                      )}
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-semibold ${statusColor[h.toStatus] ?? ""}`}>
                        {STATUS_DISPLAY[h.toStatus]?.label ?? h.toStatus}
                      </span>
                    </div>

                    {/* Note */}
                    {h.note && (
                      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-white/5 rounded-lg px-2.5 py-2">
                        <StickyNote size={11} className="shrink-0 mt-0.5 text-accent/70" />
                        <span className="leading-relaxed">{h.note}</span>
                      </div>
                    )}

                    {/* Meta */}
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
                      {h.admin && (
                        <span className="flex items-center gap-1">
                          <User size={9} />{h.admin.name}
                        </span>
                      )}
                      <span>{fmtDate(h.createdAt)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Admin AI Cell ────────────────────────────────────────────────────────────
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
        style={{ backgroundColor: "rgba(15,23,42,0.85)", color: value ? "rgb(226,232,240)" : "rgb(100,116,139)" }}
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

  // Auto-fill note hint on status hover / initial open
  const [hintNote, setHintNote] = useState("");

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
    const dropH      = 330;
    const top        = spaceBelow >= dropH ? rect.bottom + 6 : rect.top - dropH - 6;
    setPos({ top, left: rect.left, width: rect.width });
    setOpen(p => !p);
  }

  async function handleSelect(newStatus: DbStatus) {
    if (newStatus === currentStatus) { setOpen(false); return; }
    setLoading(true); setOpen(false);
    try {
      const finalNote = note.trim() || STATUS_NOTE_HINTS[newStatus];
      const res = await authFetch(`/api/reports/${reportId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, note: finalNote }),
      });
      if (!res.ok) { const body = await res.json().catch(() => ({})); alert(body?.error ?? "Gagal mengubah status."); return; }
      onUpdated(reportId, newStatus);
      setNote("");
    } catch { alert("Tidak dapat terhubung ke server."); }
    finally  { setLoading(false); }
  }

  const current = STATUS_OPTIONS.find(o => o.value === currentStatus);

  const dropdown = open ? ReactDOM.createPortal(
    <div
      id="status-portal"
      style={{ position: "fixed", top: pos.top, left: pos.left, minWidth: Math.max(pos.width, 260), zIndex: 9999 }}
      className="glass-strong border border-border rounded-xl shadow-lg overflow-hidden"
    >
      {/* Note input + hint */}
      <div className="p-2.5 border-b border-border/50 space-y-1.5">
        <textarea
          rows={2}
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder={hintNote || "Keterangan admin (opsional)…"}
          className="w-full bg-white/5 border border-border/40 rounded-lg text-[11px] text-foreground/80 placeholder:text-muted-foreground/50 outline-none px-2.5 py-1.5 resize-none leading-relaxed"
          onClick={e => e.stopPropagation()}
        />
        {!note && hintNote && (
          <button
            onClick={e => { e.stopPropagation(); setNote(hintNote); }}
            className="text-[10px] text-accent/70 hover:text-accent transition-smooth flex items-center gap-1"
          >
            <StickyNote size={9} /> Gunakan template
          </button>
        )}
      </div>

      {STATUS_OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => handleSelect(opt.value)}
          onMouseEnter={() => setHintNote(STATUS_NOTE_HINTS[opt.value])}
          onMouseLeave={() => setHintNote("")}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium transition-smooth hover:bg-white/10 ${
            opt.value === currentStatus ? "text-accent bg-accent/10" : opt.color
          }`}
        >
          {opt.icon}
          <span className="flex-1 text-left">{opt.label}</span>
          {opt.value === "DISPATCHED" && (
            <span className="text-[9px] opacity-60 bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded-full border border-violet-500/20">diteruskan</span>
          )}
          {opt.value === currentStatus && (
            <span className="text-[10px] opacity-50 bg-accent/20 px-1.5 py-0.5 rounded-full">aktif</span>
          )}
        </button>
      ))}

      {/* Hint preview for hovered status */}
      {hintNote && (
        <div className="px-3 py-2 border-t border-border/50 text-[10px] text-muted-foreground/60 italic leading-relaxed">
          {hintNote}
        </div>
      )}
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleToggle}
        disabled={loading}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium glass hover:bg-white/10 transition-smooth border border-border/50 min-w-[140px] justify-between"
      >
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
function StatCard({ label, value, icon, color, highlight }: {
  label: string; value: number; icon: React.ReactNode; color: string; highlight?: boolean;
}) {
  return (
    <div className={`glass rounded-2xl px-5 py-4 flex items-center gap-4 ${highlight && value > 0 ? "border border-red-500/40 ring-1 ring-red-500/20" : ""}`}>
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>{icon}</div>
      <div>
        <div className={`text-2xl font-bold font-display leading-none ${highlight && value > 0 ? "text-red-300" : ""}`}>{value}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
      </div>
      {highlight && value > 0 && (
        <div className="ml-auto">
          <Flame size={16} className="text-red-400 animate-pulse" />
        </div>
      )}
    </div>
  );
}

// ─── Halaman Utama ────────────────────────────────────────────────────────────
function IncomingReports() {
  const [reports,      setReports]      = useState<ApiReport[]>([]);
  const [meta,         setMeta]         = useState<ApiMeta | null>(null);
  const [stats,        setStats]        = useState<Stats | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [statsLoad,    setStatsLoad]    = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [filter,       setFilter]       = useState<FilterStatus>("all");
  const [dinasFilter,  setDinasFilter]  = useState("");
  const [q,            setQ]            = useState("");
  const [debouncedQ,   setDebouncedQ]   = useState("");
  const [page,         setPage]         = useState(1);

  // History modal
  const [historyModal, setHistoryModal] = useState<{ id: string; title: string } | null>(null);

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
      if (dinasFilter)      params.set("ai_label", dinasFilter);

      const res = await authFetch(`/api/reports/all?${params}`);
      if (res.status === 401) { setError("Sesi habis. Silakan login kembali."); return; }
      if (res.status === 403) { setError("Akses ditolak. Halaman ini hanya untuk admin."); return; }
      if (!res.ok) { const body = await res.json().catch(() => ({})); setError(body?.error ?? `Gagal memuat laporan (${res.status})`); return; }
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

  const handlePriorityUpdated = useCallback((id: string, priority: DbPriority) => {
    setReports(prev => prev.map(r => r.id === id ? { ...r, priority } : r));
    fetchStats();
  }, [fetchStats]);

  return (
    <main className="flex-1 px-5 md:px-10 py-8 max-w-[1440px] w-full mx-auto">

      {/* Header */}
      <header className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-accent mb-2">
            <Inbox size={13} /><span>Admin Panel</span>
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-gradient">Laporan Masuk</h1>
          <p className="text-muted-foreground mt-2 text-sm">Kelola & perbarui status semua laporan dari masyarakat.</p>
        </div>
        <button
          onClick={() => { fetchReports(); fetchStats(); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl glass text-xs font-medium text-muted-foreground hover:text-foreground transition-smooth border border-border/50"
        >
          <RefreshCw size={13} />Refresh
        </button>
      </header>

      {/* Stat Cards */}
      {!statsLoad && stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          <StatCard label="Total Laporan"   value={stats.total}      icon={<Inbox        size={18} className="text-primary-foreground" />} color="gradient-primary"   />
          <StatCard label="Baru / Pending"  value={stats.pending}    icon={<CircleDot    size={18} className="text-amber-300"          />} color="bg-amber-500/15"    />
          <StatCard label="Dalam Proses"    value={stats.inProgress} icon={<Clock        size={18} className="text-blue-300"           />} color="bg-blue-500/15"     />
          <StatCard label="Diteruskan"      value={stats.dispatched} icon={<Send         size={18} className="text-violet-300"         />} color="bg-violet-500/15"   />
          <StatCard label="🚨 Darurat"       value={stats.emergency}  icon={<Flame        size={18} className="text-red-300"            />} color="bg-red-500/15" highlight />
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Search */}
        <div className="glass rounded-xl px-3.5 py-2 flex items-center gap-2 flex-1 max-w-sm">
          <Search size={14} className="text-muted-foreground shrink-0" />
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder="Cari laporan, kota…"
            className="bg-transparent outline-none text-sm w-full placeholder:text-muted-foreground/60"
          />
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
              {key === "DISPATCHED" ? <><Send size={10} className="inline mr-1" />{label}</> : label}
            </button>
          ))}
        </div>

        {/* Filter Dinas AI */}
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

        {/* Header kolom desktop */}
        {/* KOLOM: Foto | Laporan | Kategori | Status | Prioritas | Dinas AI | Lokasi | Masuk | Ubah Status | Riwayat | ⋯ */}
        <div className="hidden md:grid grid-cols-[72px_2fr_1fr_1fr_100px_1.1fr_1.1fr_80px_150px_36px_36px] gap-2 px-5 py-3 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border rounded-t-2xl">
          <div>Foto</div>
          <div>Laporan</div>
          <div>Kategori</div>
          <div>Status</div>
          <div className="flex items-center gap-1"><Flame size={10} /><span>Prioritas</span></div>
          <div className="flex items-center gap-1"><Bot size={10} /><span>Dinas AI</span></div>
          <div>Lokasi</div>
          <div>Masuk</div>
          <div>Ubah Status</div>
          <div title="Riwayat"><History size={10} /></div>
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
            const isEmergency = r.priority === "EMERGENCY";

            return (
              <div
                key={r.id}
                className={`grid grid-cols-[64px_1fr_auto] md:grid-cols-[72px_2fr_1fr_1fr_100px_1.1fr_1.1fr_80px_150px_36px_36px] gap-2 px-5 py-4 transition-smooth items-center ${
                  isEmergency
                    ? "hover:bg-red-500/5 border-l-2 border-l-red-500/60"
                    : "hover:bg-white/[0.03]"
                }`}
              >
                {/* Image */}
                <div className="relative">
                  <img
                    src={r.imageUrl ?? PLACEHOLDER_IMG}
                    alt=""
                    loading="lazy"
                    onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMG; }}
                    className="h-14 w-14 rounded-xl object-cover bg-white/5 border border-border/40"
                  />
                  {isEmergency && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 flex items-center justify-center border border-background animate-pulse">
                      <Flame size={8} className="text-white" />
                    </span>
                  )}
                </div>

                {/* Title & badges */}
                <div className="min-w-0">
                  <div className="text-[10px] text-muted-foreground tracking-wider font-mono">
                    {toShortId(r.id)}<span className="ml-2 opacity-60">· {r.user?.name ?? "—"}</span>
                  </div>
                  <div className="text-sm font-medium truncate mt-0.5 flex items-center gap-1.5">
                    <span className="truncate">{r.title}</span>
                  </div>
                  {/* Priority badge inline if not NORMAL */}
                  {r.priority !== "NORMAL" && (
                    <div className="mt-1">
                      <PriorityBadge priority={r.priority} />
                    </div>
                  )}
                  {/* Mobile: extra badges */}
                  <div className="md:hidden flex flex-wrap gap-1.5 mt-1.5">
                    <CategoryBadge category={cat.color} label={cat.label} />
                    <StatusBadge   status={status.variant as any} />
                    <AdminAICell   report={r} />
                  </div>
                </div>

                <div className="hidden md:block"><CategoryBadge category={cat.color} label={cat.label} /></div>
                <div className="hidden md:block"><StatusBadge   status={status.variant as any} /></div>

                {/* Priority toggle */}
                <div className="hidden md:flex items-center">
                  <PriorityToggle
                    reportId={r.id}
                    current={r.priority ?? "NORMAL"}
                    onUpdated={handlePriorityUpdated}
                  />
                </div>

                {/* Dinas AI */}
                <div className="hidden md:block">
                  <AdminAICell report={r} />
                </div>

                {/* Lokasi */}
                <div className="hidden md:block text-xs text-muted-foreground truncate leading-snug">
                  <div>{toTitle(r.village)}</div>
                  <div className="opacity-70">{toTitle(r.city)}</div>
                </div>

                {/* Masuk */}
                <div className="hidden md:block text-xs text-muted-foreground whitespace-nowrap">
                  {timeAgo(r.createdAt)}
                </div>

                {/* Status Dropdown */}
                <div className="hidden md:flex items-center">
                  <StatusDropdown
                    reportId={r.id}
                    currentStatus={r.status}
                    onUpdated={handleStatusUpdated}
                  />
                </div>

                {/* History button */}
                <button
                  title="Lihat riwayat status"
                  onClick={() => setHistoryModal({ id: r.id, title: r.title })}
                  className="hidden md:flex h-8 w-8 rounded-lg hover:bg-white/10 items-center justify-center transition-smooth group"
                >
                  <History size={14} className="text-muted-foreground group-hover:text-accent transition-smooth" />
                </button>

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

      {/* Status History Modal */}
      {historyModal && (
        <HistoryModal
          reportId={historyModal.id}
          reportTitle={historyModal.title}
          onClose={() => setHistoryModal(null)}
        />
      )}
    </main>
  );
}