import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getOrdersAndItems,
  createOrder,
  generateNextOrderId,
  Order,
  OrderItem,
  getSettings,
} from "@/lib/sheets";
import { normalizePhoneNumber, isValidIndonesianPhone } from "@/lib/phone";
import { getSession } from "@/lib/session";

const orderItemSchema = z.object({
  service_name: z.string().min(1, "Nama layanan wajib diisi"),
  unit: z.enum(["kg", "pcs", "pasang"]),
  quantity: z.number().positive("Jumlah kuantitas harus lebih dari 0"),
  unit_price: z.number().min(0, "Harga satuan tidak boleh negatif"),
  line_total: z.number().min(0, "Subtotal baris tidak boleh negatif"),
  item_description: z.string().optional().default(""),
  piece_count: z.number().optional(),
  item_notes: z.string().optional().default(""),
});

const createOrderSchema = z.object({
  customer_name: z.string().min(1, "Nama pelanggan wajib diisi"),
  customer_phone: z.string().refine(isValidIndonesianPhone, {
    message: "Nomor WhatsApp tidak valid (format Indonesia: 08... atau 628...)",
  }),
  customer_address: z.string().optional().default(""),
  items: z.array(orderItemSchema).min(1, "Pesanan harus memiliki minimal 1 item layanan"),
  discount: z.number().min(0).default(0),
  payment_method: z.enum(["Tunai", "Transfer", "QRIS"]).default("Tunai"),
  payment_status: z.enum(["Lunas", "Belum Lunas"]).default("Lunas"),
  estimated_done: z.string().optional(),
  notes: z.string().optional().default(""),
});

// GET /api/orders
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.toLowerCase().trim();
    const status = searchParams.get("status")?.trim();
    const paymentStatus = searchParams.get("payment_status")?.trim();
    const from = searchParams.get("from")?.trim();
    const to = searchParams.get("to")?.trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "20", 10));

    const { orders, items } = await getOrdersAndItems();

    // Map items to orders
    const itemsByOrderId = new Map<string, OrderItem[]>();
    for (const item of items) {
      const list = itemsByOrderId.get(item.order_id) || [];
      list.push(item);
      itemsByOrderId.set(item.order_id, list);
    }

    // Filter orders
    let filtered = orders.filter((order) => {
      // Search
      if (search) {
        const matchesName = order.customer_name.toLowerCase().includes(search);
        const matchesPhone = order.customer_phone.includes(search);
        const matchesId = order.order_id.toLowerCase().includes(search);
        if (!matchesName && !matchesPhone && !matchesId) return false;
      }

      // Status pesanan
      if (status && order.order_status !== status) {
        return false;
      }

      // Status pembayaran
      if (paymentStatus && order.payment_status !== paymentStatus) {
        return false;
      }

      // Rentang tanggal (created_at)
      if (from) {
        const orderDate = new Date(order.created_at).getTime();
        const fromDate = new Date(from).getTime();
        if (orderDate < fromDate) return false;
      }
      if (to) {
        const orderDate = new Date(order.created_at).getTime();
        // Set sampai akhir hari 'to' (23:59:59.999)
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        if (orderDate > toDate.getTime()) return false;
      }

      return true;
    });

    // Urutkan terbaru di atas (created_at descending)
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedOrders = filtered.slice(startIndex, startIndex + limit).map((order) => ({
      ...order,
      items: itemsByOrderId.get(order.order_id) || [],
    }));

    return NextResponse.json({
      ok: true,
      orders: paginatedOrders,
      total,
      page,
      totalPages,
      limit,
    });
  } catch (error) {
    console.error("GET /api/orders error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil daftar pesanan." },
      { status: 500 }
    );
  }
}

// POST /api/orders
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Harus login terlebih dahulu." }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Input pesanan tidak valid." },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const normalizedPhone = normalizePhoneNumber(data.customer_phone);

    // Hitung subtotal dan total
    let calculatedSubtotal = 0;
    const orderItems: OrderItem[] = [];

    const orderId = await generateNextOrderId();
    const nowIso = new Date().toISOString();

    for (const item of data.items) {
      // Perhitungan subtotal per item: gram * harga / 1000 untuk kg
      let lineTotal = item.line_total;
      if (item.unit === "kg") {
        const grams = Math.round(item.quantity * 1000);
        lineTotal = Math.round((grams * item.unit_price) / 1000);
      } else {
        lineTotal = Math.round(item.quantity * item.unit_price);
      }

      calculatedSubtotal += lineTotal;

      orderItems.push({
        order_id: orderId,
        service_name: item.service_name,
        unit: item.unit,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: lineTotal,
        item_description: item.item_description,
        piece_count: item.piece_count,
        item_notes: item.item_notes,
      });
    }

    const settings = await getSettings();
    const priceRounding = settings.price_rounding || 100;

    // Pembulatan ke rupiah terdekat jika diatur
    let finalTotal = Math.max(0, calculatedSubtotal - data.discount);
    if (priceRounding > 0) {
      finalTotal = Math.round(finalTotal / priceRounding) * priceRounding;
    }

    // Estimasi selesai default jika belum disetel (48 jam dari sekarang)
    const estimatedDone =
      data.estimated_done ||
      new Date(Date.now() + 48 * 3600 * 1000).toISOString();

    const newOrder: Order = {
      order_id: orderId,
      created_at: nowIso,
      customer_name: data.customer_name.trim(),
      customer_phone: normalizedPhone,
      customer_address: (data.customer_address || "").trim(),
      subtotal: calculatedSubtotal,
      discount: data.discount,
      total: finalTotal,
      payment_method: data.payment_method,
      payment_status: data.payment_status,
      order_status: "Diterima",
      estimated_done: estimatedDone,
      notes: (data.notes || "").trim(),
      updated_at: nowIso,
    };

    await createOrder(newOrder, orderItems);

    return NextResponse.json({
      ok: true,
      message: "Pesanan berhasil disimpan.",
      order: newOrder,
      items: orderItems,
    });
  } catch (error) {
    console.error("POST /api/orders error:", error);
    return NextResponse.json(
      { error: "Gagal menyimpan pesanan ke Google Sheets. Silakan coba lagi." },
      { status: 500 }
    );
  }
}
