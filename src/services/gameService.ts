import type { RarityLevel, ProofLevel, UserLevelInfo, GameContext, AchievementDef, PhotoRecord, MarkRecord, GeoDistrict, GeoRegion, GeoSight } from '../types';
import { ACHIEVEMENTS } from './achievementsConfig';

export interface XpBreakdown {
  totalXp: number;
  districtXp: number;
  regionXp: number;
  countryXp: number;
  achievementXp: number;
  sightXp?: number;
}

export interface CalculateSubsetXpOptions {
  photos: PhotoRecord[];
  marks?: MarkRecord[];
  unlockedAchievements?: { id: string }[];
  includeManual?: boolean;
  homePoint?: GeoPoint;
  homeRegionId?: string;
  getDistrictById?: (id: string) => GeoDistrict | undefined;
  getRegionById?: (id: string) => GeoRegion | undefined;
  getDistrictCenter?: (id: string) => GeoPoint | undefined;
  getRegionCenter?: (id: string) => GeoPoint | undefined;
  visitedSightIds?: Iterable<string>;
  getSightById?: (id: string) => GeoSight | undefined;
}

export function calculateSubsetXp(opts: CalculateSubsetXpOptions): XpBreakdown {
  let districtXp = 0;
  let regionXp = 0;
  let countryXp = 0;
  let achievementXp = 0;
  let sightXp = 0;

  const awayPoint = (regionId: string | undefined, point: GeoPoint | undefined) =>
    regionId && regionId === opts.homeRegionId ? undefined : point;

  const photoDistrictIds = new Set<string>();
  const photoRegionIds = new Set<string>();
  const photoCountries = new Set<string>();

  for (const p of opts.photos) {
    if (p.districtId) photoDistrictIds.add(p.districtId);
    if (p.regionId) photoRegionIds.add(p.regionId);
    if (p.country) photoCountries.add(p.country);
  }

  const manualDistrictMarks = new Set<string>();
  const manualRegionMarks = new Set<string>();
  if (opts.includeManual && opts.marks) {
    for (const m of opts.marks) {
      if (m.markType === 'visited_manual') {
        if (m.targetType === 'district') manualDistrictMarks.add(m.targetId);
        else manualRegionMarks.add(m.targetId);
      }
    }
  }

  for (const dId of photoDistrictIds) {
    const d = opts.getDistrictById?.(dId);
    const rarity = d ? d.rarity : 1;
    const center = opts.getDistrictCenter?.(dId);
    districtXp += applyDistanceBonus(calculateDistrictXp(rarity, 'gold'), opts.homePoint, awayPoint(d?.regionId, center));
  }

  for (const dId of manualDistrictMarks) {
    if (!photoDistrictIds.has(dId)) {
      const d = opts.getDistrictById?.(dId);
      const rarity = d ? d.rarity : 1;
      const center = opts.getDistrictCenter?.(dId);
      districtXp += applyDistanceBonus(calculateDistrictXp(rarity, 'bronze'), opts.homePoint, awayPoint(d?.regionId, center));
    }
  }

  for (const rId of photoRegionIds) {
    const r = opts.getRegionById?.(rId);
    const rarity = r ? r.rarity : 1;
    const center = opts.getRegionCenter?.(rId);
    regionXp += applyDistanceBonus(calculateRegionXp(rarity, 'gold'), opts.homePoint, awayPoint(rId, center));
  }

  for (const rId of manualRegionMarks) {
    if (!photoRegionIds.has(rId)) {
      const r = opts.getRegionById?.(rId);
      const rarity = r ? r.rarity : 1;
      const center = opts.getRegionCenter?.(rId);
      regionXp += applyDistanceBonus(calculateRegionXp(rarity, 'bronze'), opts.homePoint, awayPoint(rId, center));
    }
  }

  for (const _c of photoCountries) {
    countryXp += calculateCountryXp('gold');
  }

  if (opts.unlockedAchievements) {
    const achMap = new Map(ACHIEVEMENTS.map(a => [a.id, a]));
    for (const aRec of opts.unlockedAchievements) {
      const def = achMap.get(aRec.id);
      if (def) achievementXp += def.xp;
    }
  }

  if (opts.visitedSightIds) {
    for (const sId of opts.visitedSightIds) {
      const s = opts.getSightById?.(sId);
      if (s) {
        sightXp += applyDistanceBonus(calculateSightXp(s.tier, s.unesco), opts.homePoint, awayPoint(s.regionId, { lat: s.lat, lon: s.lon }));
      }
    }
  }

  const totalXp = districtXp + regionXp + countryXp + achievementXp + sightXp;
  return {
    totalXp,
    districtXp,
    regionXp,
    countryXp,
    achievementXp,
    sightXp
  };
}

