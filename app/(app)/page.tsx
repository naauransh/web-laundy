import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getOrdersAndItems, getSettings } from "@/lib/sheets";
import { computeStats } from "@/lib/stats";
import DashboardClient from "@/components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();

  // PRD Bagian 5.1 & 5.2: Dashboard dan API /api/stats HANYA UNTUK ADMIN
  if (!session || session.role !== "admin") {
    redirect("/antrian");
  }

  const [{ orders, items }, settings] = await Promise.all([
    getOrdersAndItems(),
    getSettings(),
  ]);

  const initialStats = computeStats(orders, items, settings);

  return <DashboardClient initialStats={initialStats} />;
}
