/*eslint-disable*/

import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Search, MoreHorizontal, Loader2, AlertTriangle, FileX } from "lucide-react";
import { authFetch } from "@/data/login";
import { CategoryBadge, StatusBadge } from "@/components/civic/StatusBadge";
import { AIBadge } from "@/components/civic/AIBadge";
import { useAILabel } from "@/hooks/useAILabel";

export const Route = createFileRoute("/my-reports")({
  head: () => ({
    meta: [
      { title: "Laporan Saya — AduinKota" },
      { name: "description", content: "Track every report you've submitted, with status, location, and updates." },
    ],
  }),
  component: MyReports,
});

// ─── Tipe dari Prisma ─────────────────────────────────────────────────────────
type DbStatus   = "PENDING" | "IN_REVIEW" | "IN_PROGRESS" | "DISPATCHED" | "RESOLVED" | "REJECTED";
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

// ─── Mapping ──────────────────────────────────────────────────────────────────
const CATEGORY_DISPLAY: Record<DbCategory, { label: string; color: string }> = {
  WASTE:   { label: "Pengelolaan Sampah",  color: "red"   },
  INFRA:   { label: "Infrastruktur",       color: "blue"  },
  DISTURB: { label: "Gangguan Ketertiban", color: "amber" },
  LAND:    { label: "Tanah / Sosial",      color: "green" },
};

// ✅ FIX: Tambahkan DISPATCHED agar tidak undefined
const STATUS_DISPLAY: Record<DbStatus, { label: string; variant: string }> = {
  PENDING:     { label: "Baru",         variant: "new"        },
  IN_REVIEW:   { label: "Dalam Proses", variant: "progress"   },
  IN_PROGRESS: { label: "Dalam Proses", variant: "progress"   },
  DISPATCHED:  { label: "Diteruskan",   variant: "dispatched" },
  RESOLVED:    { label: "Selesai",      variant: "resolved"   },
  REJECTED:    { label: "Ditolak",      variant: "rejected"   },
};

type FilterTab = "all" | "new" | "progress" | "resolved";
const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all",      label: "All"          },
  { key: "new",      label: "Baru"         },
  { key: "progress", label: "Dalam Proses" },
  { key: "resolved", label: "Selesai"      },
];

function matchesFilter(status: DbStatus, filter: FilterTab): boolean {
  if (filter === "all")      return true;
  if (filter === "new")      return status === "PENDING";
  if (filter === "progress") return status === "IN_REVIEW" || status === "IN_PROGRESS" || status === "DISPATCHED";
  if (filter === "resolved") return status === "RESOLVED";
  return true;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor(diff / 60_000);
  if (m < 1)   return "Baru saja";
  if (h < 1)   return `${m}m ago`;
  if (d < 1)   return `${h}h ago`;
  if (d === 1) return "Kemarin";
  return `${d}d ago`;
}
function toShortId(cuid: string) { return `RPT-${cuid.slice(-4).toUpperCase()}`; }
function toTitle(s: string)      { return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()); }

const PLACEHOLDER_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%231e293b'/%3E%3Ctext x='32' y='36' text-anchor='middle' fill='%2364748b' font-size='10' font-family='sans-serif'%3ENo img%3C/text%3E%3C/svg%3E";
const API_BASE = "/api/reports";

// ─── Sub-komponen: AI Badge per baris ─────────────────────────────────────────
function RowAIBadge({
  reportId,
  initialLabel,
  initialScore,
  initialOverridden,
}: {
  reportId:          string;
  initialLabel:      string | null | undefined;
  initialScore:      number | null | undefined;
  initialOverridden: boolean | undefined;
}) {
  const { label, score, overridden, loading } = useAILabel(reportId, {
    initialLabel:  initialLabel  ?? null,
    initialScore:  initialScore  ?? null,
    enabled:       !initialLabel,
    pollInterval:  4_000,
    maxAttempts:   8,
  });

  return (
    <AIBadge
      label={loading ? null : label}
      score={score}
      overridden={overridden || initialOverridden}
      size="sm"
      showScore
    />
  );
}

