import { STATUSES, type Status } from "@/data/reports";

export function StatusBadge({ status }: { status: Status }) {
  const s = STATUSES[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border"
      style={{
        background: `color-mix(in oklab, ${s.color} 15%, transparent)`,
        color: s.color,
        borderColor: `color-mix(in oklab, ${s.color} 35%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

export function CategoryBadge({ category, label }: { category: string; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
      style={{
        background: `color-mix(in oklab, ${category} 18%, transparent)`,
        color: category,
        border: `1px solid color-mix(in oklab, ${category} 35%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: category }} />
      {label}
    </span>
  );
}
