import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { SightsSpatialIndex } from '../src/services/sightsIndex';
import { calculateSightXp, evaluateAchievements } from '../src/services/gameService';
import { SEVEN_WONDERS_OF_RUSSIA, ACHIEVEMENTS } from '../src/services/achievementsConfig';
import type { PhotoRecord, GameContext, GeoSight } from '../src/types';

function createMockContext(overrides: Partial<GameContext> = {}): GameContext {
  return {
    visitedDistrictIds: new Set(),
    visitedRegionIds: new Set(),
    visitedCountries: new Set(),
    photos: [],
    marks: [],
    includeManual: true,
    visitedRusRegionNames: new Set(),
    visitedNonRusRegionCount: 0,
    visitedContinents: new Set(),
    visitedEuropeanCountries: new Set(),
    visitedAsianCountries: new Set(),
    visitedRussianDistrictsCount: 0,
    hasCompletedAnyFullRegion: false,
    bestCompletedRegionProgress: { visited: 0, total: 1 },
    hasNorthernHemisphere: false,
    hasSouthernHemisphere: false,
    visitedSightIds: new Set(),
    visitedSightFirstDates: new Map(),
    allSights: [],
    ...overrides
  };
}

describe('Sights Data & Integrity', () => {
  const root = path.resolve(__dirname, '..');
  const sightsRaw = JSON.parse(fs.readFileSync(path.join(root, 'public', 'data', 'sights.json'), 'utf8'));

  it('contains over 4000 sights in GeoJSON format', () => {
    expect(sightsRaw.type).toBe('FeatureCollection');
    expect(sightsRaw.features.length).toBeGreaterThan(4000);
  });

  it('contains all Seven Wonders of Russia with valid data', () => {
    const sightMap = new Map<string, any>(sightsRaw.features.map((f: any) => [f.properties.id, f.properties]));

    for (const qId of SEVEN_WONDERS_OF_RUSSIA) {
      expect(sightMap.has(qId)).toBe(true);
      const sight = sightMap.get(qId);
      expect(sight.name).toBeTruthy();
      expect(sight.tier).toBeGreaterThanOrEqual(1);
      expect(sight.tier).toBeLessThanOrEqual(4);
      expect(sight.radius).toBeGreaterThan(0);
    }
  });

  it('ensures each sight has coordinates, tier, radius and kind', () => {
    for (const f of sightsRaw.features.slice(0, 500)) {
      expect(f.geometry.type).toBe('Point');
      expect(typeof f.geometry.coordinates[0]).toBe('number');
      expect(typeof f.geometry.coordinates[1]).toBe('number');
      expect(f.properties.tier).toBeGreaterThanOrEqual(1);
      expect(f.properties.tier).toBeLessThanOrEqual(4);
      expect(f.properties.radius).toBeGreaterThan(0);
      expect(typeof f.properties.kind).toBe('string');
    }
  });

  it('verifies all sight achievement thresholds are achievable by data', () => {
    const totalCount = sightsRaw.features.length;
    expect(totalCount).toBeGreaterThanOrEqual(400);

    let unescoCount = 0;
    let museumCount = 0;
    let religiousCount = 0;
    let natureCount = 0;
    const foreignCountries = new Set<string>();
    const rusRegionCounts = new Map<string, number>();
    let rusBridgesCount = 0;

    const romanRegex = /^[IVXLCDM]+$/;

    for (const f of sightsRaw.features) {
      const p = f.properties;
      if (p.unesco) unescoCount++;
      if (p.kind === 'museum') museumCount++;
      if (p.kind === 'religious') religiousCount++;
      if (['nature', 'mountain', 'water', 'park'].includes(p.kind)) natureCount++;
      if (p.country && p.country !== 'RUS') foreignCountries.add(p.country);

      if (p.country === 'RUS') {
        rusRegionCounts.set(p.regionId, (rusRegionCounts.get(p.regionId) || 0) + 1);
        if (p.kind === 'bridge') rusBridgesCount++;
      }

      const words = p.name.split(/[^\wа-яА-ЯёЁa-zA-Z]/).filter(Boolean);
      for (const w of words) {
        if (/[a-zA-Z]/.test(w) && !romanRegex.test(w)) {
          throw new Error(`Sight "${p.name}" contains forbidden Latin: "${w}"`);
        }
      }
    }

    expect(unescoCount).toBeGreaterThanOrEqual(900);
    expect(unescoCount).toBeLessThanOrEqual(1050);
    expect(museumCount).toBeGreaterThanOrEqual(20);
    expect(religiousCount).toBeGreaterThanOrEqual(20);
    expect(natureCount).toBeGreaterThanOrEqual(30);
    expect(foreignCountries.size).toBeGreaterThanOrEqual(5);

    expect(rusRegionCounts.size).toBe(89);
    for (const count of rusRegionCounts.values()) {
      expect(count).toBeGreaterThanOrEqual(6);
    }
    expect(rusBridgesCount).toBeLessThanOrEqual(15);
  });

  it('verifies all Russian UNESCO sites and Kremlin deduplication', () => {
    const expectedQids = [
      'Q1218832', 'Q122730525', 'Q128597769', 'Q155495', 'Q15980181', 'Q1643788',
      'Q16961872', 'Q192243', 'Q211962', 'Q220951', 'Q270725', 'Q277576',
      'Q277683', 'Q4204534', 'Q4411008', 'Q47519282', 'Q477462', 'Q5513',
      'Q5595', 'Q593870', 'Q603622', 'Q616578', 'Q64532917', 'Q64746144',
      'Q64763166', 'Q64787152', 'Q64787456', 'Q64797735', 'Q64798261', 'Q64808630',
      'Q66053233', 'Q838256', 'Q838264', 'Q985595'
    ];

    const sightsMap = new Map<string, any>(sightsRaw.features.map((f: any) => [f.properties.id, f.properties]));

    for (const qid of expectedQids) {
      expect(sightsMap.has(qid)).toBe(true);
      const s = sightsMap.get(qid);
      expect(s.unesco).toBe(true);
    }

    const kremlin = sightsMap.get('Q16961872');
    expect(kremlin).toBeDefined();
    expect(kremlin.name).toBe('Московский Кремль и Красная площадь');
    expect(kremlin.kind).toBe('fortress');
    expect(kremlin.tier).toBe(4);
    expect(sightsMap.has('Q133274')).toBe(false);

    const rusOthers = sightsRaw.features.filter((f: any) => f.properties.country === 'RUS' && f.properties.kind === 'other');
    expect(rusOthers.length).toBe(0);

    const totalOthers = sightsRaw.features.filter((f: any) => f.properties.kind === 'other');
    expect(totalOthers.length / sightsRaw.features.length).toBeLessThanOrEqual(0.05);
  });

  it('verifies tier 4 share is at most 6% and ordinary lakes are not tier 4', () => {
    const tier4Features = sightsRaw.features.filter((f: any) => f.properties.tier === 4);
    const tier4Share = tier4Features.length / sightsRaw.features.length;
    expect(tier4Share).toBeLessThanOrEqual(0.06);

    const khanka = sightsRaw.features.find((f: any) => f.properties.name === 'Ханка');
    if (khanka) expect(khanka.properties.tier).toBeLessThan(4);

    const ilmen = sightsRaw.features.find((f: any) => f.properties.name === 'Ильмень');
    if (ilmen) expect(ilmen.properties.tier).toBeLessThan(4);
  });
});

