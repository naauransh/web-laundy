"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  PlusCircle,
  Package,
  Sparkles,
  Settings,
  LogOut,
  ShieldCheck,
  User,
  Loader2,
} from "lucide-react";

interface AppHeaderProps {
  role: "admin" | "kasir";
}

export default function AppHeader({ role }: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    } finally {
      setLoggingOut(false);
    }
  };

  // Menu navigasi untuk Admin vs Kasir
  const navItems = [
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
      name: "Tambah Pesanan",
      href: "/orders/new",
      icon: PlusCircle,
      active: pathname === "/orders/new",
    },
    {
      name: "Daftar Pesanan",
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
            active: pathname.startsWith("/services"),
          },
          {
            name: "Pengaturan",
            href: "/settings",
            icon: Settings,
            active: pathname.startsWith("/settings"),
          },
        ]
      : []),
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <Link
              href={role === "admin" ? "/" : "/antrian"}
              className="flex items-center gap-2.5 group"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="hidden sm:block">
                <span className="font-bold text-base text-slate-800 tracking-tight block">
                  Laundry Pro
                </span>
                <span className="text-[11px] text-slate-400 block -mt-0.5">
                  Google Sheets Edition
                </span>
              </div>
            </Link>

            {/* Badge Peran */}
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                role === "admin"
                  ? "bg-purple-50 text-purple-700 border border-purple-200/60"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
              }`}
            >
              {role === "admin" ? (
                <ShieldCheck className="w-3.5 h-3.5" />
              ) : (
                <User className="w-3.5 h-3.5" />
              )}
              <span className="capitalize">{role === "admin" ? "Admin (Owner)" : "Kasir"}</span>
            </div>
          </div>

          {/* Navigasi Desktop / Tablet */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    item.active
                      ? "bg-sky-50 text-sky-700 font-semibold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Tombol Logout */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              id="logout-btn"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
              title="Keluar dari akun"
            >
              {loggingOut ? (
                <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
