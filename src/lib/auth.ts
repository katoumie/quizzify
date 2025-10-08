// /src/lib/auth.ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import * as jose from "jose";

export const COOKIE_NAME = "qz_auth";
const ALG = "HS256";

function getSecret() {
  const s = process.env.QZ_JWT_SECRET;
  if (!s) throw new Error("Missing QZ_JWT_SECRET");
  return new TextEncoder().encode(s);
}

export type AuthToken = {
  sub: string;            // userId
  email?: string;
  username?: string | null;
  iat?: number;
  exp?: number;
};

export async function signAuthToken(
  payload: Omit<AuthToken, "iat" | "exp">,
  ttlSeconds = 60 * 60 * 24 * 7
) {
  const now = Math.floor(Date.now() / 1000);
  return new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .setSubject(payload.sub)
    .sign(getSecret());
}

// READ current user id from cookie (works in RSC/route handlers)
export async function getAuthedUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jose.jwtVerify<AuthToken>(token, getSecret(), { algorithms: [ALG] });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

/** Attach an auth cookie to a NextResponse (use in route handlers). */
export function withAuthCookie(res: NextResponse, jwt: string): NextResponse {
  res.cookies.set({
    name: COOKIE_NAME,
    value: jwt,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return res;
}

/** Clear the auth cookie on a NextResponse (use in route handlers). */
export function withClearedAuthCookie(res: NextResponse): NextResponse {
  res.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
