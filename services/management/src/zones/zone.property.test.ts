import fc from 'fast-check';

import { pbtParams, tag } from '../testing/pbt';
import {
  ZoneService,
  InMemoryZoneRepository,
  PurePolygonValidator,
} from './index';

/** Build a closed, simple regular polygon ring with `vertices` distinct points. */
function regularPolygon(vertices: number, radius = 1): number[][] {
  const ring: number[][] = [];
  for (let i = 0; i < vertices; i += 1) {
    const angle = (2 * Math.PI * i) / vertices;
    ring.push([
      Math.round(Math.cos(angle) * radius * 1e6) / 1e6,
      Math.round(Math.sin(angle) * radius * 1e6) / 1e6,
    ]);
  }
  ring.push([...ring[0]]);
  return ring;
}

function build() {
  let n = 0;
  return {
    repo: new InMemoryZoneRepository(),
    make(repo: InMemoryZoneRepository) {
      return new ZoneService(repo, new PurePolygonValidator(), {
        generateId: () => `zone-${(n += 1)}`,
      });
    },
  };
}

describe('zone definition properties', () => {
  it(tag(17, 'Valid zone geometry round-trips'), async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 3, max: 200 }),
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
        async (vertices, name) => {
          const repo = new InMemoryZoneRepository();
          const service = new ZoneService(repo, new PurePolygonValidator(), {
            generateId: () => 'zone-1',
          });
          const polygon = regularPolygon(vertices);

          const created = await service.create({ name, polygon });
          const stored = await repo.list();

          expect(stored).toHaveLength(1);
          expect(stored[0].name).toBe(name);
          // Geometry round-trips: same vertex count and coordinates.
          expect(created.polygon).toHaveLength(polygon.length);
          expect(created.polygon).toEqual(polygon);
        },
      ),
      pbtParams(),
    );
  });
});
