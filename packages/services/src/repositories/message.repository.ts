import { messageReactions, messages } from "@campus-chat/database/schema";
import type { Message, MessageReaction } from "@campus-chat/database/models";
import { and, desc, eq, gt, inArray, lt, sql } from "drizzle-orm";

import type {
  MessageHistoryParams,
  MessageStatus,
  SendMessageInput,
} from "../types";
import { BaseRepository, type DrizzleClient } from "./base";

export class MessageRepository extends BaseRepository {
  constructor(db: DrizzleClient) {
    super(db);
  }

  async addReaction(
    messageId: string,
    userId: string,
    emoji: string,
  ): Promise<MessageReaction> {
    const [reaction] = await this.db
      .insert(messageReactions)
      .values({ anonymousUserId: userId, emoji, messageId })
      .onConflictDoNothing()
      .returning();

    if (reaction) return reaction;

    const [existing] = await this.db
      .select()
      .from(messageReactions)
      .where(
        and(
          eq(messageReactions.messageId, messageId),
          eq(messageReactions.anonymousUserId, userId),
          eq(messageReactions.emoji, emoji),
        ),
      )
      .limit(1);

    if (!existing) throw new Error("Failed to create message reaction.");
    return existing;
  }

  async countByRoom(roomId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(eq(messages.roomId, roomId), eq(messages.status, "visible")));

    return result?.count ?? 0;
  }

  async create(
    userId: string,
    sessionId: string,
    displayName: string,
    displayColor: string,
    input: SendMessageInput,
  ): Promise<Message> {
    const [message] = await this.db
      .insert(messages)
      .values({
        anonymousUserId: userId,
        body: input.body,
        bodyType: input.bodyType ?? "text",
        clientMessageId: input.clientMessageId,
        displayColorSnapshot: displayColor,
        displayNameSnapshot: displayName,
        mediaAssetId: input.mediaAssetId,
        replyToMessageId: input.replyToMessageId,
        roomId: input.roomId,
        sessionId,
      })
      .returning();

    if (!message) throw new Error("Failed to create message.");
    return message;
  }

  async findByClientMessageId(
    roomId: string,
    clientMessageId: string,
  ): Promise<Message | null> {
    const [message] = await this.db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.roomId, roomId),
          eq(messages.clientMessageId, clientMessageId),
        ),
      )
      .orderBy(desc(messages.createdAt))
      .limit(1);

    return message ?? null;
  }

  async findById(messageId: string): Promise<Message | null> {
    const [message] = await this.db
      .select()
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);

    return message ?? null;
  }

  async getHistory(params: MessageHistoryParams): Promise<Message[]> {
    const conditions = [
      eq(messages.roomId, params.roomId),
      eq(messages.status, "visible"),
    ];

    if (params.before) conditions.push(lt(messages.createdAt, params.before));
    if (params.after) conditions.push(gt(messages.createdAt, params.after));

    return this.db
      .select()
      .from(messages)
      .where(and(...conditions))
      .orderBy(params.after ? messages.createdAt : desc(messages.createdAt))
      .limit(params.limit);
  }

  async getReactions(messageId: string): Promise<MessageReaction[]> {
    return this.db
      .select()
      .from(messageReactions)
      .where(eq(messageReactions.messageId, messageId))
      .orderBy(messageReactions.createdAt);
  }

  async getReactionsForMessages(
    messageIds: string[],
  ): Promise<MessageReaction[]> {
    if (messageIds.length === 0) return [];

    return this.db
      .select()
      .from(messageReactions)
      .where(inArray(messageReactions.messageId, messageIds))
      .orderBy(messageReactions.createdAt);
  }

  async removeReaction(
    messageId: string,
    userId: string,
    emoji: string,
  ): Promise<boolean> {
    const removed = await this.db
      .delete(messageReactions)
      .where(
        and(
          eq(messageReactions.messageId, messageId),
          eq(messageReactions.anonymousUserId, userId),
          eq(messageReactions.emoji, emoji),
        ),
      )
      .returning({ id: messageReactions.id });

    return removed.length > 0;
  }

  async updateStatus(
    messageId: string,
    status: MessageStatus,
    options?: { adminId?: string; reason?: string },
  ): Promise<Message | null> {
    const [message] = await this.db
      .update(messages)
      .set({
        deletedAt: status === "deleted" ? new Date() : undefined,
        deletedByAdminId: options?.adminId,
        deletionReason: options?.reason,
        status,
      })
      .where(eq(messages.id, messageId))
      .returning();

    return message ?? null;
  }
}
