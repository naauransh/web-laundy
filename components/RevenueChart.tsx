"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface DailyData {
  date: string;
  displayDate: string;
  revenue: number;
  orderCount: number;
}

interface RevenueChartProps {
  data: DailyData[];
}

export default function RevenueChart({ data }: RevenueChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
        Belum ada data transaksi pada rentang ini.
      </div>
    );
  }

  return (
    <div className="w-full h-[240px] md:h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="displayDate"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#64748b", fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#64748b", fontSize: 11 }}
            tickFormatter={(v) =>
              v >= 1000000
                ? `${(v / 1000000).toFixed(1)}jt`
                : v >= 1000
                ? `${Math.round(v / 1000)}k`
                : `${v}`
            }
          />
          <Tooltip
            cursor={{ fill: "#f8fafc" }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload as DailyData;
                return (
                  <div className="bg-slate-900 text-white rounded-xl p-3 shadow-xl text-xs space-y-1">
                    <p className="font-semibold text-slate-300">Tanggal: {item.displayDate}</p>
                    <p className="text-sky-400 font-bold text-sm">
                      Rp {item.revenue.toLocaleString("id-ID")}
                    </p>
                    <p className="text-slate-400 text-[11px]">
                      {item.orderCount} pesanan selesai lunas
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar
            dataKey="revenue"
            fill="url(#revenueGradient)"
            radius={[6, 6, 0, 0]}
            maxBarSize={40}
          />
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0284c7" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.4} />
            </linearGradient>
          </defs>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
