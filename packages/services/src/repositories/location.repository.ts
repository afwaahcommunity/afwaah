import {
  anonymousSessions,
  geofenceConfig,
  locationChecks,
} from "@campus-chat/database/schema";
import type {
  GeofenceConfig,
  LocationCheck,
} from "@campus-chat/database/models";
import { and, desc, eq, gt } from "drizzle-orm";

import type { VerifyLocationInput } from "../types";
import { BaseRepository, type DrizzleClient } from "./base";

export class LocationRepository extends BaseRepository {
  constructor(db: DrizzleClient) {
    super(db);
  }

  async createCheck(
    input: VerifyLocationInput,
    result: {
      confidenceScore: number;
      distanceFromCenterKm: number;
      isWithinGeofence: boolean;
      validUntil: Date;
    },
    geofence: GeofenceConfig,
  ): Promise<LocationCheck> {
    const [check] = await this.db
      .insert(locationChecks)
      .values({
        accuracyMeters: input.accuracyMeters?.toString(),
        anonymousUserId: input.userId,
        confidenceScore: result.confidenceScore,
        distanceFromCenterKm: result.distanceFromCenterKm.toFixed(3),
        geofenceCenterLat: geofence.centerLatitude,
        geofenceCenterLng: geofence.centerLongitude,
        geofenceRadiusKm: geofence.radiusKm,
        isWithinGeofence: result.isWithinGeofence,
        latitude: input.latitude.toFixed(6),
        longitude: input.longitude.toFixed(6),
        sessionId: input.sessionId,
        validUntil: result.validUntil,
        verificationMethod: input.method ?? "browser_geolocation",
      })
      .returning();

    if (!check) throw new Error("Failed to create location check.");

    await this.db
      .update(anonymousSessions)
      .set({
        lastKnownLat: input.latitude.toFixed(6),
        lastKnownLng: input.longitude.toFixed(6),
        lastLocationCheckAt: new Date(),
        locationVerified: result.isWithinGeofence,
      })
      .where(eq(anonymousSessions.id, input.sessionId));

    return check;
  }

  async findDefaultGeofence(): Promise<GeofenceConfig | null> {
    const [geofence] = await this.db
      .select()
      .from(geofenceConfig)
      .where(
        and(
          eq(geofenceConfig.isActive, true),
          eq(geofenceConfig.isDefault, true),
        ),
      )
      .limit(1);

    return geofence ?? null;
  }

  async updateDefaultGeofenceRadius(
    radiusKm: number,
  ): Promise<GeofenceConfig | null> {
    const [geofence] = await this.db
      .update(geofenceConfig)
      .set({
        radiusKm: radiusKm.toFixed(2),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(geofenceConfig.isActive, true),
          eq(geofenceConfig.isDefault, true),
        ),
      )
      .returning();

    return geofence ?? null;
  }

  async findValidCheck(sessionId: string): Promise<LocationCheck | null> {
    const [check] = await this.db
      .select()
      .from(locationChecks)
      .where(
        and(
          eq(locationChecks.sessionId, sessionId),
          eq(locationChecks.isWithinGeofence, true),
          gt(locationChecks.validUntil, new Date()),
        ),
      )
      .orderBy(desc(locationChecks.createdAt))
      .limit(1);

    return check ?? null;
  }
}
