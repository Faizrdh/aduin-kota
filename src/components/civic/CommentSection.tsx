/*eslint-disable*/
// src/components/civic/CommentSection.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Komponen komentar lengkap dengan:
//   • TanStack Query — fetch, infinite pagination, cache invalidation
//   • Optimistic Updates  — komentar muncul instan sebelum server konfirmasi
//   • Auth guard — hanya user yang login yang bisa kirim / hapus
//   • Animasi Framer Motion — stagger entry, exit slide-up, textarea grow
// ─────────────────────────────────────────────────────────────────────────────

import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import {
  useState,
  useRef,
  useCallback,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle,
  Send,
  Trash2,
  Loader2,
  AlertTriangle,
  ChevronDown,
  Lock,
} from "lucide-react";
import { authFetch } from "@/data/login";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CommentUser {
  id:     string;
  name:   string;
  avatar: string | null;
}

export interface Comment {
  id:        string;
  content:   string;
  reportId:  string;
  userId:    string;
  user:      CommentUser;
  createdAt: string;
  updatedAt: string;
}

interface CommentsResponse {
  data: Comment[];
  meta: {
    total:        number;
    page:         number;
    limit:        number;
    totalPages:   number;
    commentCount: number;
  };
}

interface CommentSectionProps {
  reportId:       string;   // DB id (cuid) laporan
  currentUserId?: string;   // undefined = belum login
  currentUserRole?: "CITIZEN" | "OFFICER" | "ADMIN";
  /** tampilan ringkas di mobile bottom sheet */
  compact?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return "Baru saja";
  if (m < 60) return `${m}m lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}j lalu`;
  return `${Math.floor(h / 24)}h lalu`;
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? "")
    .join("");
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ user, size = 28 }: { user: CommentUser; size?: number }) {
  const colors = [
    "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4",
  ];
  const color = colors[user.name.charCodeAt(0) % colors.length];

  if (user.avatar) {
    return (
      <img
        src={user.avatar}
        alt={user.name}
        style={{ width: size, height: size }}
        className="rounded-full object-cover shrink-0 border border-white/10"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size, background: `${color}33`, border: `1.5px solid ${color}55` }}
      className="rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold"
    >
      <span style={{ color }}>{initials(user.name)}</span>
    </div>
  );
}

// ─── Single Comment Row ───────────────────────────────────────────────────────

function CommentRow({
  comment,
  canDelete,
  onDelete,
  isDeleting,
}: {
  comment:    Comment;
  canDelete:  boolean;
  onDelete:   (id: string) => void;
  isDeleting: boolean;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      className="flex gap-2.5 group"
    >
      <Avatar user={comment.user} size={26} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[12px] font-semibold leading-none truncate">
            {comment.user.name}
          </span>
          <span className="text-[10px] text-muted-foreground/60 shrink-0">
            {timeAgo(comment.createdAt)}
          </span>
        </div>
        <p className="text-[12px] text-muted-foreground leading-relaxed mt-0.5 break-words">
          {comment.content}
        </p>
      </div>

      {/* Hapus */}
      {canDelete && (
        <button
          onClick={() => onDelete(comment.id)}
          disabled={isDeleting}
          title="Hapus komentar"
          className={[
            "shrink-0 h-5 w-5 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all",
            "text-muted-foreground/50 hover:text-red-400 hover:bg-red-400/10",
            isDeleting ? "cursor-not-allowed opacity-40" : "",
          ].join(" ")}
        >
          {isDeleting ? (
            <Loader2 size={10} className="animate-spin" />
          ) : (
            <Trash2 size={10} />
          )}
        </button>
      )}
    </motion.div>
  );
}

// ─── CommentSection ───────────────────────────────────────────────────────────

