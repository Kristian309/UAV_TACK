import { toGeoJSON } from "./features";
import type { LngLat } from "./geo";
import type { CircleObject, MapObject, ProjectFile } from "./types";

export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportGeoJSON(objects: MapObject[], name: string) {
  download(`${slug(name)}.geojson`, JSON.stringify(toGeoJSON(objects), null, 2), "application/geo+json");
}

export function exportProject(project: ProjectFile) {
  download(`${slug(project.name)}.json`, JSON.stringify(project, null, 2), "application/json");
}

export function exportPNG(canvas: HTMLCanvasElement, name: string) {
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug(name)}.png`;
  a.click();
}

export function slug(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
}

const STORAGE_KEY = "tactical-planner:projects";

export function listSaved(): ProjectFile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ProjectFile[]) : [];
  } catch {
    return [];
  }
}

export function saveProject(project: ProjectFile) {
  const all = listSaved().filter((p) => p.name !== project.name);
  all.unshift(project);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all.slice(0, 30)));
}

export function deleteSaved(name: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(listSaved().filter((p) => p.name !== name)));
}

const DEMO_SPECS: Array<[string, number, number, number, string, number]> = [
  ["Alpha Zone", 0, 0, 900, "#38bdf8", 0],
  ["Bravo Ring", 0.028, 0.012, 1500, "#4ade80", 15],
  ["Charlie Point", -0.03, 0.016, 600, "#facc15", 0],
  ["Delta Perimeter", -0.015, -0.022, 2200, "#f87171", 30],
  ["Echo Grid", 0.035, -0.02, 1100, "#a78bfa", 7.5],
];

export function demoObjects(center: LngLat, nextId: (p: string) => string): CircleObject[] {
  return DEMO_SPECS.map(([name, dLng, dLat, radius, color, rotation]) => ({
    id: nextId("circle"),
    type: "12-sector-circle" as const,
    name,
    color,
    opacity: 0.22,
    visible: true,
    center: [center[0] + dLng, center[1] + dLat] as LngLat,
    radius,
    radiusUnit: "m" as const,
    rotation,
    sectors: 12 as const,
    labels: Array.from({ length: 12 }, (_, i) => String(i + 1)),
    showLabels: true,
    sectorInfo: {},
  }));
}
