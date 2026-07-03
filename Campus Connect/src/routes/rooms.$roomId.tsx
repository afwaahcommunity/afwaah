import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { useSession } from "@/hooks/useSession";
import { ChatRoom } from "@/components/ChatRoom";
import { TopBar } from "@/components/TopBar";

interface InviteSearch {
  inviteCode?: string;
}

export const Route = createFileRoute("/rooms/$roomId")({
  validateSearch: (search: Record<string, unknown>): InviteSearch => ({
    inviteCode: typeof search.inviteCode === "string" ? search.inviteCode : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Room — campus" },
      { name: "description", content: "Anonymous campus chat room." },
    ],
  }),
  component: RoomPage,
});

function RoomPage() {
  const { roomId } = Route.useParams();
  const { inviteCode } = useSearch({ from: "/rooms/$roomId" });
  const { session, loading: sessionLoading } = useSession();
  const [inviteState, setInviteState] = useState<
    | { kind: "idle" }
    | { kind: "checking" }
    | { kind: "ok" }
    | { kind: "invalid" | "expired" | "disabled" | "room_banned"; msg: string }
  >({ kind: "idle" });

  const { data: room, isLoading, error } = useQuery({
    queryKey: ["room", roomId],
    queryFn: () => api.rooms.get(roomId),
  });

  useEffect(() => {
    if (!inviteCode) return;
    setInviteState({ kind: "checking" });
    api.rooms.joinByInvite(roomId, inviteCode).then((res) => {
      if (res.ok) setInviteState({ kind: "ok" });
      else {
        const msgs = {
          invalid: "This invite is invalid.",
          expired: "This invite has expired.",
          disabled: "Invites are disabled for this room.",
          room_banned: "You're banned from this room.",
        };
        setInviteState({ kind: res.reason!, msg: msgs[res.reason!] });
      }
    });
  }, [inviteCode, roomId]);

  if (sessionLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <TopBar session={session} />
        <div className="mx-auto max-w-3xl px-4 py-10">
          <div className="h-8 w-40 animate-pulse rounded bg-muted" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-4 w-full animate-pulse rounded bg-muted" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (inviteCode && inviteState.kind !== "ok" && inviteState.kind !== "idle") {
    if (inviteState.kind !== "checking") {
      return (
        <div className="min-h-screen bg-background">
          <TopBar session={session} />
          <div className="mx-auto max-w-md px-4 py-16 text-center">
            <h1 className="text-lg font-semibold">Invite unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">{inviteState.msg}</p>
            <Link
              to="/rooms"
              className="mt-6 inline-flex rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Back to rooms
            </Link>
          </div>
        </div>
      );
    }
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-background">
        <TopBar session={session} />
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-lg font-semibold">Room not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This room may have been removed or is unavailable.
          </p>
          <Link
            to="/rooms"
            className="mt-6 inline-flex rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Back to rooms
          </Link>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-background">
      <TopBar session={session} />
      <div className="mx-auto max-w-3xl">
        <ChatRoom room={room} session={session} />
      </div>
    </div>
  );
}
