import type { StyleSpecification } from 'maplibre-gl';

/**
 * A night-time Earth: NASA "Black Marble" city-lights tiles on the globe, with
 * CARTO dark street tiles underneath that fade in as you zoom into a city. No
 * opaque background layer, so a starfield placed behind the canvas shows in
 * space. An atmosphere glow gives the planet a lit rim.
 */
export function darkBasemapStyle(): StyleSpecification {
  return {
    version: 8,
    name: 'fleet-night-earth',
    projection: { type: 'globe' },
    sky: {
      'sky-color': '#0a1230',
      'sky-horizon-blend': 0.7,
      'horizon-color': '#5b6bd6',
      'horizon-fog-blend': 0.6,
      'fog-color': '#10122e',
      'fog-ground-blend': 0.5,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 7, 0.5, 11, 0],
    },
    sources: {
      streets: {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
          'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
          'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
          'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
      },
      nightlights: {
        type: 'raster',
        tiles: [
          'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg',
        ],
        tileSize: 256,
        maxzoom: 8,
        attribution: '© NASA Earth Observatory (Black Marble)',
      },
    },
    layers: [
      {
        // Dark sphere base so the planet stays opaque even before lights load.
        id: 'streets',
        type: 'raster',
        source: 'streets',
        paint: { 'raster-opacity': 0.95, 'raster-brightness-max': 0.85, 'raster-fade-duration': 0 },
      },
      {
        // City lights on top; fade out as the user zooms into street level.
        id: 'nightlights',
        type: 'raster',
        source: 'nightlights',
        paint: {
          'raster-opacity': ['interpolate', ['linear'], ['zoom'], 3, 1, 6.5, 0.9, 9, 0],
          'raster-saturation': -0.15,
          'raster-contrast': 0.12,
          'raster-hue-rotate': -12,
          'raster-fade-duration': 0,
        },
      },
    ],
  } as StyleSpecification;
}

export function resolveMapStyle(): string | StyleSpecification {
  const url =
    typeof import.meta !== 'undefined'
      ? (import.meta as { env?: Record<string, string> }).env?.VITE_MAP_STYLE_URL
      : undefined;
  return url && url.length > 0 ? url : darkBasemapStyle();
}

export type VehicleKind = 'ground' | 'air' | 'sea';

/** Infer the transport kind from a vehicle identifier prefix. */
export function kindFromId(id: string): VehicleKind {
  if (id.startsWith('FLT')) return 'air';
  if (id.startsWith('SHP')) return 'sea';
  return 'ground';
}

const ICON: Record<VehicleKind, string> = {
  // Airplane (nose up at 0°), rotated to heading.
  air: 'M12 2c.5 0 .9.8 .9 1.9V9l8 4.6v1.9l-8-2.3v4.4l2.1 1.7v1.5L12 20.8 9 21.7v-1.5l2.1-1.7v-4.4l-8 2.3v-1.9L11.1 9V3.9C11.1 2.8 11.5 2 12 2z',
  // Cargo ship silhouette.
  sea: 'M3.5 13h17l-2.2 5.2a1 1 0 0 1-.92.6H6.62a1 1 0 0 1-.92-.6L3.5 13zm2-5.5h6.5v4H4l1.5-4zM13 5h3.2c.4 0 .76.24.92.6L18.6 11.5H13V5z',
  // Delivery truck/van.
  ground: 'M2.5 6.5h11v8h-11zM13.5 9h3.6l3.4 3.3v2.2h-7zM7 18.2a2.1 2.1 0 1 0 0-4.2 2.1 2.1 0 0 0 0 4.2zm10 0a2.1 2.1 0 1 0 0-4.2 2.1 2.1 0 0 0 0 4.2z',
};

/**
 * Build a vehicle marker: a status-coloured transport icon (plane/ship/truck)
 * with an optional label. The icon element is the first child so the caller can
 * rotate it to the heading. Air/sea icons point along the heading; ground stays
 * upright. A selection halo is drawn when `selected`.
 */
export function buildVehicleMarkerEl(opts: {
  statusVar: string;
  kind: VehicleKind;
  heading?: number | null;
  selected: boolean;
  label?: string;
}): HTMLDivElement {
  const { statusVar, kind, heading, selected, label } = opts;
  const rotates = kind === 'air' || kind === 'sea';
  const angle = rotates && typeof heading === 'number' ? heading : 0;

  const el = document.createElement('div');
  el.style.display = 'inline-flex';
  el.style.alignItems = 'center';
  el.style.gap = '5px';
  el.style.cursor = 'pointer';

  const halo = selected
    ? `<circle cx="12" cy="12" r="11" fill="none" stroke="${statusVar}" stroke-opacity="0.5" stroke-width="1.5"/>
       <circle cx="12" cy="12" r="7" fill="none" stroke="${statusVar}" stroke-opacity="0.8" stroke-width="1.5"/>`
    : '';

  const svg = document.createElement('span');
  svg.className = 'fcc-marker-icon';
  svg.style.display = 'inline-flex';
  svg.style.willChange = 'transform';
  svg.style.transform = `rotate(${angle}deg)`;
  svg.style.filter = selected
    ? `drop-shadow(0 0 6px ${statusVar})`
    : 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))';
  svg.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24">${halo}<path d="${ICON[kind]}" fill="${statusVar}" stroke="#070A16" stroke-width="0.8" stroke-linejoin="round"/></svg>`;
  el.appendChild(svg);

  if (label) {
    const tag = document.createElement('span');
    tag.textContent = label;
    tag.style.cssText =
      'font-family:var(--font-mono);font-size:11px;font-weight:600;color:var(--color-text);background:color-mix(in srgb,var(--color-bg) 66%,transparent);padding:1px 5px;border-radius:6px;white-space:nowrap;backdrop-filter:blur(2px)';
    el.appendChild(tag);
  }

  return el;
}
