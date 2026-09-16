import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { MapMouseEvent, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { usePlanner } from "@/lib/store";
import { useView } from "@/lib/view-store";
import { buildCollections, rectangleRing, closeRing } from "@/lib/features";
import {
  distance,
  formatArea,
  formatDistance,
  pathLength,
  ringArea,
  type LngLat,
} from "@/lib/geo";
import type { AreaObject, CircleObject, LineObject, MapObject, PointObject } from "@/lib/types";

const SAT_URL =
  import.meta.env["VITE_SATELLITE_TILE_URL"] ??
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const SAT_ATTRIB =
  import.meta.env["VITE_SATELLITE_ATTRIBUTION"] ?? "Imagery © Esri, Maxar, Earthstar Geographics";

const GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
const FONT = ["Noto Sans Bold"];

const style: StyleSpecification = {
  version: 8,
  glyphs: GLYPHS,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors",
    },
    satellite: {
      type: "raster",
      tiles: [SAT_URL],
      tileSize: 256,
      maxzoom: 19,
      attribution: SAT_ATTRIB,
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#05070d" } },
    {
      id: "osm",
      type: "raster",
      source: "osm",
      paint: {
        "raster-saturation": -0.75,
        "raster-brightness-max": 0.72,
        "raster-contrast": 0.12,
        "raster-opacity": 0.95,
      },
    },
    {
      id: "satellite",
      type: "raster",
      source: "satellite",
      layout: { visibility: "none" },
      paint: { "raster-brightness-max": 0.95 },
    },
  ],
};

const EMPTY = { type: "FeatureCollection", features: [] } as GeoJSON.FeatureCollection;

function addDataLayers(map: maplibregl.Map, p: string, preview: boolean) {
  // Every source and layer is checked independently. A production browser may
  // emit style events between these calls, so one existing layer must not make
  // us assume the complete vector stack is already available.
  for (const key of ["fills", "lines", "labels", "points", "handles"]) {
    if (!map.getSource(`${p}${key}`)) {
      map.addSource(`${p}${key}`, { type: "geojson", data: EMPTY, generateId: false });
    }
  }
  const dim = preview ? 0.7 : 1;

  if (!map.getLayer(`${p}fill`)) {
    map.addLayer({
      id: `${p}fill`,
      type: "fill",
      source: `${p}fills`,
      paint: {
        "fill-color": ["get", "color"],
        "fill-opacity": [
          "*",
          dim,
          [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            ["min", 0.85, ["+", ["get", "opacity"], 0.3]],
            ["get", "opacity"],
          ],
        ],
      },
    });
  }

  if (!map.getLayer(`${p}line`)) {
    map.addLayer({
      id: `${p}line`,
      type: "line",
      source: `${p}lines`,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": ["get", "color"],
        "line-width": [
          "case",
          ["==", ["get", "kind"], "radial"],
          1.3,
          ["boolean", ["get", "selected"], false],
          3.4,
          2.4,
        ],
        "line-opacity": preview ? 0.8 : ["case", ["==", ["get", "kind"], "radial"], 0.85, 1],
        ...(preview ? { "line-dasharray": [2, 1.5] } : {}),
      },
    });
  }

  if (!map.getLayer(`${p}point`)) {
    map.addLayer({
      id: `${p}point`,
      type: "circle",
      source: `${p}points`,
      paint: {
        "circle-radius": ["case", ["==", ["get", "kind"], "center"], 4.5, 6],
        "circle-color": ["get", "color"],
        "circle-stroke-color": "#f8fbff",
        "circle-stroke-width": 1.5,
        "circle-opacity": dim,
      },
    });
  }

  // Text layers are independent from geometry. If an external glyph service
  // is temporarily unavailable, fills, outlines and points remain visible.
  if (!map.getLayer(`${p}label`)) {
    map.addLayer({
      id: `${p}label`,
      type: "symbol",
      source: `${p}labels`,
      layout: {
        "text-field": ["get", "label"],
        "text-font": FONT,
        "text-size": 12,
        "text-allow-overlap": true,
        "text-ignore-placement": true,
        "text-padding": 2,
      },
      paint: {
        "text-color": "#eaf4ff",
        "text-halo-color": "#04070f",
        "text-halo-width": 1.4,
        "text-opacity": dim,
      },
    });
  }

  if (!map.getLayer(`${p}name`)) {
    map.addLayer({
      id: `${p}name`,
      type: "symbol",
      source: `${p}points`,
      filter: ["in", ["get", "kind"], ["literal", ["center", "marker"]]],
      layout: {
        "text-field": ["get", "name"],
        "text-font": FONT,
        "text-size": 12,
        "text-offset": [0, 1.3],
        "text-anchor": "top",
        "text-allow-overlap": true,
      },
      paint: {
        "text-color": "#ffffff",
        "text-halo-color": "#04070f",
        "text-halo-width": 1.6,
        "text-opacity": dim,
      },
    });
  }

  if (!preview && !map.getLayer(`${p}handle`)) {
    map.addLayer({
      id: `${p}handle`,
      type: "circle",
      source: `${p}handles`,
      paint: {
        "circle-radius": 7,
        "circle-color": "#ffffff",
        "circle-stroke-color": ["get", "color"],
        "circle-stroke-width": 3,
      },
    });
  }
}

