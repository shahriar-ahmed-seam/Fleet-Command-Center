import React from 'react';
import maplibregl, { type Map as MlMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { driverStatusVar } from '../theme/tokens';
import { resolveMapStyle, buildVehicleMarkerEl } from './mapStyle';
import {
  windowTrace,
  boundsOf,
  type VehicleState,
  type TracePing,
} from './geo';

/** A zone polygon to render as a translucent overlay. */
export interface ZonePolygon {
  id: string;
  name: string;
  /** Ring of [lng, lat] coordinates (closed). */
  ring: [number, number][];
}

export interface LiveMapProps {
  vehicles: VehicleState[];
  zones?: ZonePolygon[];
  selectedVehicleId?: string | null;
  /** Pings for the selected vehicle (any order); windowed to 60 min here. */
  tracePings?: TracePing[];
  onSelectVehicle?: (vehicleId: string) => void;
  /** Reference time for the trace window (defaults to Date.now). */
  now?: number;
}

const TRACE_SOURCE = 'selected-trace';
const ZONE_SOURCE = 'zones';

function readCssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** The live operations map. */
export function LiveMap({
  vehicles,
  zones = [],
  selectedVehicleId = null,
  tracePings = [],
  onSelectVehicle,
  now,
}: LiveMapProps): React.ReactElement {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<MlMap | null>(null);
  const markersRef = React.useRef<Map<string, maplibregl.Marker>>(new Map());
  const [ready, setReady] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const onSelectRef = React.useRef(onSelectVehicle);
  onSelectRef.current = onSelectVehicle;

  // --- create the map once ----------------------------------------------
  React.useEffect(() => {
    if (!containerRef.current) return;
    let map: MlMap;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: resolveMapStyle(),
        center: [-122.3321, 47.6062],
        zoom: 11,
        attributionControl: false,
      });
    } catch {
      setFailed(true);
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', () => {
      const accent = readCssVar('--color-accent', '#14B8A6');
      map.addSource(ZONE_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'zone-fill',
        type: 'fill',
        source: ZONE_SOURCE,
        paint: { 'fill-color': accent, 'fill-opacity': 0.12 },
      });
      map.addLayer({
        id: 'zone-outline',
        type: 'line',
        source: ZONE_SOURCE,
        paint: { 'line-color': accent, 'line-opacity': 0.6, 'line-width': 1.5 },
      });

      // Selected-vehicle path trace: a single line with a fade toward older
      const info = readCssVar('--color-info', '#38BDF8');
      map.addSource(TRACE_SOURCE, {
        type: 'geojson',
        lineMetrics: true,
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} },
      });
      map.addLayer({
        id: 'trace-line',
        type: 'line',
        source: TRACE_SOURCE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-width': 3,
          'line-gradient': [
            'interpolate',
            ['linear'],
            ['line-progress'],
            0,
            'rgba(56,189,248,0.05)',
            1,
            info,
          ],
        },
      });
      setReady(true);
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // --- reconcile vehicle markers ----------------------------------------
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const markers = markersRef.current;
    const seen = new Set<string>();

    for (const v of vehicles) {
      seen.add(v.vehicleId);
      const selected = v.vehicleId === selectedVehicleId;
      const el = buildVehicleMarkerEl({
        statusVar: driverStatusVar(v.driverStatus),
        heading: v.heading,
        selected,
        label: v.label,
      });
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectRef.current?.(v.vehicleId);
      });

      let marker = markers.get(v.vehicleId);
      if (marker) {
        marker.getElement().replaceChildren(...Array.from(el.childNodes));
        marker.getElement().style.filter = el.style.filter;
        marker.setLngLat([v.lng, v.lat]);
      } else {
        marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([v.lng, v.lat])
          .addTo(map);
        markers.set(v.vehicleId, marker);
      }
    }

    for (const [id, marker] of markers) {
      if (!seen.has(id)) {
        marker.remove();
        markers.delete(id);
      }
    }
  }, [vehicles, selectedVehicleId, ready]);

  // --- update zone overlay ----------------------------------------------
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource(ZONE_SOURCE) as maplibregl.GeoJSONSource | undefined;
    src?.setData({
      type: 'FeatureCollection',
      features: zones.map((z) => ({
        type: 'Feature',
        properties: { id: z.id, name: z.name },
        geometry: { type: 'Polygon', coordinates: [z.ring] },
      })),
    });
  }, [zones, ready]);

  // --- update selected path trace ---------------------------------------
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource(TRACE_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (!src) return;

    const ordered = selectedVehicleId
      ? windowTrace(tracePings, now ?? Date.now())
      : [];
    const coordinates = ordered.map((p) => [p.lng, p.lat] as [number, number]);
    src.setData({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates },
      properties: {},
    });

    // Frame the trace when a vehicle is first selected.
    if (coordinates.length > 1) {
      const b = boundsOf(ordered);
      if (b) {
        map.fitBounds([[b[0], b[1]], [b[2], b[3]]], {
          padding: 80,
          maxZoom: 14,
          duration: 600,
        });
      }
    }
  }, [tracePings, selectedVehicleId, ready, now]);

  if (failed) {
    return (
      <div
        role="img"
        aria-label="Map unavailable"
        style={{
          height: '100%',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--color-bg)',
          color: 'var(--color-text-muted)',
          fontSize: 'var(--font-size-sm)',
        }}
      >
        Live map could not initialize in this environment.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0, background: 'var(--color-bg)' }}
    />
  );
}
