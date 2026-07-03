import { createHash, randomBytes } from "node:crypto";

export function generateToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

export function hashToken(token: string): Buffer {
  return hashValue(token);
}

export function hashValue(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function optionalHash(value: string | null | undefined): Buffer | null {
  const normalized = value?.trim();
  return normalized ? hashValue(normalized) : null;
}

export function generateInviteCode(byteLength = 8): string {
  return randomBytes(byteLength).toString("base64url").slice(0, 12);
}
