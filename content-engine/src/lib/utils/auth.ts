import crypto from "crypto";

const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD ?? "").trim();
const ADMIN_SESSION_SECRET = (process.env.ADMIN_SESSION_SECRET ?? "").trim();

export const ADMIN_COOKIE_NAME = "content_engine_admin";

export function verifyAdminPassword(password: string) {
  return Boolean(ADMIN_PASSWORD) && password === ADMIN_PASSWORD;
}

export function createAdminSessionValue() {
  if (!ADMIN_SESSION_SECRET) {
    throw new Error("ADMIN_SESSION_SECRET is not set");
  }

  const payload = `admin:${Date.now()}`;
  const signature = crypto
    .createHmac("sha256", ADMIN_SESSION_SECRET)
    .update(payload)
    .digest("hex");

  return `${payload}.${signature}`;
}

export function isValidAdminSession(sessionValue?: string) {
  if (!ADMIN_SESSION_SECRET) {
    return false;
  }

  if (!sessionValue) {
    return false;
  }

  const [payload, signature] = sessionValue.split(".");
  if (!payload || !signature) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", ADMIN_SESSION_SECRET)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
