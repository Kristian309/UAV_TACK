import { create } from "zustand";

interface ViewState {
  lng: number;
  lat: number;
  zoom: number;
  hover: { objId: string; name: string; sector: number; x: number; y: number } | null;
  spacePan: boolean;
  measureResult: string | null;
  setCursor: (lng: number, lat: number) => void;
  setZoom: (z: number) => void;
  setHover: (h: ViewState["hover"]) => void;
  setSpacePan: (v: boolean) => void;
  setMeasureResult: (v: string | null) => void;
}

export const useView = create<ViewState>((set) => ({
  lng: 0,
  lat: 0,
  zoom: 12,
  hover: null,
  spacePan: false,
  measureResult: null,
  setCursor: (lng, lat) => set({ lng, lat }),
  setZoom: (zoom) => set({ zoom }),
  setHover: (hover) => set({ hover }),
  setSpacePan: (spacePan) => set({ spacePan }),
  setMeasureResult: (measureResult) => set({ measureResult }),
}));
