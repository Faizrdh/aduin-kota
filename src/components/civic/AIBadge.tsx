/*eslint-disable*/
// src/components/civic/AIBadge.tsx


import { useState } from "react";
import { Bot, ChevronDown, Check, Loader2, AlertTriangle, Pencil } from "lucide-react";
import { authFetch } from "@/data/login";

// ─── Konstanta Warna per Dinas ────────────────────────────────────────────────
// Setiap dinas punya warna unik agar mudah dibedakan secara visual.

const DINAS_CONFIG: Record<
  string,
  { bg: string; border: string; text: string; dot: string; emoji: string }
> = {
  "DLH":              { bg: "bg-emerald-500/15",  border: "border-emerald-500/40",  text: "text-emerald-400",  dot: "#10b981", emoji: "🌿" },
  "Dinas Kesehatan":  { bg: "bg-red-500/15",       border: "border-red-500/40",       text: "text-red-400",      dot: "#ef4444", emoji: "🏥" },
  "PUPR":             { bg: "bg-orange-500/15",    border: "border-orange-500/40",    text: "text-orange-400",   dot: "#f97316", emoji: "🏗️" },
  "Dishub":           { bg: "bg-blue-500/15",      border: "border-blue-500/40",      text: "text-blue-400",     dot: "#3b82f6", emoji: "🚦" },
  "DPKP":             { bg: "bg-yellow-500/15",    border: "border-yellow-500/40",    text: "text-yellow-400",   dot: "#eab308", emoji: "🏠" },
  "BPBD":             { bg: "bg-cyan-500/15",      border: "border-cyan-500/40",      text: "text-cyan-400",     dot: "#06b6d4", emoji: "⛑️" },
  "Satpol PP":        { bg: "bg-purple-500/15",    border: "border-purple-500/40",    text: "text-purple-400",   dot: "#a855f7", emoji: "🛡️" },
  "BPN":              { bg: "bg-amber-500/15",     border: "border-amber-500/40",     text: "text-amber-400",    dot: "#f59e0b", emoji: "📋" },
  "Dinas Sosial":     { bg: "bg-pink-500/15",      border: "border-pink-500/40",      text: "text-pink-400",     dot: "#ec4899", emoji: "🤝" },
  "DPMPTSP":          { bg: "bg-indigo-500/15",    border: "border-indigo-500/40",    text: "text-indigo-400",   dot: "#6366f1", emoji: "📄" },
};

const DINAS_LABELS = Object.keys(DINAS_CONFIG);

