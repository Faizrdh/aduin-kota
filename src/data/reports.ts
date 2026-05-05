/*eslint-disable*/
// src/data/reports.ts

import wasteImg      from "@/assets/report-waste.jpg";
import potholeImg    from "@/assets/report-pothole.jpg";
import streetlightImg from "@/assets/report-streetlight.jpg";
import floodImg      from "@/assets/report-flood.jpg";

// ─── Legacy types (dipakai submit.tsx, map.tsx, dll) ─────────────────────────
export type Category = "waste" | "infra" | "disturb" | "land";
export type Status   = "new" | "progress" | "dispatched" | "resolved" | "cancelled";

// ─── DB types (dipakai incoming-reports, server, API) ────────────────────────
export type DbCategory = "WASTE" | "INFRA" | "DISTURB" | "LAND";
export type DbStatus   = "PENDING" | "IN_REVIEW" | "IN_PROGRESS" | "DISPATCHED" | "RESOLVED" | "REJECTED";
export type DbPriority = "NORMAL" | "HIGH" | "EMERGENCY";

// ─── CATEGORIES — support KEDUA format ───────────────────────────────────────
export const CATEGORIES: Record<Category, { label: string; color: string; emoji: string; icon: string }> = {
  waste:   { label: "Pengelolaan Sampah",  color: "var(--cat-waste)",   emoji: "🗑️", icon: "Trash2"        },
  infra:   { label: "Infrastruktur",       color: "var(--cat-infra)",   emoji: "🏗️", icon: "Construction"  },
  disturb: { label: "Gangguan Ketertiban", color: "var(--cat-disturb)", emoji: "⚠️", icon: "AlertTriangle" },
  land:    { label: "Tanah / Sosial",      color: "var(--cat-land)",    emoji: "🏘️", icon: "MapPinned"     },
};

// DB uppercase → sama tapi pakai warna hex (untuk badge API)
export const DB_CATEGORIES: Record<DbCategory, { label: string; color: string; emoji: string; icon: string }> = {
  WASTE:   { label: "Pengelolaan Sampah",  color: "#EF4444", emoji: "🗑️", icon: "Trash2"        },
  INFRA:   { label: "Infrastruktur",       color: "#3B82F6", emoji: "🏗️", icon: "Construction"  },
  DISTURB: { label: "Gangguan Ketertiban", color: "#F59E0B", emoji: "⚠️", icon: "AlertTriangle" },
  LAND:    { label: "Tanah / Sosial",      color: "#22C55E", emoji: "🏘️", icon: "MapPinned"     },
};

// ─── STATUSES ─────────────────────────────────────────────────────────────────
export const STATUSES: Record<Status, { label: string; color: string }> = {
  new:        { label: "Baru",         color: "var(--status-new)"       },
  progress:   { label: "Dalam Proses", color: "var(--status-progress)"  },
  dispatched: { label: "Diteruskan",   color: "#A78BFA"                 },
  resolved:   { label: "Selesai",      color: "var(--status-resolved)"  },
  cancelled:  { label: "Dibatalkan",   color: "var(--status-cancelled)" },
};

export const DB_STATUS_DISPLAY: Record<DbStatus, { label: string; variant: Status; color: string }> = {
  PENDING:     { label: "Baru",            variant: "new",        color: "#E5C100" },
  IN_REVIEW:   { label: "Sedang Ditinjau", variant: "progress",   color: "#82C8E5" },
  IN_PROGRESS: { label: "Dalam Proses",    variant: "progress",   color: "#82C8E5" },
  DISPATCHED:  { label: "Diteruskan",      variant: "dispatched", color: "#A78BFA" },
  RESOLVED:    { label: "Selesai",         variant: "resolved",   color: "#5BCF8C" },
  REJECTED:    { label: "Ditolak",         variant: "cancelled",  color: "#E03A3A" },
};

export const NEARBY_STATUS_LABEL: Record<DbStatus, { label: string; color: string }> = {
  PENDING:     { label: "Menunggu",        color: "#E5C100" },
  IN_REVIEW:   { label: "Sedang Ditinjau", color: "#82C8E5" },
  IN_PROGRESS: { label: "Diproses",        color: "#82C8E5" },
  DISPATCHED:  { label: "Diteruskan",      color: "#A78BFA" },
  RESOLVED:    { label: "Selesai",         color: "#5BCF8C" },
  REJECTED:    { label: "Ditolak",         color: "#E03A3A" },
};

