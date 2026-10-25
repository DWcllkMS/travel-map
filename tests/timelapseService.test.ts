import { describe, it, expect } from 'vitest';
import {
  buildTimelapseSteps,
  formatRuDate,
  computeBaseStepDuration
} from '../src/services/timelapseService';
import type { PhotoRecord, MarkRecord } from '../src/types';

describe('timelapseService', () => {
  it('returns empty steps for empty inputs', () => {
    expect(buildTimelapseSteps([], [])).toEqual([]);
  });

  it('formats dates into Russian locale string', () => {
    expect(formatRuDate('2025-06-12')).toContain('2025');
    expect(formatRuDate('2025-06-12')).toContain('июн');
  });

  it('computes step duration within reasonable bounds', () => {
    expect(computeBaseStepDuration(5)).toBe(1500);
    expect(computeBaseStepDuration(10)).toBe(1500);
    expect(computeBaseStepDuration(25)).toBe(1000);
    expect(computeBaseStepDuration(100)).toBe(250);
    expect(computeBaseStepDuration(1000)).toBe(50);
  });

  it('sorts steps chronologically and aggregates items', () => {
    const photos: PhotoRecord[] = [
      {
        id: 'p2',
        lat: 55.75,
        lon: 37.61,
        takenAt: '2025-05-10T12:00:00Z',
        regionId: 'RUS-MOW',
        districtId: 'd-arbat',
        country: 'RUS',
        h3: '861181b2fffffff',
        proof: 'gold'
      },
      {
        id: 'p1',
        lat: 59.93,
        lon: 30.33,
        takenAt: '2024-08-01T10:00:00Z',
        regionId: 'RUS-SPE',
        districtId: 'd-centr',
        country: 'RUS',
        h3: '861181b3fffffff',
        proof: 'gold'
      },
      {
        id: 'p3',
        lat: 55.76,
        lon: 37.62,
        takenAt: '2025-05-10T15:00:00Z',
        regionId: 'RUS-MOW',
        districtId: 'd-tverskoy',
        country: 'RUS',
        h3: '861181b4fffffff',
        proof: 'gold'
      }
    ];

    const marks: MarkRecord[] = [
      {
        id: 'm1',
        targetId: 'RUS-KDA',
        targetType: 'region',
        markType: 'visited_manual',
        createdAt: '2025-06-01T00:00:00Z',
        country: 'RUS'
      },
      {
        id: 'm2',
        targetId: 'RUS-KDA',
        targetType: 'region',
        markType: 'wishlist',
        createdAt: '2025-01-01T00:00:00Z'
      }
    ];

    const steps = buildTimelapseSteps(photos, marks, {
      getRegionName: id => (id === 'RUS-SPE' ? 'Санкт-Петербург' : id === 'RUS-MOW' ? 'Москва' : 'Краснодарский край'),
      getCountryName: () => 'Россия'
    });

    expect(steps.length).toBe(3);
    expect(steps[0].date).toBe('2024-08-01');
    expect(steps[0].newPhotos.length).toBe(1);
    expect(steps[0].newRegions).toEqual(['RUS-SPE']);
    expect(steps[0].newDistricts).toEqual(['d-centr']);
    expect(steps[0].regionsCount).toBe(1);
    expect(steps[0].districtsCount).toBe(1);
    expect(steps[0].countriesCount).toBe(1);
    expect(steps[0].newDiscoveries).toEqual(['+ Россия', '+ Санкт-Петербург']);
    expect(steps[0].center).toEqual([30.33, 59.93]);

    expect(steps[1].date).toBe('2025-05-10');
    expect(steps[1].newPhotos.length).toBe(2);
    expect(steps[1].newRegions).toEqual(['RUS-MOW']);
    expect(steps[1].newDistricts).toEqual(['d-arbat', 'd-tverskoy']);
    expect(steps[1].regionsCount).toBe(2);
    expect(steps[1].districtsCount).toBe(3);
    expect(steps[1].cumulativePhotos.length).toBe(3);

    expect(steps[2].date).toBe('2025-06-01');
    expect(steps[2].newMarks.length).toBe(1);
    expect(steps[2].newRegions).toEqual(['RUS-KDA']);
    expect(steps[2].regionsCount).toBe(3);
  });
});
