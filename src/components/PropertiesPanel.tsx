import { Copy, Trash2, Sparkles } from "lucide-react";
import { usePlanner } from "@/lib/store";
import { PALETTE, objectLabel, type CircleObject, type MapObject } from "@/lib/types";
import { cn } from "@/lib/utils";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-border bg-input/60 px-2 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-primary/70";

function Swatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PALETTE.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          aria-label={`Color ${c}`}
          className={cn(
            "h-6 w-6 rounded-md border transition-transform hover:scale-110",
            value.toLowerCase() === c.toLowerCase() ? "border-foreground" : "border-border",
          )}
          style={{ backgroundColor: c }}
        />
      ))}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Custom color"
        className="h-6 w-8 cursor-pointer rounded-md border border-border bg-transparent"
      />
    </div>
  );
}

function Slider({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
    />
  );
}

export function PropertiesPanel() {
  const { objects, selectedId, selectedSector, draft, setDraft, updateObject, removeObject, duplicateObject } =
    usePlanner();
  const selected = objects.find((o) => o.id === selectedId) ?? null;

  if (!selected) {
    const maxRadius = draft.radiusUnit === "km" ? 100 : 20000;
    return (
      <section className="space-y-4 p-3">
        <header className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em]">Circle Defaults</h2>
        </header>
        <Row label="Name">
          <input
            className={inputCls}
            value={draft.name}
            onChange={(e) => setDraft({ name: e.target.value })}
          />
        </Row>
        <Row label={`Radius (${draft.radiusUnit})`}>
          <div className="flex items-center gap-2">
            <Slider
              value={draft.radius}
              min={draft.radiusUnit === "km" ? 0.1 : 50}
              max={maxRadius}
              step={draft.radiusUnit === "km" ? 0.1 : 50}
              onChange={(radius) => setDraft({ radius })}
            />
            <input
              type="number"
              className={cn(inputCls, "w-20 font-mono text-xs")}
              value={draft.radius}
              onChange={(e) => setDraft({ radius: Math.max(0.01, Number(e.target.value)) })}
            />
            <select
              className={cn(inputCls, "w-16 text-xs")}
              value={draft.radiusUnit}
              onChange={(e) => {
                const unit = e.target.value as "m" | "km";
                setDraft({
                  radiusUnit: unit,
                  radius: unit === "km" ? draft.radius / 1000 : draft.radius * 1000,
                });
              }}
            >
              <option value="m">m</option>
              <option value="km">km</option>
            </select>
          </div>
        </Row>
        <Row label="Color">
          <Swatches value={draft.color} onChange={(color) => setDraft({ color })} />
        </Row>
        <Row label={`Opacity · ${Math.round(draft.opacity * 100)}%`}>
          <Slider
            value={draft.opacity}
            min={0.05}
            max={0.8}
            step={0.05}
            onChange={(opacity) => setDraft({ opacity })}
          />
        </Row>
        <Row label={`Rotation · ${draft.rotation.toFixed(1)}°`}>
          <Slider
            value={draft.rotation}
            min={0}
            max={359}
            step={0.5}
            onChange={(rotation) => setDraft({ rotation })}
          />
        </Row>
        <label className="flex items-center justify-between rounded-md border border-border bg-input/40 px-2 py-1.5 text-xs">
          Sector labels 1–12
          <input
            type="checkbox"
            checked={draft.showLabels}
            onChange={(e) => setDraft({ showLabels: e.target.checked })}
            className="h-4 w-4 accent-primary"
          />
        </label>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Pick the <span className="text-primary">12-Sector Circle</span> tool, hover the map for a live
          preview, then click to place. The tool stays active for unlimited placements.
        </p>
      </section>
    );
  }

  const patch = (p: Partial<MapObject>) => updateObject(selected.id, p);
  const circle = selected.type === "12-sector-circle" ? (selected as CircleObject) : null;
  const displayRadius = circle
    ? circle.radiusUnit === "km"
      ? circle.radius / 1000
      : circle.radius
    : 0;

  return (
    <section className="space-y-4 p-3">
      <header className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em]">{objectLabel(selected)}</h2>
        <div className="flex gap-1">
          <button
            onClick={() => duplicateObject(selected.id)}
            title="Duplicate"
            className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => removeObject(selected.id)}
            title="Delete"
            className="grid h-7 w-7 place-items-center rounded-md border border-border text-destructive hover:bg-destructive/15"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <Row label="Name">
        <input className={inputCls} value={selected.name} onChange={(e) => patch({ name: e.target.value })} />
      </Row>

      {circle && (
        <>
          <Row label={`Radius (${circle.radiusUnit})`}>
            <div className="flex items-center gap-2">
              <Slider
                value={displayRadius}
                min={circle.radiusUnit === "km" ? 0.05 : 50}
                max={circle.radiusUnit === "km" ? 100 : 20000}
                step={circle.radiusUnit === "km" ? 0.05 : 25}
                onChange={(v) => patch({ radius: circle.radiusUnit === "km" ? v * 1000 : v })}
              />
              <input
                type="number"
                className={cn(inputCls, "w-20 font-mono text-xs")}
                value={Number(displayRadius.toFixed(2))}
                onChange={(e) =>
                  patch({
                    radius: Math.max(
                      5,
                      circle.radiusUnit === "km" ? Number(e.target.value) * 1000 : Number(e.target.value),
                    ),
                  })
                }
              />
              <select
                className={cn(inputCls, "w-16 text-xs")}
                value={circle.radiusUnit}
                onChange={(e) => patch({ radiusUnit: e.target.value as "m" | "km" })}
              >
                <option value="m">m</option>
                <option value="km">km</option>
              </select>
            </div>
          </Row>
          <Row label={`Rotation · ${circle.rotation.toFixed(1)}°`}>
            <Slider
              value={circle.rotation}
              min={0}
              max={359}
              step={0.5}
              onChange={(rotation) => patch({ rotation })}
            />
          </Row>
          <label className="flex items-center justify-between rounded-md border border-border bg-input/40 px-2 py-1.5 text-xs">
            Sector labels 1–12
            <input
              type="checkbox"
              checked={circle.showLabels}
              onChange={(e) => patch({ showLabels: e.target.checked })}
              className="h-4 w-4 accent-primary"
            />
          </label>
          <div className="rounded-md border border-border bg-input/30 px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
            center {circle.center[1].toFixed(5)}, {circle.center[0].toFixed(5)}
            <br />
            12 sectors × 30.0°
          </div>
        </>
      )}

      <Row label="Color">
        <Swatches value={selected.color} onChange={(color) => patch({ color })} />
      </Row>
      <Row label={`Opacity · ${Math.round(selected.opacity * 100)}%`}>
        <Slider
          value={selected.opacity}
          min={0.05}
          max={1}
          step={0.05}
          onChange={(opacity) => patch({ opacity })}
        />
      </Row>

      {circle && selectedSector ? (
        <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/10 p-2">
          <div className="text-xs font-semibold text-primary">Sector {selectedSector}</div>
          <input
            className={inputCls}
            placeholder="Status"
            value={circle.sectorInfo[selectedSector]?.status ?? ""}
            onChange={(e) =>
              patch({
                sectorInfo: {
                  ...circle.sectorInfo,
                  [selectedSector]: { ...circle.sectorInfo[selectedSector], status: e.target.value },
                },
              } as Partial<MapObject>)
            }
          />
          <textarea
            className={cn(inputCls, "h-16 resize-none")}
            placeholder="Notes"
            value={circle.sectorInfo[selectedSector]?.notes ?? ""}
            onChange={(e) =>
              patch({
                sectorInfo: {
                  ...circle.sectorInfo,
                  [selectedSector]: { ...circle.sectorInfo[selectedSector], notes: e.target.value },
                },
              } as Partial<MapObject>)
            }
          />
        </div>
      ) : null}
    </section>
  );
}