function setData(map: maplibregl.Map, p: string, data: ReturnType<typeof buildCollections>) {
  (map.getSource(`${p}fills`) as maplibregl.GeoJSONSource | undefined)?.setData(data.fills);
  (map.getSource(`${p}lines`) as maplibregl.GeoJSONSource | undefined)?.setData(data.lines);
  (map.getSource(`${p}labels`) as maplibregl.GeoJSONSource | undefined)?.setData(data.labels);
  (map.getSource(`${p}points`) as maplibregl.GeoJSONSource | undefined)?.setData(data.points);
  (map.getSource(`${p}handles`) as maplibregl.GeoJSONSource | undefined)?.setData(data.handles);
}

function translate(o: MapObject, dLng: number, dLat: number): MapObject {
  const shift = (p: LngLat): LngLat => [p[0] + dLng, p[1] + dLat];
  if (o.type === "12-sector-circle") return { ...o, center: shift(o.center) };
  if (o.type === "point") return { ...o, position: shift(o.position) };
  if (o.type === "line" || o.type === "polyline") return { ...o, path: o.path.map(shift) };
  if (o.type === "polygon" || o.type === "rectangle") return { ...o, ring: o.ring.map(shift) };
  return o;
}

export interface MapViewProps {
  onReady: (map: maplibregl.Map) => void;
  onContextMenu: (info: { x: number; y: number; objId: string | null; lngLat: LngLat }) => void;
}

