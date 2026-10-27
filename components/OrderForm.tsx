"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Service, AppSettings } from "@/lib/sheets";
import { generateWhatsAppUrl } from "@/lib/receipt";
import { isValidIndonesianPhone } from "@/lib/phone";
import {
  User,
  Phone,
  MapPin,
  Plus,
  Trash2,
  Sparkles,
  Clock,
  CreditCard,
  MessageSquare,
  CheckCircle2,
  Loader2,
  Search,
  AlertCircle,
  Package,
} from "lucide-react";

interface FormOrderItem {
  id: string;
  service_name: string;
  unit: "kg" | "pcs" | "pasang";
  kg: number;
  gram: number;
  quantity: number;
  unit_price: number;
  line_total: number;
  item_description: string;
  piece_count?: number;
  item_notes: string;
}

interface OrderFormProps {
  services: Service[];
  settings: AppSettings;
}

interface CustomerSuggestion {
  name: string;
  phone: string;
  address: string;
}

export default function OrderForm({ services, settings }: OrderFormProps) {
  const router = useRouter();

  // Layanan aktif saja untuk dropdown pesanan baru
  const activeServices = useMemo(() => services.filter((s) => s.active), [services]);
  const defaultService = activeServices[0] || {
    name: "Cuci Kering Setrika Reguler",
    unit: "kg",
    price: 8000,
    duration_hours: 48,
  };

  // State Pelanggan
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<CustomerSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // State Item Layanan
  const [items, setItems] = useState<FormOrderItem[]>([
    {
      id: "item-1",
      service_name: defaultService.name,
      unit: defaultService.unit,
      kg: defaultService.unit === "kg" ? 1 : 0,
      gram: 0,
      quantity: 1,
      unit_price: defaultService.price,
      line_total: defaultService.price,
      item_description: "",
      item_notes: "",
    },
  ]);

  // State Pembayaran & Waktu
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<"Tunai" | "Transfer" | "QRIS">("Tunai");
  const [paymentStatus, setPaymentStatus] = useState<"Lunas" | "Belum Lunas">("Lunas");
  const [estimatedDone, setEstimatedDone] = useState<string>("");
  const [isEstimatedManual, setIsEstimatedManual] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>("");

  // Form submit state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Preset catatan dari settings
  const notePresets = useMemo(() => {
    if (!settings.note_presets) return [];
    return settings.note_presets.split(",").map((p) => p.trim()).filter(Boolean);
  }, [settings.note_presets]);

  // Hitung durasi terlama dari layanan yang dipilih dan set estimasi selesai default
  useEffect(() => {
    if (isEstimatedManual) return;

    let maxHours = 24;
    for (const item of items) {
      const match = services.find((s) => s.name === item.service_name);
      if (match && match.duration_hours > maxHours) {
        maxHours = match.duration_hours;
      }
    }

    const targetDate = new Date(Date.now() + maxHours * 3600 * 1000);
    // Format to YYYY-MM-DDTHH:mm for datetime-local
    const pad = (n: number) => String(n).padStart(2, "0");
    const formatted = `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}-${pad(
      targetDate.getDate()
    )}T${pad(targetDate.getHours())}:${pad(targetDate.getMinutes())}`;

    setEstimatedDone(formatted);
  }, [items, services, isEstimatedManual]);

  // Autocomplete debounced search
  const handleCustomerQueryChange = (val: string, field: "name" | "phone") => {
    if (field === "name") setCustomerName(val);
    else setCustomerPhone(val);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (val.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        setIsSearchingCustomer(true);
        const res = await fetch(`/api/customers/search?q=${encodeURIComponent(val.trim())}`);
        const data = await res.json();
        if (data.ok && Array.isArray(data.customers)) {
          setSuggestions(data.customers);
          setShowSuggestions(data.customers.length > 0);
        }
      } catch (err) {
        console.error("Search customer error:", err);
      } finally {
        setIsSearchingCustomer(false);
      }
    }, 250);
  };

  const handleSelectCustomer = (c: CustomerSuggestion) => {
    setCustomerName(c.name);
    setCustomerPhone(c.phone);
    if (c.address) setCustomerAddress(c.address);
    setShowSuggestions(false);
  };

  // Item helpers
  const handleServiceChange = (idx: number, serviceName: string) => {
    const selected = services.find((s) => s.name === serviceName);
    if (!selected) return;

    setItems((prev) => {
      const updated = [...prev];
      const cur = updated[idx];
      const unit = selected.unit;
      const unit_price = selected.price;

      let kg = cur.kg;
      let gram = cur.gram;
      let quantity = cur.quantity;

      if (unit === "kg") {
        if (kg === 0 && gram === 0) kg = 1;
        const totalGrams = kg * 1000 + gram;
        quantity = Math.round((totalGrams / 1000) * 100) / 100;
        const line_total = Math.round((totalGrams * unit_price) / 1000);
        updated[idx] = { ...cur, service_name: selected.name, unit, kg, gram, quantity, unit_price, line_total };
      } else {
        if (quantity < 1) quantity = 1;
        const line_total = Math.round(quantity * unit_price);
        updated[idx] = { ...cur, service_name: selected.name, unit, quantity, unit_price, line_total };
      }
      return updated;
    });
  };

  const handleKgGramChange = (idx: number, field: "kg" | "gram", val: number) => {
    setItems((prev) => {
      const updated = [...prev];
      const cur = updated[idx];
      const kg = field === "kg" ? Math.max(0, val) : cur.kg;
      const gram = field === "gram" ? Math.max(0, Math.min(999, val)) : cur.gram;
      const totalGrams = kg * 1000 + gram;
      const quantity = Math.round((totalGrams / 1000) * 100) / 100;
      const line_total = Math.round((totalGrams * cur.unit_price) / 1000);

      updated[idx] = { ...cur, kg, gram, quantity, line_total };
      return updated;
    });
  };

  const handlePcsChange = (idx: number, val: number) => {
    setItems((prev) => {
      const updated = [...prev];
      const cur = updated[idx];
      const quantity = Math.max(1, Math.round(val));
      const line_total = Math.round(quantity * cur.unit_price);
      updated[idx] = { ...cur, quantity, line_total };
      return updated;
    });
  };

  const handleUnitPriceChange = (idx: number, price: number) => {
    setItems((prev) => {
      const updated = [...prev];
      const cur = updated[idx];
      const unit_price = Math.max(0, price);
      let line_total = 0;
      if (cur.unit === "kg") {
        const totalGrams = cur.kg * 1000 + cur.gram;
        line_total = Math.round((totalGrams * unit_price) / 1000);
      } else {
        line_total = Math.round(cur.quantity * unit_price);
      }
      updated[idx] = { ...cur, unit_price, line_total };
      return updated;
    });
  };

  const handleItemFieldChange = (
    idx: number,
    field: "item_description" | "piece_count" | "item_notes",
    val: string | number
  ) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: val };
      return updated;
    });
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: "item-" + (prev.length + 1) + "-" + Date.now(),
        service_name: defaultService.name,
        unit: defaultService.unit,
        kg: defaultService.unit === "kg" ? 1 : 0,
        gram: 0,
        quantity: 1,
        unit_price: defaultService.price,
        line_total: defaultService.price,
        item_description: "",
        item_notes: "",
      },
    ]);
  };

  const handleRemoveItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // Subtotal & Total
  const subtotal = useMemo(() => {
    return items.reduce((acc, it) => acc + it.line_total, 0);
  }, [items]);

  const finalTotal = useMemo(() => {
    const afterDiscount = Math.max(0, subtotal - discount);
    const rounding = settings.price_rounding || 100;
    if (rounding > 0) {
      return Math.round(afterDiscount / rounding) * rounding;
    }
    return afterDiscount;
  }, [subtotal, discount, settings.price_rounding]);

  // Tambahkan chip catatan ke textarea
  const handleAddNoteChip = (text: string) => {
    setNotes((prev) => {
      if (!prev.trim()) return text;
      if (prev.includes(text)) return prev;
      return `${prev}, ${text}`;
    });
  };

  // Submit Handler
  const handleSubmit = async (sendWhatsAppDirectly = false) => {
    setSubmitError(null);

    // Validasi form
    if (!customerName.trim()) {
      setSubmitError("Nama pelanggan wajib diisi.");
      return;
    }
    if (!customerPhone.trim()) {
      setSubmitError("Nomor WhatsApp wajib diisi.");
      return;
    }
    if (!isValidIndonesianPhone(customerPhone)) {
      setSubmitError("Nomor WhatsApp tidak valid. Gunakan format Indonesia (contoh: 081234567890).");
      return;
    }
    if (items.length === 0) {
      setSubmitError("Pesanan harus memiliki minimal 1 item layanan.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_address: customerAddress.trim(),
        items: items.map((it) => ({
          service_name: it.service_name,
          unit: it.unit,
          quantity: it.quantity,
          unit_price: it.unit_price,
          line_total: it.line_total,
          item_description: it.item_description,
          piece_count: it.piece_count ? Number(it.piece_count) : undefined,
          item_notes: it.item_notes,
        })),
        discount,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        estimated_done: estimatedDone ? new Date(estimatedDone).toISOString() : undefined,
        notes: notes.trim(),
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "Gagal menyimpan pesanan ke Google Sheets.");
        setIsSubmitting(false);
        return;
      }

      // Jika tombol "Simpan dan Kirim WhatsApp" diklik
      if (sendWhatsAppDirectly && data.order && data.items) {
        const waUrl = generateWhatsAppUrl(data.order, data.items, settings);
        window.open(waUrl, "_blank", "noopener,noreferrer");
      }

      // Arahkan ke halaman struk
      router.push(`/orders/${data.order.order_id}/receipt`);
    } catch (err) {
      console.error("Submit order error:", err);
      setSubmitError("Terjadi gangguan saat menyimpan data. Data form Anda tidak hilang, silakan coba lagi.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Form */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Plus className="w-6 h-6 text-sky-600" />
            <span>Tambah Pesanan Baru</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Input transaksi pelanggan laundry cepat (&lt; 1 menit).
          </p>
        </div>
      </div>

      {submitError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
          <div className="flex-1">
            <strong className="font-semibold">Perhatian:</strong> {submitError}
          </div>
        </div>
      )}

      {/* Grid Layout: Desktop 2 Kolom, Mobile 1 Kolom */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Kolom Kiri: Data Pelanggan & Catatan (5 Kolom di LG) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card Data Pelanggan */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <User className="w-4 h-4 text-sky-600" />
              <span>Data Pelanggan</span>
            </h2>

            {/* Nama Pelanggan + Autocomplete */}
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nama Pelanggan <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => handleCustomerQueryChange(e.target.value, "name")}
                  onFocus={() => {
                    if (suggestions.length > 0) setShowSuggestions(true);
                  }}
                  placeholder="Ketik nama pelanggan..."
                  className="w-full px-3.5 py-2.5 text-base sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50/50 focus:bg-white"
                  required
                />
                {isSearchingCustomer && (
                  <Loader2 className="w-4 h-4 text-slate-400 animate-spin absolute right-3 top-3" />
                )}
              </div>

              {/* Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-56 overflow-y-auto">
                  <div className="p-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <span>Saran Pelanggan Lama</span>
                    <button
                      type="button"
                      onClick={() => setShowSuggestions(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      Tutup
                    </button>
                  </div>
                  {suggestions.map((c, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSelectCustomer(c)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-sky-50 flex items-center justify-between transition-colors border-b border-slate-50 last:border-0"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">{c.name}</p>
                        <p className="text-slate-500 text-[11px]">{c.phone}</p>
                      </div>
                      {c.address && (
                        <span className="text-[10px] text-slate-400 max-w-[120px] truncate">
                          {c.address}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Nomor WhatsApp */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nomor WhatsApp <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="tel"
                  inputMode="tel"
                  value={customerPhone}
                  onChange={(e) => handleCustomerQueryChange(e.target.value, "phone")}
                  placeholder="081234567890"
                  className="w-full pl-9 pr-3.5 py-2.5 text-base sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50/50 focus:bg-white"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Struk otomatis dikirimkan ke nomor ini.
              </p>
            </div>

            {/* Alamat */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Alamat (Opsional)
              </label>
              <div className="relative">
                <div className="absolute top-2.5 left-3 pointer-events-none text-slate-400">
                  <MapPin className="w-4 h-4" />
                </div>
                <textarea
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Alamat rumah / kos pelanggan..."
                  rows={2}
                  className="w-full pl-9 pr-3.5 py-2 text-base sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50/50 focus:bg-white resize-none"
                />
              </div>
            </div>
          </div>

          {/* Card Catatan Pesanan & Chips */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-sky-600" />
              <span>Catatan Pesanan</span>
            </h2>

            {/* Preset Chips */}
            {notePresets.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-slate-500 mb-1.5">
                  Tombol Cepat Catatan:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {notePresets.map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleAddNoteChip(chip)}
                      className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-200 border border-slate-200 text-slate-700 transition-colors cursor-pointer"
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ketik instruksi khusus (misal: pisahkan baju putih, pewangi ekstra)..."
              rows={3}
              className="w-full px-3.5 py-2.5 text-base sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50/50 focus:bg-white resize-none"
            />
          </div>

          {/* Estimasi Selesai */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Clock className="w-4 h-4 text-sky-600" />
                <span>Estimasi Selesai</span>
              </h2>
              {isEstimatedManual && (
                <button
                  type="button"
                  onClick={() => setIsEstimatedManual(false)}
                  className="text-xs text-sky-600 hover:underline"
                >
                  Reset Otomatis
                </button>
              )}
            </div>

            <input
              type="datetime-local"
              value={estimatedDone}
              onChange={(e) => {
                setEstimatedDone(e.target.value);
                setIsEstimatedManual(true);
              }}
              className="w-full px-3.5 py-2.5 text-base sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50/50 focus:bg-white"
            />
            <p className="text-[11px] text-slate-400">
              {isEstimatedManual
                ? "Estimasi disetel manual oleh kasir."
                : "Otomatis dihitung dari durasi terlama layanan yang dipilih."}
            </p>
          </div>
        </div>

        {/* Kolom Kanan: Item Layanan & Ringkasan Total (7 Kolom di LG) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card Item Layanan */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Package className="w-4 h-4 text-sky-600" />
                <span>Layanan & Kuantitas ({items.length} Item)</span>
              </h2>
              <button
                type="button"
                onClick={handleAddItem}
                id="add-item-btn"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sky-50 text-sky-700 hover:bg-sky-100 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Item</span>
              </button>
            </div>

            {/* List Item Baris */}
            <div className="space-y-4">
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 space-y-3 relative group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="w-6 h-6 rounded-full bg-sky-100 text-sky-700 text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>

                    {/* Pilih Layanan */}
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                          Layanan
                        </label>
                        <select
                          value={item.service_name}
                          onChange={(e) => handleServiceChange(idx, e.target.value)}
                          className="w-full px-3 py-2 text-base sm:text-sm rounded-xl border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        >
                          {activeServices.map((s) => (
                            <option key={s.service_id} value={s.name}>
                              {s.name} ({s.unit})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Input Kuantitas / Berat */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                          {item.unit === "kg" ? "Berat (Kg & Gram)" : `Jumlah (${item.unit})`}
                        </label>
                        {item.unit === "kg" ? (
                          <div className="flex items-center gap-1.5">
                            <div className="relative flex-1">
                              <input
                                type="number"
                                inputMode="decimal"
                                step="1"
                                min="0"
                                value={item.kg === 0 ? "" : item.kg}
                                onChange={(e) =>
                                  handleKgGramChange(idx, "kg", parseInt(e.target.value, 10) || 0)
                                }
                                placeholder="0"
                                className="w-full pr-7 pl-3 py-2 text-base sm:text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 font-semibold"
                              />
                              <span className="absolute right-2.5 top-2.5 text-xs text-slate-400">
                                kg
                              </span>
                            </div>
                            <div className="relative flex-1">
                              <input
                                type="number"
                                inputMode="numeric"
                                step="10"
                                min="0"
                                max="990"
                                value={item.gram === 0 ? "" : item.gram}
                                onChange={(e) =>
                                  handleKgGramChange(idx, "gram", parseInt(e.target.value, 10) || 0)
                                }
                                placeholder="0"
                                className="w-full pr-10 pl-3 py-2 text-base sm:text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 font-semibold"
                              />
                              <span className="absolute right-2 top-2.5 text-xs text-slate-400">
                                gram
                              </span>
                            </div>
                          </div>
                        ) : (
                          <input
                            type="number"
                            inputMode="numeric"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handlePcsChange(idx, parseInt(e.target.value, 10) || 1)}
                            className="w-full px-3 py-2 text-base sm:text-sm rounded-xl border border-slate-300 bg-white text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500"
                          />
                        )}
                      </div>
                    </div>

                    {/* Tombol Hapus Baris */}
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors"
                        title="Hapus baris item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Baris Harga Satuan & Subtotal Item */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-200/60 items-center">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase">
                        Harga Satuan (Rp)
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        step="500"
                        value={item.unit_price}
                        onChange={(e) =>
                          handleUnitPriceChange(idx, parseInt(e.target.value, 10) || 0)
                        }
                        className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-white text-slate-700"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase">
                        Kuantitas Total
                      </label>
                      <p className="text-xs font-semibold text-slate-800 py-1">
                        {item.unit === "kg"
                          ? `${item.quantity.toLocaleString("id-ID")} kg`
                          : `${item.quantity} ${item.unit}`}
                      </p>
                    </div>

                    <div className="col-span-2 sm:col-span-1 text-right">
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase">
                        Subtotal Item
                      </label>
                      <p className="text-sm font-extrabold text-sky-700 py-0.5">
                        Rp {item.line_total.toLocaleString("id-ID")}
                      </p>
                    </div>
                  </div>

                  {/* Keterangan Isi Cucian & Potongan */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1 border-t border-slate-200/40">
                    <div className="sm:col-span-6">
                      <input
                        type="text"
                        value={item.item_description}
                        onChange={(e) => handleItemFieldChange(idx, "item_description", e.target.value)}
                        placeholder="Isi cucian (contoh: Baju, Celana jeans, Sprei)..."
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={item.piece_count || ""}
                        onChange={(e) =>
                          handleItemFieldChange(
                            idx,
                            "piece_count",
                            e.target.value ? parseInt(e.target.value, 10) : ""
                          )
                        }
                        placeholder="Potong (pcs)..."
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        type="text"
                        value={item.item_notes}
                        onChange={(e) => handleItemFieldChange(idx, "item_notes", e.target.value)}
                        placeholder="Catatan item..."
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card Rincian Pembayaran */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-sky-600" />
              <span>Pembayaran & Total</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Metode Pembayaran */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Metode Pembayaran
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["Tunai", "Transfer", "QRIS"] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all ${
                        paymentMethod === method
                          ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Pembayaran */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Status Pembayaran
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["Lunas", "Belum Lunas"] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setPaymentStatus(status)}
                      className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all ${
                        paymentStatus === status
                          ? status === "Lunas"
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                            : "bg-rose-600 text-white border-rose-600 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Diskon */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-4">
              <label className="text-xs font-semibold text-slate-700">Diskon (Rp)</label>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                step="500"
                value={discount === 0 ? "" : discount}
                onChange={(e) => setDiscount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                placeholder="0"
                className="w-36 px-3 py-1.5 text-right text-base sm:text-sm font-semibold rounded-xl border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            {/* Ringkasan Subtotal, Diskon, dan Total Besar */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Subtotal Layanan:</span>
                <span className="font-semibold">Rp {subtotal.toLocaleString("id-ID")}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-xs text-rose-600">
                  <span>Diskon:</span>
                  <span className="font-semibold">- Rp {discount.toLocaleString("id-ID")}</span>
                </div>
              )}
              {settings.price_rounding > 0 && (
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Pembulatan ({settings.price_rounding}):</span>
                  <span>Aktif</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 flex items-baseline justify-between">
                <span className="text-sm font-bold text-slate-800">Total Akhir:</span>
                <span className="text-2xl font-black text-sky-700 tracking-tight">
                  Rp {finalTotal.toLocaleString("id-ID")}
                </span>
              </div>
            </div>

            {/* Desktop Action Buttons */}
            <div className="hidden sm:grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={isSubmitting}
                id="btn-save-order"
                className="w-full min-h-[48px] py-3 px-4 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-300"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin text-slate-600" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-slate-600" />
                )}
                <span>Simpan Pesanan</span>
              </button>

              <button
                type="button"
                onClick={() => handleSubmit(true)}
                disabled={isSubmitting}
                id="btn-save-and-wa"
                className="w-full min-h-[48px] py-3 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-600/20 active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <MessageSquare className="w-5 h-5" />
                )}
                <span>Simpan & Kirim WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Bar untuk Mobile (HP) Sesuai PRD Bagian 9.1 */}
      <div className="sm:hidden fixed bottom-14 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500">Total Pembayaran:</span>
          <span className="text-xl font-black text-sky-700">
            Rp {finalTotal.toLocaleString("id-ID")}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={isSubmitting}
            className="py-2.5 px-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300 flex items-center justify-center gap-1 active:bg-slate-200 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>Simpan</span>
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={isSubmitting}
            className="py-2.5 px-2 rounded-xl text-xs font-bold bg-emerald-600 text-white shadow-sm flex items-center justify-center gap-1 active:bg-emerald-700 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
            <span>Simpan & WA</span>
          </button>
        </div>
      </div>
    </div>
  );
}
