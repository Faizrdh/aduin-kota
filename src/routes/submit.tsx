/*eslint-disable*/

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight, ChevronLeft, Check, MapPin, Upload,
  Crosshair, Trash2, Construction, AlertTriangle, MapPinned,
  Loader2, Users, X, Info,
} from "lucide-react";
import { MapClient } from "@/components/civic/MapClient";
import { CATEGORIES, type Category } from "@/data/reports";
import { authFetch } from "@/data/login"; // ← IMPORT authFetch

export const Route = createFileRoute("/submit")({
  head: () => ({
    meta: [
      { title: "Submit Report — CivicSpot" },
      { name: "description", content: "Report a city issue in three quick steps." },
    ],
  }),
  component: SubmitPage,
});

// ─── Endpoints ────────────────────────────────────────────────────────────────
const EMSIFA           = "/api-wilayah";
const NOMINATIM_PROXY  = "/api-nominatim";
const NOMINATIM_DIRECT = "https://nominatim.openstreetmap.org";
const API_BASE         = "/api/reports";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Region      { id: string; name: string }
interface FlyToTarget { center: [number, number]; zoom: number; seq: number }

interface NearbyReport {
  id:             string;
  title:          string;
  description:    string;
  category:       string;
  status:         string;
  distanceMeters: number;
  imageUrl:       string | null;
  createdAt:      string;
  user:           { id: string; name: string; avatar: string | null };
  _count:         { joins: number };
}

const ICONS = { Trash2, Construction, AlertTriangle, MapPinned };

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function fetchJSON<T>(url: string, fallbackUrl?: string): Promise<T> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<T>;
  } catch (primaryErr) {
    if (!fallbackUrl) throw primaryErr;
    const res2 = await fetch(fallbackUrl);
    if (!res2.ok) throw new Error(`HTTP ${res2.status} (fallback)`);
    return res2.json() as Promise<T>;
  }
}

function nominatimUrl(path: string) {
  return { proxy: `${NOMINATIM_PROXY}${path}`, direct: `${NOMINATIM_DIRECT}${path}` };
}

function toTitle(s: string) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Maps & Aliases ───────────────────────────────────────────────────────────
const ISO_PROVINCE: Record<string, string> = {
  "ID-AC": "aceh", "ID-SU": "sumatera utara", "ID-SB": "sumatera barat",
  "ID-RI": "riau", "ID-KR": "kepulauan riau", "ID-JA": "jambi",
  "ID-SS": "sumatera selatan", "ID-BB": "bangka belitung", "ID-BE": "bengkulu",
  "ID-LA": "lampung", "ID-JK": "dki jakarta", "ID-JB": "jawa barat",
  "ID-BT": "banten", "ID-JT": "jawa tengah", "ID-YO": "di yogyakarta",
  "ID-JI": "jawa timur", "ID-BA": "bali", "ID-NB": "nusa tenggara barat",
  "ID-NT": "nusa tenggara timur", "ID-KB": "kalimantan barat",
  "ID-KT": "kalimantan tengah", "ID-KS": "kalimantan selatan",
  "ID-KI": "kalimantan timur", "ID-KU": "kalimantan utara",
  "ID-SA": "sulawesi utara", "ID-GO": "gorontalo", "ID-ST": "sulawesi tengah",
  "ID-SR": "sulawesi barat", "ID-SN": "sulawesi selatan", "ID-SG": "sulawesi tenggara",
  "ID-MA": "maluku", "ID-MU": "maluku utara", "ID-PA": "papua",
  "ID-PB": "papua barat", "ID-PE": "papua tengah", "ID-PS": "papua selatan",
  "ID-PG": "papua pegunungan", "ID-PD": "papua barat daya",
};

const ISLAND_NAMES = new Set(["jawa", "kalimantan", "sumatra", "sumatera", "sulawesi", "papua", "maluku", "nusa tenggara"]);

const PROVINCE_ALIAS: Record<string, string> = {
  "daerah khusus ibukota jakarta": "dki jakarta", "jakarta": "dki jakarta",
  "dki": "dki jakarta", "yogyakarta": "di yogyakarta",
  "daerah istimewa yogyakarta": "di yogyakarta", "aceh": "aceh",
  "nanggroe aceh darussalam": "aceh", "kepulauan bangka belitung": "bangka belitung",
  "bangka belitung": "bangka belitung", "nusa tenggara barat": "nusa tenggara barat",
  "nusa tenggara timur": "nusa tenggara timur", "papua barat": "papua barat",
  "kalimantan utara": "kalimantan utara",
};

const CITY_ALIAS: Record<string, string> = {
  "jakarta selatan": "kota jakarta selatan", "jakarta utara": "kota jakarta utara",
  "jakarta barat": "kota jakarta barat", "jakarta timur": "kota jakarta timur",
  "jakarta pusat": "kota jakarta pusat",
  "kota administrasi jakarta selatan": "kota jakarta selatan",
  "kota administrasi jakarta utara": "kota jakarta utara",
  "kota administrasi jakarta barat": "kota jakarta barat",
  "kota administrasi jakarta timur": "kota jakarta timur",
  "kota administrasi jakarta pusat": "kota jakarta pusat",
};

