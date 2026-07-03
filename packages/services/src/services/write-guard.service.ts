import { createError } from "../errors";
import {
  LocationRepository,
  ModerationRepository,
  type DrizzleClient,
} from "../repositories";
import type { Result } from "../types";
import { err, ok } from "../types";

export class WriteGuardService {
  private readonly locationRepo: LocationRepository;
  private readonly moderationRepo: ModerationRepository;

  constructor(db: DrizzleClient) {
    this.locationRepo = new LocationRepository(db);
    this.moderationRepo = new ModerationRepository(db);
  }

  async requireWriteAccess(input: {
    roomId?: string;
    sessionId: string;
    userId: string;
  }): Promise<Result<void>> {
    const interactionAccess = await this.requireInteractionAccess(input);
    if (!interactionAccess.ok) return err(interactionAccess.error);

    return this.requireCampusWriteAccess(input.sessionId);
  }

  async requireInteractionAccess(input: {
    roomId?: string;
    sessionId: string;
    userId: string;
  }): Promise<Result<void>> {
    const activeBan = await this.moderationRepo.findMostSevereActiveBan(input);
    if (activeBan && activeBan.banType !== "room_ban") {
      return err(
        createError("BAN_ACTIVE", "User is banned from interacting.", {
          banType: activeBan.banType,
        }),
      );
    }
    if (activeBan?.banType === "room_ban") {
      return err(createError("ROOM_BANNED", "User is banned from this room."));
    }

    return ok(undefined);
  }

  async requireRoomEntryAccess(input: {
    roomId: string;
    sessionId?: string;
    userId: string;
  }): Promise<Result<void>> {
    const [activeBan, roomBan] = await Promise.all([
      this.moderationRepo.findMostSevereActiveBan(input),
      this.moderationRepo.findActiveRoomBan(input),
    ]);
    if (activeBan?.banType === "global_hard_ban") {
      return err(
        createError("BAN_ACTIVE", "User is banned from accessing the app.", {
          banType: activeBan.banType,
        }),
      );
    }
    if (roomBan) {
      return err(createError("ROOM_BANNED", "User is banned from this room."));
    }

    return ok(undefined);
  }

  async requireCampusWriteAccess(sessionId: string): Promise<Result<void>> {
    const locationCheck = await this.locationRepo.findValidCheck(sessionId);

    if (!locationCheck) {
      return err(
        createError(
          "LOCATION_OUTSIDE_GEOFENCE",
          "A valid campus location check is required before writing.",
        ),
      );
    }

    return ok(undefined);
  }
}
