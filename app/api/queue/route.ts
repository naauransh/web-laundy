import { NextRequest, NextResponse } from "next/server";
import { getOrdersAndItems, getSettings, OrderItem } from "@/lib/sheets";

// GET /api/queue
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.toLowerCase().trim();
    const filter = searchParams.get("filter")?.toLowerCase().trim(); // 'telat' | 'belum-diambil'

    const [{ orders, items }, settings] = await Promise.all([
      getOrdersAndItems(),
      getSettings(),
    ]);

    // Map items per order
    const itemsByOrderId = new Map<string, OrderItem[]>();
    for (const item of items) {
      const list = itemsByOrderId.get(item.order_id) || [];
      list.push(item);
      itemsByOrderId.set(item.order_id, list);
    }

    // Filter yang tidak Dibatalkan
    const validOrders = orders.filter((o) => o.order_status !== "Dibatalkan");
    const now = Date.now();
    const warningDays = settings.pickup_warning_days || 3;
    const warningThreshold = now - warningDays * 24 * 3600 * 1000;

    // Filter khusus: telat atau belum-diambil
    let filteredOrders = validOrders.filter((o) => {
      if (filter === "telat") {
        const isNotDone = o.order_status === "Diterima" || o.order_status === "Diproses";
        const isPastEstimated = o.estimated_done && new Date(o.estimated_done).getTime() < now;
        return isNotDone && isPastEstimated;
      }
      if (filter === "belum-diambil") {
        const isDone = o.order_status === "Selesai" && !o.picked_up_at;
        const doneTime = o.done_at ? new Date(o.done_at).getTime() : new Date(o.updated_at).getTime();
        return isDone && doneTime < warningThreshold;
      }
      return true;
    });

    // Filter search jika ada
    if (search) {
      filteredOrders = filteredOrders.filter(
        (o) =>
          o.customer_name.toLowerCase().includes(search) ||
          o.customer_phone.includes(search) ||
          o.order_id.toLowerCase().includes(search)
      );
    }

    // 1. Antrian: pesanan yang belum diambil (Diterima, Diproses, Selesai)
    // Sesuai PRD: yang paling lama masuk di atas (created_at ASCENDING)
    const queue = filteredOrders
      .filter((o) => o.order_status !== "Diambil")
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((o) => ({
        ...o,
        items: itemsByOrderId.get(o.order_id) || [],
      }));

    // 2. Riwayat: pesanan yang sudah diambil
    // Terbaru di atas (picked_up_at / created_at DESCENDING)
    const history = filteredOrders
      .filter((o) => o.order_status === "Diambil")
      .sort(
        (a, b) =>
          new Date(b.picked_up_at || b.created_at).getTime() -
          new Date(a.picked_up_at || a.created_at).getTime()
      )
      .map((o) => ({
        ...o,
        items: itemsByOrderId.get(o.order_id) || [],
      }));

    return NextResponse.json({
      ok: true,
      queue,
      history,
      totalQueue: queue.length,
      totalHistory: history.length,
    });
  } catch (error) {
    console.error("GET /api/queue error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data antrian cucian." },
      { status: 500 }
    );
  }
}
