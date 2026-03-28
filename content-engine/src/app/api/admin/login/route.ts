import { NextResponse } from "next/server";

import {
  ADMIN_COOKIE_NAME,
  createAdminSessionValue,
  verifyAdminPassword,
} from "@/lib/utils/auth";

export async function POST(request: Request) {
  const body = await request.json();
  const password = String(body?.password ?? "");

  if (!verifyAdminPassword(password)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE_NAME, createAdminSessionValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return response;
}