export const PRIORITY_DISPLAY: Record<DbPriority, { label: string; color: string; emoji: string }> = {
  NORMAL:    { label: "Normal",    color: "#64748b", emoji: ""   },
  HIGH:      { label: "Prioritas", color: "#F59E0B", emoji: "⚡" },
  EMERGENCY: { label: "Darurat",   color: "#EF4444", emoji: "🔥" },
};

// ─── Report type (legacy — dipakai map & mock data) ───────────────────────────
export type Report = {
  id:          string;
  title:       string;
  description: string;
  category:    Category;
  status:      Status;
  lat:         number;
  lng:         number;
  image:       string;
  region:      { province: string; city: string; district: string; subdistrict: string };
  createdAt:   string;
  reporter:    string;
};

// ─── Regions ──────────────────────────────────────────────────────────────────
export const INDONESIA_REGIONS: Record<string, Record<string, Record<string, string[]>>> = {
  "DKI Jakarta": {
    "Jakarta Pusat": {
      "Menteng":     ["Menteng", "Pegangsaan", "Cikini", "Gondangdia"],
      "Tanah Abang": ["Bendungan Hilir", "Karet Tengsin", "Kebon Melati"],
    },
    "Jakarta Selatan": {
      "Kebayoran Baru": ["Senayan", "Melawai", "Pulo", "Gandaria Utara"],
      "Setiabudi":      ["Karet", "Kuningan Timur", "Menteng Atas"],
    },
  },
  "Jawa Barat": {
    "Bandung": {
      "Coblong":  ["Dago", "Cipaganti", "Lebakgede"],
      "Sukajadi": ["Cipedes", "Pasteur", "Sukabungah"],
    },
    "Bogor": {
      "Bogor Tengah": ["Pabaton", "Cibogor", "Tegallega"],
    },
  },
  "Jawa Timur": {
    "Surabaya": {
      "Genteng":   ["Embong Kaliasin", "Genteng", "Kapasari"],
      "Wonokromo": ["Darmo", "Sawunggaling", "Jagir"],
    },
  },
  "Bali": {
    "Denpasar": {
      "Denpasar Selatan": ["Sanur", "Renon", "Sesetan"],
    },
  },
};

