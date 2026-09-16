import type { LngLat } from "./geo";

export type ToolId =
  | "select"
  | "circle12"
  | "point"
  | "line"
  | "polyline"
  | "polygon"
  | "rectangle"
  | "text"
  | "measure"
  | "delete";

export type RadiusUnit = "m" | "km";

export interface SectorInfo {
  status?: string;
  notes?: string;
}

interface BaseObject {
  id: string;
  name: string;
  color: string;
  opacity: number;
  visible: boolean;
}

export interface CircleObject extends BaseObject {
  type: "12-sector-circle";
  center: LngLat;
  /** always stored in meters */
  radius: number;
  radiusUnit: RadiusUnit;
  rotation: number;
  sectors: 12;
  labels: string[];
  showLabels: boolean;
  sectorInfo: Record<number, SectorInfo>;
}

export interface PointObject extends BaseObject {
  type: "point";
  position: LngLat;
  text?: string;
}

export interface LineObject extends BaseObject {
  type: "line" | "polyline";
  path: LngLat[];
}

export interface AreaObject extends BaseObject {
  type: "polygon" | "rectangle";
  ring: LngLat[];
}

export type MapObject = CircleObject | PointObject | LineObject | AreaObject;

export interface ProjectFile {
  format: "tactical-planner-project";
  version: 1;
  name: string;
  savedAt: string;
  view?: { center: LngLat; zoom: number };
  objects: MapObject[];
}

export const DEFAULT_LABELS = Array.from({ length: 12 }, (_, i) => String(i + 1));

export const PALETTE = [
  "#38bdf8",
  "#22d3ee",
  "#4ade80",
  "#facc15",
  "#fb923c",
  "#f87171",
  "#f472b6",
  "#a78bfa",
];

export function objectLabel(o: MapObject): string {
  switch (o.type) {
    case "12-sector-circle":
      return "12-Sector Circle";
    case "point":
      return "Point";
    case "line":
      return "Line";
    case "polyline":
      return "Polyline";
    case "polygon":
      return "Polygon";
    case "rectangle":
      return "Rectangle";
  }
}
