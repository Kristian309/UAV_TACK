import { usePlanner } from "@/lib/store";
import { useView } from "@/lib/view-store";
import { formatLatLng } from "@/lib/geo";

export function StatusBar() {
  const lng = useView((s) => s.lng);
  const lat = useView((s) => s.lat);
  const zoom = useView((s) => s.zoom);
  const measureResult = useView((s) => s.measureResult);
  const tool = usePlanner((s) => s.tool);
  const count = usePlanner((s) => s.objects.length);

  return (
    <div className="pointer-events-auto flex items-center gap-4 rounded-lg border panel-surface px-3 py-1.5 font-mono text-[11px] text-muted-foreground shadow-xl">
      <span className="uppercase tracking-wider text-foreground">{tool}</span>
      <span>{formatLatLng(lat, lng)}</span>
      <span>Z {zoom.toFixed(2)}</span>
      <span>{count} obj</span>
      {measureResult ? <span className="text-primary">{measureResult}</span> : null}
    </div>
  );
}
