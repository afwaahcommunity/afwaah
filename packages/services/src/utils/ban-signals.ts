import type { AnonymousSession } from "@campus-chat/database/models";

import type { BanEvidenceType, RiskLevel, RiskSignalType } from "../types";
import { hashValue } from "./crypto";

export interface BanSignal {
  canAutoBlock: boolean;
  description: string;
  evidenceType: BanEvidenceType;
  isSharedSignal: boolean;
  matchConfidence: number;
  riskLevel: RiskLevel;
  riskScore: number;
  signalName: string;
  signalType?: RiskSignalType;
  signalValueHash: Buffer;
  signalValuePreview?: string;
}

export function getSessionBanSignals(session: AnonymousSession): BanSignal[] {
  const signals: BanSignal[] = [
    {
      canAutoBlock: true,
      description: "Exact anonymous session id.",
      evidenceType: "session_match",
      isSharedSignal: false,
      matchConfidence: 100,
      riskLevel: "blocked",
      riskScore: 100,
      signalName: "session_id",
      signalValueHash: hashValue(session.id),
    },
    {
      canAutoBlock: true,
      description: "Secure session token hash.",
      evidenceType: "session_match",
      isSharedSignal: false,
      matchConfidence: 100,
      riskLevel: "blocked",
      riskScore: 100,
      signalName: "session_token_hash",
      signalValueHash: session.tokenHash,
    },
    {
      canAutoBlock: false,
      description: "IP hash. Shared networks must not be auto-banned.",
      evidenceType: "ip_match",
      isSharedSignal: true,
      matchConfidence: 45,
      riskLevel: "medium",
      riskScore: 45,
      signalName: "ip_hash",
      signalType: "ip_hash",
      signalValueHash: session.ipHash,
    },
    {
      canAutoBlock: false,
      description: "User agent hash. Useful only as supporting evidence.",
      evidenceType: "automated_detection",
      isSharedSignal: true,
      matchConfidence: 20,
      riskLevel: "low",
      riskScore: 20,
      signalName: "user_agent_hash",
      signalType: "user_agent_hash",
      signalValueHash: session.userAgentHash,
    },
  ];

  if (session.deviceInstallIdHash) {
    signals.push({
      canAutoBlock: true,
      description: "Device install id hash.",
      evidenceType: "device_match",
      isSharedSignal: false,
      matchConfidence: 95,
      riskLevel: "blocked",
      riskScore: 95,
      signalName: "device_id_hash",
      signalType: "device_id_hash",
      signalValueHash: session.deviceInstallIdHash,
    });
  }

  if (session.fingerprintHash) {
    signals.push({
      canAutoBlock: true,
      description: "Browser/device fingerprint hash.",
      evidenceType: "fingerprint_match",
      isSharedSignal: false,
      matchConfidence: 90,
      riskLevel: "high",
      riskScore: 90,
      signalName: "fingerprint_hash",
      signalType: "fingerprint_hash",
      signalValueHash: session.fingerprintHash,
    });
  }

  if (session.ipSubnetHash) {
    signals.push({
      canAutoBlock: false,
      description: "IP subnet hash. Shared campus networks are broad signals.",
      evidenceType: "subnet_match",
      isSharedSignal: true,
      matchConfidence: 35,
      riskLevel: "medium",
      riskScore: 35,
      signalName: "subnet_hash",
      signalType: "subnet_hash",
      signalValueHash: session.ipSubnetHash,
    });
  }

  if (session.asn) {
    signals.push({
      canAutoBlock: false,
      description: "ASN/network provider. Broad context only.",
      evidenceType: "automated_detection",
      isSharedSignal: true,
      matchConfidence: 15,
      riskLevel: "low",
      riskScore: 15,
      signalName: "asn",
      signalType: "asn",
      signalValueHash: hashValue(session.asn),
      signalValuePreview: session.asn,
    });
  }

  return dedupeBanSignals(signals);
}

export function getAutoBlockSignals(session: AnonymousSession): BanSignal[] {
  return getSessionBanSignals(session).filter((signal) => signal.canAutoBlock);
}

export function dedupeBanSignals(signals: BanSignal[]): BanSignal[] {
  const bySignal = new Map<string, BanSignal>();

  for (const signal of signals) {
    const key = `${signal.signalName}:${signal.signalValueHash.toString("hex")}`;
    const existing = bySignal.get(key);
    if (!existing || signal.matchConfidence > existing.matchConfidence) {
      bySignal.set(key, signal);
    }
  }

  return [...bySignal.values()];
}
