/*eslint-disable*/

import wasteImg from "@/assets/report-waste.jpg";
import potholeImg from "@/assets/report-pothole.jpg";
import streetlightImg from "@/assets/report-streetlight.jpg";
import floodImg from "@/assets/report-flood.jpg";

export type Category = "waste" | "infra" | "disturb" | "land";
export type Status = "new" | "progress" | "resolved" | "cancelled";

export type Report = {
  id: string;
  title: string;
  description: string;
  category: Category;
  status: Status;
  lat: number;
  lng: number;
  image: string;
  region: { province: string; city: string; district: string; subdistrict: string };
  createdAt: string;
  reporter: string;
};

export const CATEGORIES: Record<Category, { label: string; color: string; emoji: string; icon: string }> = {
  waste:   { label: "Pengelolaan Sampah",   color: "var(--cat-waste)",   emoji: "🗑️", icon: "Trash2" },
  infra:   { label: "Infrastruktur",     color: "var(--cat-infra)",   emoji: "🚧", icon: "Construction" },
  disturb: { label: "Kegagalan Infrastruktur",        color: "var(--cat-disturb)", emoji: "⚠️", icon: "AlertTriangle" },
  land:    { label: "Tanah / Sosial",      color: "var(--cat-land)",    emoji: "🏘️", icon: "MapPinned" },
};

export const STATUSES: Record<Status, { label: string; color: string }> = {
  new:      { label: "Baru",         color: "var(--status-new)" },
  progress: { label: "Dalam Proses", color: "var(--status-progress)" },
  resolved: { label: "Selesai",    color: "var(--status-resolved)" },
  cancelled: { label: "Dibatalkan",    color: "var(--status-cancelled)" },
};

// Indonesia administrative hierarchy (subset)
export const INDONESIA_REGIONS: Record<string, Record<string, Record<string, string[]>>> = {
  "DKI Jakarta": {
    "Jakarta Pusat": {
      "Menteng": ["Menteng", "Pegangsaan", "Cikini", "Gondangdia"],
      "Tanah Abang": ["Bendungan Hilir", "Karet Tengsin", "Kebon Melati"],
    },
    "Jakarta Selatan": {
      "Kebayoran Baru": ["Senayan", "Melawai", "Pulo", "Gandaria Utara"],
      "Setiabudi": ["Karet", "Kuningan Timur", "Menteng Atas"],
    },
  },
  "Jawa Barat": {
    "Bandung": {
      "Coblong": ["Dago", "Cipaganti", "Lebakgede"],
      "Sukajadi": ["Cipedes", "Pasteur", "Sukabungah"],
    },
    "Bogor": {
      "Bogor Tengah": ["Pabaton", "Cibogor", "Tegallega"],
    },
  },
  "Jawa Timur": {
    "Surabaya": {
      "Genteng": ["Embong Kaliasin", "Genteng", "Kapasari"],
      "Wonokromo": ["Darmo", "Sawunggaling", "Jagir"],
    },
  },
  "Bali": {
    "Denpasar": {
      "Denpasar Selatan": ["Sanur", "Renon", "Sesetan"],
    },
  },
};

