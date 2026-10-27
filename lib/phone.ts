/**
 * Normalisasi nomor telepon ke format Indonesia (62xxxxxxxxxx)
 * Sesuai PRD Bagian 5.5:
 * Hapus spasi, tanda hubung, dan tanda plus.
 * Jika diawali 0 ganti dengan 62. Jika diawali 62 biarkan.
 * Contoh: 0812-3456-7890 -> 6281234567890
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return "";
  // Hapus semua karakter selain angka
  let cleaned = phone.replace(/[^0-9]/g, "");

  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.slice(1);
  }

  return cleaned;
}

/**
 * Validasi nomor telepon Indonesia:
 * Minimal 10 digit, maksimal 15 digit, diawali 628... atau 08...
 */
export function isValidIndonesianPhone(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  // Nomor HP Indonesia format 628xxx dengan panjang 10-15 digit
  return /^628[0-9]{8,12}$/.test(normalized);
}

/**
 * Format nomor telepon untuk tampilan manusia:
 * 6281234567890 -> 0812-3456-7890
 */
export function formatPhoneNumberDisplay(phone: string): string {
  const norm = normalizePhoneNumber(phone);
  if (norm.startsWith("62")) {
    const local = "0" + norm.slice(2);
    if (local.length >= 10) {
      return local.replace(/(\d{4})(\d{4})(\d{2,4})/, "$1-$2-$3");
    }
    return local;
  }
  return phone;
}
