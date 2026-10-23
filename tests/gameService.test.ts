import { describe, it, expect } from 'vitest';
import {
  calculateDistrictXp,
  calculateRegionXp,
  calculateCountryXp,
  calculateUserLevel,
  calculateLandCoveragePercent,
  distanceKm,
  distanceMultiplier,
  applyDistanceBonus
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

describe('Home distance bonus', () => {
  const rostov = { lat: 47.23, lon: 39.7 };
  const murmansk = { lat: 68.97, lon: 33.08 };
  const krasnodar = { lat: 45.04, lon: 38.98 };

  it('measures great-circle distance', () => {
    expect(distanceKm(rostov, rostov)).toBe(0);
    const km = distanceKm(rostov, murmansk);
    expect(km).toBeGreaterThan(2350);
    expect(km).toBeLessThan(2500);
  });

  it('picks multiplier by distance bands', () => {
    expect(distanceMultiplier(0)).toBe(1);
    expect(distanceMultiplier(99)).toBe(1);
    expect(distanceMultiplier(100)).toBe(1.5);
    expect(distanceMultiplier(499)).toBe(1.5);
    expect(distanceMultiplier(500)).toBe(2);
    expect(distanceMultiplier(1999)).toBe(2);
    expect(distanceMultiplier(2000)).toBe(3);
  });

  it('applies bonus relative to home and keeps base XP without home', () => {
    expect(applyDistanceBonus(300, undefined, murmansk)).toBe(300);
    expect(applyDistanceBonus(300, rostov, rostov)).toBe(300);
    expect(applyDistanceBonus(300, rostov, krasnodar)).toBe(450);
    expect(applyDistanceBonus(300, rostov, murmansk)).toBe(900);
    expect(applyDistanceBonus(300, murmansk, rostov)).toBe(900);
  });
});
