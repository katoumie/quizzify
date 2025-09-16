// /src/app/api/auth/login/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawIdentifier = (body?.email ?? body?.identifier ?? "").toString().trim();
    const password = (body?.password ?? "").toString();

    if (!rawIdentifier || !password) {
      return NextResponse.json(
        { error: "Email/username and password are required." },
        { status: 400 }
      );
    }

    const identifier = rawIdentifier.toLowerCase();
    const where = isValidEmail(identifier) ? { email: identifier } : { username: identifier };

    const user = await prisma.user.findUnique({
      where,
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,    // keep avatar
        passwordHash: true,
        createdAt: true,
        role: true,      // 👈 include role so the client has it
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    // strip passwordHash before sending back
    const { passwordHash, ...publicUser } = user;
    return NextResponse.json({ user: publicUser }, { status: 200 });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
