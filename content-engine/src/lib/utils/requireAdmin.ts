import { NextRequest } from "next/server";

import { ADMIN_COOKIE_NAME, isValidAdminSession } from "@/lib/utils/auth";

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export function assertAdmin(request: NextRequest) {
  const session = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!isValidAdminSession(session)) {
    throw new UnauthorizedError();
  }
}
