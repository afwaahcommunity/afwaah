import type { VerificationMethod } from "./common";

export interface VerifyLocationInput {
  accuracyMeters?: number;
  latitude: number;
  longitude: number;
  method?: VerificationMethod;
  sessionId: string;
  userId: string;
}

export interface LocationVerificationResult {
  confidenceScore: number;
  distanceFromCenterKm: number;
  isWithinGeofence: boolean;
  validUntil: Date;
}

export interface GeofenceSettings {
  centerLatitude: number;
  centerLongitude: number;
  id: string;
  isActive: boolean;
  isDefault: boolean;
  name: string;
  radiusKm: number;
  updatedAt: Date;
}

export interface UpdateGeofenceSettingsInput {
  radiusKm: number;
}
