import { createHash, randomBytes } from "node:crypto";
import type { Types } from "mongoose";
import { Session } from "@/models/session";
import { User } from "@/models/user";

export const SESSION_COOKIE = "quickfix_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

export type AuthenticatedUser = {
  id: Types.ObjectId;
  name: string;
  role: "CLIENT" | "ARTISAN" | "ADMIN";
  mustChangePassword: boolean;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionCookie(token: string, maxAge = SESSION_DURATION_SECONDS): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

export async function createSession(userId: Types.ObjectId): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await Session.create({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + SESSION_DURATION_SECONDS * 1000),
  });
  return token;
}

export async function getAuthenticatedUser(request: Request): Promise<AuthenticatedUser | null> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookie = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  const token = cookie?.slice(SESSION_COOKIE.length + 1);
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;

  const session = await Session.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } }).select("userId");
  if (!session) return null;

  const user = await User.findById(session.userId).select("name role isSuspended mustChangePassword").lean();
  if (!user || user.isSuspended) return null;
  return { id: user._id, name: user.name, role: user.role, mustChangePassword: user.mustChangePassword };
}

export async function revokeSession(request: Request): Promise<void> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookie = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  const token = cookie?.slice(SESSION_COOKIE.length + 1);
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return;
  await Session.deleteOne({ tokenHash: hashToken(token) });
}

export function hasSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}
