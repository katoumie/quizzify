// /src/app/api/auth/signup/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import type { Role } from "@prisma/client";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// 3–20 chars, start with a letter, then letters/numbers/_ only
const USERNAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/;

// allow-list for role strings
const ROLE_VALUES: Role[] = ["STUDENT", "TEACHER", "ADMIN"];

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const email = String(body?.email || "").toLowerCase().trim();
    const password = String(body?.password || "");
    const username = String(body?.username || "").trim();

    // Accept either explicit role or legacy isTeacher boolean
    const roleRaw = body?.role as Role | string | undefined;
    const isTeacherRaw = body?.isTeacher as boolean | undefined;

    // Required fields
    if (!email || !password || !username) {
      return NextResponse.json(
        { error: "Email, username, and password are required." },
        { status: 400 }
      );
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
    }
    if (!USERNAME_REGEX.test(username)) {
      return NextResponse.json(
        {
          error:
            "Username must be 3–20 chars, start with a letter, and contain only letters, numbers, or underscores.",
        },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    // Ensure unique email and username
    const [byEmail, byUsername] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.user.findUnique({ where: { username } }),
    ]);
    if (byEmail) {
      return NextResponse.json(
        { error: "An account with that email already exists." },
        { status: 409 }
      );
    }
    if (byUsername) {
      return NextResponse.json({ error: "That username is taken." }, { status: 409 });
    }

    // Normalize role:
    // 1) prefer explicit 'role' if valid
    // 2) otherwise fall back to legacy 'isTeacher' boolean
    // 3) default STUDENT
    let role: Role = "STUDENT";
    if (typeof roleRaw === "string" && ROLE_VALUES.includes(roleRaw.toUpperCase() as Role)) {
      role = roleRaw.toUpperCase() as Role;
    } else if (typeof isTeacherRaw !== "undefined") {
      role = isTeacherRaw ? "TEACHER" : "STUDENT";
    }

    // Create user
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        avatar: null,
        role,
      },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    console.error("POST /api/auth/signup error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