export function CommentSection({
  reportId,
  currentUserId,
  currentUserRole = "CITIZEN",
  compact = false,
}: CommentSectionProps) {
  const qc                         = useQueryClient();
  const qKey: QueryKey             = ["comments", reportId];

  const [text,        setText]       = useState("");
  const [page,        setPage]       = useState(1);
  const [deletingId,  setDeletingId] = useState<string | null>(null);
  const textareaRef                  = useRef<HTMLTextAreaElement>(null);

  const isAdmin = currentUserRole === "ADMIN";

  // ── Fetch komentar ─────────────────────────────────────────────────────────
  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery<CommentsResponse>({
    queryKey: [...qKey, page],
    queryFn:  async () => {
      const res = await authFetch(
        `/api/comments/${reportId}?page=${page}&limit=20`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<CommentsResponse>;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const comments    = data?.data      ?? [];
  const meta        = data?.meta;
  const totalPages  = meta?.totalPages ?? 1;

  // ── Kirim komentar (dengan Optimistic Update) ──────────────────────────────
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await authFetch(`/api/comments/${reportId}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ content }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Gagal mengirim komentar (${res.status})`);
      }
      const json: { data: Comment } = await res.json();
      return json.data;
    },

    // ── Optimistic: insert sementara sebelum server konfirmasi ──────────────
    onMutate: async (content) => {
      await qc.cancelQueries({ queryKey: [...qKey, page] });
      const prev = qc.getQueryData<CommentsResponse>([...qKey, page]);

      const optimistic: Comment = {
        id:        `opt-${Date.now()}`,
        content,
        reportId,
        userId:    currentUserId ?? "unknown",
        user:      { id: currentUserId ?? "", name: "Anda", avatar: null },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      qc.setQueryData<CommentsResponse>([...qKey, page], (old) => {
        if (!old) return old;
        return {
          ...old,
          data: [...old.data, optimistic],
          meta: { ...old.meta, total: old.meta.total + 1 },
        };
      });

      return { prev };
    },

    // ── Rollback jika gagal ────────────────────────────────────────────────
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData([...qKey, page], ctx.prev);
      }
    },

    // ── Invalidate agar data server jadi source of truth ──────────────────
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qKey });
    },
  });

  // ── Hapus komentar ─────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const res = await authFetch(`/api/comments/${commentId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Gagal menghapus komentar (${res.status})`);
    },

    onMutate: async (commentId) => {
      setDeletingId(commentId);
      await qc.cancelQueries({ queryKey: [...qKey, page] });
      const prev = qc.getQueryData<CommentsResponse>([...qKey, page]);

      qc.setQueryData<CommentsResponse>([...qKey, page], (old) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.filter(c => c.id !== commentId),
          meta: { ...old.meta, total: Math.max(0, old.meta.total - 1) },
        };
      });

      return { prev };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData([...qKey, page], ctx.prev);
    },

    onSettled: () => {
      setDeletingId(null);
      qc.invalidateQueries({ queryKey: qKey });
    },
  });

  // ── Submit handler ─────────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();
      const trimmed = text.trim();
      if (!trimmed || sendMutation.isPending) return;
      sendMutation.mutate(trimmed);
      setText("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    },
    [text, sendMutation]
  );

  // Ctrl/Cmd+Enter to submit
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  // Auto-grow textarea
  const handleTextareaInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      const el = e.target;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    },
    []
  );

  // ─────────────────────────────────────────────────────────────────────────

  const totalComments = meta?.total ?? 0;

  return (
    <section className={compact ? "pt-3" : "pt-5 border-t border-border/50"}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <MessageCircle size={13} className="text-muted-foreground" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Komentar
        </span>
        {totalComments > 0 && (
          <span className="ml-auto text-[10px] text-muted-foreground/60 tabular-nums">
            {totalComments} komentar
          </span>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-2 py-4 justify-center">
          <Loader2 size={14} className="animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Memuat komentar…</span>
        </div>
      )}

      {/* Error */}
      {isError && !isLoading && (
        <div className="flex items-center gap-2 py-3 text-xs text-red-400">
          <AlertTriangle size={12} />
          <span>Gagal memuat komentar.</span>
          <button onClick={() => refetch()} className="underline ml-1">
            Coba lagi
          </button>
        </div>
      )}

      {/* Comment list */}
      {!isLoading && !isError && (
        <>
          {comments.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/50 text-center py-4">
              Belum ada komentar. Jadilah yang pertama!
            </p>
          ) : (
            <div className={`space-y-3 ${compact ? "max-h-40 overflow-y-auto pr-1" : ""}`}>
              <AnimatePresence mode="popLayout" initial={false}>
                {comments.map((c) => (
                  <CommentRow
                    key={c.id}
                    comment={c}
                    canDelete={
                      !c.id.startsWith("opt-") &&
                      (c.userId === currentUserId || isAdmin)
                    }
                    onDelete={(id) => deleteMutation.mutate(id)}
                    isDeleting={deletingId === c.id}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30 transition-smooth"
              >
                ← Sebelumnya
              </button>
              <span className="text-[10px] text-muted-foreground/50">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30 transition-smooth"
              >
                Berikutnya →
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Input area ─────────────────────────────────────────────────────── */}
      <div className="mt-3">
        {currentUserId ? (
          <form onSubmit={handleSubmit}>
            <div
              className={[
                "flex gap-2 items-end rounded-xl border transition-all duration-200",
                text.length > 0
                  ? "bg-white/5 border-border"
                  : "bg-transparent border-white/5 hover:border-border/50",
              ].join(" ")}
            >
              <textarea
                ref={textareaRef}
                value={text}
                onChange={handleTextareaInput}
                onKeyDown={handleKeyDown}
                placeholder="Tulis komentar… (Ctrl+Enter untuk kirim)"
                maxLength={1000}
                rows={1}
                className={[
                  "flex-1 bg-transparent resize-none outline-none text-[12px] py-2.5 px-3",
                  "text-foreground placeholder:text-muted-foreground/40 leading-relaxed",
                  "min-h-[36px] max-h-[120px]",
                ].join(" ")}
              />
              <button
                type="submit"
                disabled={!text.trim() || sendMutation.isPending}
                title="Kirim (Ctrl+Enter)"
                className={[
                  "shrink-0 h-8 w-8 mb-1.5 mr-1.5 rounded-lg flex items-center justify-center transition-all",
                  text.trim()
                    ? "bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 hover:scale-105"
                    : "text-muted-foreground/30 cursor-not-allowed",
                  sendMutation.isPending ? "opacity-60" : "",
                ].join(" ")}
              >
                {sendMutation.isPending ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Send size={13} />
                )}
              </button>
            </div>

            {/* Error kirim */}
            <AnimatePresence>
              {sendMutation.isError && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-[10px] text-red-400 mt-1.5 flex items-center gap-1"
                >
                  <AlertTriangle size={10} />
                  {(sendMutation.error as Error)?.message ?? "Gagal mengirim komentar."}
                </motion.p>
              )}
            </AnimatePresence>

            {text.length > 800 && (
              <p className="text-[10px] text-muted-foreground/50 mt-1 text-right">
                {text.length}/1000
              </p>
            )}
          </form>
        ) : (
          // Belum login
          <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-white/3 border border-white/5">
            <Lock size={11} className="text-muted-foreground/40 shrink-0" />
            <p className="text-[11px] text-muted-foreground/50">
              <a href="/login" className="text-accent hover:underline">Masuk</a>
              {" "}untuk mengirim komentar.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export default CommentSection;