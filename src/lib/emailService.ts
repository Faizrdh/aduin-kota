/* eslint-disable*/

// src/lib/emailService.ts
import nodemailer from "nodemailer";

// ─── Transporter ──────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || "smtp.gmail.com",
  port:   Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ─── Static maps ─────────────────────────────────────────────────────────────
const STATUS_INFO: Record<string, { label: string; color: string; emoji: string }> = {
  PENDING:     { label: "Menunggu Tinjauan",   color: "#F59E0B", emoji: "🕐" },
  IN_REVIEW:   { label: "Sedang Ditinjau",     color: "#3B82F6", emoji: "🔍" },
  IN_PROGRESS: { label: "Sedang Diproses",     color: "#6366F1", emoji: "⚙️"  },
  DISPATCHED:  { label: "Diteruskan ke Dinas", color: "#8B5CF6", emoji: "📨" },
  RESOLVED:    { label: "Selesai",             color: "#10B981", emoji: "✅" },
  REJECTED:    { label: "Ditolak",             color: "#EF4444", emoji: "❌" },
};

const CATEGORY_LABEL: Record<string, string> = {
  WASTE:   "Pengelolaan Sampah",
  INFRA:   "Infrastruktur",
  DISTURB: "Gangguan Ketertiban",
  LAND:    "Tanah / Sosial",
};

// ─── Base HTML layout ────────────────────────────────────────────────────────
function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AduinKota</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 16px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#1e293b;border-radius:16px 16px 0 0;padding:28px 36px 24px;border-bottom:1px solid #334155;">
            <div style="font-size:20px;font-weight:700;color:#e2e8f0;letter-spacing:-0.3px;">
              🏙️ AduinKota
            </div>
            <div style="font-size:11px;color:#475569;margin-top:3px;text-transform:uppercase;letter-spacing:0.8px;">
              Sistem Pengaduan Warga Digital
            </div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#1e293b;padding:32px 36px;">
            ${content}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#0f172a;border-radius:0 0 16px 16px;padding:20px 36px;border-top:1px solid #1e293b;">
            <div style="font-size:11px;color:#334155;line-height:1.7;">
              Email ini dikirim secara otomatis — harap tidak membalas email ini.<br />
              © 2025 AduinKota. Jl. Laporan Warga No. 1, Indonesia.
            </div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Helper: status badge HTML ────────────────────────────────────────────────
function statusBadge(info: { label: string; color: string; emoji: string }): string {
  return `<span style="display:inline-block;background:${info.color}22;color:${info.color};border:1px solid ${info.color}55;border-radius:6px;padding:4px 14px;font-size:12px;font-weight:600;letter-spacing:0.2px;">${info.emoji} ${info.label}</span>`;
}

// ─── 1. Konfirmasi Laporan Baru ───────────────────────────────────────────────
export interface ReportConfirmationOpts {
  to:          string;
  reportId:    string;
  title:       string;
  category:    string;
  city:        string;
  district:    string;
  description: string;
}

export async function sendReportConfirmation(opts: ReportConfirmationOpts): Promise<void> {
  const shortId  = `RPT-${opts.reportId.slice(-4).toUpperCase()}`;
  const catLabel = CATEGORY_LABEL[opts.category] ?? opts.category;
  const descPreview = opts.description.length > 220
    ? opts.description.slice(0, 220) + "…"
    : opts.description;

  const pendingInfo = STATUS_INFO["PENDING"];

  const content = `
    <div style="font-size:14px;color:#94a3b8;line-height:1.6;margin-bottom:24px;">
      Laporan Anda telah berhasil diterima dan sedang dalam antrian untuk ditinjau oleh tim kami.
    </div>

    <!-- ID Badge -->
    <div style="background:#0f172a;border:1px solid #3b82f655;border-radius:10px;padding:16px 20px;margin-bottom:24px;display:flex;align-items:center;gap:16px;">
      <div>
        <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:4px;">ID Laporan</div>
        <div style="font-size:22px;font-weight:700;color:#60a5fa;font-family:'Courier New',monospace;letter-spacing:2px;">${shortId}</div>
      </div>
      <div style="border-left:1px solid #334155;padding-left:16px;margin-left:4px;">
        <div style="font-size:11px;color:#64748b;margin-bottom:6px;">Status</div>
        ${statusBadge(pendingInfo)}
      </div>
    </div>

    <!-- Detail Card -->
    <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;overflow:hidden;margin-bottom:24px;">
      <div style="padding:18px 20px;border-bottom:1px solid #1e293b;">
        <div style="font-size:15px;font-weight:600;color:#e2e8f0;line-height:1.4;">${opts.title}</div>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:16px 20px;">
        <tr>
          <td style="padding:5px 0;font-size:12px;color:#64748b;width:110px;vertical-align:top;">Kategori</td>
          <td style="padding:5px 0;font-size:12px;color:#cbd5e1;">${catLabel}</td>
        </tr>
        <tr>
          <td style="padding:5px 0;font-size:12px;color:#64748b;vertical-align:top;">Lokasi</td>
          <td style="padding:5px 0;font-size:12px;color:#cbd5e1;">${opts.district}, ${opts.city}</td>
        </tr>
        <tr>
          <td style="padding:5px 0;font-size:12px;color:#64748b;vertical-align:top;">Deskripsi</td>
          <td style="padding:5px 0;font-size:12px;color:#94a3b8;line-height:1.6;">${descPreview}</td>
        </tr>
      </table>
    </div>

    <!-- Info box -->
    <div style="background:#1e3a5f;border-left:3px solid #3b82f6;border-radius:0 8px 8px 0;padding:14px 18px;font-size:12px;color:#93c5fd;line-height:1.8;">
      📬 Anda akan mendapat email otomatis setiap kali status laporan berubah.<br />
      🔖 Simpan kode <strong style="color:#60a5fa;">${shortId}</strong> sebagai referensi laporan Anda.
    </div>
  `;

  await transporter.sendMail({
    from:    process.env.SMTP_FROM || `"AduinKota" <${process.env.SMTP_USER}>`,
    to:      opts.to,
    subject: `[${shortId}] ✅ Laporan Berhasil Diajukan — AduinKota`,
    html:    baseLayout(content),
  });

  console.info(`[EMAIL] Konfirmasi terkirim ke ${opts.to} untuk report ${opts.reportId}`);
}

