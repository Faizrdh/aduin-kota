import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, MoreHorizontal } from "lucide-react";
import { CATEGORIES, REPORTS, STATUSES, type Status, timeAgo } from "@/data/reports";
import { CategoryBadge, StatusBadge } from "@/components/civic/StatusBadge";

export const Route = createFileRoute("/my-reports")({
  head: () => ({
    meta: [
      { title: "My Reports — CivicSpot" },
      { name: "description", content: "Track every report you've submitted, with status, location, and updates." },
    ],
  }),
  component: MyReports,
});

function MyReports() {
  const [filter, setFilter] = useState<Status | "all">("all");
  const [q, setQ] = useState("");
  const list = REPORTS.filter((r) => (filter === "all" || r.status === filter) && (q === "" || r.title.toLowerCase().includes(q.toLowerCase())));

  return (
    <main className="flex-1 px-5 md:px-10 py-8 max-w-[1400px] w-full mx-auto">
      <header className="mb-8">
        <div className="text-xs uppercase tracking-[0.25em] text-accent mb-2">Your activity</div>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-gradient">My Reports</h1>
        <p className="text-muted-foreground mt-2 text-sm">Every report you've submitted and its current resolution status.</p>
      </header>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="glass rounded-xl px-3.5 py-2 flex items-center gap-2 flex-1 max-w-md">
          <Search size={14} className="text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your reports…"
            className="bg-transparent outline-none text-sm w-full" />
        </div>
        <div className="glass rounded-xl p-1 flex items-center gap-1">
          {(["all", "new", "progress", "resolved"] as const).map((k) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-smooth ${
                filter === k ? "gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"
              }`}>
              {k === "all" ? "All" : STATUSES[k].label}
            </button>
          ))}
        </div>
      </div>

      <div className="glass rounded-2xl shadow-soft overflow-hidden">
        <div className="hidden md:grid grid-cols-[80px_2.5fr_1.2fr_1fr_1.4fr_100px_40px] gap-4 px-5 py-3 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
          <div>Image</div><div>Report</div><div>Category</div><div>Status</div><div>Location</div><div>Submitted</div><div></div>
        </div>
        <div className="divide-y divide-border">
          {list.map((r) => {
            const cat = CATEGORIES[r.category];
            return (
              <div key={r.id} className="grid grid-cols-[64px_1fr_auto] md:grid-cols-[80px_2.5fr_1.2fr_1fr_1.4fr_100px_40px] gap-4 px-5 py-4 hover:bg-white/[0.03] transition-smooth items-center">
                <img src={r.image} alt="" loading="lazy" className="h-14 w-14 md:h-16 md:w-16 rounded-lg object-cover" />
                <div className="min-w-0">
                  <div className="text-[10px] text-muted-foreground tracking-wider">{r.id}</div>
                  <div className="text-sm font-medium truncate">{r.title}</div>
                  <div className="md:hidden flex flex-wrap gap-1.5 mt-1.5">
                    <CategoryBadge category={cat.color} label={cat.label} />
                    <StatusBadge status={r.status} />
                  </div>
                </div>
                <div className="hidden md:block"><CategoryBadge category={cat.color} label={cat.label} /></div>
                <div className="hidden md:block"><StatusBadge status={r.status} /></div>
                <div className="hidden md:block text-xs text-muted-foreground truncate">
                  {r.region.subdistrict}, {r.region.city}
                </div>
                <div className="hidden md:block text-xs text-muted-foreground">{timeAgo(r.createdAt)}</div>
                <button className="hidden md:flex h-8 w-8 rounded-lg hover:bg-white/5 items-center justify-center transition-smooth">
                  <MoreHorizontal size={15} className="text-muted-foreground" />
                </button>
              </div>
            );
          })}
          {list.length === 0 && (
            <div className="p-12 text-center text-muted-foreground text-sm">No reports match your filters.</div>
          )}
        </div>
      </div>
    </main>
  );
}
