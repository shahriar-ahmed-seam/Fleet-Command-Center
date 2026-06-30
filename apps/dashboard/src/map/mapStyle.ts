import type { StyleSpecification } from 'maplibre-gl';

/** A self-contained, offline dark base style (no tiles, no API key). */
export function blankDarkStyle(): StyleSpecification {
  return {
    version: 8,
    name: 'fleet-operations-dark',
    // Empty glyphs/sources keep the style fully self-contained.
    sources: {},
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#0F1419' },
      },
    ],
  };
}

/**
 * Resolve the map style: an operator-provided style URL when configured,
 * otherwise the self-contained dark base.
 */
export function resolveMapStyle(): string | StyleSpecification {
  const url =
    typeof import.meta !== 'undefined'
      ? (import.meta as { env?: Record<string, string> }).env?.VITE_MAP_STYLE_URL
      : undefined;
  return url && url.length > 0 ? url : blankDarkStyle();
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
