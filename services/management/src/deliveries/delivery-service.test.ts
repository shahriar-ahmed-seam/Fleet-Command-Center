import { DeliveryStatus, ErrorCode } from '@fleet/contracts';

import { DomainError } from '../common/errors';
import {
  DeliveryService,
  InMemoryDeliveryRepository,
  type CreateDeliveryInput,
  type Geocoder,
  type GeoPoint,
} from './index';

const VALID: CreateDeliveryInput = {
  address: '1600 Amphitheatre Pkwy, Mountain View',
  recipientName: 'Grace Hopper',
  recipientContact: '555-0150',
  weightKg: 12.5,
};

const POINT: GeoPoint = { lat: 37.4221, lng: -122.0841 };

/** A geocoder that resolves to a fixed point. */
const okGeocoder: Geocoder = { geocode: () => Promise.resolve(POINT) };

/** A geocoder that rejects (address not resolvable). */
const failingGeocoder: Geocoder = {
  geocode: () => Promise.reject(new Error('not found')),
};

/** A geocoder that never settles, used to exercise the timeout path. */
const hangingGeocoder: Geocoder = {
  geocode: () => new Promise<GeoPoint>(() => undefined),
};

function buildService(geocoder: Geocoder, geocodeTimeoutMs?: number) {
  const repo = new InMemoryDeliveryRepository();
  let n = 0;
  let t = 0;
  const service = new DeliveryService(repo, geocoder, {
    clock: { now: () => 1_700_000_000_000 },
    generateId: () => `del-${(n += 1)}`,
    generateTrackingToken: () => `trk-${(t += 1)}`,
    geocodeTimeoutMs,
  });
  return { repo, service };
}

describe('DeliveryService.create — success', () => {
  it('creates a delivery with status Created and the geocoded destination', async () => {
    const { service, repo } = buildService(okGeocoder);
    const delivery = await service.create(VALID);

    expect(delivery.status).toBe(DeliveryStatus.Created);
    expect(delivery.destination).toEqual(POINT);
    expect(delivery.trackingToken).toBeTruthy();
    expect(delivery.createdAt).toBe(delivery.updatedAt);
    expect(await repo.list()).toHaveLength(1);
  });
});

describe('DeliveryService.create — validation', () => {
  it('rejects missing required fields without persisting', async () => {
    const { service, repo } = buildService(okGeocoder);
    try {
      await service.create({ ...VALID, recipientName: '', recipientContact: '   ' });
      fail('expected validation rejection');
    } catch (e) {
      const err = e as DomainError;
      expect(err.envelope.error).toBe(ErrorCode.ValidationError);
      expect(err.envelope.fields).toEqual(['recipientName', 'recipientContact']);
    }
    expect(await repo.list()).toHaveLength(0);
  });

  it('rejects a weight at the exclusive lower bound (0) without persisting', async () => {
    const { service, repo } = buildService(okGeocoder);
    await expect(service.create({ ...VALID, weightKg: 0 })).rejects.toMatchObject(
      { envelope: { fields: ['weightKg'] } },
    );
    expect(await repo.list()).toHaveLength(0);
  });

  it('rejects a weight above the maximum (1000) without persisting', async () => {
    const { service, repo } = buildService(okGeocoder);
    await expect(
      service.create({ ...VALID, weightKg: 1000.1 }),
    ).rejects.toBeInstanceOf(DomainError);
    expect(await repo.list()).toHaveLength(0);
  });

  it('accepts the weight upper boundary (exactly 1000)', async () => {
    const { service } = buildService(okGeocoder);
    const delivery = await service.create({ ...VALID, weightKg: 1000 });
    expect(delivery.weightKg).toBe(1000);
  });

  it('does not invoke the geocoder when validation fails', async () => {
    let calls = 0;
    const spyGeocoder: Geocoder = {
      geocode: () => {
        calls += 1;
        return Promise.resolve(POINT);
      },
    };
    const { service } = buildService(spyGeocoder);
    await expect(service.create({ ...VALID, address: '' })).rejects.toBeInstanceOf(
      DomainError,
    );
    expect(calls).toBe(0);
  });
});

describe('DeliveryService.create — geocoding failure', () => {
  it('rejects with geocoding-failure and persists nothing when the address is unresolvable', async () => {
    const { service, repo } = buildService(failingGeocoder);
    try {
      await service.create(VALID);
      fail('expected geocoding-failure rejection');
    } catch (e) {
      const err = e as DomainError;
      expect(err.envelope.error).toBe(ErrorCode.GeocodingFailure);
      expect(err.envelope.fields).toEqual(['address']);
    }
    expect(await repo.list()).toHaveLength(0);
  });

  it('rejects with geocoding-failure when geocoding exceeds the timeout', async () => {
    // Small timeout so the never-settling geocoder trips it quickly.
    const { service, repo } = buildService(hangingGeocoder, 20);
    const start = Date.now();
    await expect(service.create(VALID)).rejects.toMatchObject({
      envelope: { error: ErrorCode.GeocodingFailure },
    });
    expect(Date.now() - start).toBeLessThan(1000);
    expect(await repo.list()).toHaveLength(0);
  });
});
