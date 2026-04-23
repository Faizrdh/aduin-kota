/*eslint-disable*/

import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  EyeOff,
  MapPin,
  ArrowRight,
  Lock,
  Mail,
  ChevronLeft,
  User,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { authenticate, register, saveSession } from "@/data/login";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Masuk — AduinKota" },
      { name: "description", content: "Login ke dashboard AduinKota" },
    ],
  }),
  component: LoginPage,
});

// ─── Floating background particles ───────────────────────────────────────────
const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  size: 2 + Math.random() * 3,
  x: Math.random() * 100,
  y: Math.random() * 100,
  delay: Math.random() * 4,
  duration: 3 + Math.random() * 4,
}));

function LoginPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"login" | "register">("login");

  // Login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Register extra state
  const [name, setName] = useState("");
  const [city, setCity] = useState("Jakarta");
  const [confirmPass, setConfirmPass] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setName("");
    setCity("Jakarta");
    setConfirmPass("");
    setError("");
    setSuccess("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Email dan password wajib diisi.");
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 900)); // simulate network
    const user = authenticate(email.trim(), password);
    setLoading(false);
    if (!user) {
      setError("Email atau password salah. Coba lagi.");
      return;
    }
    saveSession(user);
    setSuccess(`Selamat datang, ${user.name}! Mengalihkan…`);
    await new Promise((r) => setTimeout(r, 800));
    navigate({ to: "/" });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("Semua field wajib diisi.");
      return;
    }
    if (password !== confirmPass) {
      setError("Password dan konfirmasi tidak cocok.");
      return;
    }
    if (password.length < 6) {
      setError("Password minimal 6 karakter.");
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 900));
    const result = register(name.trim(), email.trim(), password, city);
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? "Pendaftaran gagal.");
      return;
    }
    saveSession(result.user!);
    setSuccess(`Akun berhasil dibuat! Selamat datang, ${result.user!.name}…`);
    await new Promise((r) => setTimeout(r, 800));
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen w-full flex bg-background overflow-hidden">
      {/* ══════════════════════════════════
          LEFT PANEL — Branding
      ══════════════════════════════════ */}
      <div
        className="hidden lg:flex flex-col flex-1 relative overflow-hidden"
        style={{
          background:
            "linear-gradient(145deg, #060b18 0%, #0d1a3a 45%, #0a1628 100%)",
        }}
      >
        {/* Animated glow orbs */}
        <div
          className="absolute top-1/4 left-1/3 w-[480px] h-[480px] rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)",
            filter: "blur(60px)",
            animation: "pulse 6s ease-in-out infinite",
          }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(139,92,246,0.14) 0%, transparent 70%)",
            filter: "blur(50px)",
            animation: "pulse 8s ease-in-out infinite reverse",
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(52,211,153,0.10) 0%, transparent 70%)",
            filter: "blur(30px)",
          }}
        />

        {/* Subtle dot grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.06]"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Floating particles */}
        {PARTICLES.map((p) => (
          <div
            key={p.id}
            className="absolute rounded-full pointer-events-none"
            style={{
              width: p.size,
              height: p.size,
              left: `${p.x}%`,
              top: `${p.y}%`,
              background: "rgba(99,102,241,0.5)",
              animation: `float ${p.duration}s ease-in-out ${p.delay}s infinite alternate`,
              boxShadow: `0 0 ${p.size * 2}px rgba(99,102,241,0.4)`,
            }}
          />
        ))}

        <div className="relative z-10 flex flex-col h-full p-12 justify-between">
          {/* Logo */}
          <Link to="/landing" className="flex items-center gap-3 w-fit">
            <div
              className="h-10 w-10 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)" }}
            >
              <MapPin size={20} className="text-white" />
            </div>
            <div className="leading-none">
              <span className="font-display text-xl font-bold text-white block">
                AduinKota
              </span>
              <span className="text-[10px] text-white/35 tracking-widest uppercase">
                aduin keluhanmu disini
              </span>
            </div>
          </Link>

          {/* Center content */}
          <div>
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="text-[11px] uppercase tracking-[0.3em] text-blue-400/70 mb-4">
                Website Pengajuan Kota
              </div>
              <h2 className="font-display text-5xl font-bold text-white leading-[1.1] mb-5">
                Suaramu penting
                <br />
                <span
                  style={{
                    background: "linear-gradient(90deg, #60a5fa, #a78bfa)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  bagi kotamu.
                </span>
              </h2>
              <p className="text-white/40 text-base leading-relaxed max-w-xs">
                Masuk untuk melaporkan, memantau, dan berkontribusi pada kota
                yang lebih baik.
              </p>
            </motion.div>

            {/* Live stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.25 }}
              className="mt-10 flex flex-col gap-3 max-w-xs"
            >
              {[
                { emoji: "📋", label: "Laporan baru hari ini", value: "142" },
                { emoji: "✅", label: "Diselesaikan minggu ini", value: "87" },
                { emoji: "⚡", label: "Rata-rata respons", value: "< 48 jam" },
              ].map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + i * 0.1 }}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <span className="text-xl">{s.emoji}</span>
                  <span className="flex-1 text-xs text-white/40">{s.label}</span>
                  <span className="text-sm font-semibold text-white">
                    {s.value}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          </div>

          <p className="text-white/20 text-xs">
            © 2025 AduinKota · Platform Pengaduan Warga Indonesia
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════
          RIGHT PANEL — Form
      ══════════════════════════════════ */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative lg:max-w-[480px] min-h-screen">
        {/* Subtle right-panel bg */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 60% 20%, rgba(59,130,246,0.06) 0%, transparent 60%)",
          }}
        />

        {/* Back to landing */}
        <Link
          to="/landing"
          className="absolute top-6 left-6 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors z-10"
        >
          <ChevronLeft size={14} /> Kembali ke halaman utama
        </Link>

        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-2 mb-8">
          <div
            className="h-8 w-8 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)" }}
          >
            <MapPin size={16} className="text-white" />
          </div>
          <span className="font-display text-lg font-bold">AduinKota</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-sm relative z-10"
        >
          {/* Tab switcher */}
          <div
            className="flex rounded-2xl p-1 mb-8"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {(["login", "register"] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t);
                  resetForm();
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                style={
                  tab === t
                    ? {
                        background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                        color: "white",
                        boxShadow: "0 0 16px rgba(99,102,241,0.35)",
                      }
                    : { color: "var(--muted-foreground)" }
                }
              >
                {t === "login" ? "Masuk" : "Daftar"}
              </button>
            ))}
          </div>

          {/* Heading */}
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <h1 className="font-display text-2xl font-bold mb-1">
                {tab === "login"
                  ? "Selamat datang kembali 👋"
                  : "Buat akun baru ✨"}
              </h1>
              <p className="text-sm text-muted-foreground mb-7">
                {tab === "login"
                  ? "Masuk untuk melanjutkan ke dashboard pengaduan."
                  : "Daftar gratis dan mulai berkontribusi untuk kotamu."}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* ── LOGIN FORM ── */}
          <AnimatePresence mode="wait">
            {tab === "login" ? (
              <motion.form
                key="login-form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleLogin}
                className="space-y-4"
              >
                <Field
                  label="Email"
                  icon={<Mail size={14} />}
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="kamu@email.com"
                />
                <Field
                  label="Password"
                  icon={<Lock size={14} />}
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={setPassword}
                  placeholder="••••••••"
                  right={
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  }
                />

                <div className="flex justify-end -mt-1">
                  <button
                    type="button"
                    className="text-xs"
                    style={{ color: "rgba(99,102,241,0.7)" }}
                  >
                    Lupa password?
                  </button>
                </div>

                <Feedback error={error} success={success} />

                <SubmitBtn loading={loading} label="Masuk ke Dashboard" />

                {/* Demo hint */}
                <div
                  className="rounded-xl px-4 py-3 text-xs text-center leading-relaxed"
                  style={{
                    background: "rgba(59,130,246,0.07)",
                    border: "1px solid rgba(59,130,246,0.15)",
                    color: "rgba(147,197,253,0.8)",
                  }}
                >
                  <strong>Demo:</strong> demo account{" "}
                  <code className="font-mono">demo@aduinkota.id</code> /{" "}
                  <code className="font-mono">demo123</code>
                </div>
              </motion.form>
            ) : (
              /* ── REGISTER FORM ── */
              <motion.form
                key="register-form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleRegister}
                className="space-y-4"
              >
                <Field
                  label="Nama Lengkap"
                  icon={<User size={14} />}
                  type="text"
                  value={name}
                  onChange={setName}
                  placeholder="Budi Santoso"
                />
                <Field
                  label="Email"
                  icon={<Mail size={14} />}
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="kamu@email.com"
                />

                {/* City select */}
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block font-medium">
                    Kota
                  </label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "var(--foreground)",
                    }}
                  >
                    {["Jakarta", "Bandung", "Surabaya", "Bali", "Medan", "Makassar"].map(
                      (c) => (
                        <option key={c} value={c} style={{ background: "#0f172a" }}>
                          {c}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <Field
                  label="Password"
                  icon={<Lock size={14} />}
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={setPassword}
                  placeholder="Min. 6 karakter"
                  right={
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  }
                />
                <Field
                  label="Konfirmasi Password"
                  icon={<Lock size={14} />}
                  type={showConfirm ? "text" : "password"}
                  value={confirmPass}
                  onChange={setConfirmPass}
                  placeholder="Ulangi password"
                  right={
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  }
                />

                <Feedback error={error} success={success} />
                <SubmitBtn loading={loading} label="Buat Akun" />
              </motion.form>
            )}
          </AnimatePresence>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Dengan masuk, kamu menyetujui{" "}
            <span className="underline cursor-pointer" style={{ color: "rgba(99,102,241,0.7)" }}>
              Syarat &amp; Ketentuan
            </span>{" "}
            dan{" "}
            <span className="underline cursor-pointer" style={{ color: "rgba(99,102,241,0.7)" }}>
              Kebijakan Privasi
            </span>{" "}
            AduinKota.
          </p>
        </motion.div>
      </div>

      <style>{`
        @keyframes float {
          from { transform: translateY(0px) scale(1); opacity: 0.4; }
          to   { transform: translateY(-14px) scale(1.2); opacity: 0.9; }
        }
      `}</style>
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function Field({
  label,
  icon,
  type,
  value,
  onChange,
  placeholder,
  right,
}: {
  label: string;
  icon: React.ReactNode;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  right?: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block font-medium">
        {label}
      </label>
      <div className="relative flex items-center">
        <span className="absolute left-3.5 text-muted-foreground pointer-events-none">
          {icon}
        </span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl pl-10 pr-10 py-3 text-sm outline-none transition-all placeholder:text-muted-foreground/50"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.10)",
            color: "var(--foreground)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)";
            e.currentTarget.style.background = "rgba(255,255,255,0.07)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)";
            e.currentTarget.style.background = "rgba(255,255,255,0.05)";
          }}
        />
        {right && (
          <span className="absolute right-3.5">{right}</span>
        )}
      </div>
    </div>
  );
}

function Feedback({ error, success }: { error: string; success: string }) {
  if (!error && !success) return null;
  return (
    <AnimatePresence>
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-xs"
          style={{
            background: "rgba(239,68,68,0.10)",
            border: "1px solid rgba(239,68,68,0.25)",
            color: "rgb(252,165,165)",
          }}
        >
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </motion.div>
      )}
      {success && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-xs"
          style={{
            background: "rgba(52,211,153,0.10)",
            border: "1px solid rgba(52,211,153,0.25)",
            color: "rgb(110,231,183)",
          }}
        >
          <CheckCircle2 size={14} className="shrink-0" />
          {success}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SubmitBtn({
  loading,
  label,
}: {
  loading: boolean;
  label: string;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full flex items-center justify-center gap-2.5 rounded-xl py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed mt-1"
      style={{
        background: loading
          ? "rgba(99,102,241,0.45)"
          : "linear-gradient(135deg, #3b82f6, #8b5cf6)",
        boxShadow: loading ? "none" : "0 0 24px rgba(99,102,241,0.4)",
      }}
    >
      {loading ? (
        <>
          <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          Memproses…
        </>
      ) : (
        <>
          {label}
          <ArrowRight size={15} />
        </>
      )}
    </button>
  );
}