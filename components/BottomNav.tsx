"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  PlusCircle,
  Package,
  Sparkles,
} from "lucide-react";

interface BottomNavProps {
  role: "admin" | "kasir";
}

export default function BottomNav({ role }: BottomNavProps) {
  const pathname = usePathname();

  const items = [
    ...(role === "admin"
      ? [
          {
            name: "Dashboard",
            href: "/",
            icon: LayoutDashboard,
            active: pathname === "/",
          },
        ]
      : []),
    {
      name: "Antrian",
      href: "/antrian",
      icon: ClipboardList,
      active: pathname.startsWith("/antrian"),
    },
    {
      name: "+ Order",
      href: "/orders/new",
      icon: PlusCircle,
      active: pathname === "/orders/new",
      highlight: true,
    },
    {
      name: "Pesanan",
      href: "/orders",
      icon: Package,
      active: pathname === "/orders" || (pathname.startsWith("/orders/") && pathname !== "/orders/new"),
    },
    ...(role === "admin"
      ? [
          {
            name: "Layanan",
            href: "/services",
            icon: Sparkles,
            active: pathname.startsWith("/services") || pathname.startsWith("/settings"),
          },
        ]
      : []),
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-lg px-2 py-1 safe-bottom">
      <div className="flex items-center justify-around">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.active;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-2 min-w-[56px] min-h-[48px] rounded-xl transition-all ${
                item.highlight
                  ? "text-sky-600 font-semibold"
                  : isActive
                  ? "text-sky-600 font-medium"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <div
                className={`p-1 rounded-lg ${
                  item.highlight
                    ? "bg-sky-50 text-sky-600"
                    : isActive
                    ? "bg-sky-50 text-sky-600"
                    : ""
                }`}
              >
                <Icon className={`w-5 h-5 ${item.highlight ? "stroke-[2.5]" : ""}`} />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
