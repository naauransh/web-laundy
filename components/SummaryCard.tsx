import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

interface SummaryCardProps {
  title: string;
  value: string;
  subtitle?: string;
  countLabel?: string;
  percentChange?: number | string;
  diffAmount?: string;
  icon?: React.ReactNode;
  variant?: "default" | "highlight" | "warning" | "danger" | "success";
}

export default function SummaryCard({
  title,
  value,
  subtitle,
  countLabel,
  percentChange,
  diffAmount,
  icon,
  variant = "default",
}: SummaryCardProps) {
  const isPositive = typeof percentChange === "number" ? percentChange > 0 : percentChange === "Baru";
  const isNegative = typeof percentChange === "number" ? percentChange < 0 : false;
  const isNeutral = percentChange === 0 || percentChange === "-";

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {title}
          </span>
          {icon && <div className="p-2 rounded-xl bg-slate-50 text-slate-600">{icon}</div>}
        </div>

        <div className="flex items-baseline justify-between gap-2">
          <span className="text-2xl font-black text-slate-900 tracking-tight">
            {value}
          </span>
        </div>

        {countLabel && (
          <p className="text-xs text-slate-500 mt-0.5">{countLabel}</p>
        )}
      </div>

      {(percentChange !== undefined || diffAmount || subtitle) && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          {percentChange !== undefined ? (
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full font-bold text-[11px] ${
                  isPositive
                    ? "bg-emerald-50 text-emerald-700"
                    : isNegative
                    ? "bg-rose-50 text-rose-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {isPositive && <ArrowUpRight className="w-3.5 h-3.5" />}
                {isNegative && <ArrowDownRight className="w-3.5 h-3.5" />}
                {isNeutral && <Minus className="w-3.5 h-3.5" />}
                <span>
                  {typeof percentChange === "number"
                    ? `${percentChange > 0 ? "+" : ""}${percentChange}%`
                    : percentChange}
                </span>
              </span>
              {diffAmount && (
                <span className="text-slate-400 text-[11px]">vs sebelumnya</span>
              )}
            </div>
          ) : (
            <div />
          )}

          {subtitle && (
            <span className="text-slate-400 text-[11px]">{subtitle}</span>
          )}
        </div>
      )}
    </div>
  );
}
