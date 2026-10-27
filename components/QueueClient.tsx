"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Order, OrderItem, AppSettings } from "@/lib/sheets";
import { generateOrderDoneWhatsAppUrl, formatRupiah, formatReceiptDate } from "@/lib/receipt";
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  MessageSquare,
  FileText,
  User,
  Phone,
  Package,
  RotateCcw,
  Check,
  Loader2,
  X,
  Filter,
} from "lucide-react";

interface OrderWithItems extends Order {
  items: OrderItem[];
}

interface QueueClientProps {
  initialQueue: OrderWithItems[];
  initialHistory: OrderWithItems[];
  role: "admin" | "kasir";
  settings: AppSettings;
  initialFilter?: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function QueueClient({
  initialQueue,
  initialHistory,
  role,
  settings,
  initialFilter = "",
}: QueueClientProps) {
  const [activeTab, setActiveTab] = useState<"queue" | "history">("queue");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>(initialFilter);
  const [loadingOrderId, setLoadingOrderId] = useState<string | null>(null);

  // Modal konfirmasi jika belum lunas saat akan dicentang "Sudah diambil"
  const [unpaidPrompt, setUnpaidPrompt] = useState<{
    order: OrderWithItems;
  } | null>(null);

  // SWR auto-refresh tiap 30 detik sesuai PRD Bagian 5.9
  const queryUrl = `/api/queue?search=${encodeURIComponent(search)}${
    activeFilter ? `&filter=${encodeURIComponent(activeFilter)}` : ""
  }`;

  const { data, mutate, isValidating } = useSWR<{
    ok: boolean;
    queue: OrderWithItems[];
    history: OrderWithItems[];
    totalQueue: number;
    totalHistory: number;
  }>(queryUrl, fetcher, {
    fallbackData: {
      ok: true,
      queue: initialQueue,
      history: initialHistory,
      totalQueue: initialQueue.length,
      totalHistory: initialHistory.length,
    },
    refreshInterval: 30000, // 30 detik auto-refresh
  });

  const queue = data?.queue || initialQueue;
  const history = data?.history || initialHistory;

  const warningDays = settings.pickup_warning_days || 3;
  const now = Date.now();
  const warningThreshold = now - warningDays * 24 * 3600 * 1000;

  // Checklist Action Handler
  const handleToggleChecklist = async (
    order: OrderWithItems,
    step: "done" | "picked_up",
    checked: boolean,
    markPaidFirst = false
  ) => {
    // Jika belum lunas saat mencentang "Sudah diambil", minta konfirmasi kasir
    if (step === "picked_up" && checked && order.payment_status === "Belum Lunas" && !markPaidFirst) {
      setUnpaidPrompt({ order });
      return;
    }

    setLoadingOrderId(order.order_id);

    try {
      // Jika kasir memilih untuk tandai lunas terlebih dahulu
      if (markPaidFirst) {
        await fetch(`/api/orders/${order.order_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payment_status: "Lunas" }),
        });
      }

      const res = await fetch(`/api/orders/${order.order_id}/checklist`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step, checked }),
      });

      const resData = await res.json();
      if (!res.ok) {
        alert(resData.error || "Gagal memperbarui status checklist.");
      } else {
        await mutate();
      }
    } catch (err) {
      console.error("Checklist update error:", err);
      alert("Terjadi kesalahan koneksi saat memperbarui checklist.");
    } finally {
      setLoadingOrderId(null);
      setUnpaidPrompt(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Role Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Antrian & Operasional Cucian
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                role === "admin"
                  ? "bg-purple-50 text-purple-700 border border-purple-200"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              }`}
            >
              Peran: {role === "admin" ? "Admin" : "Kasir"}
            </span>
            {isValidating && <Loader2 className="w-4 h-4 text-sky-600 animate-spin" />}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Centang cucian yang selesai dicuci dan cucian yang sudah diambil pelanggan (auto-refresh 30 detik).
          </p>
        </div>

        {/* Quick Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveFilter("")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              !activeFilter
                ? "bg-sky-600 text-white shadow-xs"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            Semua
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("telat")}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeFilter === "telat"
                ? "bg-rose-600 text-white shadow-xs"
                : "bg-white text-rose-700 border border-rose-200 hover:bg-rose-50"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Telat</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("belum-diambil")}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeFilter === "belum-diambil"
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-white text-amber-700 border border-amber-200 hover:bg-amber-50"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Belum Diambil &gt; {warningDays} Hari</span>
          </button>
        </div>
      </div>

      {/* Banner Filter Aktif jika disetel */}
      {activeFilter && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
            activeFilter === "telat"
              ? "bg-rose-50 border-rose-200 text-rose-800"
              : "bg-amber-50 border-amber-200 text-amber-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {activeFilter === "telat" ? (
              <Clock className="w-4 h-4 text-rose-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            )}
            <span className="font-semibold">
              {activeFilter === "telat"
                ? "Menampilkan pesanan yang melewati estimasi selesai."
                : `Menampilkan cucian selesai yang belum diambil lebih dari ${warningDays} hari.`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveFilter("")}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white text-slate-700 font-semibold hover:bg-slate-50 border border-slate-200 shadow-2xs"
          >
            <X className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      )}

      {/* Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Tab Switcher */}
        <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab("queue")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "queue"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ClipboardList className="w-4 h-4 text-sky-600" />
            <span>Antrian Cucian</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-sky-100 text-sky-700 font-bold">
              {queue.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "history"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Riwayat Diambil</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 text-slate-700 font-bold">
              {history.length}
            </span>
          </button>
        </div>

        {/* Input Pencarian */}
        <div className="relative w-full sm:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, no HP, atau no order..."
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
      </div>

      {/* List Kartu Antrian / Riwayat */}
      {activeTab === "queue" ? (
        queue.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center text-slate-500 space-y-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">
              Tidak ada antrian cucian aktif
            </h3>
            <p className="text-xs text-slate-400">
              Semua cucian sudah selesai dan diambil, atau tidak ada pesanan yang sesuai filter.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {queue.map((order) => {
              const isOverdue =
                (order.order_status === "Diterima" || order.order_status === "Diproses") &&
                order.estimated_done &&
                new Date(order.estimated_done).getTime() < now;

              const isUnclaimed =
                order.order_status === "Selesai" &&
                !order.picked_up_at &&
                new Date(order.done_at || order.updated_at).getTime() < warningThreshold;

              const isDoneChecked = Boolean(order.done_at || order.order_status === "Selesai");
              const isPickedUpChecked = Boolean(order.picked_up_at || order.order_status === "Diambil");
              const isProcessing = loadingOrderId === order.order_id;

              const doneWhatsAppUrl = generateOrderDoneWhatsAppUrl(order, settings);

              return (
                <div
                  key={order.order_id}
                  className={`bg-white rounded-2xl p-5 border shadow-xs transition-all flex flex-col justify-between ${
                    isOverdue
                      ? "border-rose-300 ring-2 ring-rose-100"
                      : isUnclaimed
                      ? "border-amber-300 ring-2 ring-amber-100"
                      : "border-slate-200"
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header Kartu */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md">
                            {order.order_id}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-md font-semibold ${
                              order.order_status === "Selesai"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-blue-50 text-blue-700"
                            }`}
                          >
                            {order.order_status}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900 mt-1.5">
                          {order.customer_name}
                        </h3>
                        <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5 font-sans">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{order.customer_phone}</span>
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-black text-slate-900 block">
                          Rp {order.total.toLocaleString("id-ID")}
                        </span>
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                            order.payment_status === "Lunas"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {order.payment_status}
                        </span>
                      </div>
                    </div>

                    {/* Penanda Peringatan Telat / Belum Diambil */}
                    {isOverdue && (
                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                        <Clock className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>
                          <strong>Telat:</strong> Melewati batas estimasi (
                          {formatReceiptDate(order.estimated_done)})
                        </span>
                      </div>
                    )}

                    {isUnclaimed && (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          <strong>Belum Diambil:</strong> Selesai &gt; {warningDays} hari lalu
                        </span>
                      </div>
                    )}

                    {/* Item Layanan & Ringkasan Isi Cucian */}
                    <div className="pt-2 border-t border-slate-100 space-y-1 text-xs">
                      {order.items.map((it, idx) => (
                        <div key={idx} className="flex items-center justify-between text-slate-700">
                          <div className="flex items-center gap-1.5">
                            <Package className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-semibold">{it.service_name}</span>
                            <span className="text-slate-500">
                              ({it.quantity} {it.unit})
                            </span>
                            {it.item_description && (
                              <span className="text-slate-400 italic">· {it.item_description}</span>
                            )}
                          </div>
                          <span className="font-medium text-slate-900">
                            Rp {it.line_total.toLocaleString("id-ID")}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Catatan Khusus dengan Penanda Mencolok sesuai PRD Bagian 5.3 & 5.9 */}
                    {order.notes && (
                      <div className="p-3 rounded-xl bg-amber-100 border border-amber-300 text-amber-950 text-xs flex items-start gap-2 shadow-2xs">
                        <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                        <div>
                          <strong className="font-bold text-amber-900 block">
                            Instruksi Khusus Petugas Cuci:
                          </strong>
                          <span>{order.notes}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bagian Bawah: Checklist 2 Langkah (Selesai & Diambil) + Tombol WA */}
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {/* Checkbox 1: Selesai Dicuci */}
                      <label
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer select-none transition-all min-h-[48px] ${
                          isDoneChecked
                            ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                            : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isDoneChecked}
                          disabled={isProcessing}
                          onChange={(e) =>
                            handleToggleChecklist(order, "done", e.target.checked)
                          }
                          className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <div className="text-xs">
                          <span className="font-bold block">1. Selesai Dicuci</span>
                          {order.done_at && (
                            <span className="text-[10px] text-emerald-700 block">
                              {formatReceiptDate(order.done_at)} ({order.done_by})
                            </span>
                          )}
                        </div>
                      </label>

                      {/* Checkbox 2: Sudah Diambil */}
                      <label
                        className={`flex items-center gap-3 p-3 rounded-xl border select-none transition-all min-h-[48px] ${
                          !isDoneChecked
                            ? "opacity-50 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-400"
                            : isPickedUpChecked
                            ? "bg-emerald-50 border-emerald-300 text-emerald-900 cursor-pointer"
                            : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isPickedUpChecked}
                          disabled={!isDoneChecked || isProcessing}
                          onChange={(e) =>
                            handleToggleChecklist(order, "picked_up", e.target.checked)
                          }
                          className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:cursor-not-allowed"
                        />
                        <div className="text-xs">
                          <span className="font-bold block">2. Sudah Diambil</span>
                          {order.picked_up_at ? (
                            <span className="text-[10px] text-emerald-700 block">
                              {formatReceiptDate(order.picked_up_at)} ({order.picked_up_by})
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 block">
                              Pindah ke Riwayat
                            </span>
                          )}
                        </div>
                      </label>
                    </div>

                    {/* Tombol WhatsApp Kabari Selesai (Muncul saat status Selesai) */}
                    {isDoneChecked && !isPickedUpChecked && (
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <a
                          href={doneWhatsAppUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors"
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span>Kabari Selesai via WhatsApp</span>
                        </a>

                        <Link
                          href={`/orders/${order.order_id}/receipt`}
                          className="inline-flex items-center gap-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                        >
                          <FileText className="w-4 h-4" />
                          <span>Struk</span>
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* TAB RIWAYAT PESANAN (SUDAH DIAMBIL) */
        history.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center text-slate-500 space-y-2">
            <CheckCircle2 className="w-12 h-12 text-slate-400 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">
              Belum ada riwayat cucian yang sudah diambil
            </h3>
            <p className="text-xs text-slate-400">
              Pesanan yang dicentang 'Sudah diambil' akan tampil di tab ini.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {history.map((order) => (
              <div
                key={order.order_id}
                className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between opacity-95 hover:opacity-100 transition-opacity"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                          {order.order_id}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-md font-semibold bg-emerald-50 text-emerald-700">
                          Diambil
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mt-1">
                        {order.customer_name}
                      </h3>
                      <p className="text-xs text-slate-500">{order.customer_phone}</p>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-black text-slate-900 block">
                        Rp {order.total.toLocaleString("id-ID")}
                      </span>
                      <span className="text-[11px] font-semibold text-emerald-700">
                        {order.payment_status}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 text-[11px] text-slate-600 space-y-0.5">
                    <p>
                      <strong>Diambil pada:</strong>{" "}
                      {order.picked_up_at ? formatReceiptDate(order.picked_up_at) : "-"}{" "}
                      (oleh: {order.picked_up_by || "-"})
                    </p>
                    <p>
                      <strong>Selesai pada:</strong>{" "}
                      {order.done_at ? formatReceiptDate(order.done_at) : "-"}{" "}
                      (oleh: {order.done_by || "-"})
                    </p>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                  {/* Batal centang jika salah centang (mundur 1 langkah ke Selesai) */}
                  <button
                    type="button"
                    onClick={() => handleToggleChecklist(order, "picked_up", false)}
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Batal Diambil</span>
                  </button>

                  <Link
                    href={`/orders/${order.order_id}/receipt`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-700"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Lihat Struk</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Modal Konfirmasi Pengambilan Pesanan Belum Lunas sesuai PRD Bagian 5.9 */}
      {unpaidPrompt && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-xl bg-amber-50 text-amber-600 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Pesanan Masih Belum Lunas
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Pesanan <strong>{unpaidPrompt.order.order_id}</strong> atas nama{" "}
                  <strong>{unpaidPrompt.order.customer_name}</strong> berstatus{" "}
                  <span className="text-rose-600 font-bold">Belum Lunas</span> sebesar{" "}
                  <strong className="text-slate-900">
                    Rp {unpaidPrompt.order.total.toLocaleString("id-ID")}
                  </strong>
                  .
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl">
              Apakah pelanggan sudah membayar sekarang dan ingin ditandai lunas, atau cucian tetap diambil tanpa pembayaran lunas?
            </p>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={() =>
                  handleToggleChecklist(unpaidPrompt.order, "picked_up", true, true)
                }
                className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                Tandai Lunas & Sudah Diambil
              </button>
              <button
                type="button"
                onClick={() =>
                  handleToggleChecklist(unpaidPrompt.order, "picked_up", true, false)
                }
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                Lanjut Tanpa Lunas
              </button>
              <button
                type="button"
                onClick={() => setUnpaidPrompt(null)}
                className="py-2.5 px-3 rounded-xl text-slate-500 hover:text-slate-800 text-xs font-medium cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
