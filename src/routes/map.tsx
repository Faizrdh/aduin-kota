/*eslint-disable*/

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Filter, Plus, X, MapPin, Search, Layers } from "lucide-react";
import { MapClient } from "@/components/civic/MapClient";
import { CATEGORIES, REPORTS, STATUSES, type Category, type Status, type Report, timeAgo } from "@/data/reports";
import { StatusBadge, CategoryBadge } from "@/components/civic/StatusBadge";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Map Reports — CivicSpot" },
      { name: "description", content: "Interactive dark-mode map of citizen reports across Indonesia, filterable by category and status." },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  const [activeCats, setActiveCats] = useState<Category[]>(Object.keys(CATEGORIES) as Category[]);
  const [activeStat, setActiveStat] = useState<Status | "all">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Report | null>(null);

  const filtered = useMemo(() => {
    return REPORTS.filter(
      (r) =>
        activeCats.includes(r.category) &&
        (activeStat === "all" || r.status === activeStat) &&
        (search === "" || r.title.toLowerCase().includes(search.toLowerCase()) || r.region.city.toLowerCase().includes(search.toLowerCase()))
    );
  }, [activeCats, activeStat, search]);

  const toggleCat = (c: Category) =>
    setActiveCats((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  return (
    <main className="flex-1 relative h-[calc(100vh-0px)] md:h-screen">
      {/* Map fills */}
      <div className="absolute inset-0 p-3 md:p-4">
        <MapClient reports={filtered} onSelect={setSelected} height="100%" />
      </div>

      {/* Top bar overlay */}
      <div className="absolute top-6 left-6 right-6 flex flex-wrap items-center gap-3 pointer-events-none z-[400]">
        <div className="glass-strong rounded-2xl px-4 py-2.5 flex items-center gap-2 pointer-events-auto shadow-elevated">
          <Search size={15} className="text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reports, cities…"
            className="bg-transparent outline-none text-sm w-56 placeholder:text-muted-foreground"
          />
        </div>

        <div className="glass-strong rounded-2xl p-1.5 flex items-center gap-1 pointer-events-auto shadow-elevated">
          <button
            onClick={() => setActiveStat("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-smooth ${
              activeStat === "all" ? "gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </button>
          {(Object.keys(STATUSES) as Status[]).map((s) => (
            <button
              key={s}
              onClick={() => setActiveStat(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-smooth ${
                activeStat === s ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {STATUSES[s].label}
            </button>
          ))}
        </div>

        <div className="ml-auto glass-strong rounded-2xl px-3 py-2 flex items-center gap-2 pointer-events-auto shadow-elevated text-xs">
          <Layers size={14} className="text-accent" />
          <span className="font-medium">{filtered.length}</span>
          <span className="text-muted-foreground">/ {REPORTS.length} visible</span>
        </div>
      </div>

      {/* Category filter — left floating */}
      <div className="absolute top-28 left-6 glass-strong rounded-2xl p-3 z-[400] pointer-events-auto shadow-elevated w-56 hidden md:block">
        <div className="flex items-center gap-2 mb-3 px-1">
          <Filter size={13} className="text-accent" />
          <span className="text-xs font-semibold uppercase tracking-wider">Categories</span>
        </div>
        <div className="space-y-1">
          {(Object.keys(CATEGORIES) as Category[]).map((c) => {
            const cat = CATEGORIES[c];
            const active = activeCats.includes(c);
            const count = REPORTS.filter((r) => r.category === c).length;
            return (
              <button
                key={c}
                onClick={() => toggleCat(c)}
                className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg transition-smooth text-sm ${
                  active ? "bg-white/8" : "opacity-50 hover:opacity-100"
                }`}
              >
                <span className="h-3 w-3 rounded-sm" style={{ background: cat.color, boxShadow: active ? `0 0 10px ${cat.color}` : "none" }} />
                <span className="flex-1 text-left text-[13px]">{cat.label}</span>
                <span className="text-[10px] text-muted-foreground">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected report side card */}
      <AnimatePresence>
        {selected && (
          <motion.aside
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            className="absolute top-6 right-6 bottom-6 w-80 glass-strong rounded-3xl shadow-elevated overflow-hidden z-[400] flex flex-col"
          >
            <div className="relative h-44">
              <img src={selected.image} alt={selected.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
              <button
                onClick={() => setSelected(null)}
                className="absolute top-3 right-3 h-8 w-8 rounded-full glass-strong flex items-center justify-center hover:bg-white/15 transition-smooth"
              >
                <X size={15} />
              </button>
              <div className="absolute bottom-3 left-4 right-4 flex flex-wrap gap-2">
                <CategoryBadge category={CATEGORIES[selected.category].color} label={CATEGORIES[selected.category].label} />
                <StatusBadge status={selected.status} />
              </div>
            </div>
            <div className="p-5 flex-1 overflow-y-auto">
              <div className="text-[10px] text-muted-foreground tracking-wider uppercase">{selected.id}</div>
              <h3 className="font-display text-lg font-semibold mt-1 leading-snug">{selected.title}</h3>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{selected.description}</p>

              <div className="mt-5 space-y-3 text-sm">
                <Row icon={<MapPin size={13} />} label="Location"
                  value={`${selected.region.subdistrict}, ${selected.region.district}, ${selected.region.city}`} />
                <Row icon={<span className="text-[10px]">📍</span>} label="Coordinates"
                  value={`${selected.lat.toFixed(4)}, ${selected.lng.toFixed(4)}`} />
                <Row icon={<span className="text-[10px]">👤</span>} label="Reporter" value={selected.reporter} />
                <Row icon={<span className="text-[10px]">⏱</span>} label="Submitted" value={timeAgo(selected.createdAt)} />
              </div>
            </div>
            <div className="p-4 border-t border-border flex gap-2">
              <button className="flex-1 px-3 py-2 rounded-xl glass text-xs font-medium hover:bg-white/10 transition-smooth">Assign</button>
              <button className="flex-1 px-3 py-2 rounded-xl gradient-primary text-primary-foreground text-xs font-semibold hover:scale-[1.02] transition-smooth">
                Mark resolved
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Floating CTA */}
      <Link
        to="/submit"
        className="absolute bottom-8 right-8 z-[450] h-14 px-6 rounded-full gradient-primary text-primary-foreground font-semibold shadow-glow hover:scale-105 transition-smooth flex items-center gap-2 animate-float"
      >
        <Plus size={18} /> Buat Pengaduan
      </Link>
    </main>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 h-6 w-6 rounded-md bg-white/5 flex items-center justify-center text-muted-foreground">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm">{value}</div>
      </div>
    </div>
  );
}
