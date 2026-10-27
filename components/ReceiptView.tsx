"use client";

import { useState } from "react";
import Link from "next/link";
import { Order, OrderItem, AppSettings } from "@/lib/sheets";
import {
  generateReceiptText,
  generateWhatsAppUrl,
  formatRupiah,
  formatReceiptDate,
  formatQuantity,
} from "@/lib/receipt";
import {
  Printer,
  MessageSquare,
  Copy,
  Check,
  PlusCircle,
  ClipboardList,
  Sparkles,
} from "lucide-react";

interface ReceiptViewProps {
  order: Order;
  items: OrderItem[];
  settings: AppSettings;
}

export default function ReceiptView({ order, items, settings }: ReceiptViewProps) {
  const [copied, setCopied] = useState(false);

  const receiptText = generateReceiptText(order, items, settings);
  const waUrl = generateWhatsAppUrl(order, items, settings);

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(receiptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Gagal menyalin teks struk:", err);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Action Bar (Hanya tampil di layar, tersembunyi saat cetak) */}
      <div className="no-print bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href="/orders/new"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Order Baru</span>
          </Link>
          <Link
            href="/antrian"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            <ClipboardList className="w-4 h-4" />
            <span>Ke Antrian</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {/* Tombol Salin */}
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            title="Salin teks struk"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700">Tersalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Salin Teks</span>
              </>
            )}
          </button>

          {/* Tombol WhatsApp */}
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Kirim WA</span>
          </a>

          {/* Tombol Cetak */}
          <button
            type="button"
            onClick={handlePrint}
            id="print-receipt-btn"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Struk</span>
          </button>
        </div>
      </div>

      {/* KERTAS STRUK THERMAL (58mm / 80mm Layout) */}
      <div className="receipt-container flex justify-center">
        <div className="receipt-paper w-full max-w-[340px] bg-white border border-slate-200 sm:rounded-2xl p-6 shadow-md font-mono text-[13px] leading-relaxed text-slate-900">
          {/* Header Usaha */}
          <div className="text-center pb-3 border-b border-dashed border-slate-300">
            <h1 className="text-base font-black tracking-tight text-slate-950 uppercase">
              {settings.business_name || "LAUNDRY"}
            </h1>
            {settings.business_address && (
              <p className="text-[11px] text-slate-600 mt-0.5 leading-tight">
                {settings.business_address}
              </p>
            )}
            {settings.business_phone && (
              <p className="text-[11px] text-slate-600 mt-0.5 font-sans">
                Telp/WA: {settings.business_phone}
              </p>
            )}
          </div>

          {/* Info Transaksi */}
          <div className="py-3 border-b border-dashed border-slate-300 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">No. Order:</span>
              <span className="font-bold">{order.order_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Tanggal:</span>
              <span>{formatReceiptDate(order.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Pelanggan:</span>
              <span className="font-bold">{order.customer_name}</span>
            </div>
            {order.customer_phone && (
              <div className="flex justify-between">
                <span className="text-slate-500">No. HP:</span>
                <span className="font-sans">{order.customer_phone}</span>
              </div>
            )}
          </div>

          {/* Daftar Item Layanan */}
          <div className="py-3 border-b border-dashed border-slate-300 space-y-2.5">
            {items.map((it, idx) => (
              <div key={idx} className="space-y-0.5">
                <div className="font-bold text-slate-950">{it.service_name}</div>
                <div className="flex justify-between text-xs text-slate-700">
                  <span>
                    {formatQuantity(it.quantity, it.unit)} x {formatRupiah(it.unit_price)}
                  </span>
                  <span className="font-bold">{formatRupiah(it.line_total)}</span>
                </div>
                {/* Rincian Potongan & Keterangan */}
                {(it.item_description || it.piece_count || it.item_notes) && (
                  <div className="text-[11px] text-slate-500 italic pl-1">
                    {it.item_description && <span>{it.item_description} </span>}
                    {it.piece_count && <span>({it.piece_count} potong) </span>}
                    {it.item_notes && <span>- {it.item_notes}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Rincian Keuangan */}
          <div className="py-3 border-b border-dashed border-slate-300 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal:</span>
              <span>{formatRupiah(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Diskon:</span>
                <span>-{formatRupiah(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-black text-slate-950 pt-1">
              <span>TOTAL:</span>
              <span>{formatRupiah(order.total)}</span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-slate-500">Metode Bayar:</span>
              <span className="font-semibold">{order.payment_method}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Status Bayar:</span>
              <span
                className={`font-bold ${
                  order.payment_status === "Lunas" ? "text-emerald-700" : "text-rose-700"
                }`}
              >
                {order.payment_status}
              </span>
            </div>
          </div>

          {/* Estimasi & Catatan */}
          <div className="py-3 border-b border-dashed border-slate-300 space-y-1 text-xs">
            {order.estimated_done && (
              <div className="flex justify-between">
                <span className="text-slate-500">Estimasi Selesai:</span>
                <span className="font-bold">{formatReceiptDate(order.estimated_done)}</span>
              </div>
            )}
            {order.notes && (
              <div className="pt-1 text-[11px] text-slate-600">
                <span className="font-bold text-slate-700">Catatan: </span>
                <span>{order.notes}</span>
              </div>
            )}
          </div>

          {/* Footer Ucapan Terima Kasih */}
          <div className="pt-4 text-center space-y-1 text-xs text-slate-500">
            <p className="font-semibold">{settings.receipt_footer || "Terima kasih atas kepercayaan Anda!"}</p>
            <p className="text-[10px] text-slate-400">Simpan struk ini sebagai bukti pengambilan cucian.</p>
          </div>
        </div>
      </div>

      {/* Style Khusus Thermal Print (@media print) */}
      <style jsx global>{`
        @media print {
          /* Sembunyikan elemen layout website */
          body * {
            visibility: hidden;
          }
          header,
          nav,
          .no-print,
          button,
          a {
            display: none !important;
          }

          /* Tampilkan hanya kertas struk */
          .receipt-container,
          .receipt-paper,
          .receipt-paper * {
            visibility: visible;
          }

          .receipt-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
          }

          .receipt-paper {
            width: 100% !important;
            max-width: 80mm !important;
            border: none !important;
            box-shadow: none !important;
            padding: 2mm !important;
            margin: 0 auto !important;
            color: #000000 !important;
            background: #ffffff !important;
            font-size: 12px !important;
            line-height: 1.3 !important;
          }

          @page {
            margin: 0;
            size: auto;
          }
        }
      `}</style>
    </div>
  );
}
