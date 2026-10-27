"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";

interface ServiceCompositionItem {
  name: string;
  revenue: number;
  percentage: number;
}

interface ServiceDonutProps {
  data: ServiceCompositionItem[];
}

const COLORS = [
  "#0284c7", // Sky 600
  "#10b981", // Emerald 500
  "#6366f1", // Indigo 500
  "#f59e0b", // Amber 500
  "#ec4899", // Pink 500
  "#8b5cf6", // Purple 500
];

export default function ServiceDonut({ data }: ServiceDonutProps) {
  if (!data || data.length === 0 || data.every((d) => d.revenue === 0)) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
        Belum ada data pendapatan layanan pada rentang ini.
      </div>
    );
  }

  return (
    <div className="w-full h-[240px] md:h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="revenue"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={3}
          >
            {data.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
                stroke="#ffffff"
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload as ServiceCompositionItem;
                return (
                  <div className="bg-slate-900 text-white rounded-xl p-3 shadow-xl text-xs space-y-1">
                    <p className="font-semibold text-slate-300">{item.name}</p>
                    <p className="text-sky-400 font-bold text-sm">
                      Rp {item.revenue.toLocaleString("id-ID")}
                    </p>
                    <p className="text-slate-400 text-[11px]">{item.percentage}% dari total</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend
            layout="horizontal"
            verticalAlign="bottom"
            align="center"
            wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
