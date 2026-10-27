"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Order, OrderItem, AppSettings } from "@/lib/sheets";
import {
  generateWhatsAppUrl,
  generateOrderDoneWhatsAppUrl,
  formatRupiah,
  formatReceiptDate,
} from "@/lib/receipt";
import {
  Search,
  Filter,
  FileText,
  ExternalLink,
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Loader2,
  Phone,
  Package,
  Calendar,
  X,
  Eye,
  Check,
} from "lucide-react";

interface OrderWithItems extends Order {
  items: OrderItem[];
}

interface OrdersClientProps {
  initialOrders: OrderWithItems[];
  initialTotal: number;
  initialTotalPages: number;
  role: "admin" | "kasir";
  settings: AppSettings;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function OrdersClient({
  initialOrders,
  initialTotal,
  initialTotalPages,
  role,
  settings,
}: OrdersClientProps) {
  // State filter & search
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  // Modal State
  const [statusModalOrder, setStatusModalOrder] = useState<OrderWithItems | null>(null);
  const [cancelModalOrder, setCancelModalOrder] = useState<OrderWithItems | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Construct Query URL
  const queryParams = new URLSearchParams();
  if (search) queryParams.set("search", search);
  if (status) queryParams.set("status", status);
  if (paymentStatus) queryParams.set("payment_status", paymentStatus);
  if (from) queryParams.set("from", from);
  if (to) queryParams.set("to", to);
  queryParams.set("page", page.toString());
  queryParams.set("limit", "20");

  const queryUrl = `/api/orders?${queryParams.toString()}`;

  const { data, mutate, isValidating } = useSWR<{
    ok: boolean;
    orders: OrderWithItems[];
    total: number;
    page: number;
    totalPages: number;
  }>(queryUrl, fetcher, {
    fallbackData: {
      ok: true,
      orders: initialOrders,
      total: initialTotal,
      page: 1,
      totalPages: initialTotalPages,
    },
    keepPreviousData: true,
  });

  const orders = data?.orders || initialOrders;
  const total = data?.total ?? initialTotal;
  const totalPages = data?.totalPages ?? initialTotalPages;

  // Handle Mark As Paid
  const handleMarkAsPaid = async (orderId: string) => {
    if (!confirm(`Tandai pesanan ${orderId} sebagai LUNAS?`)) return;
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_status: "Lunas" }),
      });
      const resData = await res.json();
      if (!res.ok) {
        alert(resData.error || "Gagal mengubah status pembayaran.");
      } else {
        await mutate();
      }
    } catch {
      alert("Terjadi kesalahan jaringan.");
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle Change Order Status
  const handleChangeOrderStatus = async (newStatus: string) => {
    if (!statusModalOrder) return;
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/orders/${statusModalOrder.order_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_status: newStatus }),
      });
      const resData = await res.json();
      if (!res.ok) {
        alert(resData.error || "Gagal mengubah status pesanan.");
      } else {
        setStatusModalOrder(null);
        await mutate();
      }
    } catch {
      alert("Terjadi kesalahan jaringan.");
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle Cancel Order (Admin Only)
  const handleCancelOrder = async () => {
    if (!cancelModalOrder) return;
    if (role !== "admin") {
      alert("Hanya Admin yang dapat membatalkan pesanan.");
      return;
    }
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/orders/${cancelModalOrder.order_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_status: "Dibatalkan" }),
      });
      const resData = await res.json();
      if (!res.ok) {
        alert(resData.error || "Gagal membatalkan pesanan.");
      } else {
        setCancelModalOrder(null);
        await mutate();
      }
    } catch {
      alert("Terjadi kesalahan jaringan.");
    } finally {
      setIsUpdating(false);
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearch("");
    setStatus("");
    setPaymentStatus("");
    setFrom("");
    setTo("");
    setPage(1);
  };

  const hasActiveFilters = Boolean(search || status || paymentStatus || from || to);

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Daftar Semua Pesanan
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
              Total {total} Pesanan
            </span>
            {isValidating && <Loader2 className="w-4 h-4 text-sky-600 animate-spin" />}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Riwayat seluruh pesanan masuk dengan pencarian, filter status, pelunasan, dan WhatsApp.
          </p>
        </div>

        <Link
          href="/orders/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs transition-colors"
        >
          <span>+ Tambah Pesanan Baru</span>
        </Link>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Input Pencarian */}
          <div className="relative lg:col-span-2">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Cari nama, no HP, atau no order..."
              className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Filter Status Pesanan */}
          <div>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
            >
              <option value="">Semua Status Pesanan</option>
              <option value="Diterima">Diterima</option>
              <option value="Diproses">Diproses</option>
              <option value="Selesai">Selesai</option>
              <option value="Diambil">Diambil</option>
              <option value="Dibatalkan">Dibatalkan</option>
            </select>
          </div>

          {/* Filter Status Bayar */}
          <div>
            <select
              value={paymentStatus}
              onChange={(e) => {
                setPaymentStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
            >
              <option value="">Semua Status Bayar</option>
              <option value="Lunas">Lunas</option>
              <option value="Belum Lunas">Belum Lunas</option>
            </select>
          </div>

          {/* Tombol Reset Filter */}
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset Filter</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Rentang Tanggal */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-500 flex items-center gap-1 font-semibold">
            <Calendar className="w-3.5 h-3.5" />
            <span>Rentang Tanggal:</span>
          </span>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <span className="text-slate-400">s/d</span>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>
      </div>

      {/* Tabel Pesanan (Desktop) & Kartu Pesanan (Mobile) */}
      {orders.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center text-slate-500 space-y-2">
          <Package className="w-12 h-12 text-slate-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">
            Tidak ada pesanan ditemukan
          </h3>
          <p className="text-xs text-slate-400">
            Coba sesuaikan kata kunci pencarian atau ubah filter status di atas.
          </p>
        </div>
      ) : (
        <>
          {/* TAMPILAN MOBILE: KARTU PESANAN */}
          <div className="grid grid-cols-1 md:hidden gap-3">
            {orders.map((order) => {
              const doneWhatsAppUrl = generateOrderDoneWhatsAppUrl(order, settings);
              const receiptWhatsAppUrl = generateWhatsAppUrl(order, order.items, settings);

              return (
                <div
                  key={order.order_id}
                  className={`bg-white rounded-2xl p-4 border shadow-xs space-y-3 ${
                    order.order_status === "Dibatalkan"
                      ? "opacity-60 border-slate-200 bg-slate-50"
                      : "border-slate-200"
                  }`}
                >
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
                              : order.order_status === "Diambil"
                              ? "bg-slate-100 text-slate-700"
                              : order.order_status === "Dibatalkan"
                              ? "bg-rose-50 text-rose-700"
                              : "bg-blue-50 text-blue-700"
                          }`}
                        >
                          {order.order_status}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 mt-1">
                        {order.customer_name}
                      </h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 font-mono">
                        <Phone className="w-3 h-3 text-slate-400" />
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

                  {/* Ringkasan Item */}
                  <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl space-y-1">
                    {order.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <span>
                          {it.service_name} ({it.quantity} {it.unit})
                        </span>
                        <span className="font-semibold text-slate-800">
                          Rp {it.line_total.toLocaleString("id-ID")}
                        </span>
                      </div>
                    ))}
                    {order.notes && (
                      <p className="text-amber-800 text-[11px] pt-1 border-t border-slate-200 italic">
                        Catatan: {order.notes}
                      </p>
                    )}
                  </div>

                  {/* Tombol Aksi Mobile */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <Link
                      href={`/orders/${order.order_id}`}
                      className="flex-1 inline-flex items-center justify-center gap-1 py-2 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Detail</span>
                    </Link>

                    <Link
                      href={`/orders/${order.order_id}/receipt`}
                      className="inline-flex items-center justify-center gap-1 py-2 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Struk</span>
                    </Link>

                    {order.payment_status === "Belum Lunas" && order.order_status !== "Dibatalkan" && (
                      <button
                        type="button"
                        onClick={() => handleMarkAsPaid(order.order_id)}
                        disabled={isUpdating}
                        className="inline-flex items-center justify-center gap-1 py-2 px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200 transition-colors cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Lunas</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setStatusModalOrder(order)}
                      disabled={isUpdating}
                      className="inline-flex items-center justify-center gap-1 py-2 px-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-semibold border border-sky-200 transition-colors cursor-pointer"
                    >
                      <span>Ubah Status</span>
                    </button>

                    {order.order_status === "Selesai" && (
                      <a
                        href={doneWhatsAppUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1 py-2 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>WA Selesai</span>
                      </a>
                    )}

                    {role === "admin" && order.order_status !== "Dibatalkan" && (
                      <button
                        type="button"
                        onClick={() => setCancelModalOrder(order)}
                        disabled={isUpdating}
                        className="inline-flex items-center justify-center gap-1 py-2 px-2.5 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Batal</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* TAMPILAN DESKTOP: TABEL PESANAN */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">No. Pesanan</th>
                    <th className="py-3 px-4">Waktu Masuk</th>
                    <th className="py-3 px-4">Pelanggan</th>
                    <th className="py-3 px-4">Layanan</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4 text-center">Status Bayar</th>
                    <th className="py-3 px-4 text-center">Status Pesanan</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((order) => {
                    const doneWhatsAppUrl = generateOrderDoneWhatsAppUrl(order, settings);
                    const receiptWhatsAppUrl = generateWhatsAppUrl(order, order.items, settings);

                    return (
                      <tr
                        key={order.order_id}
                        className={`hover:bg-slate-50/70 transition-colors ${
                          order.order_status === "Dibatalkan" ? "opacity-60 bg-slate-50/40" : ""
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-bold text-sky-700">
                          {order.order_id}
                        </td>

                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                          {formatReceiptDate(order.created_at)}
                        </td>

                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900">{order.customer_name}</p>
                          <p className="text-[11px] text-slate-400 font-mono">
                            {order.customer_phone}
                          </p>
                        </td>

                        <td className="py-3 px-4 max-w-xs">
                          <div className="space-y-0.5">
                            {order.items.map((it, idx) => (
                              <div key={idx} className="truncate text-[11px] text-slate-600">
                                <span>{it.service_name}</span>{" "}
                                <span className="text-slate-400">
                                  ({it.quantity} {it.unit})
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right font-black text-slate-900 whitespace-nowrap">
                          Rp {order.total.toLocaleString("id-ID")}
                        </td>

                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              order.payment_status === "Lunas"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {order.payment_status}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              order.order_status === "Selesai"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : order.order_status === "Diambil"
                                ? "bg-slate-100 text-slate-700 border border-slate-200"
                                : order.order_status === "Dibatalkan"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-blue-50 text-blue-700 border border-blue-200"
                            }`}
                          >
                            {order.order_status}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <Link
                              href={`/orders/${order.order_id}`}
                              title="Lihat Detail Pesanan"
                              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-sky-600 transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>

                            <Link
                              href={`/orders/${order.order_id}/receipt`}
                              title="Lihat Struk Thermal"
                              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-sky-600 transition-colors"
                            >
                              <FileText className="w-4 h-4" />
                            </Link>

                            {order.payment_status === "Belum Lunas" && order.order_status !== "Dibatalkan" && (
                              <button
                                type="button"
                                onClick={() => handleMarkAsPaid(order.order_id)}
                                title="Tandai Lunas"
                                className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold border border-emerald-200 transition-colors cursor-pointer"
                              >
                                Lunas
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setStatusModalOrder(order)}
                              title="Ubah Status Pesanan"
                              className="px-2 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 text-[11px] font-semibold border border-sky-200 transition-colors cursor-pointer"
                            >
                              Ubah Status
                            </button>

                            {order.order_status === "Selesai" && (
                              <a
                                href={doneWhatsAppUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Kabari Cucian Selesai ke WhatsApp"
                                className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                              >
                                <MessageSquare className="w-4 h-4" />
                              </a>
                            )}

                            {role === "admin" && order.order_status !== "Dibatalkan" && (
                              <button
                                type="button"
                                onClick={() => setCancelModalOrder(order)}
                                title="Batalkan Pesanan (Khusus Admin)"
                                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-xs text-xs">
          <p className="text-slate-500">
            Halaman <strong className="text-slate-800">{page}</strong> dari{" "}
            <strong className="text-slate-800">{totalPages}</strong> ({total} total pesanan)
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Sebelumnya</span>
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>Berikutnya</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* MODAL UBAH STATUS PESANAN */}
      {statusModalOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Ubah Status Pesanan</h3>
              <button
                type="button"
                onClick={() => setStatusModalOrder(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Ubah status untuk pesanan <strong>{statusModalOrder.order_id}</strong> (
              {statusModalOrder.customer_name}):
            </p>

            <div className="grid grid-cols-1 gap-2">
              {["Diterima", "Diproses", "Selesai", "Diambil"].map((st) => (
                <button
                  key={st}
                  type="button"
                  disabled={isUpdating}
                  onClick={() => handleChangeOrderStatus(st)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold text-left border transition-all cursor-pointer flex items-center justify-between ${
                    statusModalOrder.order_status === st
                      ? "bg-sky-50 border-sky-400 text-sky-800"
                      : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <span>{st}</span>
                  {statusModalOrder.order_status === st && (
                    <CheckCircle className="w-4 h-4 text-sky-600" />
                  )}
                </button>
              ))}

              {role === "admin" && (
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => handleChangeOrderStatus("Dibatalkan")}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold text-left border transition-all cursor-pointer flex items-center justify-between ${
                    statusModalOrder.order_status === "Dibatalkan"
                      ? "bg-rose-50 border-rose-400 text-rose-800"
                      : "bg-white border-rose-200 hover:bg-rose-50 text-rose-700"
                  }`}
                >
                  <span>Dibatalkan (Khusus Admin)</span>
                  {statusModalOrder.order_status === "Dibatalkan" && (
                    <XCircle className="w-4 h-4 text-rose-600" />
                  )}
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setStatusModalOrder(null)}
              className="w-full py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI BATALKAN PESANAN (ADMIN ONLY) */}
      {cancelModalOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-xl bg-rose-50 text-rose-600 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Batalkan Pesanan?</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Pesanan <strong>{cancelModalOrder.order_id}</strong> atas nama{" "}
                  <strong>{cancelModalOrder.customer_name}</strong> akan ditandai{" "}
                  <strong className="text-rose-600">Dibatalkan</strong>.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl">
              Sesuai PRD, pesanan tidak dihapus permanen agar riwayat tetap utuh, namun tidak akan
              dihitung dalam omset atau kilo dashboard.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleCancelOrder}
                disabled={isUpdating}
                className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                {isUpdating ? "Memproses..." : "Ya, Batalkan Pesanan"}
              </button>
              <button
                type="button"
                onClick={() => setCancelModalOrder(null)}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                Kembali
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