export default function MapView({ onReady, onContextMenu }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const hoverRef = useRef<number | string | null>(null);
  const dragRef = useRef<{
    mode: "move" | "resize";
    objId: string;
    start: LngLat;
    snapshot: MapObject[];
  } | null>(null);
  const cursorRef = useRef<LngLat | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: [23.3219, 42.6977],
      zoom: 12,
      attributionControl: { compact: true },
      canvasContextAttributes: { preserveDrawingBuffer: true },
      dragRotate: false,
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "bottom-right");
    map.addControl(new maplibregl.FullscreenControl(), "bottom-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    map.on("load", () => {
      syncVectors();
      onReady(map);
      map.resize();
    });

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    const state = () => usePlanner.getState();

    const redraw = () => {
      const s = state();
      setData(map, "", buildCollections(s.objects, s.selectedId));
    };

    const drawPreview = () => {
      const s = state();
      const cur = cursorRef.current;
      const objs: MapObject[] = [];
      if (s.tool === "circle12" && cur && !useView.getState().spacePan) {
        objs.push(makeCircle(cur, s.draft, "preview"));
      }
      if (s.drawing.length > 0) {
        const pts = cur ? [...s.drawing, cur] : s.drawing;
        if (s.tool === "rectangle" && s.drawing[0] && cur) {
          objs.push({
            id: "preview",
            type: "rectangle",
            name: "",
            color: s.draft.color,
            opacity: s.draft.opacity,
            visible: true,
            ring: rectangleRing(s.drawing[0], cur),
          } satisfies AreaObject);
        } else if (s.tool === "polygon") {
          objs.push({
            id: "preview",
            type: "polygon",
            name: "",
            color: s.draft.color,
            opacity: s.draft.opacity,
            visible: true,
            ring: closeRing(pts),
          } satisfies AreaObject);
        } else {
          objs.push({
            id: "preview",
            type: "line",
            name: "",
            color: s.draft.color,
            opacity: s.draft.opacity,
            visible: true,
            path: pts,
          } satisfies LineObject);
        }
      }
      const m = state().measure;
      if (state().tool === "measure" && m.points.length > 0) {
        const pts = cur ? [...m.points, cur] : m.points;
        const meta = { id: "measure", name: "", color: "#f8fafc", opacity: 0.15, visible: true };
        objs.push(
          m.mode === "area"
            ? ({ ...meta, type: "polygon", ring: closeRing(pts) } satisfies AreaObject)
            : ({ ...meta, type: "line", path: pts } satisfies LineObject),
        );
      }
      setData(map, "pv-", buildCollections(objs, null));
    };

    let syncQueued = false;
    const syncVectors = () => {
      if (syncQueued) return;
      syncQueued = true;
      requestAnimationFrame(() => {
        syncQueued = false;
        if (!map.isStyleLoaded()) return;
        addDataLayers(map, "", false);
        addDataLayers(map, "pv-", true);
        redraw();
        drawPreview();
        map.triggerRepaint();
      });
    };

    const unsub = usePlanner.subscribe(() => {
      syncVectors();
    });

    map.on("webglcontextrestored", syncVectors);
    map.on("style.load", syncVectors);
    map.on("styledata", syncVectors);
    map.once("idle", syncVectors);

    // ---- pointer tracking -------------------------------------------------
    map.on("mousemove", (e: MapMouseEvent) => {
      const cur: LngLat = [e.lngLat.lng, e.lngLat.lat];
      cursorRef.current = cur;
      useView.getState().setCursor(cur[0], cur[1]);

      const drag = dragRef.current;
      if (drag) {
        const s = state();
        const obj = s.objects.find((o) => o.id === drag.objId);
        if (!obj) return;
        if (drag.mode === "move") {
          const moved = translate(obj, cur[0] - drag.start[0], cur[1] - drag.start[1]);
          drag.start = cur;
          s.updateObject(obj.id, moved, { history: false });
        } else if (obj.type === "12-sector-circle") {
          const r = Math.max(10, distance(obj.center, cur));
          s.updateObject(obj.id, { radius: r }, { history: false });
        }
        return;
      }

      drawPreview();

      const feats = map.queryRenderedFeatures(e.point, { layers: ["fill"] });
      const top = feats[0];
      if (hoverRef.current !== null) {
        map.setFeatureState({ source: "fills", id: hoverRef.current }, { hover: false });
        hoverRef.current = null;
      }
      if (top && top.id !== undefined && top.properties?.["kind"] === "sector") {
        hoverRef.current = top.id;
        map.setFeatureState({ source: "fills", id: top.id }, { hover: true });
        useView.getState().setHover({
          objId: String(top.properties["objId"]),
          name: String(top.properties["name"]),
          sector: Number(top.properties["sector"]),
          x: e.point.x,
          y: e.point.y,
        });
      } else {
        useView.getState().setHover(null);
      }
    });

    map.on("mouseout", () => {
      cursorRef.current = null;
      useView.getState().setHover(null);
      drawPreview();
    });

    map.on("move", () => useView.getState().setZoom(map.getZoom()));

    // ---- drag start / end -------------------------------------------------
    map.on("mousedown", (e: MapMouseEvent) => {
      const s = state();
      if (s.tool !== "select" || useView.getState().spacePan) return;
      const cur: LngLat = [e.lngLat.lng, e.lngLat.lat];
      const handles = map.queryRenderedFeatures(e.point, { layers: ["handle"] });
      const hit = handles[0];
      if (hit && s.selectedId) {
        dragRef.current = { mode: "resize", objId: s.selectedId, start: cur, snapshot: s.objects };
        map.dragPan.disable();
        e.preventDefault();
        return;
      }
      const feats = map.queryRenderedFeatures(e.point, { layers: ["fill", "point", "line"] });
      const f = feats[0];
      const objId = f?.properties?.["objId"];
      if (typeof objId === "string") {
        const sector = f?.properties?.["sector"];
        s.select(objId, typeof sector === "number" && sector > 0 ? sector : null);
        dragRef.current = { mode: "move", objId, start: cur, snapshot: s.objects };
        map.dragPan.disable();
        e.preventDefault();
      }
    });

    const endDrag = () => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      map.dragPan.enable();
      usePlanner.getState().pushHistory(drag.snapshot);
    };
    map.on("mouseup", endDrag);
    window.addEventListener("mouseup", endDrag);

    // ---- click handling ---------------------------------------------------
    map.on("click", (e: MapMouseEvent) => {
      const s = state();
      if (useView.getState().spacePan) return;
      const pt: LngLat = [e.lngLat.lng, e.lngLat.lat];
      const feats = map.queryRenderedFeatures(e.point, { layers: ["fill", "point", "line"] });
      const objId = feats[0]?.properties?.["objId"];

      switch (s.tool) {
        case "select": {
          if (typeof objId !== "string") s.select(null);
          break;
        }
        case "delete": {
          if (typeof objId === "string") s.removeObject(objId);
          break;
        }
        case "circle12": {
          const circle = makeCircle(pt, s.draft, s.nextId("circle"));
          s.addObject(circle);
          // keep the circle readable: zoom in if it would render smaller than ~70px
          const mpp = (156543.03392 * Math.cos((pt[1] * Math.PI) / 180)) / 2 ** map.getZoom();
          const px = circle.radius / mpp;
          if (px < 70) {
            const target = map.getZoom() + Math.log2(70 / Math.max(px, 0.5));
            map.easeTo({ center: pt, zoom: Math.min(target, 19), duration: 500 });
          }
          break;
        }
        case "point":
        case "text": {
          s.addObject({
            id: s.nextId("point"),
            type: "point",
            name: s.tool === "text" ? s.draft.name : `Point ${s.objects.length + 1}`,
            color: s.draft.color,
            opacity: 1,
            visible: true,
            position: pt,
          } satisfies PointObject);
          break;
        }
        case "line":
        case "polyline":
        case "polygon": {
          s.setDrawing([...s.drawing, pt]);
          break;
        }
        case "rectangle": {
          if (s.drawing.length === 0) s.setDrawing([pt]);
          else {
            const a = s.drawing[0]!;
            s.addObject({
              id: s.nextId("rectangle"),
              type: "rectangle",
              name: `Rectangle ${s.objects.length + 1}`,
              color: s.draft.color,
              opacity: s.draft.opacity,
              visible: true,
              ring: rectangleRing(a, pt),
            } satisfies AreaObject);
            s.setDrawing([]);
          }
          break;
        }
        case "measure": {
          const pts = [...s.measure.points, pt];
          s.setMeasure({ points: pts });
          useView
            .getState()
            .setMeasureResult(
              s.measure.mode === "area"
                ? `Area ${formatArea(ringArea(pts))} · Perimeter ${formatDistance(pathLength(closeRing(pts)))}`
                : `Distance ${formatDistance(pathLength(pts))}`,
            );
          break;
        }
      }
      drawPreview();
    });

    map.on("dblclick", (e: MapMouseEvent) => {
      const s = state();
      if (s.tool === "line" || s.tool === "polyline" || s.tool === "polygon") {
        e.preventDefault();
        finishDrawing();
      }
    });

    map.on("contextmenu", (e: MapMouseEvent) => {
      e.preventDefault();
      const feats = map.queryRenderedFeatures(e.point, { layers: ["fill", "point", "line"] });
      const objId = feats[0]?.properties?.["objId"];
      onContextMenu({
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
        objId: typeof objId === "string" ? objId : null,
        lngLat: [e.lngLat.lng, e.lngLat.lat],
      });
    });

    return () => {
      unsub();
      ro.disconnect();
      map.off("webglcontextrestored", syncVectors);
      map.off("style.load", syncVectors);
      map.off("styledata", syncVectors);
      window.removeEventListener("mouseup", endDrag);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // base map switching
  const baseMap = usePlanner((s) => s.baseMap);
  useEffect(() => {
    const map = mapRef.current;
    const apply = () => {
      const m = mapRef.current;
      if (!m || !m.isStyleLoaded()) return;
      m.setLayoutProperty("osm", "visibility", baseMap === "map" ? "visible" : "none");
      m.setLayoutProperty("satellite", "visibility", baseMap === "satellite" ? "visible" : "none");
    };
    apply();
    const t = setTimeout(apply, 500);
    return () => clearTimeout(t);
  }, [baseMap]);

  // cursor style
  const tool = usePlanner((s) => s.tool);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = tool === "select" ? "" : "crosshair";
    map.doubleClickZoom[tool === "select" ? "enable" : "disable"]();
  }, [tool]);

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}

