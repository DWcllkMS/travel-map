import { describe, it, expect } from 'vitest';
import {
  calculateDistrictXp,
  calculateRegionXp,
  calculateCountryXp,
  calculateUserLevel,
  calculateLandCoveragePercent
} from '../src/services/gameService';

describe('Game Service XP and Level Calculations', () => {
  it('calculates XP based on rarity and proof level', () => {
    expect(calculateDistrictXp(1, 'gold')).toBe(100);
    expect(calculateDistrictXp(4, 'gold')).toBe(400);
    expect(calculateDistrictXp(4, 'silver')).toBe(400);
    expect(calculateDistrictXp(4, 'bronze')).toBe(200);

    expect(calculateRegionXp(1, 'gold')).toBe(300);
    expect(calculateRegionXp(4, 'gold')).toBe(1200);
    expect(calculateRegionXp(4, 'bronze')).toBe(600);

    expect(calculateCountryXp('gold')).toBe(1000);
    expect(calculateCountryXp('bronze')).toBe(500);
  });

  it('determines user rank and level progression', () => {
    const level1 = calculateUserLevel(0);
    expect(level1.level).toBe(1);
    expect(level1.rank).toBe('Домосед');

    const level2 = calculateUserLevel(500);
    expect(level2.level).toBe(2);
    expect(level2.rank).toBe('Любознательный');

    const level3 = calculateUserLevel(1500);
    expect(level3.level).toBe(3);
    expect(level3.rank).toBe('Турист');

    const level4 = calculateUserLevel(4000);
    expect(level4.level).toBe(4);
    expect(level4.rank).toBe('Путешественник');

    const levelHigh = calculateUserLevel(90000);
    expect(levelHigh.level).toBe(10);
    expect(levelHigh.rank).toBe('Легенда');
  });

  it('calculates land coverage percent correctly', () => {
    const pct0 = calculateLandCoveragePercent(0);
    expect(pct0).toBe(0);

    const pct100 = calculateLandCoveragePercent(100);
    expect(pct100).toBeGreaterThan(0);
    expect(pct100).toBeLessThan(1);
  });
});
