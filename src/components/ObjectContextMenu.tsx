import { useEffect } from "react";
import { usePlanner } from "@/lib/store";
import { PALETTE } from "@/lib/types";
import type { LngLat } from "@/lib/geo";
import { makeCircle } from "./MapView";

export interface MenuInfo {
  x: number;
  y: number;
  objId: string | null;
  lngLat: LngLat;
}

export function ObjectContextMenu({
  info,
  onClose,
  onRename,
}: {
  info: MenuInfo;
  onClose: () => void;
  onRename: (id: string) => void;
}) {
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener("click", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", close);
    };
  }, [onClose]);

  const s = usePlanner.getState();
  const obj = info.objId ? s.objects.find((o) => o.id === info.objId) : null;

  const item = (label: string, action: () => void) => (
    <button
      key={label}
      onClick={() => {
        action();
        onClose();
      }}
      className="w-full rounded px-2 py-1.5 text-left text-xs text-foreground hover:bg-accent"
    >
      {label}
    </button>
  );

  return (
    <div
      style={{ left: info.x, top: info.y }}
      onClick={(e) => e.stopPropagation()}
      className="fixed z-50 w-52 rounded-lg border panel-surface p-1 shadow-2xl"
    >
      {obj ? (
        <>
          {item("Edit properties", () => s.select(obj.id))}
          {item("Duplicate", () => s.duplicateObject(obj.id))}
          {item("Rename", () => onRename(obj.id))}
          {item(obj.visible ? "Hide" : "Show", () => s.toggleVisible(obj.id))}
          <div className="px-2 py-1">
            <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              Change color
            </p>
            <div className="flex flex-wrap gap-1">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  aria-label={c}
                  onClick={() => {
                    s.updateObject(obj.id, { color: c });
                    onClose();
                  }}
                  className="h-4 w-4 rounded-full border border-border"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="my-1 h-px bg-border" />
          {item("Delete", () => s.removeObject(obj.id))}
        </>
      ) : (
        <>
          {item("Create 12-Sector Circle Here", () =>
            s.addObject(makeCircle(info.lngLat, s.draft, s.nextId("circle"))),
          )}
          {item("Add Point", () =>
            s.addObject({
              id: s.nextId("point"),
              type: "point",
              name: `Point ${s.objects.length + 1}`,
              color: s.draft.color,
              opacity: 1,
              visible: true,
              position: info.lngLat,
            }),
          )}
          {item("Start Line", () => {
            s.setTool("line");
            s.setDrawing([info.lngLat]);
          })}
          {item("Start Polygon", () => {
            s.setTool("polygon");
            s.setDrawing([info.lngLat]);
          })}
        </>
      )}
    </div>
  );
}
