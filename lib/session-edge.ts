import { jwtVerify } from "jose";

export const SESSION_COOKIE_NAME = "laundry_session";

export function getJwtSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET || "default-insecure-secret-key-at-least-32-chars-long";
  return new TextEncoder().encode(secret);
}

export async function verifySessionEdge(token: string): Promise<{ role: "admin" | "kasir" } | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey(), {
      algorithms: ["HS256"],
    });
    if (payload.role === "admin" || payload.role === "kasir") {
      return { role: payload.role as "admin" | "kasir" };
    }
    return null;
  } catch {
    return null;
  }
}
