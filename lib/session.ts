import crypto from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export type UserRole = "admin" | "kasir";

export interface SessionPayload {
  role: UserRole;
  iat?: number;
  exp?: number;
}

export const SESSION_COOKIE_NAME = "laundry_session";
const SESSION_EXPIRY = "12h";
const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60; // 12 jam

// Helper to get encoded session secret
export function getJwtSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET || "default-insecure-secret-key-at-least-32-chars-long";
  return new TextEncoder().encode(secret);
}

// In-memory Rate Limiting (Maks 5 kali gagal per menit per IP)
interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const loginAttempts = new Map<string, RateLimitRecord>();

export function checkLoginRateLimit(ip: string): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 menit
  const maxAttempts = 5;

  const record = loginAttempts.get(ip);
  if (!record || now > record.resetAt) {
    return { allowed: true, remaining: maxAttempts, retryAfterSeconds: 0 };
  }

  if (record.count >= maxAttempts) {
    const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  return { allowed: true, remaining: maxAttempts - record.count, retryAfterSeconds: 0 };
}

export function recordFailedLogin(ip: string): void {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const record = loginAttempts.get(ip);

  if (!record || now > record.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + windowMs });
  } else {
    record.count += 1;
  }
}

export function clearLoginRateLimit(ip: string): void {
  loginAttempts.delete(ip);
}

// Timing-safe password compare
function safeCompare(input: string, target: string): boolean {
  if (!input || !target) return false;
  // Gunakan SHA-256 untuk menyamakan panjang buffer secara konstan (32 bytes)
  const hashInput = crypto.createHash("sha256").update(input).digest();
  const hashTarget = crypto.createHash("sha256").update(target).digest();
  return crypto.timingSafeEqual(hashInput, hashTarget);
}

// Verifikasi password & tentukan peran
export function authenticateWithPassword(password: string): { success: boolean; role?: UserRole; error?: string } {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const kasirPassword = process.env.KASIR_PASSWORD;

  if (!adminPassword || adminPassword.length < 8) {
    return { success: false, error: "ADMIN_PASSWORD belum dikonfigurasi dengan benar (minimal 8 karakter)." };
  }
  if (!kasirPassword || kasirPassword.length < 8) {
    return { success: false, error: "KASIR_PASSWORD belum dikonfigurasi dengan benar (minimal 8 karakter)." };
  }
  if (adminPassword === kasirPassword) {
    return { success: false, error: "ADMIN_PASSWORD dan KASIR_PASSWORD tidak boleh sama." };
  }

  if (safeCompare(password, adminPassword)) {
    return { success: true, role: "admin" };
  }

  if (safeCompare(password, kasirPassword)) {
    return { success: true, role: "kasir" };
  }

  return { success: false, error: "Password salah. Silakan coba lagi." };
}

// Buat JWT Token
export async function createSessionToken(role: UserRole): Promise<string> {
  const secretKey = getJwtSecretKey();
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_EXPIRY)
    .sign(secretKey);
}

// Verifikasi JWT Token
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const secretKey = getJwtSecretKey();
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });
    if (payload.role === "admin" || payload.role === "kasir") {
      return { role: payload.role as UserRole, iat: payload.iat, exp: payload.exp };
    }
    return null;
  } catch {
    return null;
  }
}

// Dapatkan sesi saat ini dari cookies (Server Component / Route Handler)
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

// Set session cookie
export function getSessionCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