describe('Sights Spatial Index & Photo Matching', () => {
  const mockGeoJson = {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        id: 'Q1',
        properties: {
          id: 'Q1',
          name: 'Point Alpha',
          kind: 'monument' as const,
          unesco: false,
          tier: 1 as const,
          radius: 500,
          regionId: 'RUS-1',
          country: 'RUS'
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [37.6173, 55.7558]
        }
      },
      {
        type: 'Feature' as const,
        id: 'Q2',
        properties: {
          id: 'Q2',
          name: 'Point Beta',
          kind: 'nature' as const,
          unesco: true,
          tier: 4 as const,
          radius: 5000,
          regionId: 'RUS-2',
          country: 'RUS'
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [42.4392, 43.3499]
        }
      }
    ]
  };

  it('correctly indexes sights and finds sight by id', () => {
    const index = new SightsSpatialIndex();
    index.init(mockGeoJson);

    expect(index.getAll().length).toBe(2);
    expect(index.getById('Q1')?.name).toBe('Point Alpha');
    expect(index.getById('Q2')?.unesco).toBe(true);
    expect(index.getById('UNKNOWN')).toBeUndefined();
  });

  it('matches photos strictly within radius and tracks earliest photo date', () => {
    const index = new SightsSpatialIndex();
    index.init(mockGeoJson);

    const photos: PhotoRecord[] = [
      {
        id: 'p1',
        lat: 55.7560,
        lon: 37.6175,
        takenAt: '2026-06-01T10:00:00Z',
        regionId: 'RUS-1',
        country: 'RUS',
        h3: '8611846cfffffff',
        proof: 'gold'
      },
      {
        id: 'p2',
        lat: 55.7559,
        lon: 37.6174,
        takenAt: '2026-05-15T12:00:00Z',
        regionId: 'RUS-1',
        country: 'RUS',
        h3: '8611846cfffffff',
        proof: 'silver'
      },
      {
        id: 'p3',
        lat: 55.7800,
        lon: 37.6500,
        takenAt: '2026-06-02T10:00:00Z',
        regionId: 'RUS-1',
        country: 'RUS',
        h3: '8611846cfffffff',
        proof: 'gold'
      }
    ];

    const match = index.matchPhotos(photos);
    expect(match.visitedSightIds.has('Q1')).toBe(true);
    expect(match.visitedSightIds.has('Q2')).toBe(false);
    expect(match.visitedSightFirstDates.get('Q1')).toBe('2026-05-15T12:00:00Z');
  });

  it('does not unlock sight if proof is bronze', () => {
    const index = new SightsSpatialIndex();
    index.init(mockGeoJson);

    const photos: PhotoRecord[] = [
      {
        id: 'p1',
        lat: 55.7558,
        lon: 37.6173,
        takenAt: '2026-06-01T10:00:00Z',
        regionId: 'RUS-1',
        country: 'RUS',
        h3: '8611846cfffffff',
        proof: 'bronze'
      }
    ];

    const match = index.matchPhotos(photos);
    expect(match.visitedSightIds.has('Q1')).toBe(false);
  });
});

