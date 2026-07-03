import type { TypingUser } from "@/lib/types";

export function TypingIndicator({ users }: { users: TypingUser[] }) {
  if (users.length === 0) return <div className="h-4" />;
  const label =
    users.length === 1
      ? `${users[0].displayName} is typing`
      : users.length === 2
      ? `${users[0].displayName} and ${users[1].displayName} are typing`
      : `${users.length} people are typing`;
  return (
    <div className="flex h-4 items-center gap-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-0.5">
        <span className="typing-dot" style={{ animationDelay: "0ms" }} />
        <span className="typing-dot" style={{ animationDelay: "150ms" }} />
        <span className="typing-dot" style={{ animationDelay: "300ms" }} />
      </span>
      <span className="truncate">{label}</span>
    </div>
  );
}
