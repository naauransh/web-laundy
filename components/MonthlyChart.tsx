"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface MonthlyData {
  monthKey: string;
  displayMonth: string;
  revenue: number;
  orderCount: number;
  totalKg: number;
}

interface MonthlyChartProps {
  data: MonthlyData[];
}

export default function MonthlyChart({ data }: MonthlyChartProps) {
  const [tab, setTab] = useState<"revenue" | "kg">("revenue");

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
        Belum ada data bulanan.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toggle Tab: Omset Bulanan vs Total Kilo */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">
          Tren 12 Bulan Terakhir
        </span>
        <div className="flex items-center bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setTab("revenue")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              tab === "revenue"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Omset (Rp)
          </button>
          <button
            type="button"
            onClick={() => setTab("kg")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              tab === "kg"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Total Kilo (Kg)
          </button>
        </div>
      </div>

      <div className="w-full h-[240px] md:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="displayMonth"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#64748b", fontSize: 10 }}
              interval={0}
              tickFormatter={(v) => v.split(" ")[0]} // Jan, Feb, ...
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#64748b", fontSize: 11 }}
              tickFormatter={(v) =>
                tab === "revenue"
                  ? v >= 1000000
                    ? `${(v / 1000000).toFixed(1)}jt`
                    : v >= 1000
                    ? `${Math.round(v / 1000)}k`
                    : `${v}`
                  : `${v} kg`
              }
            />
            <Tooltip
              cursor={{ fill: "#f8fafc" }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload as MonthlyData;
                  return (
                    <div className="bg-slate-900 text-white rounded-xl p-3 shadow-xl text-xs space-y-1">
                      <p className="font-semibold text-slate-300">Bulan: {item.displayMonth}</p>
                      {tab === "revenue" ? (
                        <p className="text-emerald-400 font-bold text-sm">
                          Rp {item.revenue.toLocaleString("id-ID")}
                        </p>
                      ) : (
                        <p className="text-sky-400 font-bold text-sm">
                          {item.totalKg.toLocaleString("id-ID")} kg cucian
                        </p>
                      )}
                      <p className="text-slate-400 text-[11px]">
                        {item.orderCount} pesanan
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar
              dataKey={tab === "revenue" ? "revenue" : "totalKg"}
              fill={tab === "revenue" ? "#10b981" : "#0284c7"}
              radius={[6, 6, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
