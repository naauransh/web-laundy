import { NextRequest, NextResponse } from "next/server";
import { getOrdersAndItems, updateOrder } from "@/lib/sheets";
import { getSession } from "@/lib/session";
import { z } from "zod";

const checklistSchema = z.object({
  step: z.enum(["done", "picked_up"]),
  checked: z.boolean(),
});

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
    const parsed = checklistSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Input checklist tidak valid." },
        { status: 400 }
      );
    }

    const { step, checked } = parsed.data;
    const { orders } = await getOrdersAndItems();
    const order = orders.find((o) => o.order_id === id);

    if (!order) {
      return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });
    }

    if (order.order_status === "Dibatalkan") {
      return NextResponse.json(
        { error: "Pesanan yang dibatalkan tidak dapat diubah status checklist-nya." },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    const updates: Partial<typeof order> = {};

    if (step === "done") {
      if (checked) {
        updates.done_at = nowIso;
        updates.done_by = session.role;
        // Hanya ubah ke Selesai jika belum Diambil
        if (order.order_status !== "Diambil") {
          updates.order_status = "Selesai";
        }
      } else {
        // Jika uncheck done, pastikan belum diambil
        if (order.picked_up_at || order.order_status === "Diambil") {
          return NextResponse.json(
            { error: "Batal centang 'Sudah diambil' terlebih dahulu sebelum membatalkan 'Selesai dicuci'." },
            { status: 400 }
          );
        }
        updates.done_at = "";
        updates.done_by = undefined;
        updates.order_status = "Diproses";
      }
    } else if (step === "picked_up") {
      if (checked) {
        // PRD: "Sudah diambil" baru bisa dicentang setelah "Selesai dicuci"
        if (!order.done_at && !updates.done_at) {
          return NextResponse.json(
            { error: "Cucian harus ditandai 'Selesai dicuci' terlebih dahulu sebelum 'Sudah diambil'." },
            { status: 400 }
          );
        }
        updates.picked_up_at = nowIso;
        updates.picked_up_by = session.role;
        updates.order_status = "Diambil";
      } else {
        updates.picked_up_at = "";
        updates.picked_up_by = undefined;
        updates.order_status = "Selesai";
      }
    }

    await updateOrder(id, updates);

    // Dapatkan data terbaru
    const { orders: updatedOrders, items: updatedItems } = await getOrdersAndItems();
    const updated = updatedOrders.find((o) => o.order_id === id);
    const orderItems = updatedItems.filter((it) => it.order_id === id);

    return NextResponse.json({
      ok: true,
      message: "Checklist antrian berhasil diperbarui.",
      order: {
        ...updated,
        items: orderItems,
      },
    });
  } catch (error) {
    console.error("PATCH /api/orders/[id]/checklist error:", error);
    return NextResponse.json(
      { error: "Gagal memperbarui checklist antrian." },
      { status: 500 }
    );
  }
}