export function finishDrawing() {
  const s = usePlanner.getState();
  const pts = s.drawing;
  if (pts.length < 2) {
    s.setDrawing([]);
    return;
  }
  if (s.tool === "polygon") {
    s.addObject({
      id: s.nextId("polygon"),
      type: "polygon",
      name: `Polygon ${s.objects.length + 1}`,
      color: s.draft.color,
      opacity: s.draft.opacity,
      visible: true,
      ring: closeRing(pts),
    } satisfies AreaObject);
  } else {
    s.addObject({
      id: s.nextId("line"),
      type: s.tool === "polyline" ? "polyline" : "line",
      name: `${s.tool === "polyline" ? "Polyline" : "Line"} ${s.objects.length + 1}`,
      color: s.draft.color,
      opacity: 1,
      visible: true,
      path: pts,
    } satisfies LineObject);
  }
  s.setDrawing([]);
}

export function makeCircle(
  center: LngLat,
  draft: ReturnType<typeof usePlanner.getState>["draft"],
  id: string,
): CircleObject {
  return {
    id,
    type: "12-sector-circle",
    name: draft.name || "Sector Circle",
    color: draft.color,
    opacity: draft.opacity,
    visible: true,
    center,
    radius: draft.radiusUnit === "km" ? draft.radius * 1000 : draft.radius,
    radiusUnit: draft.radiusUnit,
    rotation: draft.rotation,
    sectors: 12,
    labels: Array.from({ length: 12 }, (_, i) => String(i + 1)),
    showLabels: draft.showLabels,
    sectorInfo: {},
  };
}
