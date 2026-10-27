import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionEdge } from "@/lib/session-edge";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Lewatkan static assets, _next, dan favicon
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/health") ||
    pathname === "/favicon.ico" ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg")
  ) {
    return NextResponse.next();
  }

  // 2. Baca session cookie
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionEdge(token) : null;
  const isAuth = Boolean(session);
  const role = session?.role;

  // 3. Rute Login
  if (pathname === "/login") {
    if (isAuth) {
      // Jika sudah login, redirect sesuai peran
      const targetUrl = role === "admin" ? "/" : "/antrian";
      return NextResponse.redirect(new URL(targetUrl, req.url));
    }
    return NextResponse.next();
  }

  // Izinkan endpoint autentikasi login publik
  if (pathname === "/api/auth/login") {
    return NextResponse.next();
  }

  // 4. Jika belum login, proteksi semua rute lainnya
  if (!isAuth) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Akses ditolak. Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  // 5. Pembatasan Hak Akses Peran KASIR (PRD Bagian 5.1 & 5.2)
  if (role === "kasir") {
    // Kasir dilarang mengakses Dashboard (/), Services (/services), dan Settings (/settings)
    if (pathname === "/" || pathname.startsWith("/services") || pathname.startsWith("/settings")) {
      return NextResponse.redirect(new URL("/antrian", req.url));
    }

    // Kasir dilarang memanggil API statistik
    if (pathname.startsWith("/api/stats")) {
      return NextResponse.json(
        { error: "Akses ditolak. Hanya Admin yang dapat mengakses statistik." },
        { status: 403 }
      );
    }

    // Kasir dilarang mengubah Services atau Settings
    if (
      (pathname.startsWith("/api/services") && (req.method === "POST" || req.method === "PATCH")) ||
      (pathname.startsWith("/api/settings") && req.method === "PATCH")
    ) {
      return NextResponse.json(
        { error: "Akses ditolak. Hanya Admin yang dapat mengubah data ini." },
        { status: 403 }
      );
    }
  }

  // 6. Teruskan request dengan header peran pengguna
  const requestHeaders = new Headers(req.headers);
  if (role) {
    requestHeaders.set("x-user-role", role);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
