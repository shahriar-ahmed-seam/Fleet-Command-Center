import { ErrorCode } from '@fleet/contracts';

import { DomainError } from '../common/errors';
import {
  ZoneService,
  InMemoryZoneRepository,
  PurePolygonValidator,
  type CreateZoneInput,
} from './index';

/** A closed, simple unit square (4 positions, first == last → 3+ vertices). */
const SQUARE: number[][] = [
  [0, 0],
  [0, 1],
  [1, 1],
  [1, 0],
  [0, 0],
];

const VALID: CreateZoneInput = {
  name: 'Downtown Warehouse',
  polygon: SQUARE,
};

function buildService() {
  const repo = new InMemoryZoneRepository();
  let n = 0;
  const service = new ZoneService(repo, new PurePolygonValidator(), {
    clock: { now: () => 1_700_000_000_000 },
    generateId: () => `zone-${(n += 1)}`,
  });
  return { repo, service };
}

/** Build a closed regular polygon ring with `vertices` distinct vertices. */
function regularPolygon(vertices: number): number[][] {
  const ring: number[][] = [];
  for (let i = 0; i < vertices; i += 1) {
    const angle = (2 * Math.PI * i) / vertices;
    // Round to keep coordinates exact-ish; scale keeps points distinct.
    ring.push([
      Math.round(Math.cos(angle) * 1e6) / 1e6,
      Math.round(Math.sin(angle) * 1e6) / 1e6,
    ]);
  }
  ring.push([...ring[0]]); // close the ring
  return ring;
}

describe('ZoneService.create — success', () => {
  it('persists a zone for a closed, simple polygon', async () => {
    const { service, repo } = buildService();
    const zone = await service.create(VALID);

    expect(zone.id).toBeTruthy();
    expect(zone.name).toBe('Downtown Warehouse');
    expect(zone.polygon).toHaveLength(SQUARE.length);
    expect(zone.arrivalLabel).toBeUndefined();
    expect(await repo.list()).toHaveLength(1);
  });

  it('persists the optional arrival label when provided', async () => {
    const { service } = buildService();
    const zone = await service.create({ ...VALID, arrivalLabel: 'Loading Bay 3' });
    expect(zone.arrivalLabel).toBe('Loading Bay 3');
  });

  it('accepts the minimum (3) and a large (1000) vertex count', async () => {
    const { service } = buildService();
    const triangle = await service.create({
      ...VALID,
      polygon: regularPolygon(3),
    });
    expect(triangle.polygon).toHaveLength(4); // 3 distinct + closing position

    const big = await service.create({ ...VALID, polygon: regularPolygon(1000) });
    expect(big.polygon).toHaveLength(1001);
  });
});

describe('ZoneService.create — name validation', () => {
  it('rejects an empty name', async () => {
    const { service, repo } = buildService();
    await expect(
      service.create({ ...VALID, name: '   ' }),
    ).rejects.toMatchObject({ envelope: { fields: ['name'] } });
    expect(await repo.list()).toHaveLength(0);
  });

  it('rejects a name longer than 100 characters', async () => {
    const { service } = buildService();
    await expect(
      service.create({ ...VALID, name: 'x'.repeat(101) }),
    ).rejects.toMatchObject({ envelope: { fields: ['name'] } });
  });

  it('accepts a name at the 100-character boundary', async () => {
    const { service } = buildService();
    const zone = await service.create({ ...VALID, name: 'x'.repeat(100) });
    expect(zone.name).toHaveLength(100);
  });
});

describe('ZoneService.create — arrival-label validation', () => {
  it('rejects an arrival label longer than 100 characters', async () => {
    const { service } = buildService();
    await expect(
      service.create({ ...VALID, arrivalLabel: 'y'.repeat(101) }),
    ).rejects.toMatchObject({ envelope: { fields: ['arrivalLabel'] } });
  });

  it('rejects an empty (present but blank) arrival label', async () => {
    const { service } = buildService();
    await expect(
      service.create({ ...VALID, arrivalLabel: '' }),
    ).rejects.toMatchObject({ envelope: { fields: ['arrivalLabel'] } });
  });
});

describe('ZoneService.create — geometry validation', () => {
  it('rejects a polygon with fewer than 3 vertices and persists nothing', async () => {
    const { service, repo } = buildService();
    const twoVertex: number[][] = [
      [0, 0],
      [1, 1],
      [0, 0],
    ];
    await expect(
      service.create({ ...VALID, polygon: twoVertex }),
    ).rejects.toMatchObject({ envelope: { fields: ['polygon'] } });
    expect(await repo.list()).toHaveLength(0);
  });

  it('rejects a polygon with more than 1000 vertices', async () => {
    const { service } = buildService();
    await expect(
      service.create({ ...VALID, polygon: regularPolygon(1001) }),
    ).rejects.toMatchObject({ envelope: { fields: ['polygon'] } });
  });

  it('rejects an unclosed polygon', async () => {
    const { service, repo } = buildService();
    const open: number[][] = [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 0],
      // missing closing [0, 0]
    ];
    await expect(
      service.create({ ...VALID, polygon: open }),
    ).rejects.toMatchObject({ envelope: { fields: ['polygon'] } });
    expect(await repo.list()).toHaveLength(0);
  });

  it('rejects a self-intersecting (bow-tie) polygon', async () => {
    const { service, repo } = buildService();
    const bowtie: number[][] = [
      [0, 0],
      [1, 1],
      [1, 0],
      [0, 1],
      [0, 0],
    ];
    await expect(
      service.create({ ...VALID, polygon: bowtie }),
    ).rejects.toMatchObject({ envelope: { fields: ['polygon'] } });
    expect(await repo.list()).toHaveLength(0);
  });

  it('rejects a malformed polygon (non-coordinate input)', async () => {
    const { service } = buildService();
    await expect(
      service.create({ ...VALID, polygon: 'not-a-polygon' as unknown as number[][] }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('collects every offending field (name + polygon) in one envelope', async () => {
    const { service } = buildService();
    try {
      await service.create({ name: '', polygon: [[0, 0]] });
      fail('expected validation rejection');
    } catch (e) {
      const err = e as DomainError;
      expect(err.envelope.error).toBe(ErrorCode.ValidationError);
      expect(err.envelope.fields).toEqual(['name', 'polygon']);
    }
  });
});
