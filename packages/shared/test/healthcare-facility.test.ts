import { describe, expect, it } from 'vitest';
import { facilityTypes, isFacilityType } from '../src/healthcare-facility.js';

describe('healthcare facility contract', () => {
  it('exposes the allowed facility types in a stable order', () => {
    expect(facilityTypes).toEqual([
      'hospital',
      'clinic',
      'health_center',
      'diagnostic_center',
      'pharmacy',
    ]);
  });

  it('recognizes valid facility types', () => {
    expect(isFacilityType('clinic')).toBe(true);
    expect(isFacilityType('ward')).toBe(false);
  });
});
