import { NextRequest, NextResponse } from "next/server";
import { getOrdersAndItems, updateOrder, updateOrderItems, OrderItem } from "@/lib/sheets";
import { getSession } from "@/lib/session";
import { z } from "zod";

const updateOrderSchema = z.object({
  payment_status: z.enum(["Lunas", "Belum Lunas"]).optional(),
  order_status: z.enum(["Diterima", "Diproses", "Selesai", "Diambil", "Dibatalkan"]).optional(),
  customer_name: z.string().min(1).optional(),
  customer_phone: z.string().optional(),
  customer_address: z.string().optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        order_id: z.string(),
        service_name: z.string(),
        unit: z.enum(["kg", "pcs", "pasang"]),
        quantity: z.number(),
        unit_price: z.number(),
        line_total: z.number(),
        item_description: z.string().optional(),
        piece_count: z.number().optional(),
        item_notes: z.string().optional(),
      })
    )
    .optional(),
});

// GET /api/orders/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { orders, items } = await getOrdersAndItems();

    const order = orders.find((o) => o.order_id === id);
    if (!order) {
      return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });
    }

    const orderItems = items.filter((it) => it.order_id === id);

    return NextResponse.json({
      ok: true,
      order,
      items: orderItems,
    });
  } catch (error) {
    console.error("GET /api/orders/[id] error:", error);
    return NextResponse.json({ error: "Gagal mengambil data pesanan." }, { status: 500 });
  }
}

// PATCH /api/orders/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Harus login terlebih dahulu." }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = updateOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data update tidak valid." },
        { status: 400 }
      );
    }

    const { orders, items: allItems } = await getOrdersAndItems();
    const existingOrder = orders.find((o) => o.order_id === id);

    if (!existingOrder) {
      return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });
    }

    const data = parsed.data;

    // PRD: Membatalkan pesanan HANYA BISA dilakukan Admin
    if (data.order_status === "Dibatalkan" && session.role !== "admin") {
      return NextResponse.json(
        { error: "Akses ditolak. Hanya Admin (Pemilik) yang berhak membatalkan pesanan." },
        { status: 403 }
      );
    }

    // PRD: Kasir dan Admin boleh mengubah isi cucian dan catatan selama pesanan belum berstatus Selesai atau Diambil
    if (data.items || (data.notes !== undefined && data.notes !== existingOrder.notes)) {
      if (existingOrder.order_status === "Selesai" || existingOrder.order_status === "Diambil") {
        return NextResponse.json(
          { error: "Isi cucian dan catatan tidak dapat diubah setelah pesanan Selesai atau Diambil." },
          { status: 400 }
        );
      }
    }

    // Lakukan update order header
    const orderUpdates: Partial<typeof existingOrder> = {};
    if (data.order_status) orderUpdates.order_status = data.order_status;
    if (data.payment_status) orderUpdates.payment_status = data.payment_status;
    if (data.customer_name) orderUpdates.customer_name = data.customer_name;
    if (data.customer_phone) orderUpdates.customer_phone = data.customer_phone;
    if (data.customer_address !== undefined) orderUpdates.customer_address = data.customer_address;
    if (data.notes !== undefined) orderUpdates.notes = data.notes;

    await updateOrder(id, orderUpdates);

    // Lakukan update items jika ada
    if (data.items) {
      await updateOrderItems(id, data.items as OrderItem[]);
    }

    // Ambil data terbaru
    const { orders: updatedOrders, items: updatedAllItems } = await getOrdersAndItems();
    const updatedOrder = updatedOrders.find((o) => o.order_id === id);
    const updatedItems = updatedAllItems.filter((it) => it.order_id === id);

    return NextResponse.json({
      ok: true,
      message: "Pesanan berhasil diperbarui.",
      order: updatedOrder,
      items: updatedItems,
    });
  } catch (error) {
    console.error("PATCH /api/orders/[id] error:", error);
    return NextResponse.json(
      { error: "Gagal memperbarui pesanan. Silakan coba lagi." },
      { status: 500 }
    );
  }
}
