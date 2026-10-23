import { describe, it, expect } from 'vitest';
import {
  groupPhotosIntoTrips,
  calculateYearRecap,
  buildTimelineFeed,
  formatTripDates,
  getUniqueYears
} from '../src/services/timelineService';
import { calculateSubsetXp } from '../src/services/gameService';
import type { PhotoRecord, MarkRecord, UnlockedAchievementRecord, GeoRegion } from '../src/types';

describe('timelineService', () => {
  it('groups photos into trips respecting 2-day gap', () => {
    const photos: PhotoRecord[] = [
      {
        id: 'p1',
        lat: 43.5,
        lon: 42.5,
        takenAt: '2026-06-01T10:00:00Z',
        regionId: 'RUS-KBR',
        country: 'RUS',
        proof: 'gold',
        h3: 'h1'
      },
      {
        id: 'p2',
        lat: 43.6,
        lon: 42.6,
        takenAt: '2026-06-03T18:00:00Z',
        regionId: 'RUS-KBR',
        country: 'RUS',
        proof: 'gold',
        h3: 'h2'
      },
      {
        id: 'p3',
        lat: 43.7,
        lon: 42.7,
        takenAt: '2026-06-07T12:00:00Z',
        regionId: 'RUS-KBR',
        country: 'RUS',
        proof: 'gold',
        h3: 'h3'
      }
    ];

    const trips = groupPhotosIntoTrips(photos);
    expect(trips).toHaveLength(2);
    expect(trips[0].photoIds).toEqual(['p1', 'p2']);
    expect(trips[1].photoIds).toEqual(['p3']);
    expect(trips[0].dateLabel).toBe('1–3 июня');
    expect(trips[1].dateLabel).toBe('7 июня');
  });

  it('splits trips when regions are not neighbors', () => {
    const photos: PhotoRecord[] = [
      {
        id: 'p1',
        lat: 55.75,
        lon: 37.61,
        takenAt: '2026-06-01T10:00:00Z',
        regionId: 'RUS-MOW',
        country: 'RUS',
        proof: 'gold',
        h3: 'h1'
      },
      {
        id: 'p2',
        lat: 43.11,
        lon: 131.87,
        takenAt: '2026-06-02T10:00:00Z',
        regionId: 'RUS-PRI',
        country: 'RUS',
        proof: 'gold',
        h3: 'h2'
      }
    ];

    const isNeighbor = (r1: string, r2: string) => (r1 === 'RUS-MOW' && r2 === 'RUS-MOS') || (r1 === 'RUS-MOS' && r2 === 'RUS-MOW');

    const trips = groupPhotosIntoTrips(photos, { isNeighbor });
    expect(trips).toHaveLength(2);
    expect(trips[0].photoIds).toEqual(['p1']);
    expect(trips[1].photoIds).toEqual(['p2']);
  });

  it('groups consecutive photos in neighboring regions into a single trip', () => {
    const photos: PhotoRecord[] = [
      {
        id: 'p1',
        lat: 43.5,
        lon: 42.5,
        takenAt: '2026-06-01T10:00:00Z',
        regionId: 'RUS-KBR',
        country: 'RUS',
        proof: 'gold',
        h3: 'h1'
      },
      {
        id: 'p2',
        lat: 43.3,
        lon: 41.6,
        takenAt: '2026-06-02T12:00:00Z',
        regionId: 'RUS-KCH',
        country: 'RUS',
        proof: 'gold',
        h3: 'h2'
      }
    ];

    const isNeighbor = (r1: string, r2: string) =>
      (r1 === 'RUS-KBR' && r2 === 'RUS-KCH') || (r1 === 'RUS-KCH' && r2 === 'RUS-KBR');

    const trips = groupPhotosIntoTrips(photos, { isNeighbor });
    expect(trips).toHaveLength(1);
    expect(trips[0].regionIds).toContain('RUS-KBR');
    expect(trips[0].regionIds).toContain('RUS-KCH');
    expect(trips[0].dateLabel).toBe('1–2 июня');
  });

  it('correctly marks trips entirely within homeRegionId as isHome', () => {
    const photos: PhotoRecord[] = [
      {
        id: 'p1',
        lat: 55.75,
        lon: 37.61,
        takenAt: '2026-05-01T10:00:00Z',
        regionId: 'RUS-MOW',
        country: 'RUS',
        proof: 'gold',
        h3: 'h1'
      },
      {
        id: 'p2',
        lat: 55.76,
        lon: 37.62,
        takenAt: '2026-05-02T10:00:00Z',
        regionId: 'RUS-MOW',
        country: 'RUS',
        proof: 'gold',
        h3: 'h2'
      },
      {
        id: 'p3',
        lat: 59.93,
        lon: 30.33,
        takenAt: '2026-07-01T10:00:00Z',
        regionId: 'RUS-SPE',
        country: 'RUS',
        proof: 'gold',
        h3: 'h3'
      }
    ];

    const trips = groupPhotosIntoTrips(photos, { homeRegionId: 'RUS-MOW' });
    expect(trips).toHaveLength(2);
    expect(trips[0].isHome).toBe(true);
    expect(trips[1].isHome).toBe(false);
  });

  it('computes newly opened entities considering prior history', () => {
    const photos: PhotoRecord[] = [
      {
        id: 'p1',
        lat: 55.75,
        lon: 37.61,
        takenAt: '2024-05-01T10:00:00Z',
        regionId: 'RUS-MOW',
        districtId: 'D-MOW-1',
        country: 'RUS',
        proof: 'gold',
        h3: 'h1'
      },
      {
        id: 'p2',
        lat: 55.75,
        lon: 37.61,
        takenAt: '2026-06-01T10:00:00Z',
        regionId: 'RUS-MOW',
        districtId: 'D-MOW-1',
        country: 'RUS',
        proof: 'gold',
        h3: 'h2'
      },
      {
        id: 'p3',
        lat: 59.93,
        lon: 30.33,
        takenAt: '2026-06-02T10:00:00Z',
        regionId: 'RUS-SPE',
        districtId: 'D-SPE-1',
        country: 'RUS',
        proof: 'gold',
        h3: 'h3'
      }
    ];

    const isNeighbor = (_r1: string, _r2: string) => true;
    const trips = groupPhotosIntoTrips(photos, { isNeighbor });
    expect(trips).toHaveLength(2);

    expect(trips[0].newRegionsCount).toBe(1);
    expect(trips[0].newDistrictsCount).toBe(1);
    expect(trips[0].newCountriesCount).toBe(1);

    expect(trips[1].newRegionsCount).toBe(1);
    expect(trips[1].newDistrictsCount).toBe(1);
    expect(trips[1].newCountriesCount).toBe(0);

    const recap2026 = calculateYearRecap(2026, photos, [], [], { isNeighbor });
    expect(recap2026.newCountriesCount).toBe(0);
    expect(recap2026.newRegionsCount).toBe(1);
    expect(recap2026.newRusRegionsCount).toBe(1);
    expect(recap2026.newDistrictsCount).toBe(1);
  });

  it('calculates year recap accurately', () => {
    const photos: PhotoRecord[] = [
      {
        id: 'p1',
        lat: 55.75,
        lon: 37.61,
        alt: 150,
        takenAt: '2026-01-10T10:00:00Z',
        regionId: 'RUS-MOW',
        districtId: 'D1',
        country: 'RUS',
        proof: 'gold',
        h3: 'h1'
      },
      {
        id: 'p2',
        lat: 43.5,
        lon: 42.5,
        alt: 2200,
        takenAt: '2026-06-15T10:00:00Z',
        regionId: 'RUS-KBR',
        districtId: 'D2',
        country: 'RUS',
        proof: 'gold',
        h3: 'h2'
      },
      {
        id: 'p3',
        lat: 43.6,
        lon: 42.6,
        alt: 3890,
        takenAt: '2026-06-16T12:00:00Z',
        regionId: 'RUS-KBR',
        districtId: 'D2',
        country: 'RUS',
        proof: 'gold',
        h3: 'h3'
      }
    ];

    const marks: MarkRecord[] = [
      {
        id: 'm1',
        targetId: 'RUS-KCH',
        targetType: 'region',
        markType: 'visited_manual',
        createdAt: '2026-07-20T10:00:00Z',
        country: 'RUS'
      }
    ];

    const achievements: UnlockedAchievementRecord[] = [
      { id: 'first_photo', unlockedAt: '2026-01-10T10:05:00Z' },
      { id: 'old_ach', unlockedAt: '2025-05-01T10:00:00Z' }
    ];

    const regions: Record<string, GeoRegion> = {
      'RUS-MOW': { id: 'RUS-MOW', name: 'Москва', country: 'RUS', countryName: 'Россия', area: 2500, rarity: 1 },
      'RUS-KBR': { id: 'RUS-KBR', name: 'Кабардино-Балкария', country: 'RUS', countryName: 'Россия', area: 12500, rarity: 2 },
      'RUS-KCH': { id: 'RUS-KCH', name: 'Карачаево-Черкесия', country: 'RUS', countryName: 'Россия', area: 14000, rarity: 2 }
    };

    const centers: Record<string, { lat: number; lon: number }> = {
      'RUS-MOW': { lat: 55.75, lon: 37.61 },
      'RUS-KBR': { lat: 43.5, lon: 42.5 },
      'RUS-KCH': { lat: 43.8, lon: 41.8 }
    };

    const recap = calculateYearRecap(2026, photos, marks, achievements, {
      homeRegionId: 'RUS-MOW',
      getRegionById: id => regions[id],
      getRegionCenter: id => centers[id],
      getRegionName: id => regions[id]?.name || id
    });

    expect(recap.year).toBe(2026);
    expect(recap.newCountriesCount).toBe(1);
    expect(recap.newRegionsCount).toBe(3);
    expect(recap.newRusRegionsCount).toBe(3);
    expect(recap.newDistrictsCount).toBe(2);
    expect(recap.tripsCount).toBe(1);
    expect(recap.daysInTravel).toBe(2);
    expect(recap.highestPoint?.alt).toBe(3890);
    expect(recap.furthestPoint).toBeDefined();
    expect(recap.furthestPoint?.km).toBeGreaterThan(1000);
    expect(recap.unlockedAchievementsCount).toBe(1);
    expect(recap.totalXp).toBeGreaterThan(0);
  });

  it('determines extreme geographic regions correctly', () => {
    const photos: PhotoRecord[] = [
      {
        id: 'p_north',
        lat: 68.97,
        lon: 33.08,
        takenAt: '2026-03-01T10:00:00Z',
        regionId: 'RUS-MUR',
        country: 'RUS',
        proof: 'gold',
        h3: 'h1'
      },
      {
        id: 'p_south',
        lat: 42.06,
        lon: 48.29,
        takenAt: '2026-05-01T10:00:00Z',
        regionId: 'RUS-DAG',
        country: 'RUS',
        proof: 'gold',
        h3: 'h2'
      },
      {
        id: 'p_west',
        lat: 54.71,
        lon: 20.51,
        takenAt: '2026-07-01T10:00:00Z',
        regionId: 'RUS-KGD',
        country: 'RUS',
        proof: 'gold',
        h3: 'h3'
      },
      {
        id: 'p_east',
        lat: 64.73,
        lon: 177.51,
        takenAt: '2026-09-01T10:00:00Z',
        regionId: 'RUS-CHU',
        country: 'RUS',
        proof: 'gold',
        h3: 'h4'
      }
    ];

    const centers: Record<string, { lat: number; lon: number }> = {
      'RUS-MUR': { lat: 68.97, lon: 33.08 },
      'RUS-DAG': { lat: 42.06, lon: 48.29 },
      'RUS-KGD': { lat: 54.71, lon: 20.51 },
      'RUS-CHU': { lat: 64.73, lon: 177.51 }
    };

    const recap = calculateYearRecap(2026, photos, [], [], {
      getRegionCenter: id => centers[id],
      getRegionName: id => id
    });

    expect(recap.northernRegion?.id).toBe('RUS-MUR');
    expect(recap.southernRegion?.id).toBe('RUS-DAG');
    expect(recap.westernRegion?.id).toBe('RUS-KGD');
    expect(recap.easternRegion?.id).toBe('RUS-CHU');
  });

  it('builds 12-month activity histogram correctly', () => {
    const photos: PhotoRecord[] = [
      {
        id: 'p1',
        lat: 55.75,
        lon: 37.61,
        takenAt: '2026-01-10T10:00:00Z',
        regionId: 'RUS-MOW',
        country: 'RUS',
        proof: 'gold',
        h3: 'h1'
      },
      {
        id: 'p2',
        lat: 55.75,
        lon: 37.61,
        takenAt: '2026-01-10T15:00:00Z',
        regionId: 'RUS-MOW',
        country: 'RUS',
        proof: 'gold',
        h3: 'h2'
      },
      {
        id: 'p3',
        lat: 55.75,
        lon: 37.61,
        takenAt: '2026-01-12T10:00:00Z',
        regionId: 'RUS-MOW',
        country: 'RUS',
        proof: 'gold',
        h3: 'h3'
      },
      {
        id: 'p4',
        lat: 55.75,
        lon: 37.61,
        takenAt: '2026-08-05T10:00:00Z',
        regionId: 'RUS-MOW',
        country: 'RUS',
        proof: 'gold',
        h3: 'h4'
      }
    ];

    const recap = calculateYearRecap(2026, photos);
    expect(recap.monthlyDays).toHaveLength(12);
    expect(recap.monthlyDays[0].daysCount).toBe(2);
    expect(recap.monthlyDays[7].daysCount).toBe(1);
    expect(recap.monthlyDays[1].daysCount).toBe(0);
    expect(recap.monthlyDays[5].daysCount).toBe(0);
  });

  it('gracefully handles empty data', () => {
    const trips = groupPhotosIntoTrips([]);
    expect(trips).toEqual([]);

    const years = getUniqueYears([]);
    expect(years).toEqual([]);

    const recap = calculateYearRecap(2026, []);
    expect(recap.year).toBe(2026);
    expect(recap.newCountriesCount).toBe(0);
    expect(recap.newRegionsCount).toBe(0);
    expect(recap.tripsCount).toBe(0);
    expect(recap.daysInTravel).toBe(0);
    expect(recap.furthestPoint).toBeUndefined();
    expect(recap.northernRegion).toBeUndefined();
    expect(recap.highestPoint).toBeUndefined();
    expect(recap.totalXp).toBe(0);
    expect(recap.monthlyDays).toHaveLength(12);

    const feed = buildTimelineFeed([], []);
    expect(feed).toEqual([]);
  });

  it('formats trip date intervals properly in Russian typography', () => {
    expect(formatTripDates('2026-06-12T10:00:00Z', '2026-06-12T18:00:00Z')).toBe('12 июня');
    expect(formatTripDates('2026-06-12T10:00:00Z', '2026-06-15T18:00:00Z')).toBe('12–15 июня');
    expect(formatTripDates('2026-06-28T10:00:00Z', '2026-07-03T18:00:00Z')).toBe('28 июня – 3 июля');
    expect(formatTripDates('2025-12-30T10:00:00Z', '2026-01-05T18:00:00Z')).toBe('30 декабря 2025 – 5 января 2026');
  });

  it('executes grouping and recap on 5000 synthetic photos in under 200 ms', () => {
    const syntheticPhotos: PhotoRecord[] = [];
    const baseEpoch = new Date('2024-01-01T00:00:00Z').getTime();

    for (let i = 0; i < 5000; i++) {
      const dayOffset = Math.floor(i / 5);
      const hourOffset = (i % 5) * 2;
      const ts = new Date(baseEpoch + dayOffset * 86400000 + hourOffset * 3600000).toISOString();
      const regIndex = (Math.floor(i / 20)) % 15;
      syntheticPhotos.push({
        id: `synth-${i}`,
        lat: 50 + (i % 100) * 0.1,
        lon: 30 + (i % 100) * 0.1,
        alt: 100 + (i % 50) * 20,
        takenAt: ts,
        regionId: `REG-${regIndex}`,
        districtId: `DIST-${i % 40}`,
        country: regIndex < 10 ? 'RUS' : 'BLR',
        proof: i % 10 === 0 ? 'silver' : 'gold',
        h3: `h3-${i % 500}`
      });
    }

    const t0 = performance.now();
    const trips = groupPhotosIntoTrips(syntheticPhotos, {
      homeRegionId: 'REG-0'
    });
    const recap = calculateYearRecap(2025, syntheticPhotos, [], [], {
      homeRegionId: 'REG-0'
    });
    const duration = performance.now() - t0;

    expect(trips.length).toBeGreaterThan(10);
    expect(recap.monthlyDays).toHaveLength(12);
    expect(duration).toBeLessThan(200);
  });
  it('splits XP between years without counting revisits twice', () => {
    const mk = (id: string, takenAt: string, regionId: string): PhotoRecord => ({
      id, lat: 55, lon: 37, takenAt, regionId, country: 'RUS', proof: 'gold', h3: id
    });
    const photos = [
      mk('a', '2025-05-01T10:00:00', 'RUS-MOW'),
      mk('b', '2026-05-01T10:00:00', 'RUS-MOW'),
      mk('c', '2026-07-01T10:00:00', 'RUS-SPE')
    ];
    const total = calculateSubsetXp({ photos }).totalXp;
    const xp2025 = calculateYearRecap(2025, photos).totalXp;
    const xp2026 = calculateYearRecap(2026, photos).totalXp;
    expect(xp2025).toBeGreaterThan(0);
    expect(xp2026).toBeGreaterThan(0);
    expect(xp2025 + xp2026).toBe(total);
  });
});
