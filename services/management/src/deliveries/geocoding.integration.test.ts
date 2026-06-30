import { DeliveryService } from './delivery-service';
import { InMemoryDeliveryRepository } from './delivery-repository';
import { type Geocoder } from './geocoder';

const validInput = {
  address: '1 Main St, Seattle, WA',
  recipientName: 'Grace',
  recipientContact: '555-0100',
  weightKg: 5,
};

describe('delivery creation geocoding', () => {
  it('rejects creation and persists nothing when geocoding fails', async () => {
    const repo = new InMemoryDeliveryRepository();
    const failing: Geocoder = {
      geocode: () => Promise.reject(new Error('provider unavailable')),
    };
    const service = new DeliveryService(repo, failing);

    await expect(service.create(validInput)).rejects.toMatchObject({
      httpStatus: 422,
    });
    expect(await repo.list()).toHaveLength(0);
  });

  it('rejects creation and persists nothing when geocoding times out', async () => {
    const repo = new InMemoryDeliveryRepository();
    const hanging: Geocoder = {
      // Never resolves; the service's timeout must fire.
      geocode: () => new Promise(() => {}),
    };
    const service = new DeliveryService(repo, hanging, {
      geocodeTimeoutMs: 50, // shrink the 10s budget for the test
    });

    const start = Date.now();
    await expect(service.create(validInput)).rejects.toMatchObject({
      httpStatus: 422,
    });
    expect(Date.now() - start).toBeLessThan(2000);
    expect(await repo.list()).toHaveLength(0);
  });

  it('creates the delivery as Created when geocoding succeeds', async () => {
    const repo = new InMemoryDeliveryRepository();
    const ok: Geocoder = {
      geocode: () => Promise.resolve({ lat: 47.6062, lng: -122.3321 }),
    };
    const service = new DeliveryService(repo, ok);

    const delivery = await service.create(validInput);
    expect(delivery.status).toBe('Created');
    expect(delivery.destination).toEqual({ lat: 47.6062, lng: -122.3321 });
    expect(await repo.list()).toHaveLength(1);
  });
});
