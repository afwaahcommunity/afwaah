import { adminSessions, adminUsers, auditLog } from "../schema/admin";

export type AdminUser = typeof adminUsers.$inferSelect;
export type NewAdminUser = typeof adminUsers.$inferInsert;

export type AdminSession = typeof adminSessions.$inferSelect;
export type NewAdminSession = typeof adminSessions.$inferInsert;

export type AdminAuditLog = typeof auditLog.$inferSelect;
export type NewAdminAuditLog = typeof auditLog.$inferInsert;
