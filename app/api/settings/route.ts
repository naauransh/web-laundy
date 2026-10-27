import { NextRequest, NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/sheets";
import { getSession } from "@/lib/session";
import { z } from "zod";

const settingsSchema = z.object({
  business_name: z.string().min(1, "Nama usaha tidak boleh kosong").optional(),
  business_address: z.string().optional(),
  business_phone: z.string().optional(),
  receipt_footer: z.string().optional(),
  pickup_warning_days: z.number().int().min(1, "Batas hari minimal 1 hari").optional(),
  price_rounding: z.number().int().min(0, "Pembulatan minimal 0 (0 = tanpa pembulatan)").optional(),
  note_presets: z.string().optional(),
});

// GET /api/settings
export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json({
      ok: true,
      settings,
    });
  } catch (error) {
    console.error("GET /api/settings error:", error);
    return NextResponse.json({ error: "Gagal memuat pengaturan usaha." }, { status: 500 });
  }
}

// PATCH /api/settings (Admin Only)
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json(
        { error: "Akses ditolak. Hanya Admin yang berhak mengubah pengaturan." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data pengaturan tidak valid." },
        { status: 400 }
      );
    }

    await saveSettings(parsed.data);
    const updatedSettings = await getSettings();

    return NextResponse.json({
      ok: true,
      message: "Pengaturan berhasil diperbarui.",
      settings: updatedSettings,
    });
  } catch (error) {
    console.error("PATCH /api/settings error:", error);
    return NextResponse.json(
      { error: "Gagal memperbarui pengaturan di Google Sheets." },
      { status: 500 }
    );
  }
}
