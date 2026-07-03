import type { Presence } from "@/lib/types";

export function PresenceBar({ users }: { users: Presence[] }) {
  if (users.length === 0) return null;
  const visible = users.slice(0, 6);
  const extra = users.length - visible.length;
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex -space-x-1.5">
        {visible.map((u) => (
          <span
            key={u.userId}
            title={u.displayName}
            className="h-4 w-4 rounded-full ring-2 ring-background"
            style={{ backgroundColor: u.displayColor }}
          />
        ))}
      </div>
      {extra > 0 && <span className="text-xs text-muted-foreground">+{extra}</span>}
    </div>
  );
}
