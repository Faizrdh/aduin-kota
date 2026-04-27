/*eslint-disable*/

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import { CATEGORIES, STATUSES, type Report, type Category, type Status, timeAgo } from "@/data/reports";

type FlyToTarget = {
  center: [number, number];
  zoom: number;
  /** Increment ini setiap kali ingin trigger ulang flyTo ke koordinat yang sama */
  seq?: number;
};

type Props = {
  reports: Report[];
  height?: string;
  onSelect?: (r: Report) => void;
  pickMode?: boolean;
  onPick?: (lat: number, lng: number) => void;
  /** Dipanggil ketika user selesai men-drag pin (dragend) */
  onDrag?: (lat: number, lng: number) => void;
  pickedPos?: { lat: number; lng: number } | null;
  /** Jika true, pin yang ditempatkan bisa di-drag */
  draggable?: boolean;
  initialCenter?: [number, number];
  initialZoom?: number;
  /** Ketika prop ini berubah, peta akan flyTo secara smooth ke target */
  flyTo?: FlyToTarget | null;
};

const CATEGORY_HEX: Record<Category, string> = {
  waste:   "#7E2233",
  infra:   "#E5C100",
  disturb: "#E03A3A",
  land:    "#E08A2A",
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

/** Icon untuk pin yang bisa di-drag — sedikit lebih besar agar mudah di-grab */
function makePickIcon(isDraggable: boolean) {
  const shadow = isDraggable
    ? "box-shadow:0 0 0 6px #82C8E555,0 0 22px #82C8E5,0 4px 12px rgba(0,0,0,.4);"
    : "box-shadow:0 0 0 6px #82C8E555,0 0 22px #82C8E5;";
  const cursor = isDraggable ? "cursor:grab;" : "";
  return L.divIcon({
    className: "civic-marker",
    html: `<div class="pin" style="background:#82C8E5;--marker-glow:#82C8E5;${shadow}${cursor}"></div>`,
    iconSize:   [32, 32],
    iconAnchor: [16, 30],
  });
}

export function CivicMap({
  reports,
  height = "100%",
  onSelect,
  pickMode = false,
  onPick,
  onDrag,
  pickedPos = null,
  draggable = false,
  initialCenter = [-6.2088, 106.8200],
  initialZoom = 11,
  flyTo = null,
}: Props) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<L.Map | null>(null);
  const clusterRef    = useRef<L.MarkerClusterGroup | null>(null);
  const pickMarkerRef = useRef<L.Marker | null>(null);
  const [mounted, setMounted] = useState(false);

  // Simpan callback terbaru ke ref agar efek marker tidak perlu di-recreate
  // setiap kali onDrag / onPick berubah referensinya
  const onDragRef = useRef(onDrag);
  const onPickRef = useRef(onPick);
  useEffect(() => { onDragRef.current = onDrag; }, [onDrag]);
  useEffect(() => { onPickRef.current = onPick; }, [onPick]);

  useEffect(() => setMounted(true), []);

  // ── Inisialisasi peta (hanya sekali) ──────────────────────────────────────
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
          html: `<div class="marker-cluster-custom" style="width:${size}px;height:${size}px;font-size:${count < 10 ? 13 : 14}px">${count}</div>`,
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

    return () => {
      map.remove();
      mapRef.current     = null;
      clusterRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // ── flyTo: animasi smooth ke wilayah yang dipilih ─────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;

    map.flyTo(flyTo.center, flyTo.zoom, {
      animate:       true,
      duration:      1.4,
      easeLinearity: 0.3,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(flyTo)]);

  // ── Populate report markers ───────────────────────────────────────────────
  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster) return;
    cluster.clearLayers();
    reports.forEach((r) => {
      const m   = L.marker([r.lat, r.lng], { icon: makeIcon(r.category) });
      const cat  = CATEGORIES[r.category];
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

  // ── Pick mode: klik peta untuk memilih koordinat ─────────────────────────
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

  // ── Picked marker: pin biru yang bisa di-drag ────────────────────────────
  //
  // Dibuat ulang setiap kali pickedPos atau draggable berubah.
  // Marker dibuat dengan opsi { draggable } sehingga Leaflet langsung
  // mengaktifkan drag handle tanpa perlu plugin tambahan.
  // Event "dragend" mengambil posisi baru dan memanggil onDrag (via ref
  // agar selalu menggunakan callback terbaru dari parent).
  //
  // Cursor "grab" / "grabbing" diset langsung pada elemen icon via CSS
  // sehingga konsisten antar-browser tanpa harus override style Leaflet.
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Bersihkan marker lama
    if (pickMarkerRef.current) {
      map.removeLayer(pickMarkerRef.current);
      pickMarkerRef.current = null;
    }

    if (!pickedPos) return;

    const marker = L.marker([pickedPos.lat, pickedPos.lng], {
      icon:     makePickIcon(draggable),
      draggable,
    }).addTo(map);

    // Ketika drag selesai, panggil onDrag dengan koordinat presisi baru
    if (draggable) {
      marker.on("dragstart", () => {
        // Ubah cursor menjadi "grabbing" selama drag berlangsung
        const el = marker.getElement();
        if (el) el.style.cursor = "grabbing";
      });

      marker.on("dragend", () => {
        const { lat, lng } = marker.getLatLng();
        // Kembalikan cursor ke "grab" setelah drag selesai
        const el = marker.getElement();
        if (el) el.style.cursor = "grab";
        // Panggil callback via ref agar selalu up-to-date
        onDragRef.current?.(lat, lng);
      });
    }

    pickMarkerRef.current = marker;

    // Cleanup: hapus event listener dan marker saat efek dijalankan ulang
    return () => {
      marker.off();
      map.removeLayer(marker);
    };
  // draggable masuk deps agar marker direcreate jika prop berubah
  }, [pickedPos, draggable]);

  return (
    <div
      ref={containerRef}
      style={{ height, width: "100%" }}
      className="rounded-2xl overflow-hidden"
    />
  );
}

function getStatusHex(s: Status) {
  return s === "new" ? "#82C8E5" : s === "progress" ? "#E5C100" : "#5BCF8C";
}