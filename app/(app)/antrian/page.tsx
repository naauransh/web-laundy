import { getSession } from "@/lib/session";
import { getOrdersAndItems, getSettings, OrderItem, Order } from "@/lib/sheets";
import QueueClient from "@/components/QueueClient";

export const dynamic = "force-dynamic";

interface AntrianPageProps {
  searchParams: Promise<{
    filter?: string;
    search?: string;
  }>;
}

interface OrderWithItems extends Order {
  items: OrderItem[];
}

export default async function AntrianPage({ searchParams }: AntrianPageProps) {
  const session = await getSession();
  const role = session?.role || "kasir";
  const params = await searchParams;
  const currentFilter = params.filter || "";

  const [{ orders, items }, settings] = await Promise.all([
    getOrdersAndItems(),
    getSettings(),
  ]);

  const itemsByOrderId = new Map<string, OrderItem[]>();
  for (const it of items) {
    const list = itemsByOrderId.get(it.order_id) || [];
    list.push(it);
    itemsByOrderId.set(it.order_id, list);
  }

  const validOrders: OrderWithItems[] = orders
    .filter((o) => o.order_status !== "Dibatalkan")
    .map((o) => ({
      ...o,
      items: itemsByOrderId.get(o.order_id) || [],
    }));

  const initialQueue = validOrders
    .filter((o) => o.order_status !== "Diambil")
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const initialHistory = validOrders
    .filter((o) => o.order_status === "Diambil")
    .sort(
      (a, b) =>
        new Date(b.picked_up_at || b.created_at).getTime() -
        new Date(a.picked_up_at || a.created_at).getTime()
    );

  return (
    <QueueClient
      initialQueue={initialQueue}
      initialHistory={initialHistory}
      role={role}
      settings={settings}
      initialFilter={currentFilter}
    />
  );
}