// ─── Komponen Utama ───────────────────────────────────────────────────────────
function MyReports() {
  const [reports, setReports] = useState<ApiReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [filter,  setFilter]  = useState<FilterTab>("all");
  const [q,       setQ]       = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(null);
      try {
        const res = await authFetch(API_BASE);
        if (res.status === 401) { if (!cancelled) setError("Sesi habis. Silakan login kembali."); return; }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (!cancelled) setError(body?.error ?? `Gagal memuat laporan (${res.status})`);
          return;
        }
        const json: { data: ApiReport[] } = await res.json();
        if (!cancelled) setReports(json.data ?? []);
      } catch {
        if (!cancelled) setError("Tidak dapat terhubung ke server.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const list = reports.filter(
    r => matchesFilter(r.status, filter) &&
         (q === "" || r.title.toLowerCase().includes(q.toLowerCase()))
  );

  const counts: Record<FilterTab, number> = {
    all:      reports.length,
    new:      reports.filter(r => r.status === "PENDING").length,
    progress: reports.filter(r => r.status === "IN_REVIEW" || r.status === "IN_PROGRESS" || r.status === "DISPATCHED").length,
    resolved: reports.filter(r => r.status === "RESOLVED").length,
  };

  return (
    <main className="flex-1 px-5 md:px-10 py-8 max-w-[1400px] w-full mx-auto">

      {/* Header */}
      <header className="mb-8">
        <div className="text-xs uppercase tracking-[0.25em] text-accent mb-2">Aktivitas anda</div>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-gradient">Laporan Saya</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Setiap laporan yang telah Anda kirimkan dan status penyelesaian saat ini.
        </p>
      </header>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="glass rounded-xl px-3.5 py-2 flex items-center gap-2 flex-1 max-w-md">
          <Search size={14} className="text-muted-foreground shrink-0" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search your reports…"
            className="bg-transparent outline-none text-sm w-full placeholder:text-muted-foreground/60" />
        </div>
        <div className="glass rounded-xl p-1 flex items-center gap-1">
          {FILTER_TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-smooth flex items-center gap-1.5 ${
                filter === key
                  ? "gradient-primary text-primary-foreground shadow-glow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
              {counts[key] > 0 && (
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  filter === key ? "bg-white/20 text-primary-foreground" : "bg-white/10 text-muted-foreground"
                }`}>{counts[key]}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tabel */}
      <div className="glass rounded-2xl shadow-soft overflow-hidden">

        {/* Header kolom desktop */}
        <div className="hidden md:grid grid-cols-[80px_2.5fr_1.2fr_1fr_1fr_1.4fr_100px_40px] gap-4 px-5 py-3 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
          <div>Gambar</div>
          <div>Laporan</div>
          <div>Kategori</div>
          <div>Status</div>
          <div className="flex items-center gap-1">
            <span>🤖</span>
            <span>Diteruskan kepada dinas</span>
          </div>
          <div>Lokasi</div>
          <div>Dikirim</div>
          <div />
        </div>

        <div className="divide-y divide-border">

          {/* Loading */}
          {loading && (
            <div className="p-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 size={24} className="animate-spin text-accent" />
              <span className="text-sm">Memuat laporan…</span>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="p-12 flex flex-col items-center justify-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <p className="text-sm text-red-300 text-center max-w-xs">{error}</p>
              <button onClick={() => window.location.reload()} className="text-xs text-accent hover:underline mt-1">
                Coba lagi
              </button>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && list.length === 0 && (
            <div className="p-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <div className="h-12 w-12 rounded-2xl bg-white/5 border border-border flex items-center justify-center">
                <FileX size={20} className="text-muted-foreground" />
              </div>
              <p className="text-sm text-center">
                {reports.length === 0
                  ? "Anda belum memiliki laporan. Buat laporan pertama Anda!"
                  : "Tidak ada laporan yang cocok dengan filter."}
              </p>
            </div>
          )}

          {/* Rows */}
          {!loading && !error && list.map(r => {
            const cat = CATEGORY_DISPLAY[r.category] ?? { label: r.category, color: "gray" };
            // ✅ FIX: fallback jika status tidak dikenali
            const status = STATUS_DISPLAY[r.status] ?? { label: r.status, variant: "new" };
            return (
              <div
                key={r.id}
                className="grid grid-cols-[64px_1fr_auto] md:grid-cols-[80px_2.5fr_1.2fr_1fr_1fr_1.4fr_100px_40px] gap-4 px-5 py-4 hover:bg-white/[0.03] transition-smooth items-center"
              >
                {/* Gambar */}
                <img
                  src={r.imageUrl ?? PLACEHOLDER_IMG} alt="" loading="lazy"
                  onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMG; }}
                  className="h-14 w-14 md:h-16 md:w-16 rounded-lg object-cover bg-white/5"
                />

                {/* Judul + ID */}
                <div className="min-w-0">
                  <div className="text-[10px] text-muted-foreground tracking-wider font-mono">
                    {toShortId(r.id)}
                  </div>
                  <div className="text-sm font-medium truncate">{r.title}</div>
                  {/* Mobile: badges di sini */}
                  <div className="md:hidden flex flex-wrap gap-1.5 mt-1.5">
                    <CategoryBadge category={cat.color} label={cat.label} />
                    <StatusBadge status={status.variant as any} />
                    <RowAIBadge
                      reportId={r.id}
                      initialLabel={r.ai_label}
                      initialScore={r.confidence_score}
                      initialOverridden={r.ai_overridden}
                    />
                  </div>
                </div>

                {/* Kategori — desktop */}
                <div className="hidden md:block">
                  <CategoryBadge category={cat.color} label={cat.label} />
                </div>

                {/* Status — desktop */}
                <div className="hidden md:block">
                  <StatusBadge status={status.variant as any} />
                </div>

                {/* DINAS AI — desktop */}
                <div className="hidden md:block">
                  <RowAIBadge
                    reportId={r.id}
                    initialLabel={r.ai_label}
                    initialScore={r.confidence_score}
                    initialOverridden={r.ai_overridden}
                  />
                </div>

                {/* Lokasi */}
                <div className="hidden md:block text-xs text-muted-foreground truncate">
                  {toTitle(r.village)}, {toTitle(r.city)}
                </div>

                {/* Waktu */}
                <div className="hidden md:block text-xs text-muted-foreground whitespace-nowrap">
                  {timeAgo(r.createdAt)}
                </div>

                {/* Action */}
                <button className="hidden md:flex h-8 w-8 rounded-lg hover:bg-white/5 items-center justify-center transition-smooth">
                  <MoreHorizontal size={15} className="text-muted-foreground" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      {!loading && !error && reports.length > 0 && (
        <p className="text-[11px] text-muted-foreground text-center mt-4">
          Menampilkan {list.length} dari {reports.length} laporan
        </p>
      )}
    </main>
  );
}