/*eslint-disable*/

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
  CartesianGrid, PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";
import {
  TrendingUp, Clock, CheckCircle2, Activity, Loader2, AlertCircle, RefreshCw,
} from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — CivicSpot" },
      { name: "description", content: "Visual insights into citywide reporting trends, response times, and category breakdowns." },
    ],
  }),
  component: Analytics,
});

// ─── Types ────────────────────────────────────────────────────────────────────
type RangeKey = "1d" | "7d" | "30d" | "90d" | "365d" | "all";

interface AnalyticsKpis {
  totalReports: number; weekDelta: number; avgResponseHours: number;
  avgDeltaMin: number; completionRate: number; completionDelta: number;
  activeDistricts: number; activeDistrictsThisWeek: number;
}
interface AnalyticsData {
  kpis: AnalyticsKpis;
  trend: Array<{ day: string; new: number; resolved: number }>;
  categoryBreakdown: Array<{ category: string; count: number }>;
  responseByCat: Array<{ cat: string; hours: number }>;
  topRegions: Array<{ name: string; rate: number; count: number }>;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CAT_META: Record<string, { label: string; color: string }> = {
  WASTE:   { label: "Pengelolaan Sampah",      color: "#E24B4A" },
  INFRA:   { label: "Infrastruktur",           color: "#EF9F27" },
  DISTURB: { label: "Kegagalan Infrastruktur", color: "#993556" },
  LAND:    { label: "Tanah / Sosial",          color: "#BA7517" },
};
const CAT_SHORT: Record<string, string> = {
  WASTE: "Sampah", INFRA: "Infra", DISTURB: "Disturb", LAND: "Tanah",
};

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "1d",   label: "1 Hari"  },
  { key: "7d",   label: "1 Minggu" },
  { key: "30d",  label: "1 Bulan"  },
  { key: "90d",  label: "3 Bulan"  },
  { key: "365d", label: "12 Bulan" },
  { key: "all",  label: "Semua"    },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isSessionError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes("session") || msg.includes("expired") || msg.includes("401");
  }
  return false;
}

function fmtAvgResp(hours: number): string {
  if (hours === 0) return "—";
  if (hours < 1)   return `${Math.round(hours * 60)}m`;
  return `${hours.toFixed(1)}h`;
}
function fmtDeltaResp(deltaMin: number): string {
  if (deltaMin === 0) return "sama";
  const abs = Math.abs(deltaMin);
  return deltaMin < 0 ? `-${abs} mnt` : `+${abs} mnt`;
}
function fmtWeekDelta(n: number): string { return n >= 0 ? `+${n}%` : `${n}%`; }

// ─── Skeletons ────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="glass rounded-2xl p-5 shadow-soft animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-2.5 w-24 bg-white/10 rounded" /><div className="h-4 w-4 bg-white/10 rounded" />
      </div>
      <div className="h-9 w-20 bg-white/15 rounded mb-2" /><div className="h-2 w-14 bg-white/10 rounded" />
    </div>
  );
}
function SkeletonChart({ height = 72 }: { height?: number }) {
  return (
    <div className="flex items-center justify-center animate-pulse bg-white/5 rounded-xl" style={{ height }}>
      <Loader2 size={22} className="animate-spin text-white/20" />
    </div>
  );
}

