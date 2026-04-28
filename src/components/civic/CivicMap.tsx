/*eslint-disable*/

import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import { CATEGORIES, STATUSES, type Report, type Category, type Status, timeAgo } from "@/data/reports";
import { authFetch } from "@/data/login";

// ─── Types ────────────────────────────────────────────────────────────────────

type FlyToTarget = {
  center: [number, number];
  zoom:   number;
  seq?:   number;
};

type Props = {
  reports:        Report[];
  height?:        string;
  onSelect?:      (r: Report) => void;
  pickMode?:      boolean;
  onPick?:        (lat: number, lng: number) => void;
  onDrag?:        (lat: number, lng: number) => void;
  pickedPos?:     { lat: number; lng: number } | null;
  draggable?:     boolean;
  initialCenter?: [number, number];
  initialZoom?:   number;
  flyTo?:         FlyToTarget | null;
  showHeatmap?:   boolean;
  /**
   * Path API untuk fetch data heatmap.
   * Default: /api/reports/heatmap  (butuh admin auth)
   * Landing page publik: /api/reports/heatmap/public  (tanpa auth)
   */
  heatmapApiPath?: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_HEX: Record<Category, string> = {
  waste:   "#7E2233",
  infra:   "#E5C100",
  disturb: "#E03A3A",
  land:    "#E08A2A",
};

const HEAT_GRADIENT: Record<number, string> = {
  0.0: "#00ff00",
  0.3: "#80ff00",
  0.5: "#ffff00",
  0.7: "#ff8800",
  1.0: "#ff0000",
};

// ─── leaflet.heat dynamic loader ──────────────────────────────────────────────
let _heatPromise: Promise<void> | null = null;

function loadHeatPlugin(): Promise<void> {
  if (typeof (L as any).heatLayer === "function") return Promise.resolve();
  if (_heatPromise) return _heatPromise;

  _heatPromise = new Promise<void>((resolve, reject) => {
    (window as any).L = L;

    const script     = document.createElement("script");
    script.src       = "https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js";
    script.async     = true;
    script.onload    = () => {
      if (typeof (L as any).heatLayer === "function") resolve();
      else reject(new Error("leaflet.heat loaded tapi L.heatLayer tidak terdaftar"));
    };
    script.onerror   = () => { _heatPromise = null; reject(new Error("Gagal mengunduh leaflet.heat dari CDN")); };
    document.head.appendChild(script);
  });

  return _heatPromise;
}

// ─── Icon helpers ─────────────────────────────────────────────────────────────

function makeIcon(cat: Category, active = false) {
  const color = CATEGORY_HEX[cat];
  const glow  = active ? `box-shadow:0 0 0 6px ${color}33, 0 0 22px ${color};` : "";
  return L.divIcon({
    className:   "civic-marker",
    html:        `<div class="pin" style="background:${color};--marker-glow:${color}aa;${glow}"></div>`,
    iconSize:    [28, 28],
    iconAnchor:  [14, 26],
    popupAnchor: [0, -28],
  });
}

function makePickIcon(isDraggable: boolean) {
  const shadow = isDraggable
    ? "box-shadow:0 0 0 6px #82C8E555,0 0 22px #82C8E5,0 4px 12px rgba(0,0,0,.4);"
    : "box-shadow:0 0 0 6px #82C8E555,0 0 22px #82C8E5;";
  const cursor = isDraggable ? "cursor:grab;" : "";
  return L.divIcon({
    className:  "civic-marker",
    html:       `<div class="pin" style="background:#82C8E5;--marker-glow:#82C8E5;${shadow}${cursor}"></div>`,
    iconSize:   [32, 32],
    iconAnchor: [16, 30],
  });
}

function getStatusHex(s: Status) {
  return s === "new" ? "#82C8E5" : s === "progress" ? "#E5C100" : "#5BCF8C";
}

// ─── Hook: fetch heatmap data dari backend ────────────────────────────────────
//
// Menerima `apiPath` sehingga bisa digunakan baik dengan endpoint admin
// maupun endpoint publik (/api/reports/heatmap/public) untuk landing page.
//
function useHeatmapData(
  enabled:     boolean,
  mapMoveTick: number,
  getMap:      () => L.Map | null,
  apiPath:     string,
): [number, number, number][] {
  const [points, setPoints] = useState<[number, number, number][]>([]);

  // Stable refs agar tidak trigger re-render
  const getMapRef  = useRef(getMap);
  const apiPathRef = useRef(apiPath);
  useEffect(() => { getMapRef.current  = getMap;   }, [getMap]);
  useEffect(() => { apiPathRef.current = apiPath;  }, [apiPath]);

  useEffect(() => {
    if (!enabled) { setPoints([]); return; }

    let cancelled = false;

    async function load() {
      const map = getMapRef.current();
      if (!map) return;

      try {
        const b      = map.getBounds();
        const params = new URLSearchParams({
          swLat: b.getSouth().toFixed(6),
          swLng: b.getWest().toFixed(6),
          neLat: b.getNorth().toFixed(6),
          neLng: b.getEast().toFixed(6),
        });

        // Gunakan fetch biasa untuk endpoint publik,
        // authFetch untuk endpoint yang butuh auth (admin dashboard).
        const isPublic = apiPathRef.current.includes("/public");
        const res      = isPublic
          ? await fetch(`${apiPathRef.current}?${params}`)
          : await authFetch(`${apiPathRef.current}?${params}`);

        if (!res.ok) {
          console.warn("[CivicMap] heatmap API error:", res.status, res.statusText);
          return;
        }

        const json: { data: [number, number, number][] } = await res.json();
        if (!cancelled) setPoints(json.data ?? []);
      } catch (err) {
        if (!cancelled) console.warn("[CivicMap] heatmap fetch gagal:", err);
      }
    }

    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, mapMoveTick]);

  return points;
}

// ─── CivicMap ─────────────────────────────────────────────────────────────────

export function CivicMap({
  reports,
  height          = "100%",
  onSelect,
  pickMode        = false,
  onPick,
  onDrag,
  pickedPos       = null,
  draggable       = false,
  initialCenter   = [-6.2088, 106.8200],
  initialZoom     = 11,
  flyTo           = null,
  showHeatmap     = false,
  heatmapApiPath  = "/api/reports/heatmap",  // default: admin endpoint
}: Props) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<L.Map | null>(null);
  const clusterRef    = useRef<L.MarkerClusterGroup | null>(null);
  const heatLayerRef  = useRef<L.Layer | null>(null);
  const pickMarkerRef = useRef<L.Marker | null>(null);

  const [mounted,      setMounted]      = useState(false);
  const [mapReady,     setMapReady]     = useState(false);
  const [heatReady,    setHeatReady]    = useState(false);
  const [mapMoveTick,  setMapMoveTick]  = useState(0);

  const onDragRef = useRef(onDrag);
  const onPickRef = useRef(onPick);
  useEffect(() => { onDragRef.current = onDrag; }, [onDrag]);
  useEffect(() => { onPickRef.current = onPick; }, [onPick]);

  const getMap = useCallback(() => mapRef.current, []);

  useEffect(() => setMounted(true), []);

  // ── Load heat plugin async ─────────────────────────────────────────────────
  useEffect(() => {
    loadHeatPlugin()
      .then(()  => setHeatReady(true))
      .catch((e) => console.warn("[CivicMap] heatmap tidak tersedia:", e.message));
  }, []);

  // ── Init peta (hanya sekali) ───────────────────────────────────────────────
  useEffect(() => {
    if (!mounted || !containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center:             initialCenter,
      zoom:               initialZoom,
      zoomControl:        true,
      attributionControl: true,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    const cluster = (L as any).markerClusterGroup({
      iconCreateFunction: (c: any) => {
        const count = c.getChildCount();
        const size  = count < 10 ? 40 : count < 50 ? 50 : 60;
        return L.divIcon({
          html:      `<div class="marker-cluster-custom" style="width:${size}px;height:${size}px;font-size:${count < 10 ? 13 : 14}px">${count}</div>`,
          className: "",
          iconSize:  [size, size],
        });
      },
      showCoverageOnHover: false,
      spiderfyOnMaxZoom:   true,
      animate:             true,
      maxClusterRadius:    55,
    });
    clusterRef.current = cluster;
    map.addLayer(cluster);

    // Increment tick setiap peta selesai bergerak/zoom → trigger re-fetch heatmap
    const onMoveEnd = () => setMapMoveTick(t => t + 1);
    map.on("moveend", onMoveEnd);
    map.on("zoomend", onMoveEnd);

    setMapReady(true);

    return () => {
      map.off("moveend", onMoveEnd);
      map.off("zoomend", onMoveEnd);
      map.remove();
      mapRef.current       = null;
      clusterRef.current   = null;
      heatLayerRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // ── flyTo ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;
    map.flyTo(flyTo.center, flyTo.zoom, { animate: true, duration: 1.4, easeLinearity: 0.3 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(flyTo)]);

  // ── Report markers ─────────────────────────────────────────────────────────
  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster) return;
    cluster.clearLayers();
    reports.forEach(r => {
      const m   = L.marker([r.lat, r.lng], { icon: makeIcon(r.category) });
      const cat  = CATEGORIES[r.category];
      const stat = STATUSES[r.status];
      m.bindPopup(
        `<div style="padding:0;width:260px;font-family:Inter,sans-serif">
          <div style="position:relative;height:120px;overflow:hidden;border-radius:14px 14px 0 0">
            <img src="${r.image}" style="width:100%;height:100%;object-fit:cover" />
            <div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 40%,rgba(0,0,0,0.7))"></div>
            <div style="position:absolute;top:8px;left:8px">
              <span style="background:${CATEGORY_HEX[r.category]};color:white;font-size:10px;font-weight:600;padding:3px 8px;border-radius:999px">${cat.label}</span>
            </div>
          </div>
          <div style="padding:12px 14px 14px">
            <div style="font-weight:600;font-size:13px;margin-bottom:4px;color:#fff">${r.title}</div>
            <div style="font-size:11px;color:#9aa6b5;line-height:1.4;margin-bottom:8px">${r.region.subdistrict}, ${r.region.city}</div>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:10px;color:#9aa6b5">${timeAgo(r.createdAt)}</span>
              <span style="font-size:10px;font-weight:600;color:${getStatusHex(r.status)}">● ${stat.label}</span>
            </div>
          </div>
        </div>`,
        { closeButton: true, autoPan: true }
      );
      m.on("click", () => onSelect?.(r));
      cluster.addLayer(m);
    });
  }, [reports, onSelect]);

  // ── Pick mode ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handler = (e: L.LeafletMouseEvent) => {
      if (!pickMode) return;
      onPickRef.current?.(e.latlng.lat, e.latlng.lng);
    };
    map.on("click", handler);
    map.getContainer().style.cursor = pickMode ? "crosshair" : "";
    return () => { map.off("click", handler); };
  }, [pickMode]);

  // ── Picked marker ──────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (pickMarkerRef.current) { map.removeLayer(pickMarkerRef.current); pickMarkerRef.current = null; }
    if (!pickedPos) return;

    const marker = L.marker([pickedPos.lat, pickedPos.lng], { icon: makePickIcon(draggable), draggable }).addTo(map);

    if (draggable) {
      marker.on("dragstart", () => { const el = marker.getElement(); if (el) el.style.cursor = "grabbing"; });
      marker.on("dragend",   () => {
        const { lat, lng } = marker.getLatLng();
        const el = marker.getElement(); if (el) el.style.cursor = "grab";
        onDragRef.current?.(lat, lng);
      });
    }
    pickMarkerRef.current = marker;
    return () => { marker.off(); map.removeLayer(marker); };
  }, [pickedPos, draggable]);

  // ── Heatmap data — re-fetch saat enabled, mapReady, heatReady, atau peta bergerak ──
  const heatPoints = useHeatmapData(
    showHeatmap && mapReady && heatReady,
    mapMoveTick,
    getMap,
    heatmapApiPath,
  );

  // ── Render heatmap layer ───────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (heatLayerRef.current) { map.removeLayer(heatLayerRef.current); heatLayerRef.current = null; }
    if (!showHeatmap || !heatReady || heatPoints.length === 0) return;

    if (typeof (L as any).heatLayer !== "function") {
      console.warn("[CivicMap] L.heatLayer belum tersedia saat render");
      return;
    }

    const heat = (L as any).heatLayer(heatPoints, {
      radius:     25,
      blur:       20,
      max:        3.0,
      gradient:   HEAT_GRADIENT,
      minOpacity: 0.4,
    }).addTo(map);

    heatLayerRef.current = heat;

    return () => {
      if (heatLayerRef.current) { map.removeLayer(heatLayerRef.current); heatLayerRef.current = null; }
    };
  }, [showHeatmap, heatReady, heatPoints]);

  return (
    <div
      ref={containerRef}
      style={{ height, width: "100%" }}
      className="rounded-2xl overflow-hidden"
    />
  );
}