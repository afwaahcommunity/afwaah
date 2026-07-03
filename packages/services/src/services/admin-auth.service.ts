import type { RedisClient } from "../cache";
import { createError } from "../errors";
import { AdminRepository, type DrizzleClient } from "../repositories";
import type { AdminUserData, Result } from "../types";
import { err, ok } from "../types";

export type PasswordVerifier = (
  plainTextPassword: string,
  passwordHash: string,
) => boolean | Promise<boolean>;

export class AdminAuthService {
  private readonly adminRepo: AdminRepository;
  private readonly verifyPassword: PasswordVerifier;

  constructor(
    db: DrizzleClient,
    _redis: RedisClient,
    verifyPassword: PasswordVerifier,
  ) {
    this.adminRepo = new AdminRepository(db);
    this.verifyPassword = verifyPassword;
  }

  async verifyCredentials(
    email: string,
    password: string,
  ): Promise<Result<AdminUserData>> {
    const admin = await this.adminRepo.findByEmail(email.trim().toLowerCase());
    if (!admin) {
      return err(createError("INVALID_TOKEN", "Invalid credentials."));
    }
    if (!admin.isActive) {
      return err(createError("ADMIN_INACTIVE", "Admin account is inactive."));
    }

    const valid = await this.verifyPassword(password, admin.passwordHash);
    if (!valid)
      return err(createError("INVALID_TOKEN", "Invalid credentials."));

    return ok({
      createdAt: admin.createdAt,
      displayName: admin.displayName,
      email: admin.email,
      id: admin.id,
      isActive: admin.isActive,
      lastLoginAt: admin.lastLoginAt,
      role: admin.role as AdminUserData["role"],
    });
  }
}
