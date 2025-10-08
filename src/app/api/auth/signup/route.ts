import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import type { Role } from "@prisma/client";
import { signAuthToken, withAuthCookie } from "@/lib/auth"; // ⬅️ updated helper

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const USERNAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/;
const ROLE_VALUES: Role[] = ["STUDENT", "TEACHER", "ADMIN"];

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const email = String(body?.email || "").toLowerCase().trim();
    const password = String(body?.password || "");
    const username = String(body?.username || "").trim();

    const roleRaw = body?.role as Role | string | undefined;
    const isTeacherRaw = body?.isTeacher as boolean | undefined;

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
        { error: "Username must be 3–20 chars, start with a letter, and contain only letters, numbers, or underscores." },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const [byEmail, byUsername] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.user.findUnique({ where: { username } }),
    ]);
    if (byEmail) return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    if (byUsername) return NextResponse.json({ error: "That username is taken." }, { status: 409 });

    let role: Role = "STUDENT";
    if (typeof roleRaw === "string" && ROLE_VALUES.includes(roleRaw.toUpperCase() as Role)) {
      role = roleRaw.toUpperCase() as Role;
    } else if (typeof isTeacherRaw !== "undefined") {
      role = isTeacherRaw ? "TEACHER" : "STUDENT";
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, username, passwordHash, avatar: null, role },
      select: { id: true, email: true, username: true, avatar: true, role: true, createdAt: true },
    });

    // Set JWT cookie on the response
    const jwt = await signAuthToken({
      sub: user.id,
      email: user.email,
      username: user.username ?? null,
    });
    const res = NextResponse.json({ user }, { status: 201 });
    withAuthCookie(res, jwt);
    return res;
  } catch (err) {
    console.error("POST /api/auth/signup error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
