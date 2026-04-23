import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Check, MapPin, Upload, Crosshair, Trash2, Construction, AlertTriangle, MapPinned } from "lucide-react";
import { MapClient } from "@/components/civic/MapClient";
import { CATEGORIES, INDONESIA_REGIONS, type Category } from "@/data/reports";

export const Route = createFileRoute("/submit")({
  head: () => ({
    meta: [
      { title: "Submit Report — CivicSpot" },
      { name: "description", content: "Report a city issue in three quick steps with location pinning and photo upload." },
    ],
  }),
  component: SubmitPage,
});

const ICONS = { Trash2, Construction, AlertTriangle, MapPinned };

function SubmitPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState<Category | null>(null);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [subdistrict, setSubdistrict] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const provinces = Object.keys(INDONESIA_REGIONS);
  const cities = useMemo(() => (province ? Object.keys(INDONESIA_REGIONS[province]) : []), [province]);
  const districts = useMemo(() => (province && city ? Object.keys(INDONESIA_REGIONS[province][city]) : []), [province, city]);
  const subdistricts = useMemo(
    () => (province && city && district ? INDONESIA_REGIONS[province][city][district] : []),
    [province, city, district]
  );

  const steps = ["Category", "Location", "Details"];

  const canNext =
    (step === 0 && category !== null) ||
    (step === 1 && pos !== null && province && city && district && subdistrict) ||
    (step === 2 && title.trim().length > 3 && desc.trim().length > 5);

  const useGPS = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setPos({ lat: -6.2088, lng: 106.82 })
    );
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

  return (
    <main className="flex-1 px-5 md:px-10 py-8 max-w-5xl w-full mx-auto">
      <header className="mb-8">
        <div className="text-xs uppercase tracking-[0.25em] text-accent mb-2">Submit a report</div>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-gradient">Help your city respond faster</h1>
        <p className="text-muted-foreground mt-2 text-sm">Three quick steps. Your report goes straight to the relevant district team.</p>
      </header>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold transition-smooth ${
                i < step ? "gradient-primary text-primary-foreground shadow-glow" :
                i === step ? "bg-accent text-accent-foreground shadow-glow-accent" :
                "bg-white/5 text-muted-foreground"
              }`}
            >
              {i < step ? <Check size={14} /> : i + 1}
            </div>
            <span className={`text-xs font-medium ${i === step ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
            {i < steps.length - 1 && <div className={`flex-1 h-px ${i < step ? "bg-primary" : "bg-white/10"}`} />}
          </div>
        ))}
      </div>

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
          {step === 0 && (
            <div>
              <h2 className="font-display text-xl font-semibold mb-1">What kind of issue?</h2>
              <p className="text-sm text-muted-foreground mb-6">Pick the category that best matches your report.</p>
              <div className="grid sm:grid-cols-2 gap-4">
                {(Object.keys(CATEGORIES) as Category[]).map((c) => {
                  const cat = CATEGORIES[c];
                  const Icon = ICONS[cat.icon as keyof typeof ICONS];
                  const active = category === c;
                  return (
                    <button
                      key={c}
                      onClick={() => setCategory(c)}
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
                        {c === "waste" && "Garbage, illegal dumping, hazardous waste"}
                        {c === "infra" && "Roads, lights, bridges, public facilities"}
                        {c === "disturb" && "Noise, pollution, safety hazards"}
                        {c === "land" && "Land use, encroachment, social issues"}
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

          {step === 1 && (
            <div className="grid lg:grid-cols-2 gap-6">
              <div>
                <h2 className="font-display text-xl font-semibold mb-1">Where is it?</h2>
                <p className="text-sm text-muted-foreground mb-4">Click the map to pin the exact spot, or use your GPS.</p>
                <div className="h-72 lg:h-80 rounded-2xl overflow-hidden border border-border">
                  <MapClient reports={[]} pickMode onPick={(lat, lng) => setPos({ lat, lng })} pickedPos={pos} height="100%" />
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <button onClick={useGPS} className="px-3 py-2 rounded-xl glass text-xs font-medium hover:bg-white/10 transition-smooth flex items-center gap-2">
                    <Crosshair size={14} /> Use my location
                  </button>
                  {pos && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <MapPin size={12} className="text-accent" />
                      {pos.lat.toFixed(4)}, {pos.lng.toFixed(4)}
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="font-semibold text-sm">Administrative region</h3>
                <Select label="Province" value={province} onChange={(v) => { setProvince(v); setCity(""); setDistrict(""); setSubdistrict(""); }} options={provinces} />
                <Select label="City / Regency" value={city} onChange={(v) => { setCity(v); setDistrict(""); setSubdistrict(""); }} options={cities} disabled={!province} />
                <Select label="District" value={district} onChange={(v) => { setDistrict(v); setSubdistrict(""); }} options={districts} disabled={!city} />
                <Select label="Sub-district" value={subdistrict} onChange={setSubdistrict} options={subdistricts} disabled={!district} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h2 className="font-display text-xl font-semibold mb-1">Tell us more</h2>
                <Field label="Report title" hint="A short summary residents will see">
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Broken streetlight on Jl. Sudirman"
                    className="w-full bg-white/5 border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-smooth" />
                </Field>
                <Field label="Description" hint="What did you observe? Any safety concerns?">
                  <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={5}
                    placeholder="Provide context — duration, severity, who's affected…"
                    className="w-full bg-white/5 border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-smooth resize-none" />
                </Field>
              </div>
              <div>
                <Field label="Photo (optional)" hint="JPG or PNG, up to 10 MB">
                  <label className="block">
                    <input type="file" accept="image/*" className="hidden"
                      onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
                    {imgPreview ? (
                      <div className="relative rounded-2xl overflow-hidden border border-border group cursor-pointer">
                        <img src={imgPreview} alt="" className="w-full h-64 object-cover" />
                        <div className="absolute inset-0 bg-background/70 opacity-0 group-hover:opacity-100 transition-smooth flex items-center justify-center text-sm">
                          Click to replace
                        </div>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-border rounded-2xl h-64 flex flex-col items-center justify-center hover:border-accent transition-smooth cursor-pointer bg-white/[0.02]">
                        <div className="h-12 w-12 rounded-full glass flex items-center justify-center mb-3">
                          <Upload size={20} className="text-accent" />
                        </div>
                        <div className="text-sm font-medium">Click or drag image to upload</div>
                        <div className="text-xs text-muted-foreground mt-1">A photo speeds up triage</div>
                      </div>
                    )}
                  </label>
                </Field>
              </div>
            </div>
          )}

          <div className="flex justify-between mt-8 pt-6 border-t border-border">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground transition-smooth flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={15} /> Back
            </button>
            {step < 2 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canNext}
                className="px-5 py-2.5 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold shadow-glow hover:scale-[1.02] transition-smooth flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:scale-100"
              >
                Continue <ChevronRight size={15} />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!canNext}
                className="px-6 py-2.5 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold shadow-glow hover:scale-[1.02] transition-smooth flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Check size={15} /> Submit Report
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
          <h2 className="font-display text-2xl font-bold">Report submitted!</h2>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto text-sm">
            Tracking ID <span className="text-accent font-mono">RPT-2042</span>. We'll notify you the moment your report is reviewed.
          </p>
        </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

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

function Select({ label, value, onChange, options, disabled }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; disabled?: boolean;
}) {
  return (
    <Field label={label}>
      <select
        value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
        className="w-full bg-white/5 border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-smooth disabled:opacity-40 appearance-none"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2382C8E5' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center" }}
      >
        <option value="">Select {label.toLowerCase()}…</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </Field>
  );
}
