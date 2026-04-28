/*eslint-disable*/
// src/server/services/aiClassifier.ts
import axios from "axios";

const hfAxios = axios.create({ baseURL: undefined, timeout: 25_000 });

const HF_API_URL =
  "https://router.huggingface.co/hf-inference/models/facebook/bart-large-mnli";

export const DINAS_LABELS = [
  "DLH",
  "Dinas Kesehatan",
  "PUPR",
  "Dishub",
  "DPKP",
  "BPBD",
  "Satpol PP",
  "BPN",
  "Dinas Sosial",
  "DPMPTSP",
] as const;

export type DinasLabel = (typeof DINAS_LABELS)[number];

export interface ClassificationResult {
  label: DinasLabel;
  score: number;
  all_scores: Record<string, number>;
}

// ── Tipe response dari endpoint baru HF ──────────────────────────────────────
type HFNewFormat = { label: string; score: number }[];
type HFOldFormat = { sequence: string; labels: string[]; scores: number[] };

export async function classifyReport(
  description: string
): Promise<ClassificationResult | null> {
  const trimmed = (description ?? "").trim();

  if (trimmed.length < 10) {
    console.warn("[AI] Deskripsi terlalu pendek, skip.");
    return null;
  }

  const apiKey = process.env.HF_API_KEY;
  if (!apiKey) {
    console.error("[AI] ❌ HF_API_KEY tidak ditemukan di .env!");
    return null;
  }

  console.info(`[AI] Mengirim ke HF...`);

  try {
    const response = await hfAxios.post(
      HF_API_URL,
      {
        inputs: trimmed,
        parameters: {
          candidate_labels: [...DINAS_LABELS],
          multi_label: false,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = response.data;

    // Cold start
    if (typeof data?.error === "string" && data.error.includes("loading")) {
      console.warn("[AI] ⏳ Model masih loading. Coba lagi 30 detik lagi.");
      return null;
    }

    // ── Parse format BARU: array of {label, score} ────────────────────────
    if (Array.isArray(data) && data[0]?.label !== undefined) {
      const sorted = [...(data as HFNewFormat)].sort((a, b) => b.score - a.score);

      const all_scores: Record<string, number> = {};
      sorted.forEach(({ label, score }) => {
        all_scores[label] = parseFloat(score.toFixed(4));
      });

      const topLabel = sorted[0].label as DinasLabel;
      const topScore = parseFloat(sorted[0].score.toFixed(4));

      console.info(`[AI] ✅ "${topLabel}" (${(topScore * 100).toFixed(1)}%)`);
      return { label: topLabel, score: topScore, all_scores };
    }

    // ── Parse format LAMA: {labels: [], scores: []} ───────────────────────
    if (Array.isArray(data?.labels) && Array.isArray(data?.scores)) {
      const all_scores: Record<string, number> = {};
      (data as HFOldFormat).labels.forEach((lbl, i) => {
        all_scores[lbl] = parseFloat((data.scores[i]).toFixed(4));
      });

      const topLabel = data.labels[0] as DinasLabel;
      const topScore = parseFloat(data.scores[0].toFixed(4));

      console.info(`[AI] ✅ "${topLabel}" (${(topScore * 100).toFixed(1)}%)`);
      return { label: topLabel, score: topScore, all_scores };
    }

    console.error("[AI] ❌ Format response tidak dikenali:", JSON.stringify(data));
    return null;

  } catch (err: any) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      if (err.code === "ECONNABORTED") {
        console.warn("[AI] ⏱ Timeout.");
      } else if (status === 503) {
        console.warn("[AI] ⏳ 503 — model cold start.");
      } else if (status === 401) {
        console.error("[AI] ❌ 401 — HF_API_KEY salah atau expired!");
      } else {
        console.error(`[AI] ❌ Error ${status}:`, err.response?.data ?? err.message);
      }
    } else {
      console.error("[AI] ❌ Error:", err?.message ?? err);
    }
    return null;
  }
}

export function isConfident(score: number | null | undefined): boolean {
  return (score ?? 0) >= 0.4;
}