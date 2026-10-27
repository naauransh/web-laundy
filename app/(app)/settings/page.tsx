
"use client";

import { useEffect, useState } from "react";

type Settings = {
  business_name: string;
  business_address: string;
  business_phone: string;
  receipt_footer: string;
  pickup_warning_days: number;
  price_rounding: number;
  note_presets: string;
};

const defaultSettings: Settings = {
  business_name: "",
  business_address: "",
  business_phone: "",
  receipt_footer: "",
  pickup_warning_days: 3,
  price_rounding: 0,
  note_presets: "",
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) throw new Error("Gagal mengambil pengaturan.");

        const data = await res.json();
        setSettings({ ...defaultSettings, ...data.settings });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  function updateField<K extends keyof Settings>(
    field: K,
    value: Settings[K]
  ) {
    setSettings((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan pengaturan.");
      }

      setSettings({ ...defaultSettings, ...data.settings });
      setMessage("Pengaturan berhasil disimpan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="p-6 text-slate-500">Memuat pengaturan...</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Pengaturan
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Kelola informasi usaha dan pengaturan operasional laundry.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <section className="rounded-2xl border bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold">Informasi Usaha</h2>

          {([
            ["business_name", "Nama Laundry"],
            ["business_address", "Alamat Laundry"],
            ["business_phone", "Nomor Telepon"],
          ] as const).map(([field, label]) => (
            <label key={field} className="block text-sm font-medium">
              {label}
              <input
                type="text"
                required={field === "business_name"}
                value={settings[field]}
                onChange={(e) => updateField(field, e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 p-3"
              />
            </label>
          ))}

          <label className="block text-sm font-medium">
            Footer Struk
            <textarea
              rows={3}
              value={settings.receipt_footer}
              onChange={(e) =>
                updateField("receipt_footer", e.target.value)
              }
              className="mt-1 w-full rounded-xl border border-slate-200 p-3"
            />
          </label>
        </section>

        <section className="rounded-2xl border bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold">
            Pengaturan Operasional
          </h2>

          <label className="block text-sm font-medium">
            Peringatan Pengambilan (Hari)
            <input
              type="number"
              min={1}
              step={1}
              required
              value={settings.pickup_warning_days}
              onChange={(e) =>
                updateField("pickup_warning_days", Number(e.target.value))
              }
              className="mt-1 w-full rounded-xl border border-slate-200 p-3"
            />
          </label>

          <label className="block text-sm font-medium">
            Pembulatan Harga (Rp)
            <input
              type="number"
              min={0}
              step={1}
              required
              value={settings.price_rounding}
              onChange={(e) =>
                updateField("price_rounding", Number(e.target.value))
              }
              className="mt-1 w-full rounded-xl border border-slate-200 p-3"
            />
          </label>

          <label className="block text-sm font-medium">
            Template Catatan
            <textarea
              rows={4}
              value={settings.note_presets}
              onChange={(e) =>
                updateField("note_presets", e.target.value)
              }
              placeholder="Contoh: Pisahkan pakaian putih"
              className="mt-1 w-full rounded-xl border border-slate-200 p-3"
            />
          </label>
        </section>

        {message && (
          <p role="status" className="text-sm text-green-700">
            {message}
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving || !!error}
          className="rounded-xl bg-sky-600 px-6 py-3 font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {saving ? "Menyimpan..." : "Simpan Pengaturan"}
        </button>
      </form>
    </div>
  );
}
