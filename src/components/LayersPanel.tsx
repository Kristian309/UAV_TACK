import { useState } from "react";
import { Copy, Eye, EyeOff, Trash2, Pencil } from "lucide-react";
import { usePlanner } from "@/lib/store";
import { objectLabel } from "@/lib/types";
import { cn } from "@/lib/utils";

export function LayersPanel() {
  const objects = usePlanner((s) => s.objects);
  const selectedId = usePlanner((s) => s.selectedId);
  const select = usePlanner((s) => s.select);
  const toggleVisible = usePlanner((s) => s.toggleVisible);
  const duplicateObject = usePlanner((s) => s.duplicateObject);
  const removeObject = usePlanner((s) => s.removeObject);
  const updateObject = usePlanner((s) => s.updateObject);
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span>Layers</span>
        <span className="font-mono normal-case">{objects.length}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
        {objects.length === 0 ? (
          <p className="px-2 py-4 text-xs text-muted-foreground">
            No objects yet. Pick a tool and click the map.
          </p>
        ) : null}
        {objects.map((o) => (
          <div
            key={o.id}
            onClick={() => select(o.id)}
            className={cn(
              "group mb-1 flex cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 py-1.5 transition-colors hover:bg-accent/50",
              selectedId === o.id && "border-primary/40 bg-primary/10",
            )}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: o.color }}
            />
            <div className="min-w-0 flex-1">
              {editing === o.id ? (
                <input
                  autoFocus
                  defaultValue={o.name}
                  onBlur={(e) => {
                    updateObject(o.id, { name: e.target.value });
                    setEditing(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setEditing(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full rounded bg-background px-1 text-sm outline-none ring-1 ring-primary"
                />
              ) : (
                <p className="truncate text-sm text-foreground">{o.name || "Untitled"}</p>
              )}
              <p className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                {objectLabel(o)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <IconBtn label="Rename" onClick={() => setEditing(o.id)}>
                <Pencil className="h-3.5 w-3.5" />
              </IconBtn>
              <IconBtn label="Duplicate" onClick={() => duplicateObject(o.id)}>
                <Copy className="h-3.5 w-3.5" />
              </IconBtn>
              <IconBtn label="Delete" onClick={() => removeObject(o.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </IconBtn>
            </div>
            <IconBtn label="Toggle visibility" onClick={() => toggleVisible(o.id)}>
              {o.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </IconBtn>
          </div>
        ))}
      </div>
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );
}
