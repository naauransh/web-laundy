import { NextRequest, NextResponse } from "next/server";
import { getServices, saveService, isServiceUsedInOrders, Service } from "@/lib/sheets";
import { getSession } from "@/lib/session";
import { z } from "zod";

const createServiceSchema = z.object({
  name: z.string().min(1, "Nama layanan wajib diisi").max(60, "Maksimal 60 karakter"),
  unit: z.enum(["kg", "pcs", "pasang"]),
  price: z.number().min(0, "Harga harus 0 atau lebih"),
  duration_hours: z.number().int().min(1, "Estimasi durasi minimal 1 jam"),
  active: z.boolean().default(true),
});

const updateServiceSchema = z.object({
  service_id: z.string().min(1, "ID layanan wajib disertakan"),
  name: z.string().min(1).max(60).optional(),
  unit: z.enum(["kg", "pcs", "pasang"]).optional(),
  price: z.number().min(0).optional(),
  duration_hours: z.number().int().min(1).optional(),
  active: z.boolean().optional(),
});

// GET /api/services
export async function GET() {
  try {
    const services = await getServices();
    return NextResponse.json({
      ok: true,
      services,
    });
  } catch (error) {
    console.error("GET /api/services error:", error);
    return NextResponse.json({ error: "Gagal memuat daftar layanan." }, { status: 500 });
  }
}

// POST /api/services (Admin Only)
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json(
        { error: "Akses ditolak. Hanya Admin yang berhak menambah layanan baru." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = createServiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data layanan tidak valid." },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const services = await getServices();

    // Cek duplikasi nama layanan (case-insensitive)
    const duplicate = services.some(
      (s) => s.name.trim().toLowerCase() === data.name.trim().toLowerCase()
    );
    if (duplicate) {
      return NextResponse.json(
        { error: `Layanan dengan nama "${data.name}" sudah ada. Gunakan nama yang berbeda.` },
        { status: 400 }
      );
    }

    // Buat service_id baru: format SVC-NNN
    let maxId = 0;
    for (const s of services) {
      if (s.service_id.startsWith("SVC-")) {
        const num = parseInt(s.service_id.replace("SVC-", ""), 10);
        if (!isNaN(num) && num > maxId) maxId = num;
      }
    }
    const newId = `SVC-${String(maxId + 1).padStart(3, "0")}`;

    const newService: Service = {
      service_id: newId,
      name: data.name.trim(),
      unit: data.unit,
      price: data.price,
      duration_hours: data.duration_hours,
      active: data.active,
    };

    await saveService(newService, true);

    return NextResponse.json({
      ok: true,
      message: "Layanan baru berhasil ditambahkan.",
      service: newService,
    });
  } catch (error) {
    console.error("POST /api/services error:", error);
    return NextResponse.json(
      { error: "Gagal menyimpan layanan ke Google Sheets." },
      { status: 500 }
    );
  }
}

// PATCH /api/services (Admin Only)
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json(
        { error: "Akses ditolak. Hanya Admin yang berhak mengubah layanan." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = updateServiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data layanan tidak valid." },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const services = await getServices();
    const existing = services.find((s) => s.service_id === data.service_id);

    if (!existing) {
      return NextResponse.json({ error: "Layanan tidak ditemukan." }, { status: 404 });
    }

    // Jika nama diubah, pastikan tidak kembar dengan layanan lain
    if (data.name && data.name.trim().toLowerCase() !== existing.name.trim().toLowerCase()) {
      const duplicate = services.some(
        (s) =>
          s.service_id !== data.service_id &&
          s.name.trim().toLowerCase() === data.name!.trim().toLowerCase()
      );
      if (duplicate) {
        return NextResponse.json(
          { error: `Layanan dengan nama "${data.name}" sudah ada.` },
          { status: 400 }
        );
      }
    }

    // PRD: Satuan tidak boleh diubah jika layanan sudah pernah dipakai di pesanan
    if (data.unit && data.unit !== existing.unit) {
      const used = await isServiceUsedInOrders(existing.name);
      if (used) {
        return NextResponse.json(
          {
            error:
              "Satuan tidak boleh diubah karena layanan ini sudah pernah dipakai di pesanan sebelumnya. Buat layanan baru jika butuh satuan berbeda.",
          },
          { status: 400 }
        );
      }
    }

    const updatedService: Service = {
      service_id: existing.service_id,
      name: data.name ? data.name.trim() : existing.name,
      unit: data.unit || existing.unit,
      price: data.price !== undefined ? data.price : existing.price,
      duration_hours: data.duration_hours !== undefined ? data.duration_hours : existing.duration_hours,
      active: data.active !== undefined ? data.active : existing.active,
    };

    await saveService(updatedService, false);

    return NextResponse.json({
      ok: true,
      message: "Layanan berhasil diperbarui.",
      service: updatedService,
    });
  } catch (error) {
    console.error("PATCH /api/services error:", error);
    return NextResponse.json(
      { error: "Gagal memperbarui layanan di Google Sheets." },
      { status: 500 }
    );
  }
}
