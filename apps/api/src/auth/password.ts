import bcrypt from "bcryptjs";

const BCRYPT_HASH_PREFIX = /^\$2[aby]\$/;

export async function verifyAdminPassword(
  plainTextPassword: string,
  passwordHash: string,
): Promise<boolean> {
  if (!plainTextPassword || !BCRYPT_HASH_PREFIX.test(passwordHash)) {
    return false;
  }

  return bcrypt.compare(plainTextPassword, passwordHash);
}
