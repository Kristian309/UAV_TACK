import { useState } from "react";
import type * as maplibregl from "maplibre-gl";
import { Search, Map as MapIcon, Satellite, Download, Save, FilePlus, FolderOpen, Sparkles } from "lucide-react";
import { usePlanner } from "@/lib/store";
import { parseCoordinates } from "@/lib/geo";
import {
  demoObjects,
  exportGeoJSON,
  exportPNG,
  exportProject,
  listSaved,
  saveProject,
} from "@/lib/project";
import type { ProjectFile } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TopBar({ map }: { map: maplibregl.Map | null }) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openLoad, setOpenLoad] = useState(false);
  const projectName = usePlanner((s) => s.projectName);
  const setProjectName = usePlanner((s) => s.setProjectName);
  const baseMap = usePlanner((s) => s.baseMap);
  const setBaseMap = usePlanner((s) => s.setBaseMap);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !map) return;
    setError(null);
    const coords = parseCoordinates(query);
    if (coords) {
      map.flyTo({ center: coords, zoom: 14 });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
      );
      const data = (await res.json()) as Array<{ lat: string; lon: string }>;
      const hit = data[0];
      if (!hit) setError("No result");
      else map.flyTo({ center: [Number(hit.lon), Number(hit.lat)], zoom: 13 });
    } catch {
      setError("Search failed");
    } finally {
      setBusy(false);
    }
  };

  const currentProject = (): ProjectFile => {
    const s = usePlanner.getState();
    const c = map?.getCenter();
    return {
      format: "tactical-planner-project",
      version: 1,
      name: s.projectName,
      savedAt: new Date().toISOString(),
      ...(c ? { view: { center: [c.lng, c.lat] as [number, number], zoom: map!.getZoom() } } : {}),
      objects: s.objects,
    };
  };

  const showProject = (project: ProjectFile) => {
    usePlanner.getState().loadProject(project);
    if (!map) return;
    if (project.view) {
      map.jumpTo({ center: project.view.center, zoom: project.view.zoom });
      return;
    }

    const coordinates = project.objects.flatMap((object): [number, number][] => {
      if (object.type === "12-sector-circle") return [object.center];
      if (object.type === "point") return [object.position];
      if (object.type === "line" || object.type === "polyline") return object.path;
      if (object.type === "polygon" || object.type === "rectangle") return object.ring;
      return [];
    });
    const first = coordinates[0];
    if (!first) return;
    let [west, south] = first;
    let [east, north] = first;
    for (const [lng, lat] of coordinates) {
      west = Math.min(west, lng);
      east = Math.max(east, lng);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
    }
    map.fitBounds([west, south, east, north], { padding: 100, maxZoom: 16, duration: 0 });
  };

  const loadDemo = () => {
    const s = usePlanner.getState();
    const c = map?.getCenter();
    const center: [number, number] = c ? [c.lng, c.lat] : [23.3219, 42.6977];
    for (const o of demoObjects(center, s.nextId)) s.addObject(o);
    map?.flyTo({ center, zoom: 12 });
  };

  const openFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const p = JSON.parse(await file.text()) as ProjectFile;
        if (Array.isArray(p.objects)) showProject(p);
      } catch {
        setError("Invalid project file");
      }
    };
    input.click();
  };

  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl border panel-surface px-2 py-1.5 shadow-2xl">
      <input
        value={projectName}
        onChange={(e) => setProjectName(e.target.value)}
        aria-label="Project name"
        className="w-40 rounded-md bg-transparent px-2 py-1 text-sm font-semibold text-foreground outline-none focus:bg-accent/50"
      />
      <div className="h-6 w-px bg-border" />

      <form onSubmit={search} className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={busy ? "Searching…" : "Search place or 42.69, 23.32"}
          aria-label="Search location"
          className="w-64 rounded-md border border-border bg-background/60 py-1 pl-7 pr-2 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
        />
      </form>
      {error ? <span className="text-[11px] text-destructive">{error}</span> : null}

      <div className="flex overflow-hidden rounded-md border border-border">
        <Tab active={baseMap === "map"} onClick={() => setBaseMap("map")} icon={<MapIcon className="h-3.5 w-3.5" />}>
          Map
        </Tab>
        <Tab
          active={baseMap === "satellite"}
          onClick={() => setBaseMap("satellite")}
          icon={<Satellite className="h-3.5 w-3.5" />}
        >
          Satellite
        </Tab>
      </div>

      <div className="h-6 w-px bg-border" />

      <Btn onClick={() => usePlanner.getState().newProject()} icon={<FilePlus className="h-3.5 w-3.5" />}>
        New
      </Btn>
      <Btn
        onClick={() => {
          saveProject(currentProject());
          setError(null);
        }}
        icon={<Save className="h-3.5 w-3.5" />}
      >
        Save
      </Btn>
      <div className="relative">
        <Btn onClick={() => setOpenLoad((v) => !v)} icon={<FolderOpen className="h-3.5 w-3.5" />}>
          Load
        </Btn>
        {openLoad ? (
          <div className="absolute right-0 top-9 z-50 w-56 rounded-lg border panel-surface p-1 shadow-2xl">
            <button
              onClick={() => {
                openFile();
                setOpenLoad(false);
              }}
              className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
            >
              Open project file…
            </button>
            <div className="my-1 h-px bg-border" />
            {listSaved().length === 0 ? (
              <p className="px-2 py-1.5 text-[11px] text-muted-foreground">No saved projects</p>
            ) : (
              listSaved().map((p) => (
                <button
                  key={p.name}
                  onClick={() => {
                    showProject(p);
                    setOpenLoad(false);
                  }}
                  className="w-full truncate rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
                >
                  {p.name}
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>
      <Btn onClick={() => exportProject(currentProject())} icon={<Download className="h-3.5 w-3.5" />}>
        JSON
      </Btn>
      <Btn
        onClick={() => exportGeoJSON(usePlanner.getState().objects, projectName)}
        icon={<Download className="h-3.5 w-3.5" />}
      >
        GeoJSON
      </Btn>
      <Btn
        onClick={() => map && exportPNG(map.getCanvas(), projectName)}
        icon={<Download className="h-3.5 w-3.5" />}
      >
        PNG
      </Btn>
      <Btn onClick={loadDemo} icon={<Sparkles className="h-3.5 w-3.5" />}>
        Load Demo
      </Btn>
    </div>
  );
}

function Btn({
  onClick,
  icon,
  children,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {icon}
      {children}
    </button>
  );
}

function Tab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 text-xs transition-colors",
        active ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-accent",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