function applyAlias(name: string, aliasMap: Record<string, string>): string {
  const lower = name.toLowerCase().trim();
  if (aliasMap[lower]) return aliasMap[lower];
  for (const [key, val] of Object.entries(aliasMap)) {
    if (lower.includes(key) || key.includes(lower)) return val;
  }
  return name;
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(kab\.|kabupaten|kota administrasi|kota|kec\.|kecamatan|kel\.|kelurahan|desa|administratif|kepulauan|kep\.|provinsi|prov\.|daerah istimewa|daerah khusus ibukota)\b/gi, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function fuzzyMatch(rawTarget: string, list: Region[], aliasMap?: Record<string, string>): Region | null {
  if (!rawTarget || list.length === 0) return null;
  const aliased = aliasMap ? applyAlias(rawTarget, aliasMap) : rawTarget;
  const t = norm(aliased);
  if (!t) return null;

  const exact = list.find((r) => norm(r.name) === t);
  if (exact) return exact;
  const sw = list.find((r) => { const n = norm(r.name); return n.startsWith(t) || t.startsWith(n); });
  if (sw) return sw;
  const inc = list.find((r) => { const n = norm(r.name); return n.includes(t) || t.includes(n); });
  if (inc) return inc;

  const tTok = t.split(" ").filter(Boolean);
  let best: Region | null = null;
  let bestScore = 0;
  for (const r of list) {
    const cTok = norm(r.name).split(" ").filter(Boolean);
    let hits = 0;
    for (const tt of tTok) {
      if (cTok.some((ct) => ct.includes(tt) || tt.includes(ct))) hits++;
    }
    const score = hits / Math.max(tTok.length, cTok.length);
    if (score > bestScore) { bestScore = score; best = r; }
  }
  return bestScore >= 0.5 ? best : null;
}

function parseNominatimAddress(addr: Record<string, string>) {
  let province = "";
  const isoCode = addr["ISO3166-2-lvl4"] || addr["ISO3166-2-lvl3"] || "";
  if (isoCode && ISO_PROVINCE[isoCode]) {
    province = ISO_PROVINCE[isoCode];
  } else {
    const raw = (addr.state || addr.province || addr.region || "").trim();
    province = ISLAND_NAMES.has(raw.toLowerCase()) ? "" : raw;
  }

  const cityBase     = addr.city || addr.regency || addr.county || addr.municipality || addr.town || "";
  const cityDistrict = addr.city_district || "";

  let city: string;
  if (cityDistrict.toLowerCase().includes("jakarta")) {
    city = cityDistrict;
  } else if (!cityBase && cityDistrict) {
    city = cityDistrict;
  } else {
    city = cityBase;
  }

  const district =
    addr.suburb || addr.subdistrict ||
    (!cityDistrict.toLowerCase().includes("jakarta") ? cityDistrict : "") ||
    addr.quarter || "";

  const village =
    addr.village || addr.hamlet || addr.neighbourhood ||
    addr.quarter || addr.residential || "";

  return { province, city, district, village };
}

const CATEGORY_LABEL: Record<string, string> = {
  WASTE: "Sampah & Limbah", INFRA: "Infrastruktur",
  DISTURB: "Gangguan", LAND: "Tata Lahan",
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDING:     { label: "Menunggu",        color: "text-yellow-400" },
  IN_REVIEW:   { label: "Sedang Ditinjau", color: "text-blue-400"   },
  IN_PROGRESS: { label: "Diproses",        color: "text-cyan-400"   },
  RESOLVED:    { label: "Selesai",         color: "text-green-400"  },
  REJECTED:    { label: "Ditolak",         color: "text-red-400"    },
};

// ─── Component Utama ──────────────────────────────────────────────────────────
function SubmitPage() {
  const navigate = useNavigate();

  const [step,     setStep]     = useState(0);
  const [category, setCategory] = useState<Category | null>(null);

  const [provinceList, setProvinceList] = useState<Region[]>([]);
  const [cityList,     setCityList]     = useState<Region[]>([]);
  const [districtList, setDistrictList] = useState<Region[]>([]);
  const [villageList,  setVillageList]  = useState<Region[]>([]);

  const [loadingProv, setLoadingProv] = useState(false);
  const [loadingCity, setLoadingCity] = useState(false);
  const [loadingDist, setLoadingDist] = useState(false);
  const [loadingVill, setLoadingVill] = useState(false);
  const [loadingGeo,  setLoadingGeo]  = useState(false);
  const [loadingRev,  setLoadingRev]  = useState(false);

  const [apiError,  setApiError]  = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  const [provinceId,  setProvinceId]  = useState("");
  const [cityId,      setCityId]      = useState("");
  const [districtId,  setDistrictId]  = useState("");
  const [villageId,   setVillageId]   = useState("");
  const [province,    setProvince]    = useState("");
  const [city,        setCity]        = useState("");
  const [district,    setDistrict]    = useState("");
  const [subdistrict, setSubdistrict] = useState("");
  const [address,     setAddress]     = useState("");

  const [pos,   setPos]   = useState<{ lat: number; lng: number } | null>(null);
  const [flyTo, setFlyTo] = useState<FlyToTarget | null>(null);
  const flyToSeq     = useRef(0);
  const revGeoActive = useRef(false);
  const autoGeo      = useRef(false);

  const [title,      setTitle]      = useState("");
  const [desc,       setDesc]       = useState("");
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [submitted,  setSubmitted]  = useState(false);

  const [nearbyReports, setNearbyReports] = useState<NearbyReport[]>([]);
  const [showDupModal,  setShowDupModal]  = useState(false);
  const [checkingDup,   setCheckingDup]   = useState(false);
  const [submittingNew, setSubmittingNew] = useState(false);
  const [joiningId,     setJoiningId]     = useState<string | null>(null);
  const [joinedSuccess, setJoinedSuccess] = useState(false);
  const [submitError,   setSubmitError]   = useState<string | null>(null);

  const steps = ["Category", "Location", "Details"];

  const canNext =
    (step === 0 && category !== null) ||
    (step === 1 && pos !== null && province && city && district && subdistrict) ||
    (step === 2 && title.trim().length > 3 && desc.trim().length > 5);

  const commitFlyTo = useCallback((center: [number, number], zoom: number) => {
    flyToSeq.current += 1;
    setFlyTo({ center, zoom, seq: flyToSeq.current });
  }, []);

  useEffect(() => {
    setLoadingProv(true);
    fetchJSON<{ id: string; name: string }[]>(`${EMSIFA}/provinces.json`)
      .then((data) => setProvinceList(data.map((p) => ({ id: p.id, name: p.name }))))
      .catch(() => setApiError("Gagal memuat data wilayah."))
      .finally(() => setLoadingProv(false));
  }, []);

  useEffect(() => {
    if (!provinceId || revGeoActive.current) return;
    setLoadingCity(true);
    setCityList([]); setDistrictList([]); setVillageList([]);
    fetchJSON<{ id: string; name: string }[]>(`${EMSIFA}/regencies/${provinceId}.json`)
      .then((data) => setCityList(data.map((d) => ({ id: d.id, name: d.name }))))
      .catch(console.error)
      .finally(() => setLoadingCity(false));
  }, [provinceId]);

  useEffect(() => {
    if (!cityId || revGeoActive.current) return;
    setLoadingDist(true);
    setDistrictList([]); setVillageList([]);
    fetchJSON<{ id: string; name: string }[]>(`${EMSIFA}/districts/${cityId}.json`)
      .then((data) => setDistrictList(data.map((d) => ({ id: d.id, name: d.name }))))
      .catch(console.error)
      .finally(() => setLoadingDist(false));
  }, [cityId]);

  useEffect(() => {
    if (!districtId || revGeoActive.current) return;
    setLoadingVill(true);
    setVillageList([]);
    fetchJSON<{ id: string; name: string }[]>(`${EMSIFA}/villages/${districtId}.json`)
      .then((data) => setVillageList(data.map((d) => ({ id: d.id, name: d.name }))))
      .catch(console.error)
      .finally(() => setLoadingVill(false));
  }, [districtId]);

  useEffect(() => {
    if (revGeoActive.current) return;
    const parts = [subdistrict, district, city, province, "Indonesia"].filter(Boolean);
    if (parts.length < 2) return;
    const zoom = subdistrict ? 15 : district ? 13 : city ? 11 : 8;
    const { proxy, direct } = nominatimUrl(
      `/search?q=${encodeURIComponent(parts.join(", "))}&format=json&limit=1`
    );
    setLoadingGeo(true);
    fetchJSON<any[]>(proxy, direct)
      .then((results) => {
        const r = results?.[0];
        if (!r) return;
        autoGeo.current = true;
        setPos({ lat: parseFloat(r.lat), lng: parseFloat(r.lon) });
        commitFlyTo([parseFloat(r.lat), parseFloat(r.lon)], zoom);
      })
      .catch((err) => console.error("Forward geocode:", err))
      .finally(() => setLoadingGeo(false));
  }, [province, city, district, subdistrict, commitFlyTo]);

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    revGeoActive.current = true;
    setLoadingRev(true);
    setDebugInfo(null);

    setProvinceId(""); setProvince("");
    setCityId("");     setCity("");
    setDistrictId(""); setDistrict("");
    setVillageId("");  setSubdistrict("");
    setCityList([]); setDistrictList([]); setVillageList([]);

    try {
      const params = `lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=18&accept-language=id`;
      const { proxy, direct } = nominatimUrl(`/reverse?${params}`);
      const result = await fetchJSON<{ address: Record<string, string> }>(proxy, direct);

      const addr = result?.address;
      if (!addr) { setDebugInfo("Nominatim tidak mengembalikan data address."); return; }

      const isoCode = addr["ISO3166-2-lvl4"] || addr["ISO3166-2-lvl3"] || "(tidak ada)";
      const { province: provRaw, city: cityRaw, district: distRaw, village: villRaw } =
        parseNominatimAddress(addr);

      setDebugInfo(`ISO: ${isoCode} | prov="${provRaw}" | city="${cityRaw}" | dist="${distRaw}" | vill="${villRaw}"`);

      if (!provRaw) {
        setDebugInfo(`Gagal: Provinsi tidak terdeteksi.\nISO: ${isoCode}\naddr.state: "${addr.state || ""}"\nSemua keys: ${Object.keys(addr).join(", ")}`);
        return;
      }

      const provinces = await fetchJSON<{ id: string; name: string }[]>(`${EMSIFA}/provinces.json`);
      setProvinceList(provinces);

      const matchedProv = fuzzyMatch(provRaw, provinces, PROVINCE_ALIAS);
      if (!matchedProv) { setDebugInfo((p) => `${p}\nProvinsi "${provRaw}" tidak cocok.`); return; }
      setProvinceId(matchedProv.id);
      setProvince(matchedProv.name);

      if (!cityRaw) return;
      const cities = await fetchJSON<{ id: string; name: string }[]>(`${EMSIFA}/regencies/${matchedProv.id}.json`);
      setCityList(cities);

      const matchedCity = fuzzyMatch(cityRaw, cities, CITY_ALIAS);
      if (!matchedCity) { setDebugInfo((p) => `${p}\nKota "${cityRaw}" tidak cocok — pilih manual.`); return; }
      setCityId(matchedCity.id);
      setCity(matchedCity.name);

      if (!distRaw) return;
      const districts = await fetchJSON<{ id: string; name: string }[]>(`${EMSIFA}/districts/${matchedCity.id}.json`);
      setDistrictList(districts);

      const matchedDist = fuzzyMatch(distRaw, districts);
      if (!matchedDist) { setDebugInfo((p) => `${p}\nKecamatan "${distRaw}" tidak cocok — pilih manual.`); return; }
      setDistrictId(matchedDist.id);
      setDistrict(matchedDist.name);

      if (!villRaw) return;
      const villages = await fetchJSON<{ id: string; name: string }[]>(`${EMSIFA}/villages/${matchedDist.id}.json`);
      setVillageList(villages);

      const matchedVill = fuzzyMatch(villRaw, villages);
      if (matchedVill) {
        setVillageId(matchedVill.id);
        setSubdistrict(matchedVill.name);
        setDebugInfo(null);
      } else {
        setDebugInfo((p) => `${p}\nKelurahan "${villRaw}" tidak cocok — pilih manual.`);
      }
    } catch (err) {
      console.error("Reverse geocode error:", err);
      setDebugInfo(`Error: ${String(err)}`);
    } finally {
      setLoadingRev(false);
      setTimeout(() => { revGeoActive.current = false; }, 1000);
    }
  }, []);

  const handleGPS = useCallback(() => {
    if (!navigator.geolocation) { setDebugInfo("Browser tidak mendukung geolocation."); return; }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        autoGeo.current = false;
        const { latitude: lat, longitude: lng } = coords;
        setPos({ lat, lng });
        commitFlyTo([lat, lng], 16);
        reverseGeocode(lat, lng);
      },
      () => {
        autoGeo.current = false;
        setPos({ lat: -6.2088, lng: 106.82 });
        commitFlyTo([-6.2088, 106.82], 11);
        reverseGeocode(-6.2088, 106.82);
      },
      { timeout: 8000, maximumAge: 60_000 }
    );
  }, [commitFlyTo, reverseGeocode]);

  const handleManualPick = useCallback((lat: number, lng: number) => {
    autoGeo.current = false;
    setPos({ lat, lng });
    reverseGeocode(lat, lng);
  }, [reverseGeocode]);

  const onProvince = (id: string, name: string) => {
    setProvinceId(id); setProvince(name);
    setCityId(""); setCity(""); setDistrictId(""); setDistrict("");
    setVillageId(""); setSubdistrict("");
  };
  const onCity     = (id: string, name: string) => { setCityId(id); setCity(name); setDistrictId(""); setDistrict(""); setVillageId(""); setSubdistrict(""); };
  const onDistrict = (id: string, name: string) => { setDistrictId(id); setDistrict(name); setVillageId(""); setSubdistrict(""); };
  const onVillage  = (id: string, name: string) => { setVillageId(id); setSubdistrict(name); };

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setImgPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  // ─── Duplicate Detection ──────────────────────────────────────────────────
  const checkDuplicatesAndSubmit = async () => {
    if (!pos || !category) return;
    setCheckingDup(true);
    setSubmitError(null);

    try {
      const catUpper = category.toUpperCase();
      // GET /nearby tidak butuh auth → pakai authFetch tetap aman (kirim token kalau ada)
      const url = `${API_BASE}/nearby?lat=${pos.lat}&lng=${pos.lng}&radius=100&category=${catUpper}`;
      const res  = await authFetch(url); // ← authFetch otomatis kirim Bearer token
      const json = await res.json();
      const found: NearbyReport[] = json.data ?? [];

      if (found.length > 0) {
        setNearbyReports(found);
        setShowDupModal(true);
      } else {
        await doSubmitNew();
      }
    } catch (err) {
      console.error("Duplicate check error:", err);
      await doSubmitNew();
    } finally {
      setCheckingDup(false);
    }
  };

  const doSubmitNew = async () => {
    if (!pos || !category) return;
    setSubmittingNew(true);
    setSubmitError(null);

    try {
      const body = {
        title,
        description: desc,
        category:    category.toUpperCase(),
        lat:         pos.lat,
        lng:         pos.lng,
        province,
        city,
        district,
        village:     subdistrict,
        address:     address || undefined,
        imageUrl:    imgPreview || undefined,
      };

      // ↓ authFetch otomatis tambahkan "Authorization: Bearer <token>"
      const res = await authFetch(API_BASE, {
        method: "POST",
        body:   JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? `HTTP ${res.status}`);
      }

      setShowDupModal(false);
      setSubmitted(true);
      setTimeout(() => navigate({ to: "/my-reports" }), 1800);
    } catch (err: any) {
      setSubmitError(err?.message ?? "Terjadi kesalahan saat mengirim laporan.");
    } finally {
      setSubmittingNew(false);
    }
  };

  const handleJoinReport = async (reportId: string) => {
    setJoiningId(reportId);
    setSubmitError(null);
    try {
      // ↓ authFetch otomatis tambahkan "Authorization: Bearer <token>"
      const res = await authFetch(`${API_BASE}/${reportId}/join`, {
        method: "POST",
        body:   JSON.stringify({}),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? `HTTP ${res.status}`);
      }

      setJoinedSuccess(true);
      setTimeout(() => navigate({ to: "/my-reports" }), 1800);
    } catch (err: any) {
      setSubmitError(err?.message ?? "Gagal bergabung ke laporan.");
    } finally {
      setJoiningId(null);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <main className="flex-1 px-5 md:px-10 py-8 max-w-5xl w-full mx-auto">
      <header className="mb-8">
        <div className="text-xs uppercase tracking-[0.25em] text-accent mb-2">Buat Laporan</div>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-gradient">
          Membantu Laporan Pengaduan Anda
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Tiga langkah sederhana. Laporan Anda langsung dikirim ke tim distrik yang relevan.
        </p>
      </header>

      {/* ── Stepper ── */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold transition-smooth ${
              i < step
                ? "gradient-primary text-primary-foreground shadow-glow"
                : i === step
                  ? "bg-accent text-accent-foreground shadow-glow-accent"
                  : "bg-white/5 text-muted-foreground"
            }`}>
              {i < step ? <Check size={14} /> : i + 1}
            </div>
            <span className={`text-xs font-medium ${i === step ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
            {i < steps.length - 1 && <div className={`flex-1 h-px ${i < step ? "bg-primary" : "bg-white/10"}`} />}
          </div>
        ))}
      </div>

      {apiError && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 flex items-start gap-2"
        >
          <AlertTriangle size={15} className="shrink-0 mt-0.5" /><span>{apiError}</span>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {!submitted ? (
          <motion.div key={step}
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}
            className="glass rounded-3xl p-6 md:p-8 shadow-soft"
          >
            {/* ── STEP 0 — Category ── */}
            {step === 0 && (
              <div>
                <h2 className="font-display text-xl font-semibold mb-1">Ada permasalahan apa hari ini?</h2>
                <p className="text-sm text-muted-foreground mb-6">Silahkan pilih kategori yang paling sesuai.</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {(Object.keys(CATEGORIES) as Category[]).map((c) => {
                    const cat  = CATEGORIES[c];
                    const Icon = ICONS[cat.icon as keyof typeof ICONS];
                    const active = category === c;
                    return (
                      <button key={c} onClick={() => setCategory(c)}
                        className={`relative text-left p-5 rounded-2xl border transition-smooth overflow-hidden ${
                          active ? "border-accent shadow-glow-accent" : "border-border hover:border-white/20 bg-white/5"
                        }`}
                      >
                        <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full opacity-20 blur-2xl" style={{ background: cat.color }} />
                        <div className="h-12 w-12 rounded-xl flex items-center justify-center mb-3 relative"
                          style={{ background: `color-mix(in oklab, ${cat.color} 25%, transparent)`, color: cat.color }}>
                          <Icon size={22} />
                        </div>
                        <div className="font-semibold text-sm relative">{cat.label}</div>
                        <div className="text-xs text-muted-foreground mt-1 relative">
                          {c === "waste"   && "Sampah, pembuangan liar, limbah berbahaya"}
                          {c === "infra"   && "Jalan, lampu, jembatan, fasilitas umum"}
                          {c === "disturb" && "Kebisingan, polusi, bahaya keselamatan"}
                          {c === "land"    && "Tata lahan, penyerobotan, isu sosial"}
                        </div>
                        {active && (
                          <div className="absolute top-3 right-3 h-6 w-6 rounded-full bg-accent text-accent-foreground flex items-center justify-center">
                            <Check size={13} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── STEP 1 — Location ── */}
            {step === 1 && (
              <div className="grid lg:grid-cols-2 gap-6">
                <div>
                  <h2 className="font-display text-xl font-semibold mb-1">Dimana lokasi pengaduan?</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Klik di peta atau gunakan GPS — form wilayah di kanan otomatis terisi.
                  </p>

                  <div className="relative h-72 lg:h-80 rounded-2xl overflow-hidden border border-border">
                    <AnimatePresence>
                      {(loadingGeo || loadingRev) && (
                        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className="absolute top-2 right-2 z-10 flex items-center gap-1.5 rounded-xl bg-background/80 backdrop-blur-sm border border-border px-2.5 py-1.5 text-xs text-accent"
                        >
                          <Loader2 size={11} className="animate-spin" />
                          {loadingRev ? "Mendeteksi wilayah…" : "Mencari koordinat…"}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <MapClient
                      reports={[]} pickMode onPick={handleManualPick}
                      pickedPos={pos} initialCenter={[-6.2088, 106.8200]}
                      initialZoom={11} flyTo={flyTo} height="100%"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3 mt-3">
                    <button onClick={handleGPS} disabled={loadingRev}
                      className="px-3 py-2 rounded-xl glass text-xs font-medium hover:bg-white/10 transition-smooth flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loadingRev ? <Loader2 size={14} className="animate-spin" /> : <Crosshair size={14} />}
                      Gunakan Lokasi saya saat ini
                    </button>
                    {pos && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <MapPin size={12} className="text-accent" />
                        {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
                      </span>
                    )}
                  </div>

                  {!pos && (
                    <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1.5">
                      <MapPin size={11} className="text-accent shrink-0" />
                      Klik titik di peta untuk otomatis mengisi form wilayah
                    </p>
                  )}

                  {debugInfo && (
                    <div className="mt-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 px-3 py-2 text-[10px] text-yellow-300 font-mono whitespace-pre-wrap leading-relaxed">
                      <span className="font-bold text-yellow-400">Debug: </span>{debugInfo}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Silahkan pilih region administratif</h3>
                    {loadingRev && (
                      <span className="text-[11px] text-accent flex items-center gap-1.5 animate-pulse">
                        <Loader2 size={10} className="animate-spin" /> Mengisi otomatis…
                      </span>
                    )}
                  </div>

                  <RegionSelect label="Provinsi" value={provinceId} loading={loadingProv}
                    options={provinceList} disabled={false}
                    placeholder={loadingProv ? "Memuat data provinsi…" : "Pilih provinsi…"}
                    onChange={onProvince}
                  />
                  <RegionSelect label="Kota / Kabupaten" value={cityId} loading={loadingCity}
                    options={cityList} disabled={!provinceId || loadingProv}
                    placeholder={!provinceId ? "Pilih provinsi dulu" : loadingCity ? "Memuat data…" : "Pilih kota / kabupaten…"}
                    onChange={onCity}
                  />
                  <RegionSelect label="Kecamatan" value={districtId} loading={loadingDist}
                    options={districtList} disabled={!cityId || loadingCity}
                    placeholder={!cityId ? "Pilih kota dulu" : loadingDist ? "Memuat data…" : "Pilih kecamatan…"}
                    onChange={onDistrict}
                  />
                  <RegionSelect label="Kelurahan / Desa" value={villageId} loading={loadingVill}
                    options={villageList} disabled={!districtId || loadingDist}
                    placeholder={!districtId ? "Pilih kecamatan dulu" : loadingVill ? "Memuat data…" : "Pilih kelurahan / desa…"}
                    onChange={onVillage}
                  />

                  <Field label="Detail Alamat" hint="Opsional namun disarankan">
                    <textarea
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      rows={3}
                      placeholder="Tuliskan alamat lokasi kejadian dengan lengkap"
                      className="w-full bg-white/5 border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-smooth resize-none placeholder:text-muted-foreground/60"
                    />
                  </Field>
                </div>
              </div>
            )}

            {/* ── STEP 2 — Details ── */}
            {step === 2 && (
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h2 className="font-display text-xl font-semibold mb-1">Detail Pengaduan</h2>

                  <Field label="Judul Laporan" hint="Buat judul singkat yang menggambarkan masalahnya">
                    <input value={title} onChange={(e) => setTitle(e.target.value)}
                      placeholder="contoh: Lampu jalan rusak di Jl. Merdeka"
                      className="w-full bg-white/5 border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-smooth"
                    />
                  </Field>

                  <Field label="Deskripsi" hint="Apa yang anda temukan, ada permasalahan apa?">
                    <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={5}
                      placeholder="Detail pengaduan — apa masalahmu? sudah berapa lama? ceritakan disini dengan lengkap"
                      className="w-full bg-white/5 border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-smooth resize-none"
                    />
                  </Field>

                  <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 px-3.5 py-3 flex items-start gap-2.5">
                    <Info size={14} className="text-blue-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-300 leading-relaxed">
                      Sebelum laporan dikirim, sistem akan memeriksa apakah sudah ada laporan serupa
                      dalam radius <strong>100 meter</strong> dari lokasi Anda.
                    </p>
                  </div>

                  {province && (
                    <div className="rounded-xl bg-white/[0.04] border border-border px-3.5 py-3">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Lokasi Terpilih</div>
                      {[
                        { label: "Provinsi",  val: province    },
                        { label: "Kota",      val: city        },
                        { label: "Kecamatan", val: district    },
                        { label: "Kelurahan", val: subdistrict },
                        { label: "Alamat",    val: address     },
                      ].map(({ label, val }) => val && (
                        <div key={label} className="flex gap-2 text-xs py-0.5">
                          <span className="text-muted-foreground w-20 shrink-0">{label}</span>
                          <span className="font-medium">{label === "Alamat" ? val : toTitle(val)}</span>
                        </div>
                      ))}
                      {pos && (
                        <div className="flex gap-2 text-xs mt-1.5 pt-1.5 border-t border-white/5">
                          <span className="text-muted-foreground w-20 shrink-0">Koordinat</span>
                          <span className="font-mono text-accent text-[11px]">{pos.lat.toFixed(6)}, {pos.lng.toFixed(6)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {submitError && (
                    <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-3.5 py-3 flex items-start gap-2 text-sm text-red-300">
                      <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                      {submitError}
                    </div>
                  )}
                </div>

                <div>
                  <Field label="Foto (opsional)" hint="JPG atau PNG, maks 10 MB">
                    <label className="block">
                      <input type="file" accept="image/*" className="hidden"
                        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
                      />
                      {imgPreview ? (
                        <div className="relative rounded-2xl overflow-hidden border border-border group cursor-pointer">
                          <img src={imgPreview} alt="" className="w-full h-64 object-cover" />
                          <div className="absolute inset-0 bg-background/70 opacity-0 group-hover:opacity-100 transition-smooth flex items-center justify-center text-sm">
                            klik untuk mengganti foto
                          </div>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed border-border rounded-2xl h-64 flex flex-col items-center justify-center hover:border-accent transition-smooth cursor-pointer bg-white/[0.02]">
                          <div className="h-12 w-12 rounded-full glass flex items-center justify-center mb-3">
                            <Upload size={20} className="text-accent" />
                          </div>
                          <div className="text-sm font-medium">klik atau seret gambar untuk mengunggah</div>
                          <div className="text-xs text-muted-foreground mt-1">gunakan foto yang jelas</div>
                        </div>
                      )}
                    </label>
                  </Field>
                </div>
              </div>
            )}

            {/* ── Navigasi ── */}
            <div className="flex justify-between mt-8 pt-6 border-t border-border">
              <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground transition-smooth flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={15} /> kembali
              </button>

              {step < 2 ? (
                <button onClick={() => setStep((s) => s + 1)} disabled={!canNext}
                  className="px-5 py-2.5 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold shadow-glow hover:scale-[1.02] transition-smooth flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:scale-100"
                >
                  Lanjut <ChevronRight size={15} />
                </button>
              ) : (
                <button
                  onClick={checkDuplicatesAndSubmit}
                  disabled={!canNext || checkingDup || submittingNew}
                  className="px-6 py-2.5 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold shadow-glow hover:scale-[1.02] transition-smooth flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:scale-100"
                >
                  {checkingDup || submittingNew
                    ? <><Loader2 size={15} className="animate-spin" /> {checkingDup ? "Memeriksa duplikat…" : "Mengirim…"}</>
                    : <><Check size={15} /> Ajukan Laporan</>
                  }
                </button>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-3xl p-12 text-center shadow-soft"
          >
            <div className="h-20 w-20 rounded-full gradient-primary mx-auto flex items-center justify-center shadow-glow mb-5">
              <Check size={36} className="text-primary-foreground" />
            </div>
            <h2 className="font-display text-2xl font-bold">Laporan diajukan!</h2>
            <p className="text-muted-foreground mt-2 max-w-md mx-auto text-sm">
              Kami akan memberi tahu Anda segera setelah laporan Anda ditinjau.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal Duplicate Detection ── */}
      <AnimatePresence>
        {showDupModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1,   opacity: 1, y: 0  }}
              exit={{    scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="glass rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-yellow-500/30 relative"
            >
              <button onClick={() => setShowDupModal(false)}
                className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-smooth">
                <X size={15} />
              </button>

              {joinedSuccess ? (
                <div className="text-center py-6">
                  <div className="h-16 w-16 rounded-full bg-green-500/20 border border-green-500/40 mx-auto flex items-center justify-center mb-4">
                    <Check size={28} className="text-green-400" />
                  </div>
                  <h3 className="font-display text-xl font-bold mb-2">Berhasil Bergabung!</h3>
                  <p className="text-sm text-muted-foreground">Mengarahkan ke halaman laporan saya…</p>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-3 mb-5 pr-8">
                    <div className="h-10 w-10 rounded-xl bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center shrink-0">
                      <AlertTriangle size={19} className="text-yellow-400" />
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-bold leading-tight">Laporan Serupa Ditemukan</h3>
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                        Terdapat <strong className="text-foreground">{nearbyReports.length} laporan</strong> dalam
                        radius 100m di kategori yang sama.
                      </p>
                    </div>
                  </div>

                  {submitError && (
                    <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/30 px-3.5 py-2.5 flex items-center gap-2 text-sm text-red-300">
                      <AlertTriangle size={13} className="shrink-0" />{submitError}
                    </div>
                  )}

                  <div className="space-y-3 mb-5 max-h-64 overflow-y-auto pr-1 -mr-1">
                    {nearbyReports.map((r) => {
                      const statusInfo = STATUS_LABEL[r.status] ?? { label: r.status, color: "text-muted-foreground" };
                      return (
                        <div key={r.id} className="rounded-2xl border border-border bg-white/[0.04] hover:bg-white/[0.06] p-4 transition-smooth">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="font-semibold text-sm truncate">{r.title}</span>
                                <span className={`text-[10px] font-medium shrink-0 ${statusInfo.color}`}>● {statusInfo.label}</span>
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-2">
                                <span className="flex items-center gap-1"><MapPin size={9} className="text-accent" />{r.distanceMeters}m dari titik Anda</span>
                                <span className="flex items-center gap-1"><Users size={9} />{r._count.joins + 1} pelapor</span>
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{r.description}</p>
                            </div>
                            {r.imageUrl && <img src={r.imageUrl} alt="" className="h-14 w-14 rounded-xl object-cover shrink-0 border border-border" />}
                          </div>
                          <button
                            onClick={() => handleJoinReport(r.id)}
                            disabled={joiningId !== null}
                            className="mt-3 w-full py-2 rounded-xl bg-accent/15 border border-accent/30 text-accent text-xs font-semibold hover:bg-accent/25 transition-smooth flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {joiningId === r.id
                              ? <><Loader2 size={12} className="animate-spin" /> Bergabung…</>
                              : <><Users size={12} /> Ikut Laporan Ini</>
                            }
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-border">
                    <button onClick={() => setShowDupModal(false)} disabled={submittingNew || joiningId !== null}
                      className="flex-1 px-4 py-2.5 rounded-xl glass text-sm font-medium hover:bg-white/10 transition-smooth disabled:opacity-50">
                      Batal
                    </button>
                    <button onClick={doSubmitNew} disabled={submittingNew || joiningId !== null}
                      className="flex-1 px-4 py-2.5 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold shadow-glow hover:scale-[1.02] transition-smooth flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      {submittingNew
                        ? <><Loader2 size={13} className="animate-spin" /> Mengirim…</>
                        : "Tetap Buat Laporan Baru"
                      }
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

// ─── Helper Components ────────────────────────────────────────────────────────
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-foreground">{label}</span>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function RegionSelect({ label, value, loading, options, disabled, placeholder, onChange }: {
  label: string; value: string; loading: boolean; options: Region[];
  disabled: boolean; placeholder: string; onChange: (id: string, name: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => {
            const id   = e.target.value;
            const name = options.find((o) => o.id === id)?.name ?? "";
            onChange(id, name);
          }}
          disabled={disabled || loading}
          className="w-full border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-smooth disabled:opacity-40 appearance-none pr-10"
          style={{
            backgroundColor: "rgba(15, 23, 42, 0.85)",
            color: "rgb(226, 232, 240)",
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2382C8E5' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 14px center",
          }}
        >
          <option value="" style={{ backgroundColor: "#0f172a", color: "#94a3b8" }}>{placeholder}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id} style={{ backgroundColor: "#0f172a", color: "#e2e8f0" }}>{toTitle(o.name)}</option>
          ))}
        </select>
        {loading && (
          <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none">
            <Loader2 size={13} className="animate-spin text-accent" />
          </div>
        )}
      </div>
    </Field>
  );
}