import { adminUsers } from "@campus-chat/database/schema";
import type { AdminUser } from "@campus-chat/database/models";
import { eq, sql } from "drizzle-orm";

import type { CreateAdminInput } from "../types";
import { BaseRepository, type DrizzleClient } from "./base";

export class AdminRepository extends BaseRepository {
  constructor(db: DrizzleClient) {
    super(db);
  }

  async create(
    input: CreateAdminInput,
    createdByAdminId?: string,
  ): Promise<AdminUser> {
    const [admin] = await this.db
      .insert(adminUsers)
      .values({
        createdByAdminId,
        displayName: input.displayName,
        email: input.email,
        passwordHash: input.passwordHash,
        permissions: input.permissions?.map(String) ?? [],
        role: input.role ?? "moderator",
      })
      .returning();

    if (!admin) throw new Error("Failed to create admin.");
    return admin;
  }

  async findByEmail(email: string): Promise<AdminUser | null> {
    const [admin] = await this.db
      .select()
      .from(adminUsers)
      .where(sql`LOWER(${adminUsers.email}) = LOWER(${email})`)
      .limit(1);

    return admin ?? null;
  }

  async findById(adminId: string): Promise<AdminUser | null> {
    const [admin] = await this.db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.id, adminId))
      .limit(1);

    return admin ?? null;
  }
}
