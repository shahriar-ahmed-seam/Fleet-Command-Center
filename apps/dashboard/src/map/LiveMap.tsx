import React from 'react';
import maplibregl, { type Map as MlMap, type Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { driverStatusVar } from '../theme/tokens';
import { resolveMapStyle, buildVehicleMarkerEl, kindFromId, type VehicleKind } from './mapStyle';
import { createGlobeSpin } from './globeSpin';
import { windowTrace, boundsOf, type VehicleState, type TracePing } from './geo';

export interface ZonePolygon {
  id: string;
  name: string;
  ring: [number, number][];
}

export interface LiveMapProps {
  vehicles: VehicleState[];
  zones?: ZonePolygon[];
  selectedVehicleId?: string | null;
  tracePings?: TracePing[];
  onSelectVehicle?: (vehicleId: string) => void;
  now?: number;
}

interface MarkerEntry {
  marker: Marker;
  icon: HTMLElement | null;
  curr: { lng: number; lat: number };
  target: { lng: number; lat: number };
  headingCurr: number;
  headingTarget: number;
  kind: VehicleKind;
  status: string;
  selected: boolean;
  label?: string;
}

const TRACE_SOURCE = 'selected-trace';
const ZONE_SOURCE = 'zones';
const FLEET_CENTER: [number, number] = [-122.3321, 47.6062];

function readCssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Shortest-path angular interpolation (degrees). */
function lerpAngle(a: number, b: number, t: number): number {
  let d = ((b - a + 540) % 360) - 180;
  return a + d * t;
}

/** Night-Earth operations globe with smooth, icon-based live trackers. */
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
  const entriesRef = React.useRef<Map<string, MarkerEntry>>(new Map());
  const rafRef = React.useRef<number | null>(null);
  const [ready, setReady] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const onSelectRef = React.useRef(onSelectVehicle);
  onSelectRef.current = onSelectVehicle;

  React.useEffect(() => {
    if (!containerRef.current) return;
    let map: MlMap;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: resolveMapStyle(),
        center: FLEET_CENTER,
        zoom: 2.2,
        bearing: -16,
        attributionControl: false,
        maxPitch: 70,
        fadeDuration: 0,
        maxTileCacheSize: 1024,
        refreshExpiredTiles: false,
        renderWorldCopies: false,
      });
    } catch {
      setFailed(true);
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

    const spin = createGlobeSpin(map, { secondsPerRevolution: 90, maxSpinZoom: 5, slowSpinZoom: 3 });

    map.on('load', () => {
      const accent = readCssVar('--color-accent', '#58D6F2');
      const info = readCssVar('--color-info', '#8FB4FB');

      map.addSource(ZONE_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'zone-fill', type: 'fill', source: ZONE_SOURCE, paint: { 'fill-color': accent, 'fill-opacity': 0.12 } });
      map.addLayer({ id: 'zone-outline', type: 'line', source: ZONE_SOURCE, paint: { 'line-color': accent, 'line-opacity': 0.65, 'line-width': 1.5 } });

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
          'line-gradient': ['interpolate', ['linear'], ['line-progress'], 0, 'rgba(143,180,251,0.04)', 1, info],
        },
      });

      setReady(true);
      spin.start();
      window.setTimeout(() => {
        map.flyTo({ center: FLEET_CENTER, zoom: 10.2, bearing: 0, duration: 5200, curve: 1.7, essential: true });
      }, 2800);
    });

    // Buttery interpolation loop: ease every marker toward its latest target.
    const animate = () => {
      for (const e of entriesRef.current.values()) {
        e.curr.lng += (e.target.lng - e.curr.lng) * 0.16;
        e.curr.lat += (e.target.lat - e.curr.lat) * 0.16;
        e.marker.setLngLat([e.curr.lng, e.curr.lat]);
        if (e.icon && (e.kind === 'air' || e.kind === 'sea')) {
          e.headingCurr = lerpAngle(e.headingCurr, e.headingTarget, 0.16);
          e.icon.style.transform = `rotate(${e.headingCurr}deg)`;
        }
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      spin.destroy();
      entriesRef.current.forEach((e) => e.marker.remove());
      entriesRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Reconcile markers (create/update/remove) — positions are animated in rAF.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const entries = entriesRef.current;
    const seen = new Set<string>();

    for (const v of vehicles) {
      seen.add(v.vehicleId);
      const kind = v.kind ?? kindFromId(v.vehicleId);
      const status = v.driverStatus;
      const selected = v.vehicleId === selectedVehicleId;
      const heading = typeof v.heading === 'number' ? v.heading : 0;
      const existing = entries.get(v.vehicleId);

      if (!existing) {
        const el = buildVehicleMarkerEl({
          statusVar: driverStatusVar(status),
          kind,
          heading,
          selected,
          label: v.label,
        });
        el.addEventListener('click', (ev) => {
          ev.stopPropagation();
          onSelectRef.current?.(v.vehicleId);
        });
        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([v.lng, v.lat])
          .addTo(map);
        entries.set(v.vehicleId, {
          marker,
          icon: el.querySelector('.fcc-marker-icon'),
          curr: { lng: v.lng, lat: v.lat },
          target: { lng: v.lng, lat: v.lat },
          headingCurr: heading,
          headingTarget: heading,
          kind,
          status,
          selected,
          label: v.label,
        });
        continue;
      }

      existing.target = { lng: v.lng, lat: v.lat };
      existing.headingTarget = heading;
      // Rebuild the element only when appearance (status/selection) changes.
      if (existing.status !== status || existing.selected !== selected) {
        const el = buildVehicleMarkerEl({
          statusVar: driverStatusVar(status),
          kind,
          heading: existing.headingCurr,
          selected,
          label: v.label,
        });
        el.addEventListener('click', (ev) => {
          ev.stopPropagation();
          onSelectRef.current?.(v.vehicleId);
        });
        existing.marker.getElement().replaceChildren(...Array.from(el.childNodes));
        existing.icon = existing.marker.getElement().querySelector('.fcc-marker-icon');
        existing.status = status;
        existing.selected = selected;
      }
    }

    for (const [id, e] of entries) {
      if (!seen.has(id)) {
        e.marker.remove();
        entries.delete(id);
      }
    }
  }, [vehicles, selectedVehicleId, ready]);

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

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource(TRACE_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    const ordered = selectedVehicleId ? windowTrace(tracePings, now ?? Date.now()) : [];
    const coordinates = ordered.map((p) => [p.lng, p.lat] as [number, number]);
    src.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: {} });
    if (coordinates.length > 1) {
      const b = boundsOf(ordered);
      if (b) map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 90, maxZoom: 14, duration: 700 });
    }
  }, [tracePings, selectedVehicleId, ready, now]);

  const viewGlobe = () => mapRef.current?.flyTo({ center: FLEET_CENTER, zoom: 2.4, bearing: -16, duration: 2600, essential: true });
  const viewFleet = () => mapRef.current?.flyTo({ center: FLEET_CENTER, zoom: 10.2, bearing: 0, duration: 2600, essential: true });

  if (failed) {
    return (
      <div className="fcc-starfield" role="img" aria-label="Map unavailable"
        style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
        Live map could not initialize in this environment.
      </div>
    );
  }

  return (
    <>
      <div className="fcc-starfield" aria-hidden="true" style={{ position: 'absolute', inset: 0 }} />
      <div ref={containerRef} style={{ position: 'absolute', inset: 0, background: 'transparent' }} />
      <div className="fcc-globe-tint" aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 'var(--space-4)', right: 'var(--space-4)', zIndex: 2, display: 'flex', gap: 'var(--space-2)' }}>
        <MapPill onClick={viewGlobe} label="🌐 Globe" />
        <MapPill onClick={viewFleet} label="📍 Fleet" />
      </div>
    </>
  );
}

function MapPill({ onClick, label }: { onClick: () => void; label: string }): React.ReactElement {
  return (
    <button type="button" onClick={onClick} className="glass"
      style={{ height: 32, padding: '0 var(--space-3)', borderRadius: 'var(--radius-pill)', color: 'var(--color-text)', fontSize: 'var(--font-size-xs)', fontWeight: 600, cursor: 'pointer' }}>
      {label}
    </button>
  );
}
