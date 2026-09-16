import {
  MousePointer2,
  Target,
  MapPin,
  Minus,
  Spline,
  Pentagon,
  Square,
  Type,
  Ruler,
  Trash2,
  Undo2,
  Redo2,
} from "lucide-react";
import { usePlanner } from "@/lib/store";
import type { ToolId } from "@/lib/types";
import { cn } from "@/lib/utils";

const TOOLS: Array<{ id: ToolId; label: string; icon: typeof Target; key?: string }> = [
  { id: "select", label: "Select", icon: MousePointer2, key: "V" },
  { id: "circle12", label: "12-Sector Circle", icon: Target, key: "C" },
  { id: "point", label: "Point", icon: MapPin, key: "P" },
  { id: "line", label: "Line", icon: Minus, key: "L" },
  { id: "polyline", label: "Polyline", icon: Spline },
  { id: "polygon", label: "Polygon", icon: Pentagon, key: "G" },
  { id: "rectangle", label: "Rectangle", icon: Square, key: "R" },
  { id: "text", label: "Text", icon: Type },
  { id: "measure", label: "Measure", icon: Ruler, key: "M" },
  { id: "delete", label: "Delete", icon: Trash2 },
];

export function Toolbar() {
  const tool = usePlanner((s) => s.tool);
  const setTool = usePlanner((s) => s.setTool);
  const undo = usePlanner((s) => s.undo);
  const redo = usePlanner((s) => s.redo);
  const canUndo = usePlanner((s) => s.past.length > 0);
  const canRedo = usePlanner((s) => s.future.length > 0);

  return (
    <div className="pointer-events-auto flex flex-col gap-1 rounded-xl border panel-surface p-1.5 shadow-2xl">
      {TOOLS.map((t) => {
        const Icon = t.icon;
        const active = tool === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            title={`${t.label}${t.key ? ` (${t.key})` : ""}`}
            aria-label={t.label}
            aria-pressed={active}
            className={cn(
              "group relative grid h-9 w-9 place-items-center rounded-lg border border-transparent text-muted-foreground transition-all duration-150",
              "hover:border-border hover:bg-accent/60 hover:text-foreground",
              active &&
                "border-primary/50 bg-primary/15 text-primary shadow-[0_0_0_1px_var(--color-primary)]/20",
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={1.9} />
            <span className="pointer-events-none absolute left-11 z-30 hidden whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-lg group-hover:block">
              {t.label}
              {t.key ? <span className="ml-2 font-mono text-muted-foreground">{t.key}</span> : null}
            </span>
          </button>
        );
      })}

      <div className="my-1 h-px bg-border" />

      <button
        onClick={undo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
        className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground disabled:opacity-30"
      >
        <Undo2 className="h-4 w-4" strokeWidth={1.9} />
      </button>
      <button
        onClick={redo}
        disabled={!canRedo}
        title="Redo (Ctrl+Y)"
        aria-label="Redo"
        className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground disabled:opacity-30"
      >
        <Redo2 className="h-4 w-4" strokeWidth={1.9} />
      </button>
    </div>
  );
}
