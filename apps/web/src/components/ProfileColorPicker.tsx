import { DISPLAY_COLORS } from "@/lib/constants";
import { Check } from "lucide-react";

export function ProfileColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {DISPLAY_COLORS.map((c) => {
        const active = c.toLowerCase() === value.toLowerCase();
        return (
          <button
            key={c}
            type="button"
            aria-label={`color ${c}`}
            onClick={() => onChange(c)}
            className={
              "relative h-8 w-8 rounded-md ring-1 ring-border transition-transform hover:scale-105 " +
              (active ? "ring-2 ring-primary" : "")
            }
            style={{ backgroundColor: c }}
          >
            {active && (
              <Check
                className="absolute inset-0 m-auto h-4 w-4"
                style={{ color: "#0b0b0b" }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
