
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getOrdersAndItems, getSettings } from "@/lib/sheets";
import OrdersClient from "@/components/OrdersClient";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const [{ orders, items }, settings] = await Promise.all([
    getOrdersAndItems(),
    getSettings(),
  ]);

  const itemsByOrderId = new Map<string, typeof items>();

  for (const item of items) {
    const existingItems = itemsByOrderId.get(item.order_id) || [];
    existingItems.push(item);
    itemsByOrderId.set(item.order_id, existingItems);
  }

  const sortedOrders = [...orders].sort(
    (a, b) =>
      new Date(b.created_at).getTime() -
      new Date(a.created_at).getTime()
  );

  const initialOrders = sortedOrders.slice(0, 20).map((order) => ({
    ...order,
    items: itemsByOrderId.get(order.order_id) || [],
  }));

  const total = sortedOrders.length;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <OrdersClient
      initialOrders={initialOrders}
      initialTotal={total}
      initialTotalPages={totalPages}
      role={session.role as "admin" | "kasir"}
      settings={settings}
    />
  );
}
