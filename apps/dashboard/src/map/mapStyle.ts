import type { StyleSpecification } from 'maplibre-gl';

/**
 * A real dark basemap built from CARTO's free "dark matter" raster tiles
 * (OpenStreetMap data, no API key), rendered on a 3D globe with an atmosphere
 * glow. The background colour matches the app shell so tiles fade in over the
 * theme instead of a white flash.
 */
export function darkBasemapStyle(): StyleSpecification {
  return {
    version: 8,
    name: 'fleet-operations-globe',
    projection: { type: 'globe' },
    sky: {
      'sky-color': '#0a1320',
      'sky-horizon-blend': 0.6,
      'horizon-color': '#274060',
      'horizon-fog-blend': 0.6,
      'fog-color': '#0F1419',
      'fog-ground-blend': 0.4,
      'atmosphere-blend': [
        'interpolate',
        ['linear'],
        ['zoom'],
        0, 1,
        7, 0.6,
        11, 0,
      ],
    },
    sources: {
      basemap: {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        ],
        tileSize: 256,
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#0b0f14' },
      },
      {
        id: 'basemap',
        type: 'raster',
        source: 'basemap',
        paint: { 'raster-opacity': 0.95 },
      },
    ],
  } as StyleSpecification;
}

/**
 * Resolve the map style: an operator-provided style URL when configured,
 * otherwise the dark globe basemap.
 */
export function resolveMapStyle(): string | StyleSpecification {
  const url =
    typeof import.meta !== 'undefined'
      ? (import.meta as { env?: Record<string, string> }).env?.VITE_MAP_STYLE_URL
      : undefined;
  return url && url.length > 0 ? url : darkBasemapStyle();
}

export function buildVehicleMarkerEl(opts: {
  statusVar: string;
  heading?: number | null;
  selected: boolean;
  label?: string;
}): HTMLDivElement {
  const { statusVar, heading, selected, label } = opts;
  const hasHeading = typeof heading === 'number' && Number.isFinite(heading);

  const el = document.createElement('div');
  el.style.display = 'inline-flex';
  el.style.alignItems = 'center';
  el.style.gap = '4px';
  el.style.cursor = 'pointer';
  el.style.transition = 'filter 200ms ease';
  if (selected) {
    el.style.filter = 'drop-shadow(0 0 6px rgba(56,189,248,0.9))';
  }

  const shape = hasHeading
    ? `<path d="M12 2 L19 20 L12 16 L5 20 Z" style="fill:${statusVar}" stroke="#0F1419" stroke-width="1.25" stroke-linejoin="round"/>`
    : `<circle cx="12" cy="12" r="6" style="fill:${statusVar}" stroke="#0F1419" stroke-width="2"/>`;
  const halo = selected
    ? `<circle cx="12" cy="12" r="11" fill="none" style="stroke:${statusVar}" stroke-opacity="0.35" stroke-width="2"/>`
    : '';

  el.innerHTML =
    `<svg width="26" height="26" viewBox="0 0 24 24" style="transition:transform 600ms ease;${
      hasHeading ? `transform:rotate(${heading}deg)` : ''
    }">${halo}${shape}</svg>` +
    (label
      ? `<span style="font-family:var(--font-mono);font-size:12px;font-weight:600;color:var(--color-text);background:color-mix(in srgb,var(--color-bg) 70%,transparent);padding:1px 4px;border-radius:6px;white-space:nowrap">${label}</span>`
      : '');

  return el;
}
