/*eslint-disable*/

import { motion } from "framer-motion";
import { ArrowRight, MapPin, Loader2 } from "lucide-react";
import { CATEGORIES } from "@/data/reports";

// ─── Types ────────────────────────────────────────────────────────────────────

type DbCategory = "WASTE" | "INFRA" | "DISTURB" | "LAND";
type DbStatus   = "PENDING" | "IN_REVIEW" | "IN_PROGRESS" | "RESOLVED" | "REJECTED";

export interface NearbyReportItem {
  id:             string;
  title:          string;
  category:       DbCategory;
  status:         DbStatus;
  lat:            number;
  lng:            number;
  imageUrl:       string | null;
  city:           string;
  district:       string;
  village:        string;
  createdAt:      string;
  distanceMeters: number;
  _count:         { joins: number };
}

interface Props {
  items:    NearbyReportItem[];
  loading?: boolean;
  onSelect: (item: NearbyReportItem) => void;
  compact?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<DbCategory, string> = {
  WASTE:   "#7E2233",
  INFRA:   "#E5C100",
  DISTURB: "#E03A3A",
  LAND:    "#E08A2A",
};

const CATEGORY_LABEL: Record<DbCategory, string> = {
  WASTE:   "Sampah",
  INFRA:   "Infrastruktur",
  DISTURB: "Ketertiban",
  LAND:    "Tata Lahan",
};

const STATUS_COLOR: Record<DbStatus, string> = {
  PENDING:     "#E5C100",
  IN_REVIEW:   "#82C8E5",
  IN_PROGRESS: "#82C8E5",
  RESOLVED:    "#5BCF8C",
  REJECTED:    "#E03A3A",
};

const STATUS_LABEL: Record<DbStatus, string> = {
  PENDING:     "Menunggu",
  IN_REVIEW:   "Ditinjau",
  IN_PROGRESS: "Diproses",
  RESOLVED:    "Selesai",
  REJECTED:    "Ditolak",
};

const PLACEHOLDER_IMG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' fill='%231e293b'/%3E%3Ctext x='20' y='24' text-anchor='middle' fill='%2364748b' font-size='8' font-family='sans-serif'%3ENo img%3C/text%3E%3C/svg%3E";

function formatDist(m: number) {
  return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NearbyReportsSection({ items, loading = false, onSelect, compact = false }: Props) {
  // Skeleton saat loading
  if (loading) {
    return (
      <div className="mt-5 pt-4 border-t border-border/50">
        <div className="flex items-center gap-2 mb-3">
          <Loader2 size={11} className="animate-spin text-muted-foreground" />
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Laporan Sekitar…
          </p>
        </div>
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl mb-2">
            <div className="h-10 w-10 rounded-lg bg-white/5 shrink-0 animate-pulse" />
            <div className="flex-1 space-y-1.5">
              <div className="h-2.5 bg-white/5 rounded animate-pulse w-3/4" />
              <div className="h-2   bg-white/5 rounded animate-pulse w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!items.length) return null;

  const visibleItems = compact ? items.slice(0, 3) : items;

  return (
    <div className="mt-5 pt-4 border-t border-border/50">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <MapPin size={10} className="text-accent" />
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Laporan Sekitar
          </p>
          <span className="text-[10px] font-semibold text-accent tabular-nums">
            {items.length}
          </span>
        </div>
        <span className="text-[9px] text-muted-foreground/50 bg-white/5 px-2 py-0.5 rounded-full">
          dalam 2 km
        </span>
      </div>

      {/* Cards */}
      <div className="space-y-1.5">
        {visibleItems.map((item, i) => (
          <motion.button
            key={item.id}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06, duration: 0.25 }}
            onClick={() => onSelect(item)}
            className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl
                       glass border border-transparent
                       hover:bg-white/8 hover:border-white/10
                       active:scale-[0.98]
                       transition-all duration-200 group text-left"
          >
            {/* Thumbnail */}
            <div className="h-10 w-10 rounded-lg overflow-hidden shrink-0 bg-white/5">
              <img
                src={item.imageUrl ?? PLACEHOLDER_IMG}
                alt={item.title}
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = PLACEHOLDER_IMG;
                }}
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate leading-snug text-foreground/90">
                {item.title}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {/* Category dot */}
                <span
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ background: CATEGORY_COLOR[item.category] }}
                />
                <span className="text-[10px] text-muted-foreground truncate">
                  {CATEGORY_LABEL[item.category]}
                </span>
                <span className="text-muted-foreground/30">·</span>
                {/* Status pill */}
                <span
                  className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{
                    color: STATUS_COLOR[item.status],
                    background: `${STATUS_COLOR[item.status]}18`,
                  }}
                >
                  {STATUS_LABEL[item.status]}
                </span>
              </div>
            </div>

            {/* Distance + arrow */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span
                className="text-[10px] font-bold tabular-nums"
                style={{ color: "#82C8E5" }}
              >
                {formatDist(item.distanceMeters)}
              </span>
              <ArrowRight
                size={11}
                className="text-muted-foreground/40 group-hover:text-accent
                           group-hover:translate-x-0.5 transition-all duration-200"
              />
            </div>
          </motion.button>
        ))}
      </div>

      {/* "show more" hint when compact & truncated */}
      {compact && items.length > 3 && (
        <p className="text-[10px] text-muted-foreground/50 text-center mt-2">
          +{items.length - 3} laporan lainnya — buka detail untuk melihat semua
        </p>
      )}
    </div>
  );
}