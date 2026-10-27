"use client";

import { useState } from "react";
import useSWR from "swr";
import type { Service } from "@/lib/sheets";
import {
  Plus,
  Pencil,
  X,
  Loader2,
  Search,
} from "lucide-react";

type ServiceForm = Omit<Service, "service_id">;

const emptyForm: ServiceForm = {
  name: "",
  unit: "kg",
  price: 0,
  duration_hours: 48,
  active: true,
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Gagal mengambil layanan.");
  return res.json();
};

const rupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

export default function ServicesClient({
  initialServices,
}: {
  initialServices: Service[];
}) {
  const { data, mutate, error } = useSWR<{
    ok: boolean;
    services: Service[];
  }>("/api/services", fetcher, {
    fallbackData: { ok: true, services: initialServices },
    refreshInterval: 60000,
  });

  const services = data?.services ?? [];
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState<ServiceForm>(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");

  const filtered = services.filter((service) =>
    service.name.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (service: Service) => {
    setEditing(service);
    setForm({
      name: service.name,
      unit: service.unit,
      price: service.price,
      duration_hours: service.duration_hours,
      active: service.active,
    });
    setFormError("");
    setModalOpen(true);
  };

  const request = async (
    method: "POST" | "PATCH",
    payload: object
  ) => {
    const res = await fetch("/api/services", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result.error || "Gagal menyimpan layanan.");
    }

    return result;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (saving) return;

    setFormError("");
    setMessage("");

    if (!form.name.trim()) {
      setFormError("Nama layanan wajib diisi.");
      return;
    }

    if (
      !Number.isFinite(form.price) ||
      form.price < 0 ||
      !Number.isInteger(form.duration_hours) ||
      form.duration_hours < 1
    ) {
      setFormError("Harga atau durasi tidak valid.");
      return;
    }

    setSaving(true);

    try {
      await request(editing ? "PATCH" : "POST", {
        ...(editing ? { service_id: editing.service_id } : {}),
        ...form,
        name: form.name.trim(),
      });

      await mutate();
      setModalOpen(false);
      setMessage("Layanan berhasil disimpan.");
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Terjadi kesalahan."
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (service: Service) => {
    if (saving) return;

    setSaving(true);
    setMessage("");

    try {
      await request("PATCH", {
        service_id: service.service_id,
        active: !service.active,
      });

      await mutate();
      setMessage("Status layanan berhasil diperbarui.");
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Gagal mengubah status."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Kelola Layanan
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Atur jenis layanan, harga, dan estimasi pengerjaan.
          </p>
        </div>

        <button
          onClick={openCreate}
          className="flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-white font-medium hover:bg-sky-700"
        >
          <Plus size={18} />
          Tambah Layanan
        </button>
      </div>

      {message && (
        <div role="status" className="rounded-xl bg-sky-50 border border-sky-200 p-3 text-sm text-sky-800">
          {message}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="relative mb-5">
          <Search
            size={18}
            className="absolute left-3 top-3 text-slate-400"
          />
          <input
            type="text"
            placeholder="Cari layanan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 outline-none focus:border-sky-500"
          />
        </div>

        {error && (
          <p role="alert" className="text-red-600 mb-4">
            Gagal memuat daftar layanan.
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-slate-600">
              <tr>
                <th className="p-3">Layanan</th>
                <th className="p-3">Satuan</th>
                <th className="p-3">Harga</th>
                <th className="p-3">Durasi</th>
                <th className="p-3">Status</th>
                <th className="p-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((service) => (
                <tr
                  key={service.service_id}
                  className="border-b border-slate-100"
                >
                  <td className="p-3 font-medium">
                    {service.name}
                  </td>
                  <td className="p-3">{service.unit}</td>
                  <td className="p-3">
                    {rupiah(service.price)}
                  </td>
                  <td className="p-3">
                    {service.duration_hours} jam
                  </td>
                  <td className="p-3">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => toggleActive(service)}
                      className={`rounded-full px-3 py-1 text-xs font-medium disabled:opacity-50 ${
                        service.active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {service.active ? "Aktif" : "Nonaktif"}
                    </button>
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => openEdit(service)}
                      className="inline-flex items-center gap-1 text-sky-700 hover:text-sky-900"
                    >
                      <Pencil size={15} />
                      Ubah
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && !error && (
            <p className="py-8 text-center text-slate-500">
              Tidak ada layanan ditemukan.
            </p>
          )}
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="service-modal-title"
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 id="service-modal-title" className="text-xl font-bold">
                {editing ? "Ubah Layanan" : "Tambah Layanan"}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                aria-label="Tutup"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block text-sm font-medium">
                Nama Layanan
                <input
                  required
                  maxLength={60}
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border p-3"
                />
              </label>

              <label className="block text-sm font-medium">
                Satuan
                <select
                  value={form.unit}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      unit: e.target.value as Service["unit"],
                    })
                  }
                  className="mt-1 w-full rounded-xl border p-3"
                >
                  <option value="kg">Kilogram (kg)</option>
                  <option value="pcs">Pcs</option>
                  <option value="pasang">Pasang</option>
                </select>
              </label>

              <label className="block text-sm font-medium">
                Harga (Rp)
                <input
                  required
                  type="number"
                  min={0}
                  step={1}
                  value={form.price}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      price: Number(e.target.value),
                    })
                  }
                  className="mt-1 w-full rounded-xl border p-3"
                />
              </label>

              <label className="block text-sm font-medium">
                Estimasi Durasi (Jam)
                <input
                  required
                  type="number"
                  min={1}
                  step={1}
                  value={form.duration_hours}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      duration_hours: Number(e.target.value),
                    })
                  }
                  className="mt-1 w-full rounded-xl border p-3"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                {[1, 6, 24, 48, 72].map((hours) => (
                  <button
                    key={hours}
                    type="button"
                    onClick={() =>
                      setForm({ ...form, duration_hours: hours })
                    }
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      form.duration_hours === hours
                        ? "bg-sky-100 border-sky-500 text-sky-700"
                        : "border-slate-200"
                    }`}
                  >
                    {hours} jam
                  </button>
                ))}
              </div>

              <p className="text-sm text-slate-500">
                {form.duration_hours} jam ={" "}
                {(form.duration_hours / 24).toLocaleString("id-ID", {
                  maximumFractionDigits: 2,
                })}{" "}
                hari
              </p>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) =>
                    setForm({ ...form, active: e.target.checked })
                  }
                />
                Layanan Aktif
              </label>

              {formError && (
                <p role="alert" className="text-sm text-red-600">
                  {formError}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border px-4 py-2"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2 text-white disabled:opacity-50"
                >
                  {saving && (
                    <Loader2 size={16} className="animate-spin" />
                  )}
                  {saving ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}