import React from 'react';
import maplibregl, { type Map as MlMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { darkBasemapStyle } from '../map/mapStyle';
import { createGlobeSpin } from '../map/globeSpin';

// A scattering of global logistics hubs so the rotating earth always shows
// glowing activity, with Seattle (the demo fleet) emphasised.
const HUBS: Array<[number, number]> = [
  [-122.3321, 47.6062], // Seattle (fleet)
  [-74.006, 40.7128], // New York
  [-0.1276, 51.5072], // London
  [2.3522, 48.8566], // Paris
  [13.405, 52.52], // Berlin
  [55.2708, 25.2048], // Dubai
  [72.8777, 19.076], // Mumbai
  [103.8198, 1.3521], // Singapore
  [139.6917, 35.6895], // Tokyo
  [116.4074, 39.9042], // Beijing
  [151.2093, -33.8688], // Sydney
  [-46.6333, -23.5505], // São Paulo
  [-99.1332, 19.4326], // Mexico City
  [37.6173, 55.7558], // Moscow
  [-122.4194, 37.7749], // San Francisco
];

function readCssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/**
 * A decorative, continuously rotating 3D globe used as the landing hero
 * background. Non-interactive so it never captures page scroll; glowing hub
 * points give the earth a sense of live activity.
 */
export function GlobeHero(): React.ReactElement {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!containerRef.current) return;
    let map: MlMap;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: darkBasemapStyle(),
        center: [10, 25],
        zoom: 1.55,
        attributionControl: false,
        interactive: false,
        renderWorldCopies: false,
      });
    } catch {
      return; // WebGL unavailable: the gradient fallback behind us shows.
    }

    const spin = createGlobeSpin(map, {
      secondsPerRevolution: 70,
      maxSpinZoom: Infinity,
      pauseOnInteraction: false,
    });

    map.on('load', () => {
      const accent = readCssVar('--color-accent', '#14B8A6');
      const info = readCssVar('--color-info', '#38BDF8');

      map.addSource('hubs', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: HUBS.map(([lng, lat], i) => ({
            type: 'Feature',
            properties: { fleet: i === 0 },
            geometry: { type: 'Point', coordinates: [lng, lat] },
          })),
        },
      });
      map.addLayer({
        id: 'hub-glow',
        type: 'circle',
        source: 'hubs',
        paint: {
          'circle-radius': ['case', ['get', 'fleet'], 18, 11],
          'circle-color': ['case', ['get', 'fleet'], info, accent],
          'circle-opacity': 0.22,
          'circle-blur': 1,
        },
      });
      map.addLayer({
        id: 'hub-core',
        type: 'circle',
        source: 'hubs',
        paint: {
          'circle-radius': ['case', ['get', 'fleet'], 4.5, 2.5],
          'circle-color': ['case', ['get', 'fleet'], info, accent],
          'circle-opacity': 0.95,
        },
      });

      spin.start();

      // Gentle pulse on the glow halos.
      let t = 0;
      const pulse = window.setInterval(() => {
        t += 0.1;
        const base = 0.18 + Math.sin(t) * 0.08;
        if (map.getLayer('hub-glow')) {
          map.setPaintProperty('hub-glow', 'circle-opacity', Math.max(0.08, base));
        }
      }, 120);
      map.once('remove', () => clearInterval(pulse));
    });

    return () => {
      spin.destroy();
      map.remove();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, background: '#0b0f14' }}
    />
  );
}
