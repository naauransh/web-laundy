import { Order, OrderItem, AppSettings } from "./sheets";
import { normalizePhoneNumber } from "./phone";
import { format, parseISO } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const TIMEZONE = "Asia/Jakarta";

/**
 * Format mata uang Rupiah: Rp 25.000
 */
export function formatRupiah(amount: number): string {
  return "Rp " + Math.round(amount).toLocaleString("id-ID");
}

/**
 * Format tanggal Indonesia: dd/MM/yyyy HH:mm
 */
export function formatReceiptDate(isoString: string): string {
  try {
    const zoned = toZonedTime(parseISO(isoString), TIMEZONE);
    return format(zoned, "dd/MM/yyyy HH:mm");
  } catch {
    return isoString;
  }
}

/**
 * Format kuantitas: desimal koma untuk kg (2,5 kg) atau bulat untuk pcs
 */
export function formatQuantity(qty: number, unit: string): string {
  if (unit === "kg") {
    // Tampilkan koma sesuai id-ID
    return qty.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " kg";
  }
  return `${qty} ${unit}`;
}

/**
 * Membentuk teks struk untuk dikirim via WhatsApp atau disalin
 * Sesuai format PRD Bagian 5.5
 */
export function generateReceiptText(
  order: Order,
  items: OrderItem[],
  settings: AppSettings
): string {
  const divider = "--------------------------";
  const lines: string[] = [];

  // Header Usaha
  lines.push(`*${(settings.business_name || "LAUNDRY").toUpperCase()}*`);
  const addressPhone = [settings.business_address, settings.business_phone]
    .filter(Boolean)
    .join(" · ");
  if (addressPhone) {
    lines.push(addressPhone);
  }
  lines.push(divider);

  // Info Pesanan
  lines.push(`No: ${order.order_id}`);
  lines.push(`Tanggal: ${formatReceiptDate(order.created_at)}`);
  lines.push(`Pelanggan: ${order.customer_name}`);
  lines.push(divider);

  // Daftar Item
  for (const it of items) {
    lines.push(it.service_name);

    let detailStr = `${formatQuantity(it.quantity, it.unit)} x ${formatRupiah(it.unit_price)} = ${formatRupiah(it.line_total)}`;
    lines.push(detailStr);

    // Keterangan isi cucian & potongan jika ada
    const extraInfo: string[] = [];
    if (it.item_description) extraInfo.push(it.item_description);
    if (it.piece_count) extraInfo.push(`${it.piece_count} potong`);
    if (it.item_notes) extraInfo.push(`Catatan: ${it.item_notes}`);

    if (extraInfo.length > 0) {
      lines.push(`(${extraInfo.join(" · ")})`);
    }
  }

  lines.push(divider);

  // Keuangan
  if (order.discount > 0) {
    lines.push(`Diskon: ${formatRupiah(order.discount)}`);
  }
  lines.push(`*TOTAL: ${formatRupiah(order.total)}*`);
  lines.push(`Status: ${order.payment_status} (${order.payment_method})`);

  if (order.estimated_done) {
    lines.push(`Estimasi selesai: ${formatReceiptDate(order.estimated_done)}`);
  }

  if (order.notes) {
    lines.push(`Catatan: ${order.notes}`);
  }

  lines.push(divider);
  lines.push(settings.receipt_footer || "Terima kasih!");

  return lines.join("\n");
}

/**
 * Membentuk URL wa.me untuk struk pesanan
 */
export function generateWhatsAppUrl(
  order: Order,
  items: OrderItem[],
  settings: AppSettings
): string {
  const normalizedPhone = normalizePhoneNumber(order.customer_phone);
  const text = generateReceiptText(order, items, settings);
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(text)}`;
}

/**
 * Membentuk teks WhatsApp untuk pemberitahuan cucian selesai
 */
export function generateOrderDoneWhatsAppUrl(
  order: Order,
  settings: AppSettings
): string {
  const normalizedPhone = normalizePhoneNumber(order.customer_phone);
  const text = `Halo Kak ${order.customer_name},\n\nKabar baik! Cucian Anda dengan nomor pesanan *${order.order_id}* di *${settings.business_name}* sudah SELESAI dicuci dan siap diambil.\n\nTotal: ${formatRupiah(order.total)} (${order.payment_status})\n\nTerima kasih! 🙏`;
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(text)}`;
}
