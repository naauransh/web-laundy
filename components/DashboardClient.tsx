"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { StatsResponse } from "@/lib/stats";
import SummaryCard from "./SummaryCard";
import DateRangePicker from "./DateRangePicker";
import RevenueChart from "./RevenueChart";
import MonthlyChart from "./MonthlyChart";
import ServiceDonut from "./ServiceDonut";
import {
  DollarSign,
  TrendingUp,
  Calendar,
  AlertTriangle,
  Clock,
  Scale,
  CreditCard,
  Package,
  Layers,
  ArrowRight,
  Loader2,
  FileText,
  BadgeAlert,
  Wallet,
} from "lucide-react";

interface DashboardClientProps {
  initialStats: StatsResponse;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function DashboardClient({ initialStats }: DashboardClientProps) {
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({});
  const [topServiceSort, setTopServiceSort] = useState<"revenue" | "orders">("revenue");

  // Buat URL API Stats dengan query parameter tanggal
  const statsUrl = `/api/stats${
    dateRange.from && dateRange.to ? `?from=${dateRange.from}&to=${dateRange.to}` : ""
  }`;

  const { data, isValidating } = useSWR<{ ok: boolean; stats: StatsResponse }>(
    statsUrl,
    fetcher,
    {
      fallbackData: { ok: true, stats: initialStats },
      revalidateOnFocus: false,
    }
  );

  const stats = data?.stats || initialStats;
  const { summary, attention, paymentMethods, topServices, dailyChart, monthlyChart, serviceComposition, monthlyRecap, recentOrders } = stats;

  const handleRangeChange = (from: string, to: string) => {
    setDateRange({ from, to });
  };

  // Sort top services
  const sortedTopServices = [...topServices].sort((a, b) =>
    topServiceSort === "revenue" ? b.revenue - a.revenue : b.orderCount - a.orderCount
  );

  return (
    <div className="space-y-6">
      {/* Title & Loading indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <span>Dashboard Pendapatan & Tren</span>
            {isValidating && <Loader2 className="w-4 h-4 text-sky-600 animate-spin" />}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Laporan keuangan, omset cucian, piutang, dan performa layanan.
          </p>
        </div>
      </div>

      {/* 1. KARTU OMSET & RINGKASAN UTAMA (4 Kolom di Desktop, 2 di Tablet, 1 di Mobile) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Hari Ini */}
        <SummaryCard
          title="Pendapatan Hari Ini"
          value={`Rp ${summary.today.revenue.toLocaleString("id-ID")}`}
          countLabel={`${summary.today.orderCount} pesanan lunas`}
          percentChange={summary.today.percentChange}
          diffAmount={`Rp ${Math.abs(summary.today.diffRevenue).toLocaleString("id-ID")}`}
          icon={<DollarSign className="w-5 h-5 text-sky-600" />}
        />

        {/* Bulan Ini */}
        <SummaryCard
          title="Pendapatan Bulan Ini"
          value={`Rp ${summary.monthToDate.revenue.toLocaleString("id-ID")}`}
          countLabel={`${summary.monthToDate.orderCount} pesanan (tgl 1 - skrg)`}
          percentChange={summary.monthToDate.percentChange}
          diffAmount={`Rp ${Math.abs(summary.monthToDate.diffRevenue).toLocaleString("id-ID")}`}
          icon={<Calendar className="w-5 h-5 text-emerald-600" />}
        />

        {/* 3 Bulan Terakhir */}
        <SummaryCard
          title="3 Bulan Terakhir"
          value={`Rp ${summary.last3Months.revenue.toLocaleString("id-ID")}`}
          countLabel={`${summary.last3Months.orderCount} pesanan (90 hari)`}
          percentChange={summary.last3Months.percentChange}
          diffAmount={`Rp ${Math.abs(summary.last3Months.diffRevenue).toLocaleString("id-ID")}`}
          icon={<TrendingUp className="w-5 h-5 text-indigo-600" />}
        />

        {/* Rentang Custom */}
        <SummaryCard
          title="Pendapatan Filter"
          value={`Rp ${summary.custom.revenue.toLocaleString("id-ID")}`}
          countLabel={`${summary.custom.orderCount} pesanan pada filter`}
          percentChange={summary.custom.percentChange}
          subtitle={`${summary.custom.from} s/d ${summary.custom.to}`}
          icon={<FileText className="w-5 h-5 text-amber-600" />}
        />
      </div>

      {/* Baris Tambahan: Uang Tunai, Total Kilo, Piutang, dan Pesanan Belum Selesai */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Uang Tunai Hari Ini (Sesuai PRD: dicocokkan dengan laci) */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold uppercase">Uang Tunai Hari Ini</span>
            <Wallet className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-lg font-black text-emerald-700">
            Rp {summary.cashToday.toLocaleString("id-ID")}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Cocokkan dengan fisik laci</p>
        </div>

        {/* Total Kilo Dicuci */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold uppercase">Total Kilo Dicuci</span>
            <Scale className="w-4 h-4 text-sky-600" />
          </div>
          <p className="text-lg font-black text-sky-700">
            {summary.totalKg.monthToDate.toLocaleString("id-ID")} kg
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Hari ini: {summary.totalKg.today} kg
            {summary.unitPiecesCustom > 0 && ` (+${summary.unitPiecesCustom} pcs)`}
          </p>
        </div>

        {/* Total Piutang (Belum Lunas) */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold uppercase">Total Piutang</span>
            <BadgeAlert className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-lg font-black text-rose-700">
            Rp {summary.totalReceivables.toLocaleString("id-ID")}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Pesanan belum lunas</p>
        </div>

        {/* Belum Selesai */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold uppercase">Belum Selesai</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-lg font-black text-amber-700">
            {summary.uncompletedOrders} Cucian
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Diterima & diproses</p>
        </div>
      </div>

      {/* 2. KARTU PERBANDINGAN BULAN INI VS BULAN LALU */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Perbandingan Periode Sama
            </span>
            <h2 className="text-xl font-bold">
              Bulan Ini vs Bulan Lalu (Tanggal 1 s/d Hari Ini)
            </h2>
            <p className="text-xs text-slate-400">
              Membandingkan omset tanggal yang sama di bulan ini dengan bulan lalu untuk akurasi tren.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div>
              <span className="text-[11px] text-slate-400 block">Selisih Omset</span>
              <span
                className={`text-xl font-black ${
                  summary.monthToDate.diffRevenue >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {summary.monthToDate.diffRevenue >= 0 ? "+" : "-"}Rp{" "}
                {Math.abs(summary.monthToDate.diffRevenue).toLocaleString("id-ID")}
              </span>
              <span className="text-xs text-slate-300 ml-1.5 font-semibold">
                ({typeof summary.monthToDate.percentChange === "number" && summary.monthToDate.percentChange > 0 ? "+" : ""}
                {summary.monthToDate.percentChange}%)
              </span>
            </div>

            <div className="border-l border-slate-700 pl-6">
              <span className="text-[11px] text-slate-400 block">Omset Bulan Lalu Penuh</span>
              <span className="text-lg font-bold text-slate-200">
                Rp {summary.monthToDate.lastMonthFull.toLocaleString("id-ID")}
              </span>
              <span className="text-[10px] text-slate-400 block">sebagai pembanding penuh</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. PANEL PERLU PERHATIAN (Klik membuka /antrian yang sudah terfilter) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Pesanan Telat */}
        <Link
          href="/antrian?filter=telat"
          className="group bg-white rounded-2xl p-5 border border-rose-200/80 shadow-xs hover:border-rose-300 hover:shadow-md transition-all flex items-start justify-between"
        >
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full">
              <Clock className="w-3.5 h-3.5" />
              <span>Perlu Perhatian</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-2">
              Pesanan Telat Dicuci
            </h3>
            <p className="text-xs text-slate-500">
              Melewati estimasi waktu selesai namun belum ditandai Selesai.
            </p>
          </div>
          <div className="flex flex-col items-end justify-between self-stretch">
            <span className="text-3xl font-black text-rose-600">
              {attention.overdueOrders}
            </span>
            <span className="text-xs text-sky-600 font-semibold group-hover:translate-x-1 transition-transform flex items-center gap-0.5 mt-2">
              Buka Antrian <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </Link>

        {/* Selesai Belum Diambil */}
        <Link
          href="/antrian?filter=belum-diambil"
          className="group bg-white rounded-2xl p-5 border border-amber-200/80 shadow-xs hover:border-amber-300 hover:shadow-md transition-all flex items-start justify-between"
        >
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Penyimpanan Menumpuk</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-2">
              Selesai Belum Diambil
            </h3>
            <p className="text-xs text-slate-500">
              Cucian sudah selesai lebih dari batas hari peringatan namun belum diambil.
            </p>
          </div>
          <div className="flex flex-col items-end justify-between self-stretch">
            <span className="text-3xl font-black text-amber-600">
              {attention.unclaimedOrders}
            </span>
            <span className="text-xs text-sky-600 font-semibold group-hover:translate-x-1 transition-transform flex items-center gap-0.5 mt-2">
              Buka Antrian <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </Link>
      </div>

      {/* 4. FILTER RENTANG TANGGAL CUSTOM */}
      <DateRangePicker
        initialFrom={summary.custom.from}
        initialTo={summary.custom.to}
        onRangeChange={handleRangeChange}
      />

      {/* 5. GRAFIK-GRAFIK ANALITIK RECHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Grafik Omset Harian (8 Kolom di LG) */}
        <div className="lg:col-span-8 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Grafik Omset Harian
              </h2>
              <p className="text-xs text-slate-400">
                Mengikuti rentang tanggal terpilih ({summary.custom.from} s/d {summary.custom.to})
              </p>
            </div>
          </div>
          <RevenueChart data={dailyChart} />
        </div>

        {/* Grafik Komposisi Layanan (4 Kolom di LG) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Komposisi Layanan
            </h2>
            <p className="text-xs text-slate-400">
              Kontribusi omset per jenis layanan pada filter
            </p>
          </div>
          <ServiceDonut data={serviceComposition} />
        </div>
      </div>

      {/* Grafik 12 Bulan Terakhir (Omset Bulanan & Total Kilo) */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
        <MonthlyChart data={monthlyChart} />
      </div>

      {/* 6. LAYANAN TERLARIS & OMSET METODE BAYAR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Layanan Terlaris (7 Kolom di LG) */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                5 Layanan Terlaris
              </h2>
              <p className="text-xs text-slate-400">Pada rentang tanggal yang dipilih</p>
            </div>

            {/* Toggle Urutan */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setTopServiceSort("revenue")}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  topServiceSort === "revenue"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Omset
              </button>
              <button
                type="button"
                onClick={() => setTopServiceSort("orders")}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  topServiceSort === "orders"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Pesanan
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Layanan</th>
                  <th className="py-2.5 px-3 text-center">Pesanan</th>
                  <th className="py-2.5 px-3 text-center">Kuantitas</th>
                  <th className="py-2.5 px-3 text-right">Omset</th>
                  <th className="py-2.5 px-3 text-right">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedTopServices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      Belum ada transaksi pada periode ini.
                    </td>
                  </tr>
                ) : (
                  sortedTopServices.map((svc, i) => (
                    <tr key={i} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {svc.serviceName}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-600">
                        {svc.orderCount}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-600">
                        {svc.totalQuantity.toLocaleString("id-ID")} {svc.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                        Rp {svc.revenue.toLocaleString("id-ID")}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-500 font-semibold">
                        {svc.percentage}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-slate-400 italic">
            * Total rincian layanan dihitung dari line_total sebelum potongan diskon pesanan.
          </p>
        </div>

        {/* Omset per Metode Bayar (5 Kolom di LG) */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Omset per Metode Bayar
            </h2>
            <p className="text-xs text-slate-400">
              Pencocokan uang tunai dan saldo rekening/QRIS
            </p>
          </div>

          <div className="space-y-3 pt-1">
            {paymentMethods.map((pm) => (
              <div
                key={pm.method}
                className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`p-2 rounded-lg ${
                      pm.method === "Tunai"
                        ? "bg-emerald-100 text-emerald-700"
                        : pm.method === "QRIS"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-xs">{pm.method}</p>
                    <p className="text-[11px] text-slate-400">{pm.orderCount} pesanan</p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-extrabold text-slate-900 text-sm">
                    Rp {pm.revenue.toLocaleString("id-ID")}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-500">{pm.percentage}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 7. REKAP BULANAN (12 Bulan) & TABEL 10 PESANAN TERBARU */}
      <div className="space-y-6">
        {/* Rekap Bulanan */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Rekap Bulanan (12 Bulan Terakhir)
            </h2>
            <p className="text-xs text-slate-400">Bulan terbaru di atas</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Bulan</th>
                  <th className="py-2.5 px-3 text-right">Omset</th>
                  <th className="py-2.5 px-3 text-center">Selisih dari Bulan Lalu</th>
                  <th className="py-2.5 px-3 text-center">Total Kg</th>
                  <th className="py-2.5 px-3 text-center">Pesanan</th>
                  <th className="py-2.5 px-3 text-right">Rata-rata/Pesanan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {monthlyRecap.map((row) => (
                  <tr key={row.monthKey} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      {row.displayMonth}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      Rp {row.revenue.toLocaleString("id-ID")}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {row.percentChange === "-" ? (
                        <span className="text-slate-400">-</span>
                      ) : row.percentChange === "Baru" ? (
                        <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full text-[11px]">
                          Baru
                        </span>
                      ) : (
                        <span
                          className={`font-semibold ${
                            row.diffRevenue >= 0 ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {row.diffRevenue >= 0 ? "+" : ""}
                          Rp {row.diffRevenue.toLocaleString("id-ID")} ({row.percentChange}%)
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-600 font-medium">
                      {row.totalKg.toLocaleString("id-ID")} kg
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-600">
                      {row.orderCount}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-800">
                      Rp {row.averageOrderValue.toLocaleString("id-ID")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabel 10 Pesanan Terbaru */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                10 Pesanan Terbaru
              </h2>
              <p className="text-xs text-slate-400">Klik pesanan untuk melihat struk</p>
            </div>
            <Link
              href="/orders"
              className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
            >
              <span>Semua Pesanan</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-semibold">
                <tr>
                  <th className="py-2.5 px-3">No. Order</th>
                  <th className="py-2.5 px-3">Pelanggan</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                  <th className="py-2.5 px-3 text-center">Status Bayar</th>
                  <th className="py-2.5 px-3 text-center">Status Pesanan</th>
                  <th className="py-2.5 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      Belum ada transaksi pesanan.
                    </td>
                  </tr>
                ) : (
                  recentOrders.map((o) => (
                    <tr key={o.order_id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 font-mono font-bold text-sky-700">
                        {o.order_id}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {o.customer_name}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                        Rp {o.total.toLocaleString("id-ID")}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            o.payment_status === "Lunas"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {o.payment_status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${
                            o.order_status === "Selesai"
                              ? "bg-emerald-50 text-emerald-700"
                              : o.order_status === "Diambil"
                              ? "bg-slate-100 text-slate-700"
                              : "bg-sky-50 text-sky-700"
                          }`}
                        >
                          {o.order_status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Link
                          href={`/orders/${o.order_id}/receipt`}
                          className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 text-[11px] font-semibold"
                        >
                          Struk
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