// ─── Mock reports (legacy) ────────────────────────────────────────────────────
export const REPORTS: Report[] = [
  { id: "RPT-2041", title: "Overflowing dumpster on Jl. Sudirman",   description: "Trash piling up for 4 days, attracting rats.",              category: "waste",   status: "new",      lat: -6.2088, lng: 106.8200, image: wasteImg,       region: { province: "DKI Jakarta",  city: "Jakarta Pusat",   district: "Tanah Abang",    subdistrict: "Bendungan Hilir"   }, createdAt: "2025-04-22T08:14:00Z", reporter: "Anissa K."  },
  { id: "RPT-2040", title: "Deep pothole near intersection",           description: "Causing motorbike accidents during rainy hours.",          category: "infra",   status: "progress", lat: -6.2150, lng: 106.8451, image: potholeImg,     region: { province: "DKI Jakarta",  city: "Jakarta Selatan", district: "Setiabudi",       subdistrict: "Karet"             }, createdAt: "2025-04-21T17:02:00Z", reporter: "Budi S."    },
  { id: "RPT-2039", title: "Broken streetlight on Jl. Dago",          description: "Has been off for two weeks.",                              category: "infra",   status: "new",      lat: -6.8915, lng: 107.6107, image: streetlightImg, region: { province: "Jawa Barat",   city: "Bandung",         district: "Coblong",         subdistrict: "Dago"              }, createdAt: "2025-04-22T19:45:00Z", reporter: "Citra M."   },
  { id: "RPT-2038", title: "Recurrent flooding in narrow alley",       description: "Drainage clogged, water reaches knee height.",            category: "disturb", status: "progress", lat: -7.2575, lng: 112.7521, image: floodImg,       region: { province: "Jawa Timur",   city: "Surabaya",        district: "Genteng",         subdistrict: "Embong Kaliasin"   }, createdAt: "2025-04-20T11:22:00Z", reporter: "Dewi P."    },
  { id: "RPT-2037", title: "Illegal dumping at empty lot",             description: "Construction debris blocking sidewalk.",                  category: "land",    status: "new",      lat: -6.2615, lng: 106.7810, image: wasteImg,       region: { province: "DKI Jakarta",  city: "Jakarta Selatan", district: "Kebayoran Baru",  subdistrict: "Gandaria Utara"    }, createdAt: "2025-04-22T06:30:00Z", reporter: "Eka R."     },
  { id: "RPT-2036", title: "Loud construction at night",               description: "Heavy equipment past midnight.",                          category: "disturb", status: "resolved", lat: -6.1944, lng: 106.8229, image: streetlightImg, region: { province: "DKI Jakarta",  city: "Jakarta Pusat",   district: "Menteng",         subdistrict: "Cikini"            }, createdAt: "2025-04-18T22:10:00Z", reporter: "Faisal T."  },
  { id: "RPT-2035", title: "Sidewalk collapse near park",              description: "Exposed rebar is a hazard for pedestrians.",             category: "infra",   status: "resolved", lat: -6.5944, lng: 106.7892, image: potholeImg,     region: { province: "Jawa Barat",   city: "Bogor",           district: "Bogor Tengah",    subdistrict: "Pabaton"           }, createdAt: "2025-04-15T09:00:00Z", reporter: "Gita L."    },
  { id: "RPT-2034", title: "Land boundary dispute marker damaged",     description: "Official boundary stone was knocked over.",               category: "land",    status: "progress", lat: -8.6705, lng: 115.2126, image: wasteImg,       region: { province: "Bali",         city: "Denpasar",        district: "Denpasar Selatan", subdistrict: "Renon"            }, createdAt: "2025-04-19T14:55:00Z", reporter: "Hadi N."    },
  { id: "RPT-2033", title: "Standing water breeding mosquitoes",       description: "Stagnant pool behind market, dengue cases rising.",       category: "waste",   status: "new",      lat: -6.9034, lng: 107.6181, image: floodImg,       region: { province: "Jawa Barat",   city: "Bandung",         district: "Sukajadi",        subdistrict: "Pasteur"           }, createdAt: "2025-04-22T12:08:00Z", reporter: "Indah W."   },
  { id: "RPT-2032", title: "Cracked bridge railing",                   description: "Section of railing missing, dangerous for children.",    category: "infra",   status: "new",      lat: -7.2459, lng: 112.7378, image: potholeImg,     region: { province: "Jawa Timur",   city: "Surabaya",        district: "Wonokromo",       subdistrict: "Darmo"             }, createdAt: "2025-04-22T07:30:00Z", reporter: "Joko H."    },
  { id: "RPT-2031", title: "Public park encroached by stalls",         description: "Informal vendors blocking public access.",                category: "land",    status: "new",      lat: -6.2297, lng: 106.8262, image: streetlightImg, region: { province: "DKI Jakarta",  city: "Jakarta Selatan", district: "Setiabudi",       subdistrict: "Kuningan Timur"    }, createdAt: "2025-04-21T15:40:00Z", reporter: "Kartika V." },
  { id: "RPT-2030", title: "Hazardous waste left at curb",             description: "Bags labelled with chemical warnings next to bin.",      category: "waste",   status: "progress", lat: -6.1751, lng: 106.8650, image: wasteImg,       region: { province: "DKI Jakarta",  city: "Jakarta Pusat",   district: "Menteng",         subdistrict: "Pegangsaan"        }, createdAt: "2025-04-20T10:15:00Z", reporter: "Lukman A."  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function getStats(reports: Report[]) {
  return {
    total:    reports.length,
    open:     reports.filter(r => r.status === "new").length,
    progress: reports.filter(r => r.status === "progress").length,
    resolved: reports.filter(r => r.status === "resolved").length,
  };
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (m < 1)   return "Baru saja";
  if (h < 1)   return `${m}m ago`;
  if (d < 1)   return `${h}h ago`;
  if (d === 1) return "Kemarin";
  return `${d}d ago`;
}

export function toShortId(id: string): string {
  return `RPT-${id.slice(-4).toUpperCase()}`;
}

export function toTitle(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function dbStatusToVariant(s: DbStatus): Status {
  return DB_STATUS_DISPLAY[s]?.variant ?? "new";
}

// Helper: konversi DbCategory uppercase → lowercase Category
export function dbCategoryToLegacy(c: DbCategory): Category {
  return c.toLowerCase() as Category;
}