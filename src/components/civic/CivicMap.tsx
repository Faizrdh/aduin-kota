/*eslint-disable*/

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import { CATEGORIES, STATUSES, type Report, type Category, type Status, timeAgo } from "@/data/reports";

type Props = {
  reports: Report[];
  height?: string;
  onSelect?: (r: Report) => void;
  pickMode?: boolean;
  onPick?: (lat: number, lng: number) => void;
  pickedPos?: { lat: number; lng: number } | null;
  initialCenter?: [number, number];
  initialZoom?: number;
};

const CATEGORY_HEX: Record<Category, string> = {
  waste: "#7E2233",
  infra: "#E5C100",
  disturb: "#E03A3A",
  land: "#E08A2A",
};

function makeIcon(cat: Category, active = false) {
  const color = CATEGORY_HEX[cat];
  const glow = active ? `box-shadow:0 0 0 6px ${color}33, 0 0 22px ${color};` : "";
  return L.divIcon({
    className: "civic-marker",
    html: `<div class="pin" style="background:${color};--marker-glow:${color}aa;${glow}"></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 26],
    popupAnchor: [0, -28],
  });
}

export function CivicMap({
  reports,
  height = "100%",
  onSelect,
  pickMode = false,
  onPick,
  pickedPos = null,
  initialCenter = [-6.2088, 106.8200],
  initialZoom = 11,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const pickMarkerRef = useRef<L.Marker | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || !containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      zoomControl: true,
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
        const size = count < 10 ? 40 : count < 50 ? 50 : 60;
        return L.divIcon({
          html: `<div class="marker-cluster-custom" style="width:${size}px;height:${size}px;font-size:${count < 10 ? 13 : 14}px">${count}</div>`,
          className: "",
          iconSize: [size, size],
        });
      },
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      animate: true,
      maxClusterRadius: 55,
    });
    clusterRef.current = cluster;
    map.addLayer(cluster);

    return () => {
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // populate markers
  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster) return;
    cluster.clearLayers();
    reports.forEach((r) => {
      const m = L.marker([r.lat, r.lng], { icon: makeIcon(r.category) });
      const cat = CATEGORIES[r.category];
      const stat = STATUSES[r.status];
      m.bindPopup(
        `<div style="padding:0;width:260px;font-family:Inter,sans-serif">
          <div style="position:relative;height:120px;overflow:hidden;border-radius:14px 14px 0 0">
            <img src="${r.image}" style="width:100%;height:100%;object-fit:cover" />
            <div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 40%,rgba(0,0,0,0.7))"></div>
            <div style="position:absolute;top:8px;left:8px;display:flex;gap:6px">
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

  // pick mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handler = (e: L.LeafletMouseEvent) => {
      if (!pickMode) return;
      onPick?.(e.latlng.lat, e.latlng.lng);
    };
    map.on("click", handler);
    map.getContainer().style.cursor = pickMode ? "crosshair" : "";
    return () => {
      map.off("click", handler);
    };
  }, [pickMode, onPick]);

  // picked marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (pickMarkerRef.current) {
      map.removeLayer(pickMarkerRef.current);
      pickMarkerRef.current = null;
    }
    if (pickedPos) {
      const icon = L.divIcon({
        className: "civic-marker",
        html: `<div class="pin" style="background:#82C8E5;--marker-glow:#82C8E5;box-shadow:0 0 0 6px #82C8E555,0 0 22px #82C8E5"></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 30],
      });
      pickMarkerRef.current = L.marker([pickedPos.lat, pickedPos.lng], { icon }).addTo(map);
    }
  }, [pickedPos]);

  return <div ref={containerRef} style={{ height, width: "100%" }} className="rounded-2xl overflow-hidden" />;
}

function getStatusHex(s: Status) {
  return s === "new" ? "#82C8E5" : s === "progress" ? "#E5C100" : "#5BCF8C";
}
