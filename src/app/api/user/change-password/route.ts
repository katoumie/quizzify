// src/app/api/user/change-password/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const id = (body?.id ?? "").toString().trim();
    const currentPassword = (body?.currentPassword ?? "").toString();
    const newPassword = (body?.newPassword ?? "").toString();

    if (!id || !currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters." },
        { status: 400 }
      );
    }

    // Fetch user with current hash
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      // Don't leak whether the account exists
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    // Check current password
    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    // Optional: prevent reusing the exact same password
    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: "New password must be different from the current password." },
        { status: 400 }
      );
    }

    // Hash and store
    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    // No need to return the full user; nothing in localStorage changes
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("Change-password error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