const TOOLTIP_STYLE = {
  background: "rgba(20,25,45,0.95)", border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12, fontSize: 12,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
function useAnalytics(range: RangeKey) {
  return useQuery<AnalyticsData>({
    queryKey: ["analytics", range],              // ← range masuk ke cache key
    queryFn: async () => {
      const res = await apiFetch(`/api/reports/analytics?range=${range}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (isSessionError(error)) return false;
      return failureCount < 1;
    },
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
function Analytics() {
  const [range, setRange] = useState<RangeKey>("7d");
  const { data, isLoading, isError, error, refetch, isFetching } = useAnalytics(range);
  const sessionExpired = isSessionError(error);

  const kpiCards = data ? [
    {
      label: "total pengajuan", value: data.kpis.totalReports.toLocaleString("id-ID"),
      delta: fmtWeekDelta(data.kpis.weekDelta), positive: data.kpis.weekDelta >= 0,
      icon: Activity, color: "var(--primary)",
    },
    {
      label: "rata-rata respons", value: fmtAvgResp(data.kpis.avgResponseHours),
      delta: fmtDeltaResp(data.kpis.avgDeltaMin), positive: data.kpis.avgDeltaMin <= 0,
      icon: Clock, color: "var(--accent)",
    },
    {
      label: "tingkat penyelesaian", value: `${data.kpis.completionRate}%`,
      delta: data.kpis.completionDelta >= 0
        ? `+${data.kpis.completionDelta} pts`
        : `${data.kpis.completionDelta} pts`,
      positive: data.kpis.completionDelta >= 0,
      icon: CheckCircle2, color: "var(--status-resolved)",
    },
    {
      label: "wilayah aktif", value: String(data.kpis.activeDistricts),
      delta: `+${data.kpis.activeDistrictsThisWeek} periode ini`, positive: true,
      icon: TrendingUp, color: "var(--status-progress)",
    },
  ] : [];

  const catData = data?.categoryBreakdown.map((c) => ({
    name:  CAT_META[c.category]?.label ?? c.category,
    value: c.count,
    color: CAT_META[c.category]?.color ?? "#888",
  })) ?? [];

  const responseByCat = data?.responseByCat.map((r) => ({
    cat:   CAT_SHORT[r.cat] ?? r.cat,
    hours: r.hours,
  })) ?? [];

  // Label dinamis untuk sumbu X chart trend
  const selectedRangeLabel = RANGE_OPTIONS.find((o) => o.key === range)?.label ?? "";

  return (
    <main className="flex-1 px-5 md:px-10 py-8 max-w-[1500px] w-full mx-auto">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-accent mb-2">Data Analitik</div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-gradient">
            Data analitik pengaduan masyarakat
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Monitoring &amp; distribusi pengaduan di seluruh wilayah Indonesia.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching || sessionExpired}
          className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground
                     transition-colors disabled:opacity-40 shrink-0"
        >
          <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
          {isFetching ? "Memperbarui…" : "Live · 1m"}
        </button>
      </header>

      {/* ── Range Filter Bar ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setRange(opt.key)}
            className={[
              "px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
              range === opt.key
                ? "bg-accent text-white shadow-md scale-105"
                : "glass text-muted-foreground hover:text-foreground hover:bg-white/10",
            ].join(" ")}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* ── Error Banner ────────────────────────────────────────────────────── */}
      {isError && (
        <div className="glass rounded-2xl p-4 mb-6 flex items-center gap-3 text-sm
                        border border-red-500/20 text-red-400">
          <AlertCircle size={16} className="shrink-0" />
          {sessionExpired ? (
            <span>Sesi habis. Mengalihkan ke halaman login…</span>
          ) : (
            <>
              <span>Gagal memuat data analitik{error instanceof Error ? `: ${error.message}` : ""}.</span>
              <button
                onClick={() => refetch()}
                className="ml-auto text-xs underline underline-offset-2 hover:no-underline"
              >
                Coba lagi
              </button>
            </>
          )}
        </div>
      )}

      {/* ── KPI Cards ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : kpiCards.map((k) => (
            <div key={k.label} className="glass rounded-2xl p-5 shadow-soft relative overflow-hidden">
              <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-15 blur-2xl pointer-events-none"
                   style={{ background: k.color }} />
              <div className="flex items-center justify-between mb-3 relative">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</span>
                <k.icon size={16} style={{ color: k.color }} />
              </div>
              <div className="font-display text-3xl font-bold relative">{k.value}</div>
              <div className="text-xs mt-1 relative font-medium"
                   style={{ color: k.positive ? k.color : "#E24B4A" }}>
                {k.delta}
              </div>
            </div>
          ))
        }
      </div>

      {/* ── Trend + Pie ─────────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 glass rounded-2xl p-6 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-lg font-semibold">Laporan dari waktu ke waktu</h3>
              <p className="text-xs text-muted-foreground">
                {selectedRangeLabel} · Laporan baru vs Selesai
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-accent" />Laporan Baru
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: "var(--status-resolved)" }} />
                Selesai
              </span>
            </div>
          </div>
          <div className="h-72">
            {isLoading ? <SkeletonChart height={288} /> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.trend ?? []} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="day" stroke="rgba(255,255,255,0.4)" fontSize={11} />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value, name) => [
                      Number(value ?? 0),
                      name === "new" ? "Laporan Baru" : "Selesai",
                    ]}
                  />
                  <Line type="monotone" dataKey="new" stroke="#82C8E5" strokeWidth={2.5}
                        dot={{ r: 4, fill: "#82C8E5" }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="resolved" stroke="oklch(0.7 0.16 155)"
                        strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="glass rounded-2xl p-6 shadow-soft">
          <h3 className="font-display text-lg font-semibold mb-1">Distribusi Berdasarkan Kategori</h3>
          <p className="text-xs text-muted-foreground mb-4">Seluruh pengajuan</p>
          <div className="h-52">
            {isLoading ? <SkeletonChart height={208} /> : catData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                Belum ada data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={catData} dataKey="value" innerRadius={48} outerRadius={78}
                       paddingAngle={3} stroke="none">
                    {catData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value, _name, props) => [
                      Number(value ?? 0),
                      (props.payload as { name: string }).name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="space-y-1.5 mt-3">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between animate-pulse">
                  <div className="h-2 w-28 bg-white/10 rounded" />
                  <div className="h-2 w-4 bg-white/10 rounded" />
                </div>
              ))
              : catData.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: d.color }} />
                    {d.name}
                  </span>
                  <span className="text-muted-foreground tabular-nums">{d.value}</span>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      {/* ── Bar Chart + Top Regions ──────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass rounded-2xl p-6 shadow-soft">
          <h3 className="font-display text-lg font-semibold mb-1">
            Waktu Respons Berdasarkan Kategori
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Rata-rata jam dari pengiriman ke penyelesaian pertama
          </p>
          <div className="h-64">
            {isLoading ? <SkeletonChart height={256} /> : responseByCat.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                Belum ada laporan yang diselesaikan
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={responseByCat} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="cat" stroke="rgba(255,255,255,0.4)" fontSize={11} />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value) => [`${Number(value ?? 0)}h`, "Rata-rata waktu respons"]}
                  />
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#82C8E5" />
                      <stop offset="100%" stopColor="#0047AB" />
                    </linearGradient>
                  </defs>
                  <Bar dataKey="hours" radius={[8, 8, 0, 0]} fill="url(#barGrad)" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="glass rounded-2xl p-6 shadow-soft">
          <h3 className="font-display text-lg font-semibold mb-1">Wilayah Terbaik</h3>
          <p className="text-xs text-muted-foreground mb-5">
            Diperanking berdasarkan tingkat penyelesaian
          </p>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="h-3 bg-white/10 rounded w-1/2" />
                    <div className="h-3 bg-white/10 rounded w-16" />
                  </div>
                  <div className="h-1.5 bg-white/10 rounded" />
                </div>
              ))}
            </div>
          ) : !data || data.topRegions.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              Belum ada data wilayah yang cukup (minimal 2 laporan per wilayah).
            </div>
          ) : (
            <div className="space-y-4">
              {data.topRegions.map((d, i) => (
                <div key={d.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="h-6 w-6 rounded-md glass flex items-center justify-center
                                       text-[11px] font-bold text-accent shrink-0">
                        {i + 1}
                      </span>
                      <span className="font-medium truncate max-w-[160px]">{d.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums shrink-0 ml-2">
                      {d.rate}% · {d.count} laporan
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full gradient-accent transition-all duration-500"
                      style={{ width: `${d.rate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}