export const REPORTS: Report[] = [
  { id: "RPT-2041", title: "Overflowing dumpster on Jl. Sudirman", description: "tempat piling up for 4 days, attracting rats and producing strong odor near the bus stop.", category: "waste", status: "new", lat: -6.2088, lng: 106.8200, image: wasteImg, region: { province: "DKI Jakarta", city: "Jakarta Pusat", district: "Tanah Abang", subdistrict: "Bendungan Hilir" }, createdAt: "2025-04-22T08:14:00Z", reporter: "Anissa K." },
  { id: "RPT-2040", title: "Deep pothole near intersection", description: "Causing motorbike accidents during rainy hours. Diameter ~80cm, depth 25cm.", category: "infra", status: "progress", lat: -6.2150, lng: 106.8451, image: potholeImg, region: { province: "DKI Jakarta", city: "Jakarta Selatan", district: "Setiabudi", subdistrict: "Karet" }, createdAt: "2025-04-21T17:02:00Z", reporter: "Budi S." },
  { id: "RPT-2039", title: "Broken streetlight on Jl. Dago", description: "Has been off for two weeks, the entire block is dark after sunset.", category: "infra", status: "new", lat: -6.8915, lng: 107.6107, image: streetlightImg, region: { province: "Jawa Barat", city: "Bandung", district: "Coblong", subdistrict: "Dago" }, createdAt: "2025-04-22T19:45:00Z", reporter: "Citra M." },
  { id: "RPT-2038", title: "Recurrent flooding in narrow alley", description: "Drainage clogged, water reaches knee height with every heavy rain.", category: "disturb", status: "progress", lat: -7.2575, lng: 112.7521, image: floodImg, region: { province: "Jawa Timur", city: "Surabaya", district: "Genteng", subdistrict: "Embong Kaliasin" }, createdAt: "2025-04-20T11:22:00Z", reporter: "Dewi P." },
  { id: "RPT-2037", title: "Illegal dumping at empty lot", description: "Construction debris being dumped overnight, blocking sidewalk access.", category: "land", status: "new", lat: -6.2615, lng: 106.7810, image: wasteImg, region: { province: "DKI Jakarta", city: "Jakarta Selatan", district: "Kebayoran Baru", subdistrict: "Gandaria Utara" }, createdAt: "2025-04-22T06:30:00Z", reporter: "Eka R." },
  { id: "RPT-2036", title: "Loud construction at night", description: "Building site running heavy equipment past midnight, residents unable to sleep.", category: "disturb", status: "resolved", lat: -6.1944, lng: 106.8229, image: streetlightImg, region: { province: "DKI Jakarta", city: "Jakarta Pusat", district: "Menteng", subdistrict: "Cikini" }, createdAt: "2025-04-18T22:10:00Z", reporter: "Faisal T." },
  { id: "RPT-2035", title: "Sidewalk collapse near park", description: "Concrete slab caved in, exposed rebar is a hazard for pedestrians.", category: "infra", status: "resolved", lat: -6.5944, lng: 106.7892, image: potholeImg, region: { province: "Jawa Barat", city: "Bogor", district: "Bogor Tengah", subdistrict: "Pabaton" }, createdAt: "2025-04-15T09:00:00Z", reporter: "Gita L." },
  { id: "RPT-2034", title: "Land boundary dispute marker damaged", description: "Official boundary stone was knocked over, neighbors disagree on placement.", category: "land", status: "progress", lat: -8.6705, lng: 115.2126, image: wasteImg, region: { province: "Bali", city: "Denpasar", district: "Denpasar Selatan", subdistrict: "Renon" }, createdAt: "2025-04-19T14:55:00Z", reporter: "Hadi N." },
  { id: "RPT-2033", title: "Standing water breeding mosquitoes", description: "Stagnant pool behind market is health hazard, dengue cases rising.", category: "waste", status: "new", lat: -6.9034, lng: 107.6181, image: floodImg, region: { province: "Jawa Barat", city: "Bandung", district: "Sukajadi", subdistrict: "Pasteur" }, createdAt: "2025-04-22T12:08:00Z", reporter: "Indah W." },
  { id: "RPT-2032", title: "Cracked bridge railing", description: "Section of railing missing, dangerous especially for children walking to school.", category: "infra", status: "new", lat: -7.2459, lng: 112.7378, image: potholeImg, region: { province: "Jawa Timur", city: "Surabaya", district: "Wonokromo", subdistrict: "Darmo" }, createdAt: "2025-04-22T07:30:00Z", reporter: "Joko H." },
  { id: "RPT-2031", title: "Public park encroached by stalls", description: "Informal vendors blocking public access to the green space.", category: "land", status: "new", lat: -6.2297, lng: 106.8262, image: streetlightImg, region: { province: "DKI Jakarta", city: "Jakarta Selatan", district: "Setiabudi", subdistrict: "Kuningan Timur" }, createdAt: "2025-04-21T15:40:00Z", reporter: "Kartika V." },
  { id: "RPT-2030", title: "Hazardous waste left at curb", description: "Bags labelled with chemical warnings left next to residential bin.", category: "waste", status: "progress", lat: -6.1751, lng: 106.8650, image: wasteImg, region: { province: "DKI Jakarta", city: "Jakarta Pusat", district: "Menteng", subdistrict: "Pegangsaan" }, createdAt: "2025-04-20T10:15:00Z", reporter: "Lukman A." },
];

export function getStats(reports: Report[]) {
  const total = reports.length;
  const open = reports.filter((r) => r.status === "new").length;
  const progress = reports.filter((r) => r.status === "progress").length;
  const resolved = reports.filter((r) => r.status === "resolved").length;
  return { total, open, progress, resolved };
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
