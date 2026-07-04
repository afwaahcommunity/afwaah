"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { getFloorLabel, searchRooms } from "../engine";
import type { CampusRoom, FloorId } from "../types";

export function RoomSearch({
  floor,
  label,
  onSelect,
  placeholder,
  value,
}: {
  floor?: FloorId;
  label: string;
  onSelect: (roomId: string | null) => void;
  placeholder: string;
  value: CampusRoom | null;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchRooms(query, floor, 7), [floor, query]);

  return (
    <div className="relative min-w-0">
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={value ? `${value.name} (${value.id})` : query}
          onChange={(event) => {
            onSelect(null);
            setQuery(event.target.value);
          }}
          placeholder={placeholder}
          className="w-full rounded-md border border-border bg-background py-2 pl-8 pr-8 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
        {value || query ? (
          <button
            type="button"
            aria-label={`Clear ${label}`}
            onClick={() => {
              onSelect(null);
              setQuery("");
            }}
            className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {!value && query && results.length > 0 ? (
        <div className="absolute left-0 right-0 top-[4.6rem] z-20 max-h-72 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-xl">
          {results.map((room) => (
            <button
              key={room.id}
              type="button"
              onClick={() => {
                onSelect(room.id);
                setQuery("");
              }}
              className="flex w-full min-w-0 items-center justify-between gap-3 rounded-md px-2 py-2 text-left hover:bg-accent"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{room.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {room.details || getFloorLabel(room.floor)}
                </span>
              </span>
              <span className="flex-shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {room.id}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
