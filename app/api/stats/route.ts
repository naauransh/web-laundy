import { NextRequest, NextResponse } from "next/server";
import { getOrdersAndItems, getSettings } from "@/lib/sheets";
import { computeStats } from "@/lib/stats";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Harus login terlebih dahulu." }, { status: 401 });
    }

    // PRD: Halaman ini dan API /api/stats HANYA UNTUK ADMIN
    if (session.role !== "admin") {
      return NextResponse.json(
        { error: "Akses ditolak. Hanya Admin (Pemilik) yang berhak melihat statistik dan omset." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;

    const [{ orders, items }, settings] = await Promise.all([
      getOrdersAndItems(),
      getSettings(),
    ]);

    const stats = computeStats(orders, items, settings, from, to);

    return NextResponse.json({
      ok: true,
      stats,
    });
  } catch (error) {
    console.error("GET /api/stats error:", error);
    return NextResponse.json(
      { error: "Gagal menghitung statistik keuangan." },
      { status: 500 }
    );
  }
}
