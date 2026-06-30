import { ErrorCode } from '@fleet/contracts';

import {
  isMissing,
  validateDriverInput,
  validatePingInput,
  validateDeliveryInput,
  validateZoneInput,
} from './index';

describe('isMissing', () => {
  it('treats undefined, null, empty and whitespace strings, and NaN as missing', () => {
    expect(isMissing(undefined)).toBe(true);
    expect(isMissing(null)).toBe(true);
    expect(isMissing('')).toBe(true);
    expect(isMissing('   ')).toBe(true);
    expect(isMissing(NaN)).toBe(true);
  });

  it('treats non-empty (incl. non-ASCII) strings and numbers as present', () => {
    expect(isMissing('a')).toBe(false);
    expect(isMissing('日本語')).toBe(false);
    expect(isMissing('Ångström')).toBe(false);
    expect(isMissing(0)).toBe(false);
    expect(isMissing(-12.5)).toBe(false);
  });
});

describe('validateDriverInput', () => {
  it('accepts a complete record', () => {
    expect(
      validateDriverInput({
        name: 'Ann',
        email: 'a@b.c',
        phone: '555',
        licenseNumber: 'LIC',
      }),
    ).toBeNull();
  });

  it('names every missing required field exactly once', () => {
    const err = validateDriverInput({ name: '   ', email: 'a@b.c' });
    expect(err?.error).toBe(ErrorCode.ValidationError);
    expect(err?.fields).toEqual(['name', 'phone', 'licenseNumber']);
  });
});

describe('validatePingInput', () => {
  it('accepts in-range coordinates', () => {
    expect(
      validatePingInput({ vehicleId: 'v1', lat: 45, lng: -120, timestamp: 't' }),
    ).toBeNull();
  });

  it('accepts coordinate boundaries', () => {
    expect(
      validatePingInput({ vehicleId: 'v1', lat: 90, lng: 180, timestamp: 't' }),
    ).toBeNull();
    expect(
      validatePingInput({ vehicleId: 'v1', lat: -90, lng: -180, timestamp: 't' }),
    ).toBeNull();
  });

  it('flags out-of-range coordinates', () => {
    const err = validatePingInput({
      vehicleId: 'v1',
      lat: 90.1,
      lng: -181,
      timestamp: 't',
    });
    expect(err?.fields).toEqual(['lat', 'lng']);
  });

  it('reports a missing coordinate once, not also as out-of-range', () => {
    const err = validatePingInput({ vehicleId: 'v1', lng: 10, timestamp: 't' });
    expect(err?.fields).toEqual(['lat']);
  });
});

describe('validateDeliveryInput', () => {
  it('accepts a valid delivery including the weight upper boundary', () => {
    expect(
      validateDeliveryInput({
        address: '1 Main',
        recipientName: 'Rae',
        recipientContact: '555',
        weightKg: 1000,
      }),
    ).toBeNull();
  });

  it('flags a weight of exactly 0 (exclusive lower bound)', () => {
    const err = validateDeliveryInput({
      address: '1 Main',
      recipientName: 'Rae',
      recipientContact: '555',
      weightKg: 0,
    });
    expect(err?.fields).toEqual(['weightKg']);
  });

  it('flags weight above the maximum and missing fields together', () => {
    const err = validateDeliveryInput({
      address: '',
      recipientName: 'Rae',
      recipientContact: '555',
      weightKg: 1000.1,
    });
    expect(err?.fields).toEqual(['address', 'weightKg']);
  });
});

describe('validateZoneInput', () => {
  it('accepts a polygon with 3 vertices (lower boundary)', () => {
    expect(
      validateZoneInput({
        name: 'Depot',
        vertices: [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
      }),
    ).toBeNull();
  });

  it('accepts a polygon with 1000 vertices (upper boundary)', () => {
    const ring = Array.from({ length: 1000 }, (_, i) => [i, 0]);
    expect(validateZoneInput({ name: 'Big', vertices: ring })).toBeNull();
  });

  it('flags fewer than 3 vertices', () => {
    const err = validateZoneInput({
      name: 'Tiny',
      vertices: [
        [0, 0],
        [1, 1],
      ],
    });
    expect(err?.fields).toEqual(['vertices']);
  });

  it('flags more than 1000 vertices', () => {
    const ring = Array.from({ length: 1001 }, (_, i) => [i, 0]);
    const err = validateZoneInput({ name: 'Huge', vertices: ring });
    expect(err?.fields).toEqual(['vertices']);
  });

  it('flags a missing name and missing vertices together', () => {
    const err = validateZoneInput({});
    expect(err?.fields).toEqual(['name', 'vertices']);
  });
});
