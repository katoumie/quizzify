// /src/app/api/user/update/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// 3–20 chars, start with a letter, then letters/numbers/_ only
const USERNAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/;

// allow-list of role strings coming from the client
const ROLE_VALUES: Role[] = ["STUDENT", "TEACHER", "ADMIN"];

/**
 * PATCH body can include any subset of:
 * { id, avatar, username, email, role }
 * - id is required (the logged-in user id)
 * - avatar is a string (URL or DataURL) or null
 * - username optional, validated & unique
 * - email optional, validated & unique
 * - role optional; must be one of "STUDENT" | "TEACHER" | "ADMIN"
 */
export async function PATCH(
  req: NextRequest,
  _context: RouteContext<"/api/user/update"> // params is Promise<{}> for this static route
) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const id = (body?.id ?? "").toString();
    const avatar = body?.avatar as string | null | undefined;
    const usernameRaw = (body?.username ?? undefined) as string | undefined;
    const emailRaw = (body?.email ?? undefined) as string | undefined;
    const roleRaw = (body?.role ?? undefined) as Role | string | undefined;

    if (!id) {
      return NextResponse.json({ error: "Missing user id." }, { status: 400 });
    }

    const data: Record<string, any> = {};

    // avatar: allow string or null to clear
    if (typeof avatar !== "undefined") {
      data.avatar = avatar;
    }

    // username: validate + uniqueness
    if (typeof usernameRaw !== "undefined") {
      const username = usernameRaw.trim();
      if (!USERNAME_REGEX.test(username)) {
        return NextResponse.json(
          {
            error:
              "Username must be 3–20 chars, start with a letter, and contain only letters, numbers, or underscores.",
          },
          { status: 400 }
        );
      }
      const exists = await prisma.user.findUnique({ where: { username } });
      if (exists && exists.id !== id) {
        return NextResponse.json({ error: "That username is taken." }, { status: 409 });
      }
      data.username = username;
    }

    // email: validate + uniqueness
    if (typeof emailRaw !== "undefined") {
      const email = emailRaw.toLowerCase().trim();
      if (!isValidEmail(email)) {
        return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
      }
      const exists = await prisma.user.findUnique({ where: { email } });
      if (exists && exists.id !== id) {
        return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
      }
      data.email = email;
    }

    // role: must be in enum
    if (typeof roleRaw !== "undefined") {
      const roleStr = String(roleRaw).toUpperCase() as Role;
      if (!ROLE_VALUES.includes(roleStr)) {
        return NextResponse.json({ error: "Invalid role." }, { status: 400 });
      }
      data.role = roleStr;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        createdAt: true,
        role: true, // include role in response
      },
    });

    return NextResponse.json({ user }, { status: 200 });
  } catch (err) {
    console.error("Update error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
