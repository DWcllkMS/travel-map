import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { evaluateAchievements } from '../src/services/gameService';
import {
  ACHIEVEMENTS,
  FEDERAL_DISTRICTS,
  RUSSIAN_SEAS,
  ARCTIC_REGIONS,
  EXTREME_POINTS,
  TRANSSIB_REGIONS,
  BAIKAL_REGIONS,
  GOLDEN_RING_REGIONS,
  CAUCASUS_REPUBLICS,
  RUSSIAN_REPUBLICS,
  RUSSIA_LAND_NEIGHBORS,
  CIS_MEMBERS
} from '../src/services/achievementsConfig';
import type { GameContext } from '../src/types';

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
    ...overrides
  };
}

describe('Achievements Configuration & Integrity', () => {
  const root = path.resolve(__dirname, '..');
  const regionsRaw = JSON.parse(fs.readFileSync(path.join(root, 'public', 'data', 'regions.json'), 'utf8'));
  const countriesRaw = JSON.parse(fs.readFileSync(path.join(root, 'public', 'data', 'countries.json'), 'utf8'));

  const rusRegionFeatures = regionsRaw.features.filter((f: any) => f.properties.country === 'RUS');
  const rusRegionNames = new Set<string>(rusRegionFeatures.map((f: any) => f.properties.name));
  const countryIds = new Set<string>(countriesRaw.features.map((f: any) => f.properties.id));

  it('contains exactly 89 subjects of the Russian Federation in data', () => {
    expect(rusRegionFeatures.length).toBe(89);
    expect(rusRegionNames.size).toBe(89);
  });

  it('partitions all 89 subjects into 8 federal districts without duplicates or omissions', () => {
    const okrugKeys = Object.keys(FEDERAL_DISTRICTS);
    expect(okrugKeys.length).toBe(8);

    const allInOkrugs: string[] = [];
    for (const key of okrugKeys) {
      allInOkrugs.push(...FEDERAL_DISTRICTS[key]);
    }

    expect(allInOkrugs.length).toBe(89);
    const uniqueOkrugs = new Set(allInOkrugs);
    expect(uniqueOkrugs.size).toBe(89);

    for (const name of allInOkrugs) {
      expect(rusRegionNames.has(name)).toBe(true);
    }

    for (const name of rusRegionNames) {
      expect(uniqueOkrugs.has(name)).toBe(true);
    }
  });

  it('ensures all thematic Russian region names exist in regions.json and belong to Russia', () => {
    const allSeaRegs = Object.values(RUSSIAN_SEAS).flat();
    for (const name of allSeaRegs) {
      expect(rusRegionNames.has(name)).toBe(true);
    }

    for (const name of ARCTIC_REGIONS) {
      expect(rusRegionNames.has(name)).toBe(true);
    }

    for (const name of EXTREME_POINTS) {
      expect(rusRegionNames.has(name)).toBe(true);
    }

    for (const name of TRANSSIB_REGIONS) {
      expect(rusRegionNames.has(name)).toBe(true);
    }

    for (const name of BAIKAL_REGIONS) {
      expect(rusRegionNames.has(name)).toBe(true);
    }

    for (const name of GOLDEN_RING_REGIONS) {
      expect(rusRegionNames.has(name)).toBe(true);
    }

    for (const name of CAUCASUS_REPUBLICS) {
      expect(rusRegionNames.has(name)).toBe(true);
    }

    for (const name of RUSSIAN_REPUBLICS) {
      expect(rusRegionNames.has(name)).toBe(true);
    }
  });

  it('ensures all land neighbors and CIS country codes exist in countries.json', () => {
    expect(RUSSIA_LAND_NEIGHBORS.length).toBe(16);
    for (const code of RUSSIA_LAND_NEIGHBORS) {
      expect(countryIds.has(code)).toBe(true);
    }

    for (const code of CIS_MEMBERS) {
      expect(countryIds.has(code)).toBe(true);
    }
  });

  it('has between 35 and 48 achievements divided into russia, world and special sections', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(35);
    expect(ACHIEVEMENTS.length).toBeLessThanOrEqual(48);

    const sections = new Set(ACHIEVEMENTS.map(a => a.section));
    expect(sections).toEqual(new Set(['russia', 'world', 'special']));
  });

  it('computes valid progress for every achievement on default context', () => {
    const ctx = createMockContext();
    for (const ach of ACHIEVEMENTS) {
      const p = ach.progress(ctx);
      expect(typeof p.current).toBe('number');
      expect(typeof p.target).toBe('number');
      expect(p.target).toBeGreaterThan(0);
      expect(p.current).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('Russia Achievements Evaluation', () => {
  it('unlocks Russian subjects counters correctly and separately from world counters', () => {
    const ctx5 = createMockContext({
      visitedRusRegionNames: new Set(['Москва', 'Московская область', 'Тверская область', 'Ярославская область', 'Тульская область'])
    });
    const unlocked5 = evaluateAchievements(ctx5, new Set()).map(a => a.id);
    expect(unlocked5).toContain('rus_subjects_5');
    expect(unlocked5).not.toContain('rus_subjects_15');
    expect(unlocked5).not.toContain('world_countries_5');

    const all89 = new Set(Object.values(FEDERAL_DISTRICTS).flat());
    const ctx89 = createMockContext({ visitedRusRegionNames: all89 });
    const unlocked89 = evaluateAchievements(ctx89, new Set()).map(a => a.id);
    expect(unlocked89).toContain('rus_subjects_5');
    expect(unlocked89).toContain('rus_subjects_15');
    expect(unlocked89).toContain('rus_subjects_30');
    expect(unlocked89).toContain('rus_subjects_50');
    expect(unlocked89).toContain('rus_subjects_89');
  });

  it('unlocks federal districts achievements when all their regions are visited', () => {
    const cfoSet = new Set(FEDERAL_DISTRICTS.cfo);
    const ctxCfo = createMockContext({ visitedRusRegionNames: cfoSet });
    const unlocked = evaluateAchievements(ctxCfo, new Set()).map(a => a.id);
    expect(unlocked).toContain('rus_fo_cfo');
    expect(unlocked).not.toContain('rus_fo_szfo');
    expect(unlocked).not.toContain('rus_fo_all');

    const oneFromEach = new Set([
      FEDERAL_DISTRICTS.cfo[0],
      FEDERAL_DISTRICTS.szfo[0],
      FEDERAL_DISTRICTS.yufo[0],
      FEDERAL_DISTRICTS.skfo[0],
      FEDERAL_DISTRICTS.pfo[0],
      FEDERAL_DISTRICTS.ufo[0],
      FEDERAL_DISTRICTS.sfo[0],
      FEDERAL_DISTRICTS.dfo[0]
    ]);
    const ctxAllFo = createMockContext({ visitedRusRegionNames: oneFromEach });
    const unlockedAllFo = evaluateAchievements(ctxAllFo, new Set()).map(a => a.id);
    expect(unlockedAllFo).toContain('rus_fo_all');
  });

  it('unlocks Caucasus republics achievement when visiting all 7 republics', () => {
    const ctxPartial = createMockContext({
      visitedRusRegionNames: new Set(['Дагестан', 'Чечня', 'Ингушетия'])
    });
    expect(evaluateAchievements(ctxPartial, new Set()).map(a => a.id)).not.toContain('rus_theme_caucasus');

    const ctxFull = createMockContext({
      visitedRusRegionNames: new Set(CAUCASUS_REPUBLICS)
    });
    expect(evaluateAchievements(ctxFull, new Set()).map(a => a.id)).toContain('rus_theme_caucasus');
  });

  it('unlocks Russian seas achievement when visiting 5 of 7 seas', () => {
    const visited5Seas = new Set([
      'Калининградская область',
      'Краснодарский край',
      'Дагестан',
      'Мурманская область',
      'Приморский край'
    ]);
    const ctx = createMockContext({ visitedRusRegionNames: visited5Seas });
    expect(evaluateAchievements(ctx, new Set()).map(a => a.id)).toContain('rus_theme_seas');
  });

  it('evaluates district counters and full region achievement properly', () => {
    const ctxDist = createMockContext({
      visitedRussianDistrictsCount: 120,
      hasCompletedAnyFullRegion: false
    });
    const unlocked = evaluateAchievements(ctxDist, new Set()).map(a => a.id);
    expect(unlocked).toContain('rus_districts_25');
    expect(unlocked).toContain('rus_districts_100');
    expect(unlocked).not.toContain('rus_districts_300');
    expect(unlocked).not.toContain('rus_districts_full_region');

    const ctxFullRegion = createMockContext({
      visitedRussianDistrictsCount: 9,
      hasCompletedAnyFullRegion: true,
      bestCompletedRegionProgress: { visited: 9, total: 9 }
    });
    expect(evaluateAchievements(ctxFullRegion, new Set()).map(a => a.id)).toContain('rus_districts_full_region');
  });
});

describe('World Achievements Evaluation', () => {
  it('unlocks country counters and continent achievements', () => {
    const ctx = createMockContext({
      visitedCountries: new Set(['RUS', 'BLR', 'KAZ', 'CHN', 'MNG']),
      visitedContinents: new Set(['Европа', 'Азия']),
      visitedEuropeanCountries: new Set(['RUS', 'BLR']),
      visitedAsianCountries: new Set(['RUS', 'KAZ', 'CHN', 'MNG'])
    });

    const unlocked = evaluateAchievements(ctx, new Set()).map(a => a.id);
    expect(unlocked).toContain('world_countries_5');
    expect(unlocked).not.toContain('world_countries_15');
    expect(unlocked).toContain('world_continents_2');
    expect(unlocked).not.toContain('world_continents_4');
  });

  it('unlocks all 16 land neighbors when all are visited', () => {
    const ctx = createMockContext({
      visitedCountries: new Set(RUSSIA_LAND_NEIGHBORS)
    });
    expect(evaluateAchievements(ctx, new Set()).map(a => a.id)).toContain('world_theme_neighbors');
  });

  it('unlocks CIS members achievement', () => {
    const ctx = createMockContext({
      visitedCountries: new Set(CIS_MEMBERS)
    });
    expect(evaluateAchievements(ctx, new Set()).map(a => a.id)).toContain('world_theme_cis');
  });

  it('unlocks both hemispheres achievement', () => {
    const ctxNorthOnly = createMockContext({
      hasNorthernHemisphere: true,
      hasSouthernHemisphere: false
    });
    expect(evaluateAchievements(ctxNorthOnly, new Set()).map(a => a.id)).not.toContain('world_theme_hemispheres');

    const ctxBoth = createMockContext({
      hasNorthernHemisphere: true,
      hasSouthernHemisphere: true
    });
    expect(evaluateAchievements(ctxBoth, new Set()).map(a => a.id)).toContain('world_theme_hemispheres');
  });

  it('unlocks foreign regions achievements without counting Russian regions', () => {
    const ctx = createMockContext({
      visitedNonRusRegionCount: 28,
      visitedRusRegionNames: new Set(['Москва', 'Санкт-Петербург'])
    });
    const unlocked = evaluateAchievements(ctx, new Set()).map(a => a.id);
    expect(unlocked).toContain('world_regions_25');
    expect(unlocked).not.toContain('world_regions_100');
    expect(unlocked).not.toContain('rus_subjects_5');
  });
});

describe('Special Photo Achievements Evaluation', () => {
  it('unlocks altitude achievements according to photo GPS altitude', () => {
    const ctx = createMockContext({
      photos: [
        {
          id: '1',
          lat: 43.35,
          lon: 42.44,
          alt: 3500,
          takenAt: '2026-07-01T12:00:00Z',
          regionId: 'RUS-2304',
          country: 'RUS',
          h3: '8611846cfffffff',
          proof: 'gold'
        }
      ]
    });

    const unlocked = evaluateAchievements(ctx, new Set()).map(a => a.id);
    expect(unlocked).toContain('spec_alt_1500');
    expect(unlocked).toContain('spec_alt_3000');
    expect(unlocked).not.toContain('spec_alt_5000');
  });

  it('unlocks night photo achievement for photos taken between 00:00 and 04:00', () => {
    const ctxDay = createMockContext({
      photos: [
        {
          id: '1',
          lat: 55.75,
          lon: 37.61,
          takenAt: '2026-07-01T15:00:00Z',
          regionId: 'RUS-2365',
          country: 'RUS',
          h3: '8611846cfffffff',
          proof: 'gold'
        }
      ]
    });
    expect(evaluateAchievements(ctxDay, new Set()).map(a => a.id)).not.toContain('spec_night');

    const ctxNight = createMockContext({
      photos: [
        {
          id: '2',
          lat: 55.75,
          lon: 37.61,
          takenAt: '2026-07-01T02:30:00Z',
          regionId: 'RUS-2365',
          country: 'RUS',
          h3: '8611846cfffffff',
          proof: 'gold'
        }
      ]
    });
    expect(evaluateAchievements(ctxNight, new Set()).map(a => a.id)).toContain('spec_night');
  });

  it('unlocks arctic circle photo achievement when latitude is >= 66.56', () => {
    const ctx = createMockContext({
      photos: [
        {
          id: '1',
          lat: 67.50,
          lon: 33.40,
          takenAt: '2026-07-01T12:00:00Z',
          regionId: 'RUS-2374',
          country: 'RUS',
          h3: '8611846cfffffff',
          proof: 'gold'
        }
      ]
    });
    expect(evaluateAchievements(ctx, new Set()).map(a => a.id)).toContain('spec_arctic_circle');
  });
});
