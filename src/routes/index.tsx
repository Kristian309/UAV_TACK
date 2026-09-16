import { createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import type * as maplibregl from "maplibre-gl";
import { Toolbar } from "@/components/Toolbar";
import { PropertiesPanel } from "@/components/PropertiesPanel";
import { LayersPanel } from "@/components/LayersPanel";
import { StatusBar } from "@/components/StatusBar";
import { TopBar } from "@/components/TopBar";
import { ObjectContextMenu, type MenuInfo } from "@/components/ObjectContextMenu";
import { usePlanner } from "@/lib/store";
import { useView } from "@/lib/view-store";
import { PanelRightClose, PanelRightOpen } from "lucide-react";

const MapView = lazy(() => import("@/components/MapView"));

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Tactical Map Planner — 12-Sector Circle GIS Tool" },
      {
        name: "description",
        content:
          "Plan on a full-screen map: place 12-sector circles with real radii, draw vectors, measure, and export GeoJSON.",
      },
      { property: "og:title", content: "Tactical Map Planner — 12-Sector Circle GIS Tool" },
      {
        property: "og:description",
        content:
          "Interactive dark GIS planner with 12-sector circles, real geographic geometry and GeoJSON export.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Index() {
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [menu, setMenu] = useState<MenuInfo | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const hover = useView((s) => s.hover);

  const onReady = useCallback((m: maplibregl.Map) => setMap(m), []);
  const onContextMenu = useCallback((info: MenuInfo) => setMenu(info), []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const s = usePlanner.getState();
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === "z") {
        e.preventDefault();
        e.shiftKey ? s.redo() : s.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && key === "y") {
        e.preventDefault();
        s.redo();
        return;
      }
      if (e.ctrlKey || e.metaKey) return;
      if (e.key === "Escape") {
        s.setDrawing([]);
        s.setMeasure({ points: [] });
        s.select(null);
        s.setTool("select");
        setMenu(null);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (s.selectedId) s.removeObject(s.selectedId);
      } else if (e.code === "Space") {
        e.preventDefault();
        useView.getState().setSpacePan(true);
      } else if (key === "v") s.setTool("select");
      else if (key === "c") s.setTool("circle12");
      else if (key === "p") s.setTool("point");
      else if (key === "l") s.setTool("line");
      else if (key === "g") s.setTool("polygon");
      else if (key === "r") s.setTool("rectangle");
      else if (key === "m") s.setTool("measure");
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") useView.getState().setSpacePan(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-background text-foreground">
      <Suspense fallback={<div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Loading map…</div>}>
        <MapView onReady={onReady} onContextMenu={onContextMenu} />
      </Suspense>

      <h1 className="sr-only">Tactical Map Planner</h1>

      <div className="pointer-events-none absolute left-3 right-3 top-3 z-20 flex justify-center">
        <TopBar map={map} />
      </div>

      <div className="pointer-events-none absolute left-3 top-1/2 z-20 -translate-y-1/2">
        <Toolbar />
      </div>

      <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2">
        <StatusBar />
      </div>

      <button
        onClick={() => setPanelOpen((v) => !v)}
        aria-label={panelOpen ? "Collapse panel" : "Expand panel"}
        className="absolute right-3 top-20 z-30 grid h-8 w-8 place-items-center rounded-lg border panel-surface text-muted-foreground shadow-xl hover:text-foreground"
        style={{ right: panelOpen ? "21rem" : "0.75rem" }}
      >
        {panelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
      </button>

      {panelOpen ? (
        <aside className="absolute bottom-3 right-3 top-20 z-20 flex w-80 flex-col overflow-hidden rounded-xl border panel-surface shadow-2xl">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <PropertiesPanel />
          </div>
          <div className="h-px bg-border" />
          <div className="flex max-h-[45%] min-h-32 flex-col">
            <LayersPanel />
          </div>
        </aside>
      ) : null}

      {hover ? (
        <div
          className="pointer-events-none absolute z-30 rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-lg"
          style={{ left: hover.x + 14, top: hover.y + 14 }}
        >
          <span className="font-semibold">{hover.name}</span> · Sector {hover.sector}
        </div>
      ) : null}

      {menu ? (
        <ObjectContextMenu
          info={menu}
          onClose={() => setMenu(null)}
          onRename={(id) => {
            const s = usePlanner.getState();
            const o = s.objects.find((x) => x.id === id);
            const name = window.prompt("Rename object", o?.name ?? "");
            if (name !== null) s.updateObject(id, { name });
          }}
        />
      ) : null}
    </main>
  );
}