// ─── 2. Notifikasi Perubahan Status ──────────────────────────────────────────
export interface StatusUpdateOpts {
  to:         string;
  reportId:   string;
  title:      string;
  fromStatus: string | null;
  toStatus:   string;
  note:       string | null;
  adminName:  string | null;
}

export async function sendStatusUpdate(opts: StatusUpdateOpts): Promise<void> {
  const shortId  = `RPT-${opts.reportId.slice(-4).toUpperCase()}`;
  const toInfo   = STATUS_INFO[opts.toStatus]   ?? { label: opts.toStatus,   color: "#64748b", emoji: "📋" };
  const fromInfo = opts.fromStatus
    ? (STATUS_INFO[opts.fromStatus] ?? { label: opts.fromStatus, color: "#64748b", emoji: "📋" })
    : null;

  const isResolved = opts.toStatus === "RESOLVED";
  const isRejected = opts.toStatus === "REJECTED";

  const transitionBlock = fromInfo
    ? `<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:8px;">
         ${statusBadge(fromInfo)}
         <span style="color:#475569;font-size:16px;">→</span>
         ${statusBadge(toInfo)}
       </div>`
    : `<div style="margin-bottom:8px;">${statusBadge(toInfo)}</div>`;

  const noteBlock = opts.note
    ? `<div style="background:#0f172a;border:1px solid #334155;border-radius:10px;padding:16px 18px;margin-top:20px;">
         <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:8px;">Catatan dari Admin</div>
         <div style="font-size:13px;color:#cbd5e1;line-height:1.7;">${opts.note}</div>
       </div>`
    : "";

  const adminLine = opts.adminName
    ? `<div style="font-size:11px;color:#475569;margin-top:10px;">Diperbarui oleh: <strong style="color:#64748b;">${opts.adminName}</strong></div>`
    : "";

  const closingBlock = isResolved
    ? `<div style="background:#10b98115;border:1px solid #10b98140;border-radius:10px;padding:20px;margin-top:20px;text-align:center;">
         <div style="font-size:28px;margin-bottom:8px;">🎉</div>
         <div style="font-size:14px;font-weight:600;color:#6ee7b7;">Laporan Anda Telah Diselesaikan!</div>
         <div style="font-size:12px;color:#34d399;margin-top:6px;line-height:1.6;">
           Terima kasih telah berpartisipasi dalam membangun kota yang lebih baik.
         </div>
       </div>`
    : isRejected
    ? `<div style="background:#ef444415;border:1px solid #ef444435;border-radius:10px;padding:16px 18px;margin-top:20px;font-size:12px;color:#fca5a5;line-height:1.7;">
         Jika Anda merasa laporan ini ditolak secara tidak tepat, Anda dapat mengajukan laporan baru dengan informasi yang lebih lengkap dan jelas.
       </div>`
    : "";

  const content = `
    <div style="font-size:14px;color:#94a3b8;margin-bottom:20px;line-height:1.6;">
      Terdapat pembaruan status pada laporan Anda.
    </div>

    <!-- Report info -->
    <div style="background:#0f172a;border:1px solid #334155;border-radius:10px;padding:16px 18px;margin-bottom:20px;">
      <div style="font-size:11px;font-family:'Courier New',monospace;color:#475569;margin-bottom:6px;">${shortId}</div>
      <div style="font-size:14px;font-weight:600;color:#e2e8f0;line-height:1.4;">${opts.title}</div>
    </div>

    <!-- Status change -->
    <div style="background:#0f172a;border:1px solid #334155;border-radius:10px;padding:18px 18px;">
      <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:12px;">Perubahan Status</div>
      ${transitionBlock}
      ${adminLine}
    </div>

    ${noteBlock}
    ${closingBlock}
  `;

  await transporter.sendMail({
    from:    process.env.SMTP_FROM || `"AduinKota" <${process.env.SMTP_USER}>`,
    to:      opts.to,
    subject: `[${shortId}] ${toInfo.emoji} Status Diperbarui: ${toInfo.label} — AduinKota`,
    html:    baseLayout(content),
  });

  console.info(`[EMAIL] Status update terkirim ke ${opts.to} untuk report ${opts.reportId} → ${opts.toStatus}`);
}