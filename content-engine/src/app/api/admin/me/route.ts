import { NextRequest, NextResponse } from "next/server";

import { assertAdmin } from "@/lib/utils/requireAdmin";

export async function GET(request: NextRequest) {
  try {
    assertAdmin(request);
    return NextResponse.json({ authenticated: true });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
