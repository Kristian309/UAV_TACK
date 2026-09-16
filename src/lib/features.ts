import type { FeatureCollection, Feature, Geometry } from "geojson";
import { circleRing, sectorMidAngle, sectorRing, destination, type LngLat } from "./geo";
import type { CircleObject, MapObject } from "./types";

export interface Collections {
  fills: FeatureCollection;
  lines: FeatureCollection;
  labels: FeatureCollection;
  points: FeatureCollection;
  handles: FeatureCollection;
}

const empty = (): FeatureCollection => ({ type: "FeatureCollection", features: [] });

function f(geometry: Geometry, properties: Record<string, unknown>, id?: string | number): Feature {
  return { type: "Feature", geometry, properties, ...(id !== undefined ? { id } : {}) };
}

let fid = 1;

export function buildCollections(objects: MapObject[], selectedId: string | null): Collections {
  const c: Collections = {
    fills: empty(),
    lines: empty(),
    labels: empty(),
    points: empty(),
    handles: empty(),
  };

  for (const o of objects) {
    // Older project files did not always persist `visible`. Only an explicit
    // false means hidden; otherwise the object must remain renderable.
    if (o.visible === false) continue;
    const selected = o.id === selectedId;
    const base = { objId: o.id, color: o.color, opacity: o.opacity, selected, name: o.name };

    if (o.type === "12-sector-circle") {
      for (let i = 0; i < 12; i++) {
        const ring = sectorRing(o.center, o.radius, i, o.rotation);
        c.fills.features.push(
          f(
            { type: "Polygon", coordinates: [ring.map((p) => [p[0], p[1]])] },
            { ...base, kind: "sector", sector: i + 1, label: o.labels[i] ?? String(i + 1) },
            fid++,
          ),
        );
        // radial divider
        c.lines.features.push(
          f(
            {
              type: "LineString",
              coordinates: [o.center, ring[1] ?? o.center].map((p) => [p[0], p[1]]),
            },
            { ...base, kind: "radial" },
          ),
        );
        if (o.showLabels) {
          const pos = destination(o.center, sectorMidAngle(i, o.rotation), o.radius * 0.72);
          c.labels.features.push(
            f(
              { type: "Point", coordinates: [pos[0], pos[1]] },
              { ...base, kind: "sector-label", label: o.labels[i] ?? String(i + 1) },
            ),
          );
        }
      }
      c.lines.features.push(
        f(
          { type: "LineString", coordinates: circleRing(o.center, o.radius).map((p) => [p[0], p[1]]) },
          { ...base, kind: "outline" },
        ),
      );
      c.points.features.push(
        f({ type: "Point", coordinates: [o.center[0], o.center[1]] }, { ...base, kind: "center" }),
      );
      if (selected) {
        const h = destination(o.center, 90 + o.rotation, o.radius);
        c.handles.features.push(
          f({ type: "Point", coordinates: [h[0], h[1]] }, { ...base, kind: "resize" }),
        );
      }
    } else if (o.type === "point") {
      c.points.features.push(
        f({ type: "Point", coordinates: [o.position[0], o.position[1]] }, { ...base, kind: "marker" }),
      );
    } else if (o.type === "line" || o.type === "polyline") {
      if (o.path.length > 1) {
        c.lines.features.push(
          f(
            { type: "LineString", coordinates: o.path.map((p) => [p[0], p[1]]) },
            { ...base, kind: "path" },
            fid++,
          ),
        );
      }
      const first = o.path[0];
      if (first) {
        c.points.features.push(
          f({ type: "Point", coordinates: [first[0], first[1]] }, { ...base, kind: "vertex" }),
        );
      }
    } else if (o.type === "polygon" || o.type === "rectangle") {
      const ring = closeRing(o.ring);
      if (ring.length > 3) {
        c.fills.features.push(
          f(
            { type: "Polygon", coordinates: [ring.map((p) => [p[0], p[1]])] },
            { ...base, kind: "area", sector: 0, label: "" },
            fid++,
          ),
        );
        c.lines.features.push(
          f(
            { type: "LineString", coordinates: ring.map((p) => [p[0], p[1]]) },
            { ...base, kind: "outline" },
          ),
        );
      }
    }
  }
  return c;
}

export function closeRing(ring: LngLat[]): LngLat[] {
  if (ring.length < 3) return ring;
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  return first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first];
}

export function rectangleRing(a: LngLat, b: LngLat): LngLat[] {
  return [a, [b[0], a[1]], b, [a[0], b[1]], a];
}

/** GeoJSON export: one feature per object, circles keep their metadata + rendered ring. */
export function toGeoJSON(objects: MapObject[]): FeatureCollection {
  const features: Feature[] = objects.map((o) => {
    if (o.type === "12-sector-circle") {
      const sectors = Array.from({ length: 12 }, (_, i) =>
        sectorRing(o.center, o.radius, i, o.rotation).map((p) => [p[0], p[1]]),
      );
      return f(
        { type: "MultiPolygon", coordinates: sectors.map((s) => [s]) },
        {
          type: "12-sector-circle",
          id: o.id,
          name: o.name,
          center: { latitude: o.center[1], longitude: o.center[0] },
          radius: o.radiusUnit === "km" ? o.radius / 1000 : o.radius,
          radiusUnit: o.radiusUnit,
          color: o.color,
          opacity: o.opacity,
          rotation: o.rotation,
          sectors: 12,
          labels: o.labels,
        },
      );
    }
    if (o.type === "point") {
      return f({ type: "Point", coordinates: o.position }, { ...o });
    }
    if (o.type === "line" || o.type === "polyline") {
      return f({ type: "LineString", coordinates: o.path }, { ...o });
    }
    if (o.type === "polygon" || o.type === "rectangle") {
      return f({ type: "Polygon", coordinates: [closeRing(o.ring)] }, { ...o });
    }
    return f({ type: "Point", coordinates: [0, 0] }, { ...o });
  });
  return { type: "FeatureCollection", features };
}

export function previewCircle(circle: CircleObject): Collections {
  return buildCollections([circle], null);
}
