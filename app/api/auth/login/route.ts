import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  authenticateWithPassword,
  checkLoginRateLimit,
  recordFailedLogin,
  clearLoginRateLimit,
  createSessionToken,
  getSessionCookieOptions,
} from "@/lib/session";

const loginSchema = z.object({
  password: z.string().min(1, "Password wajib diisi"),
});

export async function POST(req: NextRequest) {
  try {
    // Dapatkan client IP untuk rate limiting
    const forwardedFor = req.headers.get("x-forwarded-for");
    const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : "127.0.0.1";

    // Cek batas percobaan gagal (maksimal 5 kali per menit per IP)
    const rateLimit = checkLoginRateLimit(ip);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Terlalu banyak percobaan login gagal. Silakan coba lagi dalam ${rateLimit.retryAfterSeconds} detik.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Input tidak valid." },
        { status: 400 }
      );
    }

    const { password } = parsed.data;
    const authResult = authenticateWithPassword(password);

    if (!authResult.success || !authResult.role) {
      recordFailedLogin(ip);
      const updatedLimit = checkLoginRateLimit(ip);
      return NextResponse.json(
        {
          error: authResult.error || "Password salah. Silakan coba lagi.",
          remainingAttempts: updatedLimit.remaining,
        },
        { status: 401 }
      );
    }

    // Berhasil login: reset rate limit & buat JWT
    clearLoginRateLimit(ip);
    const role = authResult.role;
    const token = await createSessionToken(role);

    const redirectTo = role === "admin" ? "/" : "/antrian";
    const response = NextResponse.json({
      ok: true,
      role,
      redirectTo,
      message: `Login berhasil sebagai ${role === "admin" ? "Admin (Pemilik)" : "Kasir"}.`,
    });

    const cookieOptions = getSessionCookieOptions();
    response.cookies.set(cookieOptions.name, token, cookieOptions);

    return response;
  } catch (error) {
    console.error("Login API Error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Silakan coba lagi." },
      { status: 500 }
    );
  }
}