export const RANKS = [
  { level: 1, minXp: 0, title: 'Домосед' },
  { level: 2, minXp: 500, title: 'Любознательный' },
  { level: 3, minXp: 1500, title: 'Турист' },
  { level: 4, minXp: 3500, title: 'Путешественник' },
  { level: 5, minXp: 7000, title: 'Странник' },
  { level: 6, minXp: 12000, title: 'Исследователь' },
  { level: 7, minXp: 20000, title: 'Первопроходец' },
  { level: 8, minXp: 35000, title: 'Мастер дорог' },
  { level: 9, minXp: 55000, title: 'Властелин горизонтов' },
  { level: 10, minXp: 80000, title: 'Легенда' }
];

export function calculateDistrictXp(rarity: RarityLevel, proof: ProofLevel): number {
  const base = 100 * rarity;
  return proof === 'bronze' ? Math.round(base * 0.5) : base;
}

export function calculateRegionXp(rarity: RarityLevel, proof: ProofLevel): number {
  const base = 300 * rarity;
  return proof === 'bronze' ? Math.round(base * 0.5) : base;
}

export function calculateCountryXp(proof: ProofLevel): number {
  const base = 1000;
  return proof === 'bronze' ? Math.round(base * 0.5) : base;
}

export function calculateSightXp(tier: number, unesco: boolean): number {
  return 150 * tier + (unesco ? 500 : 0);
}

export interface GeoPoint {
  lat: number;
  lon: number;
}

export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function distanceMultiplier(km: number): number {
  if (km < 100) return 1;
  if (km < 500) return 1.5;
  if (km < 2000) return 2;
  return 3;
}

export function homeDistanceBonus(home: GeoPoint | undefined, target: GeoPoint | undefined): { km: number; multiplier: number } | undefined {
  if (!home || !target) return undefined;
  const km = distanceKm(home, target);
  return { km, multiplier: distanceMultiplier(km) };
}

export function applyDistanceBonus(xp: number, home: GeoPoint | undefined, target: GeoPoint | undefined): number {
  const bonus = homeDistanceBonus(home, target);
  return bonus ? Math.round(xp * bonus.multiplier) : xp;
}

export function calculateUserLevel(totalXp: number): UserLevelInfo {
  let currentRank = RANKS[0];
  let nextRank = RANKS[1];

  for (let i = 0; i < RANKS.length; i++) {
    if (totalXp >= RANKS[i].minXp) {
      currentRank = RANKS[i];
      nextRank = RANKS[i + 1] || { level: currentRank.level + 1, minXp: currentRank.minXp + 30000, title: 'Легенда' };
    }
  }

  const range = nextRank.minXp - currentRank.minXp;
  const inLevel = Math.max(0, totalXp - currentRank.minXp);
  const progressPercent = Math.min(100, Math.round((inLevel / range) * 100));

  return {
    level: currentRank.level,
    rank: currentRank.title,
    currentXp: totalXp,
    currentLevelXp: currentRank.minXp,
    nextLevelXp: nextRank.minXp,
    progressPercent
  };
}

export function evaluateAchievements(ctx: GameContext, unlockedIds: Set<string>): AchievementDef[] {
  const newlyUnlocked: AchievementDef[] = [];
  for (const ach of ACHIEVEMENTS) {
    if (!unlockedIds.has(ach.id)) {
      if (ach.condition(ctx)) {
        newlyUnlocked.push(ach);
      }
    }
  }
  return newlyUnlocked;
}

export function calculateLandCoveragePercent(uniqueH3Resolution6Count: number): number {
  const totalLandKm2 = 148900000;
  const approxCellAreaKm2 = 36.1;
  const openedKm2 = uniqueH3Resolution6Count * approxCellAreaKm2;
  const pct = (openedKm2 / totalLandKm2) * 100;
  return parseFloat(pct.toFixed(4));
}
