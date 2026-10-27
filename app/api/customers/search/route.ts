import { NextRequest, NextResponse } from "next/server";
import { getOrdersAndItems } from "@/lib/sheets";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("q") || "").toLowerCase().trim();

    if (!query) {
      return NextResponse.json({ ok: true, customers: [] });
    }

    const { orders } = await getOrdersAndItems();

    // Map unique customers by normalized phone
    const customersMap = new Map<
      string,
      {
        name: string;
        phone: string;
        address: string;
        lastOrderAt: string;
      }
    >();

    for (const order of orders) {
      if (!order.customer_name && !order.customer_phone) continue;

      const nameMatch = order.customer_name.toLowerCase().includes(query);
      const phoneMatch = order.customer_phone.includes(query);

      if (nameMatch || phoneMatch) {
        const key = order.customer_phone || order.customer_name.toLowerCase();
        const existing = customersMap.get(key);

        if (
          !existing ||
          new Date(order.created_at).getTime() > new Date(existing.lastOrderAt).getTime()
        ) {
          customersMap.set(key, {
            name: order.customer_name,
            phone: order.customer_phone,
            address: order.customer_address || "",
            lastOrderAt: order.created_at,
          });
        }
      }
    }

    const customers = Array.from(customersMap.values())
      .sort((a, b) => new Date(b.lastOrderAt).getTime() - new Date(a.lastOrderAt).getTime())
      .slice(0, 10); // Ambil 10 teratas

    return NextResponse.json({
      ok: true,
      customers,
    });
  } catch (error) {
    console.error("GET /api/customers/search error:", error);
    return NextResponse.json(
      { error: "Gagal mencari data pelanggan." },
      { status: 500 }
    );
  }
}
