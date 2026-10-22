// Maps raw Supabase/PostgREST/Postgres errors to short, friendly Indonesian
// messages for master-data forms, instead of showing raw SQL error text
// (constraint names, column names, etc.) to end users. Falls back to the
// original message when no specific mapping applies.

type SupabaseLikeError = {
  message?: string;
  code?: string;
  details?: string | null;
};

function isSupabaseLikeError(value: unknown): value is SupabaseLikeError {
  return typeof value === "object" && value !== null && ("message" in value || "code" in value);
}

const CODE_MESSAGES: Record<string, string> = {
  "23505": "Data dengan kode atau nilai unik tersebut sudah ada. Gunakan kode lain.",
  "23503": "Data terkait tidak ditemukan atau sedang dipakai data lain; periksa kembali referensinya.",
  "23502": "Ada kolom wajib yang belum diisi.",
  "23514": "Nilai yang dimasukkan tidak memenuhi aturan data (periksa format atau rentang nilai).",
  "22023": "Permintaan tidak valid.",
  "42501": "Anda tidak memiliki izin untuk melakukan aksi ini.",
  "PGRST116": "Data tidak ditemukan atau Anda tidak memiliki akses.",
};

export function friendlyErrorMessage(cause: unknown, fallback: string): string {
  if (isSupabaseLikeError(cause)) {
    const code = cause.code ?? "";
    if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code];
    if (cause.message) {
      // Postgres raise exception messages (from RPC/trigger) are already
      // written to be user-facing in Indonesian/English; surface them as-is.
      if (code === "22023" || code === "42501") return cause.message;
    }
  }
  if (cause instanceof Error && cause.message) {
    if (/duplicate key value/i.test(cause.message)) return CODE_MESSAGES["23505"];
    if (/violates foreign key/i.test(cause.message)) return CODE_MESSAGES["23503"];
    if (/violates not-null/i.test(cause.message)) return CODE_MESSAGES["23502"];
    if (/violates check constraint/i.test(cause.message)) return CODE_MESSAGES["23514"];
    return cause.message;
  }
  return fallback;
}
