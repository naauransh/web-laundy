import { Order, OrderItem, AppSettings } from "./sheets";
import {
  format,
  subDays,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  subMonths,
  eachDayOfInterval,
  isWithinInterval,
  parseISO,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";

const TIMEZONE = "Asia/Jakarta";

export interface StatsResponse {
  summary: {
    today: { revenue: number; orderCount: number; diffRevenue: number; percentChange: number | string };
    monthToDate: { revenue: number; orderCount: number; diffRevenue: number; percentChange: number | string; lastMonthFull: number };
    last3Months: { revenue: number; orderCount: number; diffRevenue: number; percentChange: number | string };
    custom: { revenue: number; orderCount: number; diffRevenue: number; percentChange: number | string; from: string; to: string };
    totalReceivables: number; // Piutang
    uncompletedOrders: number; // Belum Selesai
    cashToday: number; // Uang Tunai Hari Ini
    totalKg: {
      today: number;
      monthToDate: number;
      monthDiffKg: number;
      monthPercentChange: number | string;
      custom: number;
    };
    unitPiecesCustom: number; // + N pcs satuan
  };
  attention: {
    overdueOrders: number;
    unclaimedOrders: number;
  };
  paymentMethods: {
    method: "Tunai" | "Transfer" | "QRIS";
    revenue: number;
    orderCount: number;
    percentage: number;
  }[];
  topServices: {
    serviceName: string;
    unit: string;
    orderCount: number;
    totalQuantity: number;
    revenue: number;
    percentage: number;
  }[];
  dailyChart: {
    date: string;
    displayDate: string;
    revenue: number;
    orderCount: number;
  }[];
  monthlyChart: {
    monthKey: string;
    displayMonth: string;
    revenue: number;
    orderCount: number;
    totalKg: number;
  }[];
  serviceComposition: {
    name: string;
    revenue: number;
    percentage: number;
  }[];
  monthlyRecap: {
    monthKey: string;
    displayMonth: string;
    revenue: number;
    diffRevenue: number;
    percentChange: number | string;
    totalKg: number;
    orderCount: number;
    averageOrderValue: number;
  }[];
  recentOrders: Order[];
}

// Helper persentase selisih
function calcPercentChange(current: number, previous: number): number | string {
  if (previous === 0) {
    return current > 0 ? "Baru" : 0;
  }
  const pct = ((current - previous) / previous) * 100;
  return Math.round(pct * 10) / 10;
}

export function computeStats(
  orders: Order[],
  items: OrderItem[],
  settings: AppSettings,
  customFrom?: string,
  customTo?: string
): StatsResponse {
  const now = new Date();
  const zonedNow = toZonedTime(now, TIMEZONE);

  // Map items per order_id
  const itemsByOrder = new Map<string, OrderItem[]>();
  for (const it of items) {
    const list = itemsByOrder.get(it.order_id) || [];
    list.push(it);
    itemsByOrder.set(it.order_id, list);
  }

  // Pesanan valid (tidak Dibatalkan)
  const nonCancelledOrders = orders.filter((o) => o.order_status !== "Dibatalkan");

  // Pesanan Omset/Pendapatan: Lunas dan tidak Dibatalkan
  const revenueOrders = nonCancelledOrders.filter((o) => o.payment_status === "Lunas");

  // --- 1. HARI INI ---
  const todayStr = format(zonedNow, "yyyy-MM-dd");
  const yesterdayStr = format(subDays(zonedNow, 1), "yyyy-MM-dd");

  const todayOrders = revenueOrders.filter((o) => {
    const d = toZonedTime(parseISO(o.created_at), TIMEZONE);
    return format(d, "yyyy-MM-dd") === todayStr;
  });
  const yesterdayOrders = revenueOrders.filter((o) => {
    const d = toZonedTime(parseISO(o.created_at), TIMEZONE);
    return format(d, "yyyy-MM-dd") === yesterdayStr;
  });

  const todayRevenue = todayOrders.reduce((sum, o) => sum + o.total, 0);
  const yesterdayRevenue = yesterdayOrders.reduce((sum, o) => sum + o.total, 0);
  const todayDiff = todayRevenue - yesterdayRevenue;
  const todayPercent = calcPercentChange(todayRevenue, yesterdayRevenue);

  // Uang Tunai Hari Ini (Lunas & Tunai)
  const cashToday = todayOrders
    .filter((o) => o.payment_method === "Tunai")
    .reduce((sum, o) => sum + o.total, 0);

  // Total kg hari ini (semua pesanan tidak dibatalkan, lunas maupun belum lunas)
  let todayKg = 0;
  for (const o of nonCancelledOrders) {
    const d = toZonedTime(parseISO(o.created_at), TIMEZONE);
    if (format(d, "yyyy-MM-dd") === todayStr) {
      const orderItems = itemsByOrder.get(o.order_id) || [];
      for (const it of orderItems) {
        if (it.unit === "kg") todayKg += it.quantity;
      }
    }
  }

  // --- 2. BULAN INI VS BULAN LALU (Rentang tanggal yang sama) ---
  // Contoh: 1 s.d. 27 Oktober vs 1 s.d. 27 September
  const currentDayOfMonth = zonedNow.getDate();
  const currentMonthYear = format(zonedNow, "yyyy-MM");
  const lastMonthZoned = subMonths(zonedNow, 1);
  const lastMonthYear = format(lastMonthZoned, "yyyy-MM");

  let thisMonthRevenue = 0;
  let thisMonthOrdersCount = 0;
  let thisMonthKg = 0;

  let lastMonthSameRangeRevenue = 0;
  let lastMonthSameRangeKg = 0;
  let lastMonthFullRevenue = 0;

  for (const o of revenueOrders) {
    const d = toZonedTime(parseISO(o.created_at), TIMEZONE);
    const mKey = format(d, "yyyy-MM");
    const day = d.getDate();

    if (mKey === currentMonthYear && day <= currentDayOfMonth) {
      thisMonthRevenue += o.total;
      thisMonthOrdersCount += 1;
    }
    if (mKey === lastMonthYear) {
      lastMonthFullRevenue += o.total;
      if (day <= currentDayOfMonth) {
        lastMonthSameRangeRevenue += o.total;
      }
    }
  }

  for (const o of nonCancelledOrders) {
    const d = toZonedTime(parseISO(o.created_at), TIMEZONE);
    const mKey = format(d, "yyyy-MM");
    const day = d.getDate();
    const orderItems = itemsByOrder.get(o.order_id) || [];
    const kgInOrder = orderItems.filter((i) => i.unit === "kg").reduce((acc, i) => acc + i.quantity, 0);

    if (mKey === currentMonthYear && day <= currentDayOfMonth) {
      thisMonthKg += kgInOrder;
    }
    if (mKey === lastMonthYear && day <= currentDayOfMonth) {
      lastMonthSameRangeKg += kgInOrder;
    }
  }

  const monthDiffRevenue = thisMonthRevenue - lastMonthSameRangeRevenue;
  const monthPercentChange = calcPercentChange(thisMonthRevenue, lastMonthSameRangeRevenue);
  const monthDiffKg = Math.round((thisMonthKg - lastMonthSameRangeKg) * 100) / 100;
  const monthKgPercentChange = calcPercentChange(thisMonthKg, lastMonthSameRangeKg);

  // --- 3. 3 BULAN TERAKHIR (90 hari terakhir) ---
  const ninetyDaysAgo = subDays(zonedNow, 90);
  const oneEightyDaysAgo = subDays(zonedNow, 180);

  let last3MonthsRevenue = 0;
  let last3MonthsCount = 0;
  let prev3MonthsRevenue = 0;

  for (const o of revenueOrders) {
    const d = toZonedTime(parseISO(o.created_at), TIMEZONE);
    if (d >= ninetyDaysAgo && d <= zonedNow) {
      last3MonthsRevenue += o.total;
      last3MonthsCount += 1;
    } else if (d >= oneEightyDaysAgo && d < ninetyDaysAgo) {
      prev3MonthsRevenue += o.total;
    }
  }

  const last3MonthsDiff = last3MonthsRevenue - prev3MonthsRevenue;
  const last3MonthsPercent = calcPercentChange(last3MonthsRevenue, prev3MonthsRevenue);

  // --- 4. RENTANG CUSTOM FILTER ---
  const defaultFrom = subDays(zonedNow, 29);
  const fromDate = customFrom ? toZonedTime(parseISO(customFrom), TIMEZONE) : defaultFrom;
  const toDate = customTo ? toZonedTime(parseISO(customTo), TIMEZONE) : zonedNow;

  const filterInterval = {
    start: startOfDay(fromDate),
    end: endOfDay(toDate),
  };

  const rangeDays = Math.max(
    1,
    Math.round((filterInterval.end.getTime() - filterInterval.start.getTime()) / (1000 * 3600 * 24))
  );
  const prevInterval = {
    start: startOfDay(subDays(filterInterval.start, rangeDays)),
    end: endOfDay(subDays(filterInterval.start, 1)),
  };

  let customRevenue = 0;
  let customOrderCount = 0;
  let customKg = 0;
  let customUnitPieces = 0;
  let prevCustomRevenue = 0;

  const customRevenueOrders: Order[] = [];
  const customAllOrders: Order[] = [];

  for (const o of nonCancelledOrders) {
    const d = toZonedTime(parseISO(o.created_at), TIMEZONE);
    if (isWithinInterval(d, filterInterval)) {
      customAllOrders.push(o);
      const orderItems = itemsByOrder.get(o.order_id) || [];
      for (const it of orderItems) {
        if (it.unit === "kg") customKg += it.quantity;
        else customUnitPieces += it.quantity;
      }
      if (o.payment_status === "Lunas") {
        customRevenue += o.total;
        customOrderCount += 1;
        customRevenueOrders.push(o);
      }
    } else if (isWithinInterval(d, prevInterval)) {
      if (o.payment_status === "Lunas") {
        prevCustomRevenue += o.total;
      }
    }
  }

  const customDiffRevenue = customRevenue - prevCustomRevenue;
  const customPercentChange = calcPercentChange(customRevenue, prevCustomRevenue);

  // --- 5. TOTAL PIUTANG & BELUM SELESAI ---
  const totalReceivables = nonCancelledOrders
    .filter((o) => o.payment_status === "Belum Lunas")
    .reduce((sum, o) => sum + o.total, 0);

  const uncompletedOrders = nonCancelledOrders.filter(
    (o) => o.order_status === "Diterima" || o.order_status === "Diproses"
  ).length;

  // --- 6. PANEL PERLU PERHATIAN ---
  // - Telat: sudah lewat estimated_done tapi belum Selesai dan belum Diambil
  // - Belum diambil: sudah Selesai tapi belum diambil > pickup_warning_days
  const warningDays = settings.pickup_warning_days || 3;
  const warningThreshold = subDays(zonedNow, warningDays).getTime();

  let overdueOrders = 0;
  let unclaimedOrders = 0;

  for (const o of nonCancelledOrders) {
    if (o.order_status === "Diterima" || o.order_status === "Diproses") {
      if (o.estimated_done && new Date(o.estimated_done).getTime() < now.getTime()) {
        overdueOrders += 1;
      }
    }
    if (o.order_status === "Selesai" && !o.picked_up_at) {
      const doneTime = o.done_at ? new Date(o.done_at).getTime() : new Date(o.updated_at).getTime();
      if (doneTime < warningThreshold) {
        unclaimedOrders += 1;
      }
    }
  }

  // --- 7. OMSET PER METODE BAYAR (pada rentang custom) ---
  const paymentMethodsData: Record<"Tunai" | "Transfer" | "QRIS", { revenue: number; orderCount: number }> = {
    Tunai: { revenue: 0, orderCount: 0 },
    Transfer: { revenue: 0, orderCount: 0 },
    QRIS: { revenue: 0, orderCount: 0 },
  };

  for (const o of customRevenueOrders) {
    const m = (o.payment_method as "Tunai" | "Transfer" | "QRIS") || "Tunai";
    if (paymentMethodsData[m]) {
      paymentMethodsData[m].revenue += o.total;
      paymentMethodsData[m].orderCount += 1;
    }
  }

  const totalPayRevenue = customRevenue || 1;
  const paymentMethods = (["Tunai", "Transfer", "QRIS"] as const).map((method) => ({
    method,
    revenue: paymentMethodsData[method].revenue,
    orderCount: paymentMethodsData[method].orderCount,
    percentage: Math.round((paymentMethodsData[method].revenue / totalPayRevenue) * 1000) / 10,
  }));

  // --- 8. LAYANAN TERLARIS & KOMPOSISI LAYANAN (pada rentang custom) ---
  const serviceStatsMap = new Map<
    string,
    { serviceName: string; unit: string; orderCount: number; totalQuantity: number; revenue: number }
  >();

  for (const o of customRevenueOrders) {
    const orderItems = itemsByOrder.get(o.order_id) || [];
    for (const it of orderItems) {
      const key = it.service_name;
      const cur = serviceStatsMap.get(key) || {
        serviceName: it.service_name,
        unit: it.unit,
        orderCount: 0,
        totalQuantity: 0,
        revenue: 0,
      };
      cur.orderCount += 1;
      cur.totalQuantity += it.quantity;
      cur.revenue += it.line_total;
      serviceStatsMap.set(key, cur);
    }
  }

  const allTopServices = Array.from(serviceStatsMap.values()).map((svc) => ({
    ...svc,
    percentage: customRevenue > 0 ? Math.round((svc.revenue / customRevenue) * 1000) / 10 : 0,
  }));

  // Urutkan default menurut omset terbanyak
  const topServices = [...allTopServices].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  const serviceComposition = allTopServices
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6)
    .map((s) => ({
      name: s.serviceName,
      revenue: s.revenue,
      percentage: s.percentage,
    }));

  // --- 9. GRAFIK HARIAN (Sesuai rentang filter, setiap hari ada nilai 0 jika tanpa transaksi) ---
  const daysInInterval = eachDayOfInterval({
    start: filterInterval.start,
    end: filterInterval.end,
  });

  const dailyMap = new Map<string, { revenue: number; orderCount: number }>();
  for (const d of daysInInterval) {
    const key = format(d, "yyyy-MM-dd");
    dailyMap.set(key, { revenue: 0, orderCount: 0 });
  }

  for (const o of customRevenueOrders) {
    const d = toZonedTime(parseISO(o.created_at), TIMEZONE);
    const key = format(d, "yyyy-MM-dd");
    const cur = dailyMap.get(key);
    if (cur) {
      cur.revenue += o.total;
      cur.orderCount += 1;
    }
  }

  const dailyChart = Array.from(dailyMap.entries()).map(([date, val]) => ({
    date,
    displayDate: format(parseISO(date), "dd/MM"),
    revenue: val.revenue,
    orderCount: val.orderCount,
  }));

  // --- 10. REKAP & GRAFIK 12 BULAN TERAKHIR ---
  const monthlyRecapMap = new Map<
    string,
    { monthKey: string; displayMonth: string; revenue: number; orderCount: number; totalKg: number }
  >();

  // Inisialisasi 12 bulan terakhir
  for (let i = 11; i >= 0; i--) {
    const m = subMonths(zonedNow, i);
    const key = format(m, "yyyy-MM");
    monthlyRecapMap.set(key, {
      monthKey: key,
      displayMonth: format(m, "MMM yyyy"),
      revenue: 0,
      orderCount: 0,
      totalKg: 0,
    });
  }

  for (const o of revenueOrders) {
    const d = toZonedTime(parseISO(o.created_at), TIMEZONE);
    const key = format(d, "yyyy-MM");
    const cur = monthlyRecapMap.get(key);
    if (cur) {
      cur.revenue += o.total;
      cur.orderCount += 1;
    }
  }

  for (const o of nonCancelledOrders) {
    const d = toZonedTime(parseISO(o.created_at), TIMEZONE);
    const key = format(d, "yyyy-MM");
    const cur = monthlyRecapMap.get(key);
    if (cur) {
      const orderItems = itemsByOrder.get(o.order_id) || [];
      for (const it of orderItems) {
        if (it.unit === "kg") cur.totalKg += it.quantity;
      }
    }
  }

  const monthlyList = Array.from(monthlyRecapMap.values());
  const monthlyChart = monthlyList.map((m) => ({
    ...m,
    totalKg: Math.round(m.totalKg * 100) / 100,
  }));

  // Bentuk tabel rekap bulanan (terbaru di atas) dengan perbandingan selisih ke bulan sebelumnya
  const monthlyRecap = [];
  for (let i = monthlyList.length - 1; i >= 0; i--) {
    const current = monthlyList[i];
    const prev = i > 0 ? monthlyList[i - 1] : null;

    let diffRevenue = 0;
    let percentChange: number | string = "-";

    if (prev) {
      diffRevenue = current.revenue - prev.revenue;
      percentChange = calcPercentChange(current.revenue, prev.revenue);
    }

    const averageOrderValue = current.orderCount > 0 ? Math.round(current.revenue / current.orderCount) : 0;

    monthlyRecap.push({
      monthKey: current.monthKey,
      displayMonth: current.displayMonth,
      revenue: current.revenue,
      diffRevenue,
      percentChange,
      totalKg: Math.round(current.totalKg * 100) / 100,
      orderCount: current.orderCount,
      averageOrderValue,
    });
  }

  // --- 11. 10 PESANAN TERBARU ---
  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10);

  return {
    summary: {
      today: {
        revenue: todayRevenue,
        orderCount: todayOrders.length,
        diffRevenue: todayDiff,
        percentChange: todayPercent,
      },
      monthToDate: {
        revenue: thisMonthRevenue,
        orderCount: thisMonthOrdersCount,
        diffRevenue: monthDiffRevenue,
        percentChange: monthPercentChange,
        lastMonthFull: lastMonthFullRevenue,
      },
      last3Months: {
        revenue: last3MonthsRevenue,
        orderCount: last3MonthsCount,
        diffRevenue: last3MonthsDiff,
        percentChange: last3MonthsPercent,
      },
      custom: {
        revenue: customRevenue,
        orderCount: customOrderCount,
        diffRevenue: customDiffRevenue,
        percentChange: customPercentChange,
        from: format(filterInterval.start, "yyyy-MM-dd"),
        to: format(filterInterval.end, "yyyy-MM-dd"),
      },
      totalReceivables,
      uncompletedOrders,
      cashToday,
      totalKg: {
        today: Math.round(todayKg * 100) / 100,
        monthToDate: Math.round(thisMonthKg * 100) / 100,
        monthDiffKg,
        monthPercentChange: monthKgPercentChange,
        custom: Math.round(customKg * 100) / 100,
      },
      unitPiecesCustom: customUnitPieces,
    },
    attention: {
      overdueOrders,
      unclaimedOrders,
    },
    paymentMethods,
    topServices,
    dailyChart,
    monthlyChart,
    serviceComposition,
    monthlyRecap,
    recentOrders,
  };
}
