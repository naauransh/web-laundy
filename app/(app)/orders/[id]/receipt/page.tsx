import { notFound } from "next/navigation";
import { getOrdersAndItems, getSettings } from "@/lib/sheets";
import ReceiptView from "@/components/ReceiptView";

export const dynamic = "force-dynamic";

interface ReceiptPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function OrderReceiptPage({ params }: ReceiptPageProps) {
  const { id } = await params;

  const [{ orders, items }, settings] = await Promise.all([
    getOrdersAndItems(),
    getSettings(),
  ]);

  const order = orders.find((o) => o.order_id === id);
  if (!order) {
    notFound();
  }

  const orderItems = items.filter((it) => it.order_id === id);

  return <ReceiptView order={order} items={orderItems} settings={settings} />;
}
