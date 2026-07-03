import Link from "next/link";
import type { Message, Presence, TypingUser } from "@/lib/types";
import { MessageList } from "./MessageList";
import { MessageComposer } from "./MessageComposer";
import { TypingIndicator } from "./TypingIndicator";
import { PresenceBar } from "./PresenceBar";
import { AccessStateBanner } from "./AccessStateBanner";
import { ShareRoomModal } from "./ShareRoomModal";
import { ReportDialog } from "./ReportDialog";
import { DeleteMessageDialog } from "./DeleteMessageDialog";
import { LeaveRoomDialog } from "./LeaveRoomDialog";

import { useEffect, useMemo, useRef, useState } from "react";
import { joinRoom } from "@/lib/realtime/client";
import { api } from "@/lib/api/client";
import { ArrowLeft, Share2, Users } from "lucide-react";
import type { AnonSession, Room } from "@/lib/types";

export function ChatRoom({ room, session }: { room: Room; session: AnonSession }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTyping] = useState<TypingUser[]>([]);
  const [presence, setPresence] = useState<Presence[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<Message | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Message | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const channelRef = useRef<ReturnType<typeof joinRoom> | null>(null);


  useEffect(() => {
    setLoading(true);
    api.messages.list(room.id).then((m) => {
      // Remap mock "me" messages to the current session identity so ownership
      // is determined by userId, never by display name.
      const remapped = m.map((msg) =>
        msg.userId === "me"
          ? { ...msg, userId: session.userId, displayName: session.displayName, displayColor: session.displayColor }
          : msg,
      );
      setMessages(remapped);
      setLoading(false);
    });

    const ch = joinRoom(room.id, {
      displayColor: session.displayColor,
      displayName: session.displayName,
      token: session.token,
      userId: session.userId,
    });
    channelRef.current = ch;
    const u1 = ch.onMessage((m) =>
      setMessages((prev) =>
        prev.some((existing) => existing.id === m.id) ? prev : [...prev, m],
      ),
    );
    const u2 = ch.onTyping((list) => setTyping(list.filter((t) => t.userId !== session.userId)));
    const u3 = ch.onPresence((list) => setPresence(list));
    const u4 = ch.onReaction((update) =>
      setMessages((prev) =>
        prev.map((message) => {
          if (message.id !== update.messageId) return message;

          const myReactions = new Set(message.myReactions);
          if (update.userId === session.userId) {
            if (update.reacted) myReactions.add(update.emoji);
            else myReactions.delete(update.emoji);
          }

          return {
            ...message,
            myReactions: Array.from(myReactions),
            reactions: update.reactionCounts,
          };
        }),
      ),
    );
    return () => { u1(); u2(); u3(); u4(); ch.leave(); };
  }, [room.id, session.token, session.userId, session.displayName, session.displayColor]);

  const canWrite = useMemo(() => {
    if (session.ban && (session.ban.kind === "hard" || session.ban.kind === "read_only" || session.ban.kind === "room_ban" || session.ban.kind === "quarantine")) return false;
    return session.writeAccess.kind === "allowed";
  }, [session]);

  const disabledReason = session.ban
    ? "You can't send messages while restricted."
    : session.writeAccess.kind === "off_campus"
    ? "You're off campus — reading only."
    : session.writeAccess.kind !== "allowed"
    ? "Verify location to send messages."
    : undefined;

  const send = async (content: string) => {
    const sent = channelRef.current
      ? await channelRef.current.sendMessage(content)
      : (await api.messages.send({ roomId: room.id, content }),
        {
          createdAt: new Date().toISOString(),
          messageId: `local_${Math.random().toString(36).slice(2, 8)}`,
        });

    setMessages((prev) =>
      prev.some((message) => message.id === sent.messageId)
        ? prev
        : [
            ...prev,
            {
              content,
              createdAt: sent.createdAt,
              displayColor: session.displayColor,
              displayName: session.displayName,
              id: sent.messageId,
              isMine: true,
              myReactions: [],
              reactions: {},
              roomId: room.id,
              userId: session.userId,
            },
          ],
    );
  };

  const handleReact = async (messageId: string, emoji: string) => {
    const shouldRemove = messages
      .find((message) => message.id === messageId)
      ?.myReactions.includes(emoji);

    // Optimistic toggle
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const hadIt = m.myReactions.includes(emoji);
        const nextCount = Math.max(0, (m.reactions[emoji] ?? 0) + (hadIt ? -1 : 1));
        const nextReactions = { ...m.reactions };
        if (nextCount === 0) delete nextReactions[emoji];
        else nextReactions[emoji] = nextCount;
        return {
          ...m,
          reactions: nextReactions,
          myReactions: hadIt
            ? m.myReactions.filter((e) => e !== emoji)
            : [...m.myReactions, emoji],
        };
      }),
    );
    try {
      if (channelRef.current) {
        await channelRef.current.react(messageId, emoji, shouldRemove);
      } else {
        await api.messages.react({ emoji, messageId, remove: shouldRemove });
      }
    } catch {
      // Roll back on failure
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const hadIt = m.myReactions.includes(emoji);
          const nextCount = Math.max(0, (m.reactions[emoji] ?? 0) + (hadIt ? -1 : 1));
          const nextReactions = { ...m.reactions };
          if (nextCount === 0) delete nextReactions[emoji];
          else nextReactions[emoji] = nextCount;
          return {
            ...m,
            reactions: nextReactions,
            myReactions: hadIt
              ? m.myReactions.filter((e) => e !== emoji)
              : [...m.myReactions, emoji],
          };
        }),
      );
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <header className="flex items-center gap-3 border-b border-border bg-background px-4 py-2.5">
        <Link href="/rooms" aria-label="Back" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground md:hidden">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-sm font-semibold">{room.name}</h1>
            <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              {room.visibility}
            </span>
          </div>
          {room.description && (
            <p className="truncate text-xs text-muted-foreground">{room.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> {presence.length || room.participantCount}
          </span>
          <PresenceBar users={presence} />
          <button
            onClick={() => setShareOpen(true)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Share"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setLeaveOpen(true)}
            className="inline-flex h-8 items-center rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            Leave
          </button>
        </div>
      </header>

      {(session.ban || session.writeAccess.kind !== "allowed") && (
        <div className="border-b border-border px-4 py-2.5">
          <AccessStateBanner ban={session.ban} write={session.writeAccess} />
        </div>
      )}

      <MessageList
        messages={messages}
        loading={loading}
        currentUserId={session.userId}
        onReport={setReportTarget}
        onDelete={setDeleteTarget}
        onReact={handleReact}
      />


      <div className="px-4 pb-1">
        <TypingIndicator users={typing} />
      </div>

      <MessageComposer
        onSend={send}
        onTyping={() => channelRef.current?.sendTyping()}
        disabled={!canWrite}
        disabledReason={disabledReason}
        placeholder={`Message #${room.name}`}
      />

      <ShareRoomModal roomId={room.id} open={shareOpen} onClose={() => setShareOpen(false)} />
      <ReportDialog
        open={!!reportTarget}
        message={reportTarget}
        onClose={() => setReportTarget(null)}
        roomName={room.name}
        reporterId={session.userId}
        restricted={
          session.ban?.kind === "read_only"
            ? { title: "Reporting is disabled", description: "Your account is currently read-only. You cannot submit reports." }
            : session.ban?.kind === "quarantine"
            ? { title: "Reporting is disabled", description: "Your account is under review. Reporting is temporarily unavailable." }
            : session.ban?.kind === "room_ban" && session.ban.roomId === room.id
            ? { title: "Reporting is disabled in this room", description: "You are banned from this room and cannot submit reports for its messages." }
            : null
        }
      />
      <DeleteMessageDialog
        open={!!deleteTarget}
        message={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={(id) =>
          setMessages((prev) =>
            prev.map((m) => (m.id === id ? { ...m, deleted: true, content: "" } : m)),
          )
        }
      />
      <LeaveRoomDialog open={leaveOpen} room={room} onClose={() => setLeaveOpen(false)} />

    </div>
  );
}
