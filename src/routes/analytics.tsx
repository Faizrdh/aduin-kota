import { createFileRoute } from "@tanstack/react-router";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, BarChart, Bar, Legend } from "recharts";
import { CATEGORIES, REPORTS } from "@/data/reports";
import { TrendingUp, Clock, CheckCircle2, Activity } from "lucide-react";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — CivicSpot" },
      { name: "description", content: "Visual insights into citywide reporting trends, response times, and category breakdowns." },
    ],
  }),
  component: Analytics,
});

const trend = [
  { day: "Mon", new: 8, resolved: 6 },
  { day: "Tue", new: 12, resolved: 9 },
  { day: "Wed", new: 7, resolved: 11 },
  { day: "Thu", new: 15, resolved: 8 },
  { day: "Fri", new: 11, resolved: 13 },
  { day: "Sat", new: 6, resolved: 10 },
  { day: "Sun", new: 9, resolved: 7 },
];

const responseByCat = [
  { cat: "Waste", hours: 3.2 },
  { cat: "Infra", hours: 5.4 },
  { cat: "Disturb", hours: 1.8 },
  { cat: "Land", hours: 7.1 },
];

function Analytics() {
  const catData = (Object.keys(CATEGORIES) as Array<keyof typeof CATEGORIES>).map((k) => ({
    name: CATEGORIES[k].label,
    value: REPORTS.filter((r) => r.category === k).length,
    color: CATEGORIES[k].color,
  }));

  const kpis = [
    { label: "Total reports", value: "324", delta: "+18% wk", icon: Activity, color: "var(--primary)" },
    { label: "Avg. response", value: "2.4h", delta: "-12 min", icon: Clock, color: "var(--accent)" },
    { label: "Resolution rate", value: "87%", delta: "+3 pts", icon: CheckCircle2, color: "var(--status-resolved)" },
    { label: "Active districts", value: "12", delta: "+2 new", icon: TrendingUp, color: "var(--status-progress)" },
  ];

  return (
    <main className="flex-1 px-5 md:px-10 py-8 max-w-[1500px] w-full mx-auto">
      <header className="mb-8">
        <div className="text-xs uppercase tracking-[0.25em] text-accent mb-2">Analytics</div>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-gradient">City performance, at a glance</h1>
        <p className="text-muted-foreground mt-2 text-sm">Trend lines, distributions, and response benchmarks across all monitored districts.</p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((k) => (
          <div key={k.label} className="glass rounded-2xl p-5 shadow-soft relative overflow-hidden">
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-15 blur-2xl" style={{ background: k.color }} />
            <div className="flex items-center justify-between mb-3 relative">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</span>
              <k.icon size={16} style={{ color: k.color }} />
            </div>
            <div className="font-display text-3xl font-bold relative">{k.value}</div>
            <div className="text-xs mt-1 relative" style={{ color: k.color }}>{k.delta}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 glass rounded-2xl p-6 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-lg font-semibold">Reports over time</h3>
              <p className="text-xs text-muted-foreground">Last 7 days · new vs resolved</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-accent" /> New</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "var(--status-resolved)" }} /> Resolved</span>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" stroke="rgba(255,255,255,0.4)" fontSize={11} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} />
                <Tooltip contentStyle={{ background: "rgba(20,25,45,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }} />
                <Line type="monotone" dataKey="new" stroke="#82C8E5" strokeWidth={2.5} dot={{ r: 4, fill: "#82C8E5" }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="resolved" stroke="oklch(0.7 0.16 155)" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl p-6 shadow-soft">
          <h3 className="font-display text-lg font-semibold mb-1">By category</h3>
          <p className="text-xs text-muted-foreground mb-4">Share of all reports</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={catData} dataKey="value" innerRadius={48} outerRadius={78} paddingAngle={3} stroke="none">
                  {catData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "rgba(20,25,45,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-3">
            {catData.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: d.color }} />{d.name}</span>
                <span className="text-muted-foreground">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass rounded-2xl p-6 shadow-soft">
          <h3 className="font-display text-lg font-semibold mb-1">Response time by category</h3>
          <p className="text-xs text-muted-foreground mb-4">Average hours from submission to first action</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={responseByCat} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="cat" stroke="rgba(255,255,255,0.4)" fontSize={11} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} />
                <Tooltip contentStyle={{ background: "rgba(20,25,45,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="hours" radius={[8, 8, 0, 0]} fill="url(#barGrad)" />
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#82C8E5" />
                    <stop offset="100%" stopColor="#0047AB" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl p-6 shadow-soft">
          <h3 className="font-display text-lg font-semibold mb-1">Top performing districts</h3>
          <p className="text-xs text-muted-foreground mb-5">Ranked by resolution rate this week</p>
          <div className="space-y-4">
            {[
              { name: "Menteng, Jakarta Pusat", rate: 96, count: 24 },
              { name: "Coblong, Bandung", rate: 91, count: 19 },
              { name: "Genteng, Surabaya", rate: 88, count: 17 },
              { name: "Setiabudi, Jakarta Selatan", rate: 84, count: 22 },
              { name: "Denpasar Selatan, Bali", rate: 79, count: 14 },
            ].map((d, i) => (
              <div key={d.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="h-6 w-6 rounded-md glass flex items-center justify-center text-[11px] font-bold text-accent">{i + 1}</span>
                    <span className="font-medium">{d.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{d.rate}% · {d.count} reports</div>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full gradient-accent" style={{ width: `${d.rate}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
