"use client";

import { RotateCcw, Shuffle } from "lucide-react";

export function RouteControls({
  canSwap,
  onReset,
  onSwap,
}: {
  canSwap: boolean;
  onReset: () => void;
  onSwap: () => void;
}) {
  return (
    <div className="flex gap-1">
      <button
        type="button"
        disabled={!canSwap}
        onClick={onSwap}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        title="Swap route"
      >
        <Shuffle className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onReset}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        title="Reset route"
      >
        <RotateCcw className="h-4 w-4" />
      </button>
    </div>
  );
}
