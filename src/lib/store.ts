import { create } from "zustand";
import type { LngLat } from "./geo";
import {
  DEFAULT_LABELS,
  PALETTE,
  type MapObject,
  type ProjectFile,
  type RadiusUnit,
  type ToolId,
} from "./types";

export interface CircleDraft {
  name: string;
  radius: number;
  radiusUnit: RadiusUnit;
  color: string;
  opacity: number;
  rotation: number;
  showLabels: boolean;
}

export type BaseMap = "map" | "satellite";

export interface MeasureState {
  mode: "distance" | "area";
  points: LngLat[];
}

interface PlannerState {
  projectName: string;
  objects: MapObject[];
  selectedId: string | null;
  selectedSector: number | null;
  tool: ToolId;
  baseMap: BaseMap;
  draft: CircleDraft;
  drawing: LngLat[];
  measure: MeasureState;
  past: MapObject[][];
  future: MapObject[][];
  counter: number;

  setTool: (t: ToolId) => void;
  setBaseMap: (b: BaseMap) => void;
  setDraft: (patch: Partial<CircleDraft>) => void;
  setProjectName: (n: string) => void;
  setDrawing: (pts: LngLat[]) => void;
  setMeasure: (m: Partial<MeasureState>) => void;

  select: (id: string | null, sector?: number | null) => void;
  addObject: (o: MapObject) => void;
  updateObject: (id: string, patch: Partial<MapObject>, opts?: { history?: boolean }) => void;
  pushHistory: (snapshot: MapObject[]) => void;
  removeObject: (id: string) => void;
  duplicateObject: (id: string) => void;
  toggleVisible: (id: string) => void;
  undo: () => void;
  redo: () => void;
  newProject: () => void;
  loadProject: (p: ProjectFile) => void;
  nextId: (prefix: string) => string;
  nextColor: () => string;
}

const initialDraft: CircleDraft = {
  name: "Sector Circle",
  radius: 500,
  radiusUnit: "m",
  color: PALETTE[0]!,
  opacity: 0.25,
  rotation: 0,
  showLabels: true,
};

function normalizeObject(o: MapObject): MapObject {
  const common = {
    ...o,
    visible: o.visible !== false,
    color: o.color || PALETTE[0]!,
    opacity: Number.isFinite(o.opacity) ? o.opacity : 0.25,
  };
  if (common.type === "12-sector-circle") {
    return {
      ...common,
      radius: Math.max(1, Number(common.radius) || 500),
      radiusUnit: common.radiusUnit === "km" ? "km" : "m",
      rotation: Number(common.rotation) || 0,
      sectors: 12,
      labels: Array.from({ length: 12 }, (_, i) => common.labels?.[i] ?? String(i + 1)),
      showLabels: common.showLabels !== false,
      sectorInfo: common.sectorInfo ?? {},
    };
  }
  return common;
}

export const usePlanner = create<PlannerState>((set, get) => ({
  projectName: "Untitled Project",
  objects: [],
  selectedId: null,
  selectedSector: null,
  tool: "select",
  baseMap: "map",
  draft: initialDraft,
  drawing: [],
  measure: { mode: "distance", points: [] },
  past: [],
  future: [],
  counter: 0,

  setTool: (tool) => set({ tool, drawing: [], measure: { ...get().measure, points: [] } }),
  setBaseMap: (baseMap) => set({ baseMap }),
  setDraft: (patch) => set({ draft: { ...get().draft, ...patch } }),
  setProjectName: (projectName) => set({ projectName }),
  setDrawing: (drawing) => set({ drawing }),
  setMeasure: (m) => set({ measure: { ...get().measure, ...m } }),

  select: (id, sector = null) => set({ selectedId: id, selectedSector: sector }),

  addObject: (o) =>
    set((s) => ({
      past: [...s.past, s.objects],
      future: [],
      objects: [...s.objects, o],
      selectedId: o.id,
    })),

  updateObject: (id, patch, opts) =>
    set((s) => ({
      past: opts?.history === false ? s.past : [...s.past, s.objects],
      future: opts?.history === false ? s.future : [],
      objects: s.objects.map((o) => (o.id === id ? ({ ...o, ...patch } as MapObject) : o)),
    })),

  pushHistory: (snapshot) => set((s) => ({ past: [...s.past, snapshot], future: [] })),

  removeObject: (id) =>
    set((s) => ({
      past: [...s.past, s.objects],
      future: [],
      objects: s.objects.filter((o) => o.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),

  duplicateObject: (id) => {
    const src = get().objects.find((o) => o.id === id);
    if (!src) return;
    const copy = JSON.parse(JSON.stringify(src)) as MapObject;
    copy.id = get().nextId(src.type);
    copy.name = `${src.name} copy`;
    if (copy.type === "12-sector-circle") copy.center = [copy.center[0] + 0.004, copy.center[1]];
    if (copy.type === "point") copy.position = [copy.position[0] + 0.004, copy.position[1]];
    if (copy.type === "line" || copy.type === "polyline")
      copy.path = copy.path.map(([x, y]) => [x + 0.004, y] as LngLat);
    if (copy.type === "polygon" || copy.type === "rectangle")
      copy.ring = copy.ring.map(([x, y]) => [x + 0.004, y] as LngLat);
    get().addObject(copy);
  },

  toggleVisible: (id) =>
    set((s) => ({
      objects: s.objects.map((o) => (o.id === id ? { ...o, visible: !o.visible } : o)),
    })),

  undo: () =>
    set((s) => {
      const prev = s.past[s.past.length - 1];
      if (!prev) return s;
      return { past: s.past.slice(0, -1), future: [s.objects, ...s.future], objects: prev };
    }),

  redo: () =>
    set((s) => {
      const next = s.future[0];
      if (!next) return s;
      return { past: [...s.past, s.objects], future: s.future.slice(1), objects: next };
    }),

  newProject: () =>
    set((s) => ({
      past: [...s.past, s.objects],
      future: [],
      objects: [],
      selectedId: null,
      selectedSector: null,
      projectName: "Untitled Project",
    })),

  loadProject: (p) =>
    set((s) => ({
      past: [...s.past, s.objects],
      future: [],
      objects: p.objects.map(normalizeObject),
      projectName: p.name,
      selectedId: null,
      selectedSector: null,
      counter: s.counter + p.objects.length,
    })),

  nextId: (prefix) => {
    const n = get().counter + 1;
    set({ counter: n });
    return `${prefix}-${n}-${Math.random().toString(36).slice(2, 7)}`;
  },

  nextColor: () => PALETTE[get().objects.length % PALETTE.length]!,
}));

export const DEFAULT_CIRCLE_LABELS = DEFAULT_LABELS;
