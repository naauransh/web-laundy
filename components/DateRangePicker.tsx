"use client";

import { useState } from "react";
import { format, subDays, startOfMonth, startOfYear } from "date-fns";
import { Calendar as CalendarIcon, Filter } from "lucide-react";

interface DateRangePickerProps {
  initialFrom: string;
  initialTo: string;
  onRangeChange: (from: string, to: string) => void;
}

export type PresetKey = "today" | "7d" | "this_month" | "3m" | "this_year" | "custom";

export default function DateRangePicker({
  initialFrom,
  initialTo,
  onRangeChange,
}: DateRangePickerProps) {
  const [activePreset, setActivePreset] = useState<PresetKey>("3m");
  const [fromDate, setFromDate] = useState<string>(initialFrom);
  const [toDate, setToDate] = useState<string>(initialTo);
  const [validationError, setValidationError] = useState<string | null>(null);

  const applyPreset = (preset: PresetKey) => {
    setActivePreset(preset);
    setValidationError(null);

    const now = new Date();
    const todayStr = format(now, "yyyy-MM-dd");
    let from = todayStr;
    const to = todayStr;

    if (preset === "today") {
      from = todayStr;
    } else if (preset === "7d") {
      from = format(subDays(now, 6), "yyyy-MM-dd");
    } else if (preset === "this_month") {
      from = format(startOfMonth(now), "yyyy-MM-dd");
    } else if (preset === "3m") {
      from = format(subDays(now, 89), "yyyy-MM-dd");
    } else if (preset === "this_year") {
      from = format(startOfYear(now), "yyyy-MM-dd");
    }

    setFromDate(from);
    setToDate(to);
    onRangeChange(from, to);
  };

  const handleCustomDateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromDate || !toDate) return;

    if (new Date(toDate).getTime() < new Date(fromDate).getTime()) {
      setValidationError("Tanggal akhir tidak boleh sebelum tanggal awal.");
      return;
    }

    setValidationError(null);
    setActivePreset("custom");
    onRangeChange(fromDate, toDate);
  };

  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Preset Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Preset:</span>
          </span>

          {[
            { key: "today", label: "Hari Ini" },
            { key: "7d", label: "7 Hari" },
            { key: "this_month", label: "Bulan Ini" },
            { key: "3m", label: "3 Bulan" },
            { key: "this_year", label: "Tahun Ini" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => applyPreset(item.key as PresetKey)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activePreset === item.key
                  ? "bg-sky-600 text-white shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Custom Date Inputs */}
        <form
          onSubmit={handleCustomDateSubmit}
          className="flex flex-wrap items-center gap-2"
        >
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <div className="relative">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setActivePreset("custom");
                }}
                className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <span>s/d</span>
            <div className="relative">
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setActivePreset("custom");
                }}
                className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            Terapkan
          </button>
        </form>
      </div>

      {validationError && (
        <p className="text-xs text-rose-600 font-medium">{validationError}</p>
      )}
    </div>
  );
}
