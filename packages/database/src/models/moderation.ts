import {
  banEvidence,
  bans,
  networkCooldowns,
  reports,
  riskSignals,
} from "../schema/moderation";

export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;

export type Ban = typeof bans.$inferSelect;
export type NewBan = typeof bans.$inferInsert;

export type BanEvidence = typeof banEvidence.$inferSelect;
export type NewBanEvidence = typeof banEvidence.$inferInsert;

export type RiskSignal = typeof riskSignals.$inferSelect;
export type NewRiskSignal = typeof riskSignals.$inferInsert;

export type NetworkCooldown = typeof networkCooldowns.$inferSelect;
export type NewNetworkCooldown = typeof networkCooldowns.$inferInsert;
