import fc from 'fast-check';
import { ErrorCode, type ErrorEnvelope } from '@fleet/contracts';

import {
  validateDriverInput,
  validatePingInput,
  validateDeliveryInput,
  validateZoneInput,
} from './index';
import { pbtParams, tag } from '../testing/pbt';

type Validator = (input: Record<string, unknown>) => ErrorEnvelope | null;

/** A generated create request paired with the fields expected to be flagged. */
interface Case {
  validate: Validator;
  input: Record<string, unknown>;
  expected: string[];
}

// --- String fields: present (incl. non-ASCII) vs missing (empty/whitespace) ---

const presentString = fc.oneof(
  fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
  fc.constantFrom('Ann', '日本語', 'Ångström', 'Açaí 🚚', '你好世界'),
);

const missingString = fc.constantFrom<unknown>(
  '',
  '   ',
  '\t\n',
  undefined,
  null,
);

/** Yields a value plus whether it should be flagged as missing. */
const stringField = fc.oneof(
  presentString.map((value) => ({ value, flag: false })),
  missingString.map((value) => ({ value, flag: true })),
);

// --- Coordinate fields: valid in-range, out-of-range, or missing ---

function coordField(min: number, max: number) {
  const valid = fc.oneof(
    fc.double({ min, max, noNaN: true }),
    fc.constantFrom(min, max, 0),
  ).map((value) => ({ value, flag: false }));

  const outOfRange = fc.oneof(
    fc.double({ min: max + 1e-6, max: max + 1e6, noNaN: true }),
    fc.double({ min: min - 1e6, max: min - 1e-6, noNaN: true }),
    fc.constantFrom(min - 0.0001, max + 0.0001),
  ).map((value) => ({ value, flag: true }));

  const missing = fc
    .constantFrom<unknown>(undefined, null, NaN)
    .map((value) => ({ value, flag: true }));

  return fc.oneof(valid, outOfRange, missing);
}

const latField = coordField(-90, 90);
const lngField = coordField(-180, 180);

// --- Weight field: valid (0, 1000], out-of-range, or missing ---

const weightField = fc.oneof(
  fc
    .oneof(
      fc.double({ min: Number.MIN_VALUE, max: 1000, noNaN: true }),
      fc.constantFrom(1000, 0.5, 1, 999.999),
    )
    .map((value) => ({ value, flag: false })),
  fc
    .oneof(
      fc.double({ min: -1e6, max: 0, noNaN: true }), // <= 0
      fc.double({ min: 1000 + 1e-6, max: 1e6, noNaN: true }), // > 1000
      fc.constantFrom(0, -1, 1000.1, 5000),
    )
    .map((value) => ({ value, flag: true })),
  fc.constantFrom<unknown>(undefined, null, NaN).map((value) => ({ value, flag: true })),
);

// --- Vertices field: valid [3,1000], bad count, non-array, or missing ---

const coordTuple = fc.tuple(
  fc.double({ min: -180, max: 180, noNaN: true }),
  fc.double({ min: -90, max: 90, noNaN: true }),
);

const ring = (n: number) => Array.from({ length: n }, (_, i) => [i % 180, i % 90]);

const verticesField = fc.oneof(
  // valid counts incl. boundaries 3 and 1000
  fc.array(coordTuple, { minLength: 3, maxLength: 8 }).map((value) => ({ value, flag: false })),
  fc.constantFrom(ring(3), ring(1000)).map((value) => ({ value, flag: false })),
  // invalid counts incl. boundaries 2 and 1001
  fc.array(coordTuple, { minLength: 0, maxLength: 2 }).map((value) => ({ value, flag: true })),
  fc.constantFrom(ring(2), ring(1001), []).map((value) => ({ value, flag: true })),
  // non-array / missing
  fc.constantFrom<unknown>(undefined, null, 'not-an-array', 42).map((value) => ({ value, flag: true })),
);

// --- Per-entity case generators ------------------------------------------------

const driverCase: fc.Arbitrary<Case> = fc
  .record({
    name: stringField,
    email: stringField,
    phone: stringField,
    licenseNumber: stringField,
  })
  .map((r) => {
    const expected: string[] = [];
    for (const f of ['name', 'email', 'phone', 'licenseNumber'] as const) {
      if (r[f].flag) expected.push(f);
    }
    return {
      validate: validateDriverInput as Validator,
      input: {
        name: r.name.value,
        email: r.email.value,
        phone: r.phone.value,
        licenseNumber: r.licenseNumber.value,
      },
      expected,
    };
  });

const pingCase: fc.Arbitrary<Case> = fc
  .record({
    vehicleId: stringField,
    lat: latField,
    lng: lngField,
    timestamp: stringField,
  })
  .map((r) => {
    const expected: string[] = [];
    if (r.vehicleId.flag) expected.push('vehicleId');
    if (r.lat.flag) expected.push('lat');
    if (r.lng.flag) expected.push('lng');
    if (r.timestamp.flag) expected.push('timestamp');
    return {
      validate: validatePingInput as Validator,
      input: {
        vehicleId: r.vehicleId.value,
        lat: r.lat.value,
        lng: r.lng.value,
        timestamp: r.timestamp.value,
      },
      expected,
    };
  });

const deliveryCase: fc.Arbitrary<Case> = fc
  .record({
    address: stringField,
    recipientName: stringField,
    recipientContact: stringField,
    weightKg: weightField,
  })
  .map((r) => {
    const expected: string[] = [];
    for (const f of ['address', 'recipientName', 'recipientContact'] as const) {
      if (r[f].flag) expected.push(f);
    }
    if (r.weightKg.flag) expected.push('weightKg');
    return {
      validate: validateDeliveryInput as Validator,
      input: {
        address: r.address.value,
        recipientName: r.recipientName.value,
        recipientContact: r.recipientContact.value,
        weightKg: r.weightKg.value,
      },
      expected,
    };
  });

const zoneCase: fc.Arbitrary<Case> = fc
  .record({ name: stringField, vertices: verticesField })
  .map((r) => {
    const expected: string[] = [];
    if (r.name.flag) expected.push('name');
    if (r.vertices.flag) expected.push('vertices');
    return {
      validate: validateZoneInput as Validator,
      input: { name: r.name.value, vertices: r.vertices.value },
      expected,
    };
  });

const anyCase = fc.oneof(driverCase, pingCase, deliveryCase, zoneCase);

describe(tag(2, 'Required-field validation rejects offending fields without persisting'), () => {
  it('flags exactly the offending fields and persists only valid records', () => {
    fc.assert(
      fc.property(anyCase, (c) => {
        // A persistence sink: the create path writes here only on success.
        const store: Record<string, unknown>[] = [];
        const result = c.validate(c.input);
        if (result === null) {
          store.push(c.input);
        }

        if (c.expected.length === 0) {
          // Fully valid input: accepted and persisted.
          expect(result).toBeNull();
          expect(store).toHaveLength(1);
        } else {
          // Invalid input: rejected, names exactly the offending fields, and
          // nothing is persisted.
          expect(result).not.toBeNull();
          const err = result as ErrorEnvelope;
          expect(err.error).toBe(ErrorCode.ValidationError);
          // Exactly the offending fields, reported once each (set equality).
          expect(new Set(err.fields)).toEqual(new Set(c.expected));
          expect(err.fields.length).toBe(new Set(err.fields).size);
          expect(store).toHaveLength(0);
        }
      }),
      pbtParams(),
    );
  });
});
