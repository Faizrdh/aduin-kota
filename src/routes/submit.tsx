/*eslint-disable*/

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight, ChevronLeft, Check, MapPin, Upload,
  Crosshair, Trash2, Construction, AlertTriangle, MapPinned, Loader2,
} from "lucide-react";
import { MapClient } from "@/components/civic/MapClient";
import { CATEGORIES, type Category } from "@/data/reports";

export const Route = createFileRoute("/submit")({
  head: () => ({
    meta: [
      { title: "Submit Report — CivicSpot" },
      { name: "description", content: "Report a city issue in three quick steps with location pinning and photo upload." },
    ],
  }),
  component: SubmitPage,
});

// ─── Proxy via vite.config.ts ─────────────────────────────────────────────────
// /api-wilayah   → https://emsifa.github.io/api-wilayah-indonesia/api
// /api-nominatim → https://nominatim.openstreetmap.org
const EMSIFA    = "/api-wilayah";
const NOMINATIM = "/api-nominatim";

interface Region { id: string; name: string }

const ICONS = { Trash2, Construction, AlertTriangle, MapPinned };

async function fetchJSON<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.json() as Promise<T>;
}

/** Konversi ALL-CAPS dari emsifa menjadi Title Case */
function toTitle(s: string) {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function SubmitPage() {
  const navigate = useNavigate();

  const [step, setStep]         = useState(0);
  const [category, setCategory] = useState<Category | null>(null);

  // ── Region option lists ───────────────────────────────────────────────────
  const [provinceList, setProvinceList] = useState<Region[]>([]);
  const [cityList,     setCityList]     = useState<Region[]>([]);
  const [districtList, setDistrictList] = useState<Region[]>([]);
  const [villageList,  setVillageList]  = useState<Region[]>([]);

  const [loadingProv, setLoadingProv] = useState(false);
  const [loadingCity, setLoadingCity] = useState(false);
  const [loadingDist, setLoadingDist] = useState(false);
  const [loadingVill, setLoadingVill] = useState(false);
  const [loadingGeo,  setLoadingGeo]  = useState(false);
  const [apiError,    setApiError]    = useState<string | null>(null);

  // ── Selected IDs + display names ──────────────────────────────────────────
  const [provinceId,   setProvinceId]  = useState("");
  const [cityId,       setCityId]      = useState("");
  const [districtId,   setDistrictId]  = useState("");
  const [villageId,    setVillageId]   = useState("");
  const [province,     setProvince]    = useState("");
  const [city,         setCity]        = useState("");
  const [district,     setDistrict]    = useState("");
  const [subdistrict,  setSubdistrict] = useState("");

  // ── Map state ─────────────────────────────────────────────────────────────
  const [pos,       setPos]       = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([-6.2088, 106.8200]);
  const [mapZoom,   setMapZoom]   = useState(11);
  const [mapKey,    setMapKey]    = useState(0); // increment → MapClient remounts
  const autoGeo = useRef(false);                 // true jika pos berasal dari geocoding

  // ── Form fields ───────────────────────────────────────────────────────────
  const [title,      setTitle]      = useState("");
  const [desc,       setDesc]       = useState("");
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [submitted,  setSubmitted]  = useState(false);

  const steps = ["Category", "Location", "Details"];

  const canNext =
    (step === 0 && category !== null) ||
    (step === 1 && pos !== null && province && city && district && subdistrict) ||
    (step === 2 && title.trim().length > 3 && desc.trim().length > 5);

  // ── 1. Provinces on mount ─────────────────────────────────────────────────
  useEffect(() => {
    setLoadingProv(true);
    setApiError(null);
    fetchJSON<{ id: string; name: string }[]>(`${EMSIFA}/provinces.json`)
      .then((data) => setProvinceList(data.map((p) => ({ id: p.id, name: p.name }))))
      .catch((err) => {
        console.error("Provinces fetch error:", err);
        setApiError(
          "Gagal memuat data wilayah. Pastikan vite.config.ts sudah memiliki proxy /api-wilayah, lalu restart dev server."
        );
      })
      .finally(() => setLoadingProv(false));
  }, []);

  // ── 2. Cities ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!provinceId) { setCityList([]); return; }
    setLoadingCity(true);
    setCityList([]); setDistrictList([]); setVillageList([]);
    fetchJSON<{ id: string; name: string }[]>(`${EMSIFA}/regencies/${provinceId}.json`)
      .then((data) => setCityList(data.map((d) => ({ id: d.id, name: d.name }))))
      .catch(console.error)
      .finally(() => setLoadingCity(false));
  }, [provinceId]);

  // ── 3. Districts ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!cityId) { setDistrictList([]); return; }
    setLoadingDist(true);
    setDistrictList([]); setVillageList([]);
    fetchJSON<{ id: string; name: string }[]>(`${EMSIFA}/districts/${cityId}.json`)
      .then((data) => setDistrictList(data.map((d) => ({ id: d.id, name: d.name }))))
      .catch(console.error)
      .finally(() => setLoadingDist(false));
  }, [cityId]);

  // ── 4. Villages ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!districtId) { setVillageList([]); return; }
    setLoadingVill(true);
    setVillageList([]);
    fetchJSON<{ id: string; name: string }[]>(`${EMSIFA}/villages/${districtId}.json`)
      .then((data) => setVillageList(data.map((d) => ({ id: d.id, name: d.name }))))
      .catch(console.error)
      .finally(() => setLoadingVill(false));
  }, [districtId]);

  // ── 5. Geocode wilayah → auto-center + zoom peta ──────────────────────────
  useEffect(() => {
    // Susun query dari wilayah yang sudah dipilih (yang paling detail dulu)
    const parts = [subdistrict, district, city, province, "Indonesia"].filter(Boolean);
    if (parts.length < 2) return; // minimal butuh 2 bagian

    // Zoom adaptif berdasarkan granularitas wilayah
    const zoom = subdistrict ? 15 : district ? 13 : city ? 11 : 8;

    const ctrl = new AbortController();
    setLoadingGeo(true);

    fetchJSON<any[]>(
      `${NOMINATIM}/search?q=${encodeURIComponent(parts.join(", "))}&format=json&limit=1&addressdetails=0`,
      ctrl.signal
    )
      .then((results) => {
        const result = results?.[0];
        if (!result) return;
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        autoGeo.current = true;
        setPos({ lat, lng });
        setMapCenter([lat, lng]);
        setMapZoom(zoom);
        setMapKey((k) => k + 1); // remount → map reinisialisasi di posisi baru
      })
      .catch((err) => {
        if (err.name !== "AbortError") console.error("Geocode error:", err);
      })
      .finally(() => setLoadingGeo(false));

    return () => ctrl.abort();
  }, [province, city, district, subdistrict]);

  // ── GPS helper ────────────────────────────────────────────────────────────
  const useGPS = () => {
    navigator.geolocation?.getCurrentPosition(
      ({ coords }) => {
        autoGeo.current = false;
        const center: [number, number] = [coords.latitude, coords.longitude];
        setPos({ lat: coords.latitude, lng: coords.longitude });
        setMapCenter(center);
        setMapZoom(15);
        setMapKey((k) => k + 1);
      },
      () => {
        // Fallback ke Jakarta
        autoGeo.current = false;
        setPos({ lat: -6.2088, lng: 106.82 });
        setMapCenter([-6.2088, 106.82]);
        setMapZoom(11);
        setMapKey((k) => k + 1);
      }
    );
  };

  const handleManualPick = useCallback((lat: number, lng: number) => {
    autoGeo.current = false;
    setPos({ lat, lng });
    // Tidak remount — hanya update pickedPos marker
  }, []);

  // ── Region handlers ───────────────────────────────────────────────────────
  const onProvince = (id: string, name: string) => {
    setProvinceId(id); setProvince(name);
    setCityId(""); setCity("");
    setDistrictId(""); setDistrict("");
    setVillageId(""); setSubdistrict("");
  };
  const onCity = (id: string, name: string) => {
    setCityId(id); setCity(name);
    setDistrictId(""); setDistrict("");
    setVillageId(""); setSubdistrict("");
  };
  const onDistrict = (id: string, name: string) => {
    setDistrictId(id); setDistrict(name);
    setVillageId(""); setSubdistrict("");
  };
  const onVillage = (id: string, name: string) => {
    setVillageId(id); setSubdistrict(name);
  };

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setImgPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const submit = () => {
    setSubmitted(true);
    setTimeout(() => navigate({ to: "/my-reports" }), 1800);
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <main className="flex-1 px-5 md:px-10 py-8 max-w-5xl w-full mx-auto">
      <header className="mb-8">
        <div className="text-xs uppercase tracking-[0.25em] text-accent mb-2">Laporan Masuk</div>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-gradient">
          Membantu Laporan Pengaduan Anda
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Tiga langkah sederhana. Laporan Anda langsung dikirim ke tim distrik yang relevan.
        </p>
      </header>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold transition-smooth ${
                i < step
                  ? "gradient-primary text-primary-foreground shadow-glow"
                  : i === step
                  ? "bg-accent text-accent-foreground shadow-glow-accent"
                  : "bg-white/5 text-muted-foreground"
              }`}
            >
              {i < step ? <Check size={14} /> : i + 1}
            </div>
            <span className={`text-xs font-medium ${i === step ? "text-foreground" : "text-muted-foreground"}`}>
              {s}
            </span>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px ${i < step ? "bg-primary" : "bg-white/10"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Error banner */}
      {apiError && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 flex items-start gap-2"
        >
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <span>{apiError}</span>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {!submitted ? (
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="glass rounded-3xl p-6 md:p-8 shadow-soft"
          >
            {/* ── STEP 0 — Kategori ── */}
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
                      <button
                        key={c}
                        onClick={() => setCategory(c)}
                        className={`relative text-left p-5 rounded-2xl border transition-smooth overflow-hidden ${
                          active
                            ? "border-accent shadow-glow-accent"
                            : "border-border hover:border-white/20 bg-white/5"
                        }`}
                      >
                        <div
                          className="absolute -right-6 -top-6 h-28 w-28 rounded-full opacity-20 blur-2xl"
                          style={{ background: cat.color }}
                        />
                        <div
                          className="h-12 w-12 rounded-xl flex items-center justify-center mb-3 relative"
                          style={{
                            background: `color-mix(in oklab, ${cat.color} 25%, transparent)`,
                            color: cat.color,
                          }}
                        >
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

            {/* ── STEP 1 — Lokasi ── */}
            {step === 1 && (
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Kiri: Peta */}
                <div>
                  <h2 className="font-display text-xl font-semibold mb-1">Dimana lokasi pengaduan?</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Pilih wilayah di kanan → peta otomatis berpindah. Atau klik langsung di peta.
                  </p>

                  <div className="relative h-72 lg:h-80 rounded-2xl overflow-hidden border border-border">
                    {/* Indikator geocoding loading */}
                    <AnimatePresence>
                      {loadingGeo && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="absolute top-2 right-2 z-10 flex items-center gap-1.5 rounded-xl bg-background/80 backdrop-blur-sm border border-border px-2.5 py-1.5 text-xs text-accent"
                        >
                          <Loader2 size={11} className="animate-spin" /> Mencari koordinat…
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/*
                      key={mapKey}    → remount paksa ketika wilayah dipilih
                      initialCenter   → titik tengah peta setelah geocoding
                      initialZoom     → zoom level adaptif per level wilayah
                    */}
                    <MapClient
                      key={mapKey}
                      reports={[]}
                      pickMode
                      onPick={handleManualPick}
                      pickedPos={pos}
                      initialCenter={mapCenter}
                      initialZoom={mapZoom}
                      height="100%"
                    />
                  </div>

                  {/* Info koordinat */}
                  <div className="flex flex-wrap items-center gap-3 mt-3">
                    <button
                      onClick={useGPS}
                      className="px-3 py-2 rounded-xl glass text-xs font-medium hover:bg-white/10 transition-smooth flex items-center gap-2"
                    >
                      <Crosshair size={14} /> Gunakan Lokasi saya saat ini
                    </button>
                    {pos && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <MapPin size={12} className="text-accent" />
                        {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
                        {autoGeo.current && (
                          <span className="rounded-md bg-accent/15 text-accent px-1.5 py-0.5 text-[10px] font-medium">
                            dari wilayah
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* Kanan: Dropdown wilayah */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Silahkan pilih region administratif</h3>

                  <RegionSelect
                    label="Provinsi"
                    value={provinceId}
                    loading={loadingProv}
                    options={provinceList}
                    disabled={false}
                    placeholder={loadingProv ? "Memuat data provinsi…" : "Pilih provinsi…"}
                    onChange={onProvince}
                  />
                  <RegionSelect
                    label="Kota / Kabupaten"
                    value={cityId}
                    loading={loadingCity}
                    options={cityList}
                    disabled={!provinceId || loadingProv}
                    placeholder={!provinceId ? "Pilih provinsi dulu" : loadingCity ? "Memuat data…" : "Pilih kota / kabupaten…"}
                    onChange={onCity}
                  />
                  <RegionSelect
                    label="Kecamatan"
                    value={districtId}
                    loading={loadingDist}
                    options={districtList}
                    disabled={!cityId || loadingCity}
                    placeholder={!cityId ? "Pilih kota dulu" : loadingDist ? "Memuat data…" : "Pilih kecamatan…"}
                    onChange={onDistrict}
                  />
                  <RegionSelect
                    label="Kelurahan / Desa"
                    value={villageId}
                    loading={loadingVill}
                    options={villageList}
                    disabled={!districtId || loadingDist}
                    placeholder={!districtId ? "Pilih kecamatan dulu" : loadingVill ? "Memuat data…" : "Pilih kelurahan / desa…"}
                    onChange={onVillage}
                  />

                  {/* Indikasi geocoding */}
                  {loadingGeo && (
                    <div className="flex items-center gap-2 text-xs text-accent">
                      <Loader2 size={12} className="animate-spin" />
                      Memperbarui posisi peta berdasarkan wilayah…
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── STEP 2 — Detail ── */}
            {step === 2 && (
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h2 className="font-display text-xl font-semibold mb-1">Detail Pengaduan</h2>
                  <Field label="Judul Laporan" hint="Buat judul singkat yang menggambarkan masalahnya">
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="contoh: Lampu jalan rusak di Jl. Merdeka"
                      className="w-full bg-white/5 border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-smooth"
                    />
                  </Field>
                  <Field label="Deskripsi" hint="Apa yang anda temukan, ada permasalahan apa?">
                    <textarea
                      value={desc}
                      onChange={(e) => setDesc(e.target.value)}
                      rows={5}
                      placeholder="Detail pengaduan — apa masalahmu? sudah berapa lama? ceritakan disini dengan lengkap"
                      className="w-full bg-white/5 border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-smooth resize-none"
                    />
                  </Field>

                  {/* Ringkasan lokasi terpilih */}
                  {province && (
                    <div className="rounded-xl bg-white/[0.04] border border-border px-3.5 py-3">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
                        Lokasi Terpilih
                      </div>
                      {[
                        { label: "Provinsi",  val: province    },
                        { label: "Kota",      val: city        },
                        { label: "Kecamatan", val: district    },
                        { label: "Kelurahan", val: subdistrict },
                      ].map(
                        ({ label, val }) =>
                          val && (
                            <div key={label} className="flex gap-2 text-xs py-0.5">
                              <span className="text-muted-foreground w-20 shrink-0">{label}</span>
                              <span className="font-medium">{toTitle(val)}</span>
                            </div>
                          )
                      )}
                      {pos && (
                        <div className="flex gap-2 text-xs mt-1.5 pt-1.5 border-t border-white/5">
                          <span className="text-muted-foreground w-20 shrink-0">Koordinat</span>
                          <span className="font-mono text-accent text-[11px]">
                            {pos.lat.toFixed(6)}, {pos.lng.toFixed(6)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <Field label="Foto (opsional)" hint="JPG atau PNG, maks 10 MB">
                    <label className="block">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
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

            {/* Navigasi */}
            <div className="flex justify-between mt-8 pt-6 border-t border-border">
              <button
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground transition-smooth flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={15} /> kembali
              </button>
              {step < 2 ? (
                <button
                  onClick={() => setStep((s) => s + 1)}
                  disabled={!canNext}
                  className="px-5 py-2.5 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold shadow-glow hover:scale-[1.02] transition-smooth flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:scale-100"
                >
                  Lanjut <ChevronRight size={15} />
                </button>
              ) : (
                <button
                  onClick={submit}
                  disabled={!canNext}
                  className="px-6 py-2.5 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold shadow-glow hover:scale-[1.02] transition-smooth flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Check size={15} /> Ajukan Laporan
                </button>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-3xl p-12 text-center shadow-soft"
          >
            <div className="h-20 w-20 rounded-full gradient-primary mx-auto flex items-center justify-center shadow-glow mb-5">
              <Check size={36} className="text-primary-foreground" />
            </div>
            <h2 className="font-display text-2xl font-bold">Laporan diajukan!</h2>
            <p className="text-muted-foreground mt-2 max-w-md mx-auto text-sm">
              ID Pelacakan <span className="text-accent font-mono">RPT-2042</span>. Kami akan memberi tahu Anda segera setelah laporan Anda ditinjau.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

// ─── Helper components ────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
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

function RegionSelect({
  label,
  value,
  loading,
  options,
  disabled,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  loading: boolean;
  options: Region[];
  disabled: boolean;
  placeholder: string;
  onChange: (id: string, name: string) => void;
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
          className="w-full bg-white/5 border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-smooth disabled:opacity-40 appearance-none pr-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2382C8E5' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 14px center",
          }}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {toTitle(o.name)}
            </option>
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