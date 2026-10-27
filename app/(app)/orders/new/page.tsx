import { getServices, getSettings } from "@/lib/sheets";
import OrderForm from "@/components/OrderForm";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  const [services, settings] = await Promise.all([
    getServices(),
    getSettings(),
  ]);

  return <OrderForm services={services} settings={settings} />;
}