describe('Sight XP Calculation', () => {
  it('calculates XP based on tier and UNESCO status', () => {
    expect(calculateSightXp(1, false)).toBe(150);
    expect(calculateSightXp(2, false)).toBe(300);
    expect(calculateSightXp(3, false)).toBe(450);
    expect(calculateSightXp(4, false)).toBe(600);

    expect(calculateSightXp(1, true)).toBe(650);
    expect(calculateSightXp(4, true)).toBe(1100);
  });
});

describe('Sights Achievements Evaluation', () => {
  const mockSights: GeoSight[] = [
    {
      id: 'Q43105',
      name: 'Эльбрус',
      kind: 'mountain',
      unesco: false,
      sitelinks: 95,
      tier: 4,
      radius: 10000,
      regionId: 'RUS-2304',
      country: 'RUS',
      lat: 43.3499,
      lon: 42.4392
    },
    {
      id: 'Q5513',
      name: 'Байкал',
      kind: 'water',
      unesco: true,
      sitelinks: 110,
      tier: 4,
      radius: 15000,
      regionId: 'RUS-2360',
      country: 'RUS',
      lat: 53.5,
      lon: 108.0
    },
    {
      id: 'Q1235610',
      name: 'Долина гейзеров',
      kind: 'nature',
      unesco: true,
      sitelinks: 45,
      tier: 4,
      radius: 5000,
      regionId: 'RUS-2362',
      country: 'RUS',
      lat: 54.43,
      lon: 160.15
    },
    {
      id: 'Q820002',
      name: 'Мамаев курган',
      kind: 'monument',
      unesco: false,
      sitelinks: 40,
      tier: 3,
      radius: 1000,
      regionId: 'RUS-2311',
      country: 'RUS',
      lat: 48.74,
      lon: 44.54
    },
    {
      id: 'Q4360238',
      name: 'Петергоф',
      kind: 'palace',
      unesco: true,
      sitelinks: 50,
      tier: 4,
      radius: 2000,
      regionId: 'RUS-2385',
      country: 'RUS',
      lat: 59.88,
      lon: 29.90
    },
    {
      id: 'Q129846',
      name: 'Храм Василия Блаженного',
      kind: 'religious',
      unesco: true,
      sitelinks: 85,
      tier: 4,
      radius: 500,
      regionId: 'RUS-2384',
      country: 'RUS',
      lat: 55.7525,
      lon: 37.6231
    },
    {
      id: 'Q2155757',
      name: 'Маньпупунёр',
      kind: 'nature',
      unesco: false,
      sitelinks: 30,
      tier: 3,
      radius: 3000,
      regionId: 'RUS-2366',
      country: 'RUS',
      lat: 62.25,
      lon: 59.30
    },
    {
      id: 'Q243',
      name: 'Эйфелева башня',
      kind: 'monument',
      unesco: true,
      sitelinks: 200,
      tier: 4,
      radius: 1000,
      regionId: '',
      country: 'FRA',
      lat: 48.8584,
      lon: 2.2945
    }
  ];

  it('unlocks sights_10 upon visiting 10 sights', () => {
    const tenIds = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
    const ctx = createMockContext({
      visitedSightIds: tenIds,
      allSights: mockSights
    });
    const unlocked = evaluateAchievements(ctx, new Set()).map(a => a.id);
    expect(unlocked).toContain('sights_10');
  });

  it('unlocks Seven Wonders of Russia achievement only when all 7 are visited', () => {
    const partialCtx = createMockContext({
      visitedSightIds: new Set(['Q43105', 'Q5513', 'Q1235610', 'Q820002', 'Q4360238', 'Q129846']),
      allSights: mockSights
    });
    expect(evaluateAchievements(partialCtx, new Set()).map(a => a.id)).not.toContain('sights_seven_wonders_rus');

    const fullCtx = createMockContext({
      visitedSightIds: new Set(SEVEN_WONDERS_OF_RUSSIA),
      allSights: mockSights
    });
    expect(evaluateAchievements(fullCtx, new Set()).map(a => a.id)).toContain('sights_seven_wonders_rus');
  });

  it('unlocks UNESCO sights achievements', () => {
    const unescoCtx = createMockContext({
      visitedSightIds: new Set(['Q5513', 'Q1235610', 'Q4360238']),
      allSights: mockSights
    });
    const unlocked = evaluateAchievements(unescoCtx, new Set()).map(a => a.id);
    expect(unlocked).toContain('sights_unesco_3');
  });

  it('counts world sights for foreign sights achievement', () => {
    const worldCtx = createMockContext({
      visitedSightIds: new Set(['Q243']),
      allSights: mockSights
    });
    const ach = ACHIEVEMENTS.find(a => a.id === 'sights_countries_5');
    expect(ach).toBeDefined();
    const prog = ach!.progress(worldCtx);
    expect(prog.current).toBe(1);
    expect(prog.target).toBe(5);
  });
});