const FALLBACK_CONFIG = {
  bg: "bg-white/10", border: "border-white/20", text: "text-muted-foreground",
  dot: "#64748b",    emoji: "🏛️",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface AIBadgeProps {
  label:        string | null | undefined;
  score?:       number | null;
  overridden?:  boolean;         // apakah sudah dioverride admin?
  size?:        "sm" | "md" | "lg";
  showScore?:   boolean;         // tampilkan persentase skor?
  className?:   string;
}

interface AIBadgeAdminProps extends AIBadgeProps {
  reportId:   string;             // diperlukan untuk kirim PATCH request
  onOverride?: (newLabel: string) => void; // callback setelah override berhasil
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function getConfig(label: string | null | undefined) {
  if (!label) return FALLBACK_CONFIG;
  return DINAS_CONFIG[label] ?? FALLBACK_CONFIG;
}

function scoreToPercent(score: number | null | undefined): string {
  if (score == null) return "";
  return `${Math.round(score * 100)}%`;
}

function confidenceClass(score: number | null | undefined): string {
  if (score == null || score >= 0.7) return "";       // confident — warna normal
  if (score >= 0.4) return "opacity-75";              // medium — sedikit redup
  return "opacity-50";                                 // low — sangat redup
}

// ─── Komponen Utama: AIBadge (read-only) ─────────────────────────────────────

export function AIBadge({ label, score, overridden, size = "md", showScore, className = "" }: AIBadgeProps) {
  const cfg = getConfig(label);

  // ── Pending state (AI belum selesai) ──
  if (!label) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-medium text-muted-foreground bg-white/5 border-white/10 ${className}`}>
        <Loader2 size={9} className="animate-spin shrink-0" />
        Menunggu AI…
      </span>
    );
  }

  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-[10px] gap-1 rounded-md",
    md: "px-2    py-1   text-[11px] gap-1.5 rounded-lg",
    lg: "px-3    py-1.5 text-xs    gap-2   rounded-xl",
  }[size];

  const iconSize = { sm: 9, md: 10, lg: 12 }[size];

  return (
    <span
      className={`inline-flex items-center font-semibold border transition-smooth ${sizeClasses} ${cfg.bg} ${cfg.border} ${cfg.text} ${confidenceClass(score)} ${className}`}
      title={score != null ? `Confidence: ${scoreToPercent(score)}` : undefined}
    >
      {/* Robot icon — penanda bahwa ini hasil AI */}
      <Bot size={iconSize} className="shrink-0 opacity-80" />

      {/* Emoji dinas */}
      <span className="leading-none">{cfg.emoji}</span>

      {/* Label dinas */}
      <span>{label}</span>

      {/* Skor (opsional) */}
      {showScore && score != null && (
        <span className="opacity-60 font-normal">{scoreToPercent(score)}</span>
      )}

      {/* Indicator override admin */}
      {overridden && (
        <span
          className="ml-0.5 rounded px-1 py-px text-[8px] font-bold bg-white/10"
          title="Label diubah manual oleh admin"
        >
          OVERRIDE
        </span>
      )}
    </span>
  );
}

// ─── Komponen Admin: AIBadgeAdmin (dengan dropdown override) ──────────────────
//
// Menampilkan badge yang sama dengan AIBadge, tapi dengan tombol edit (✏️)
// saat di-hover. Klik tombol → dropdown pilih dinas lain → PATCH ke API.
//

export function AIBadgeAdmin({
  label, score, overridden, reportId, size = "md", showScore, className = "", onOverride,
}: AIBadgeAdminProps) {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const handleOverride = async (newLabel: string) => {
    if (newLabel === label) { setOpen(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/reports/${reportId}/ai-label`, {
        method: "PATCH",
        body:   JSON.stringify({ ai_label: newLabel }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? `HTTP ${res.status}`);
      }
      setOpen(false);
      onOverride?.(newLabel);
    } catch (err: any) {
      setError(err?.message ?? "Gagal override label.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`relative inline-flex items-center gap-1.5 group ${className}`}>
      {/* Badge utama */}
      <AIBadge label={label} score={score} overridden={overridden} size={size} showScore={showScore} />

      {/* Tombol edit — hanya tampil saat hover */}
      <button
        onClick={() => setOpen((p) => !p)}
        disabled={loading}
        className="opacity-0 group-hover:opacity-100 transition-smooth h-5 w-5 rounded flex items-center justify-center bg-white/10 hover:bg-white/20 disabled:opacity-50 shrink-0"
        title="Override label AI"
      >
        {loading ? <Loader2 size={10} className="animate-spin text-accent" /> : <Pencil size={10} className="text-muted-foreground" />}
      </button>

      {/* Dropdown daftar dinas */}
      {open && (
        <>
          {/* Overlay untuk close on click-outside */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div className="absolute left-0 top-full mt-1 z-50 w-48 rounded-xl border border-border bg-[rgba(15,23,42,0.97)] backdrop-blur-xl shadow-2xl overflow-hidden">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Pilih Dinas</p>
            </div>

            {error && (
              <div className="px-3 py-2 flex items-center gap-1.5 text-[10px] text-red-400 bg-red-500/10">
                <AlertTriangle size={10} /> {error}
              </div>
            )}

            <div className="max-h-64 overflow-y-auto py-1">
              {DINAS_LABELS.map((dinasLabel) => {
                const cfg     = DINAS_CONFIG[dinasLabel];
                const isActive = dinasLabel === label;
                return (
                  <button
                    key={dinasLabel}
                    onClick={() => handleOverride(dinasLabel)}
                    disabled={loading}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-smooth hover:bg-white/5 disabled:opacity-50 ${isActive ? "bg-white/5" : ""}`}
                  >
                    <span className="text-sm leading-none">{cfg.emoji}</span>
                    <span className={isActive ? cfg.text : "text-muted-foreground"}>{dinasLabel}</span>
                    {isActive && <Check size={10} className={`ml-auto ${cfg.text}`} />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Ekspor ───────────────────────────────────────────────────────────────────
export { DINAS_LABELS, DINAS_CONFIG };
export type { AIBadgeProps, AIBadgeAdminProps };