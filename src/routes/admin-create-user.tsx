/* eslint-disable */
// src/routes/admin-create-user.tsx

import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserPlus, Mail, Lock, User, MapPin, Shield, BadgeCheck, Users,
  Eye, EyeOff, CheckCircle2, AlertCircle, Pencil, Trash2,
  Search, X, RefreshCw, ChevronRight,
} from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = "CITIZEN" | "OFFICER" | "ADMIN";

interface UserRow {
  id       : string;
  name     : string;
  email    : string;
  role     : Role;
  city     : string;
  createdAt: string;
}

interface FormState {
  name    : string;
  email   : string;
  password: string;
  confirm : string;
  role    : Role;
  city    : string;
}

interface FieldError {
  name?    : string;
  email?   : string;
  password?: string;
  confirm? : string;
  city?    : string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES: {
  value      : Role;
  label      : string;
  desc       : string;
  Icon       : React.ElementType;
  colorClass : string;
  bgClass    : string;
  borderClass: string;
}[] = [
  { value: "CITIZEN", label: "Warga",   desc: "Dapat mengajukan & memantau laporan.",      Icon: Users,      colorClass: "text-sky-400",    bgClass: "bg-sky-400/10",    borderClass: "border-sky-400/40"    },
  { value: "OFFICER", label: "Petugas", desc: "Menangani & memperbarui status laporan.",   Icon: BadgeCheck, colorClass: "text-amber-400",  bgClass: "bg-amber-400/10",  borderClass: "border-amber-400/40"  },
  { value: "ADMIN",   label: "Admin",   desc: "Akses penuh ke semua fitur sistem.",        Icon: Shield,     colorClass: "text-violet-400", bgClass: "bg-violet-400/10", borderClass: "border-violet-400/40" },
];

const EMPTY_FORM: FormState = { name: "", email: "", password: "", confirm: "", role: "CITIZEN", city: "Jakarta" };

// ─── Validation ───────────────────────────────────────────────────────────────

function validate(form: FormState, isEdit: boolean): FieldError {
  const err: FieldError = {};
  if (!form.name.trim())                      err.name     = "Nama tidak boleh kosong.";
  if (!form.email.trim())                     err.email    = "Email tidak boleh kosong.";
  else if (!/\S+@\S+\.\S+/.test(form.email)) err.email    = "Format email tidak valid.";
  if (!form.city.trim())                      err.city     = "Kota tidak boleh kosong.";

  // Password hanya wajib saat create; saat edit boleh kosong (tidak diubah)
  if (!isEdit || form.password) {
    if (form.password.length < 8)             err.password = "Password minimal 8 karakter.";
    if (form.password !== form.confirm)       err.confirm  = "Konfirmasi password tidak cocok.";
  }
  return err;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/admin-create-user")({
  component: AdminUsersPage,
});

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const [users,   setUsers]   = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [toast,   setToast]   = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Modal state
  const [modalOpen,  setModalOpen]  = useState(false);
  const [editTarget, setEditTarget] = useState<UserRow | null>(null); // null = create mode
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);

  // ── Fetch users ────────────────────────────────────────────────────────────

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/users");
      if (!res.ok) throw new Error("Gagal memuat data pengguna.");
      const data = await res.json();
      setUsers(data.users);
    } catch (e: any) {
      showToast("error", e.message ?? "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ── Toast ──────────────────────────────────────────────────────────────────

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Handlers ───────────────────────────────────────────────────────────────

  const openCreate = () => { setEditTarget(null); setModalOpen(true); };
  const openEdit   = (u: UserRow) => { setEditTarget(u); setModalOpen(true); };

  const onSaved = (user: UserRow, isEdit: boolean) => {
    setUsers((prev) =>
      isEdit
        ? prev.map((u) => (u.id === user.id ? user : u))
        : [user, ...prev]
    );
    showToast("success", isEdit ? "Pengguna berhasil diperbarui." : "Pengguna berhasil dibuat.");
  };

  const onDeleted = async () => {
    if (!deleteTarget) return;
    try {
      const res = await apiFetch(`/api/admin/users/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Gagal menghapus pengguna.");
      }
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      showToast("success", `Pengguna "${deleteTarget.name}" telah dihapus.`);
    } catch (e: any) {
      showToast("error", e.message);
    } finally {
      setDeleteTarget(null);
    }
  };

  // ── Filter ─────────────────────────────────────────────────────────────────

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.name.toLowerCase().includes(q)  ||
      u.email.toLowerCase().includes(q) ||
      u.city.toLowerCase().includes(q)  ||
      u.role.toLowerCase().includes(q)
    );
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen p-6 md:p-10">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl gradient-primary flex items-center justify-center shadow-glow shrink-0">
              <Users className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-bold text-2xl text-foreground leading-tight">Manajemen Pengguna</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{users.length} pengguna terdaftar dalam sistem.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchUsers}
              className="h-10 w-10 flex items-center justify-center rounded-xl border border-border bg-white/5 hover:bg-white/10 transition-smooth text-muted-foreground hover:text-foreground"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm shadow-glow hover:opacity-90 transition-smooth"
            >
              <UserPlus size={15} />
              Tambah Pengguna
            </button>
          </div>
        </div>
      </motion.div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border mb-6 text-sm font-medium ${
              toast.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-red-500/10 border-red-500/30 text-red-400"
            }`}
          >
            {toast.type === "success" ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-4">
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Cari nama, email, kota, peran…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-border rounded-xl pl-9 pr-9 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-smooth"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          )}
        </div>
      </motion.div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-strong border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground text-sm gap-2">
            <span className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
            Memuat data…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-2">
            <Users size={36} className="opacity-20" />
            <p className="text-sm">{search ? "Tidak ada hasil pencarian." : "Belum ada pengguna."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-widest">
                  <th className="text-left px-5 py-3.5 font-semibold">Pengguna</th>
                  <th className="text-left px-5 py-3.5 font-semibold hidden md:table-cell">Kota</th>
                  <th className="text-left px-5 py-3.5 font-semibold">Peran</th>
                  <th className="text-left px-5 py-3.5 font-semibold hidden lg:table-cell">Dibuat</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, i) => {
                  const roleConf = ROLES.find((r) => r.value === u.role)!;
                  return (
                    <motion.tr
                      key={u.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-border/50 last:border-0 hover:bg-white/5 transition-smooth"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-foreground leading-tight">{u.name}</div>
                            <div className="text-xs text-muted-foreground">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell">{u.city}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${roleConf.bgClass} ${roleConf.borderClass} ${roleConf.colorClass}`}>
                          <roleConf.Icon size={11} />
                          {roleConf.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs hidden lg:table-cell">
                        {new Date(u.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEdit(u)}
                            className="h-8 w-8 flex items-center justify-center rounded-lg border border-border bg-white/5 hover:bg-white/10 hover:border-white/20 text-muted-foreground hover:text-foreground transition-smooth"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(u)}
                            className="h-8 w-8 flex items-center justify-center rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500/15 text-red-400/60 hover:text-red-400 transition-smooth"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Create / Edit Modal */}
      <AnimatePresence>
        {modalOpen && (
          <UserModal
            editTarget={editTarget}
            onClose={() => setModalOpen(false)}
            onSaved={onSaved}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirm Modal */}
      <AnimatePresence>
        {deleteTarget && (
          <DeleteModal
            user={deleteTarget}
            onClose={() => setDeleteTarget(null)}
            onConfirm={onDeleted}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── UserModal (Create / Edit) ────────────────────────────────────────────────

function UserModal({
  editTarget,
  onClose,
  onSaved,
}: {
  editTarget: UserRow | null;
  onClose  : () => void;
  onSaved  : (user: UserRow, isEdit: boolean) => void;
}) {
  const isEdit = !!editTarget;

  const [form, setForm]     = useState<FormState>(
    isEdit
      ? { name: editTarget.name, email: editTarget.email, password: "", confirm: "", role: editTarget.role, city: editTarget.city }
      : EMPTY_FORM
  );
  const [errors, setErrors] = useState<FieldError>({});
  const [showPw, setShowPw] = useState(false);
  const [showCf, setShowCf] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((p) => ({ ...p, [k]: e.target.value }));
    setErrors((p) => ({ ...p, [k]: undefined }));
    setApiError(null);
  };

  const handleSubmit = async () => {
    const errs = validate(form, isEdit);
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    setApiError(null);
    try {
      const body: Record<string, string> = {
        name : form.name.trim(),
        email: form.email.trim(),
        role : form.role,
        city : form.city.trim(),
      };
      if (form.password) body.password = form.password;

      const res = await apiFetch(
        isEdit ? `/api/admin/users/${editTarget!.id}` : "/api/admin/users",
        { method: isEdit ? "PUT" : "POST", body: JSON.stringify(body) }
      );

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Terjadi kesalahan pada server.");
      }

      const { user } = await res.json();
      onSaved(user, isEdit);
      onClose();
    } catch (e: any) {
      setApiError(e.message ?? "Gagal menyimpan data.");
    } finally {
      setLoading(false);
    }
  };

  const activeRole = ROLES.find((r) => r.value === form.role)!;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="glass-strong border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
              {isEdit ? <Pencil size={15} className="text-primary-foreground" /> : <UserPlus size={15} className="text-primary-foreground" />}
            </div>
            <div>
              <h2 className="font-bold text-foreground text-base leading-tight">{isEdit ? "Edit Pengguna" : "Tambah Pengguna Baru"}</h2>
              {isEdit && <p className="text-xs text-muted-foreground">{editTarget.email}</p>}
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-smooth">
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Left */}
          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Informasi Akun</p>
              <div className="space-y-4">
                <Field label="Nama Lengkap" error={errors.name} icon={<User size={14} />}>
                  <input type="text" placeholder="Budi Santoso" value={form.name} onChange={set("name")} className={inputCls(!!errors.name)} />
                </Field>
                <Field label="Email" error={errors.email} icon={<Mail size={14} />}>
                  <input type="email" placeholder="budi@example.com" value={form.email} onChange={set("email")} className={inputCls(!!errors.email)} />
                </Field>
                <Field label="Kota" error={errors.city} icon={<MapPin size={14} />}>
                  <input type="text" placeholder="Jakarta" value={form.city} onChange={set("city")} className={inputCls(!!errors.city)} />
                </Field>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                {isEdit ? "Password (kosongkan jika tidak diubah)" : "Keamanan"}
              </p>
              <div className="space-y-4">
                <Field label="Password" error={errors.password} icon={<Lock size={14} />}>
                  <div className="relative">
                    <input type={showPw ? "text" : "password"} placeholder={isEdit ? "Biarkan kosong jika tidak diubah" : "Min. 8 karakter"} value={form.password} onChange={set("password")} className={`${inputCls(!!errors.password)} pr-10`} />
                    <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-smooth">
                      {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </Field>
                <Field label="Konfirmasi Password" error={errors.confirm} icon={<Lock size={14} />}>
                  <div className="relative">
                    <input type={showCf ? "text" : "password"} placeholder="Ulangi password" value={form.confirm} onChange={set("confirm")} className={`${inputCls(!!errors.confirm)} pr-10`} />
                    <button type="button" onClick={() => setShowCf((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-smooth">
                      {showCf ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </Field>
                <PasswordStrength password={form.password} />
              </div>
            </div>
          </div>

          {/* Right */}
          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Peran Pengguna</p>
              <div className="space-y-2.5">
                {ROLES.map((r) => {
                  const active = form.role === r.value;
                  return (
                    <motion.button
                      key={r.value}
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setForm((p) => ({ ...p, role: r.value }))}
                      className={`w-full flex items-start gap-3 p-3.5 rounded-xl border text-left transition-smooth ${
                        active ? `${r.bgClass} ${r.borderClass}` : "bg-white/5 border-border hover:border-white/20"
                      }`}
                    >
                      <div className={`mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${active ? r.bgClass : "bg-white/5"}`}>
                        <r.Icon size={14} className={active ? r.colorClass : "text-muted-foreground"} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-semibold ${active ? r.colorClass : "text-foreground"}`}>{r.label}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{r.desc}</div>
                      </div>
                      {active && <CheckCircle2 size={14} className={`${r.colorClass} shrink-0 mt-0.5`} />}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Summary */}
            <div className="glass border border-border rounded-xl p-4 space-y-2.5 text-xs">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Ringkasan</p>
              <SummaryRow label="Nama"  value={form.name  || "—"} />
              <SummaryRow label="Email" value={form.email || "—"} />
              <SummaryRow label="Kota"  value={form.city  || "—"} />
              <SummaryRow label="Peran" value={<span className={`font-semibold ${activeRole.colorClass}`}>{activeRole.label}</span>} />
            </div>
          </div>
        </div>

        {/* API Error */}
        <AnimatePresence>
          {apiError && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mx-6 mb-4 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm"
            >
              <AlertCircle size={15} />
              {apiError}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground border border-border hover:border-white/20 bg-white/5 hover:bg-white/10 transition-smooth">
            Batal
          </button>
          <motion.button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm shadow-glow hover:opacity-90 transition-smooth disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Menyimpan…
              </span>
            ) : (
              <>
                {isEdit ? <CheckCircle2 size={14} /> : <UserPlus size={14} />}
                {isEdit ? "Simpan Perubahan" : "Buat Pengguna"}
                <ChevronRight size={13} />
              </>
            )}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── DeleteModal ──────────────────────────────────────────────────────────────

function DeleteModal({
  user,
  onClose,
  onConfirm,
}: {
  user     : UserRow;
  onClose  : () => void;
  onConfirm: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 12 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        className="glass-strong border border-red-500/30 rounded-2xl w-full max-w-sm p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
            <Trash2 size={17} className="text-red-400" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">Hapus Pengguna</h3>
            <p className="text-xs text-muted-foreground">Tindakan ini tidak dapat dibatalkan.</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          Anda akan menghapus pengguna{" "}
          <span className="font-semibold text-foreground">"{user.name}"</span>
          {" "}({user.email}). Semua laporan dan data terkait juga akan ikut terhapus.
        </p>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-smooth">
            Batal
          </button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-500 hover:bg-red-600 text-white transition-smooth">
            Ya, Hapus
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function inputCls(hasErr: boolean) {
  return `w-full bg-white/5 border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-smooth ${
    hasErr ? "border-red-500/50 focus:ring-red-500/30" : "border-border focus:ring-primary/30 focus:border-primary/50"
  }`;
}

function Field({ label, error, icon, children }: { label: string; error?: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}{label}
      </label>
      {children}
      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="text-[11px] text-red-400 flex items-center gap-1">
            <AlertCircle size={11} />{error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground truncate max-w-[60%] text-right">{value}</span>
    </div>
  );
}

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const score =
    (password.length >= 8          ? 1 : 0) +
    (/[A-Z]/.test(password)        ? 1 : 0) +
    (/[0-9]/.test(password)        ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(password) ? 1 : 0);
  const levels = [
    { label: "Lemah",      color: "bg-red-500"     },
    { label: "Sedang",     color: "bg-amber-400"   },
    { label: "Kuat",       color: "bg-emerald-400" },
    { label: "Sangat Kuat",color: "bg-emerald-400" },
  ];
  const lvl = levels[Math.min(score - 1, 3)] ?? levels[0];
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i < score ? lvl.color : "bg-white/10"}`} />
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">Kekuatan: <span className="font-medium text-foreground">{lvl.label}</span></p>
    </div>
  );
}