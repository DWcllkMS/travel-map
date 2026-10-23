import type { RarityLevel, ProofLevel, UserLevelInfo, GameContext, AchievementDef } from '../types';
import { ACHIEVEMENTS } from './achievementsConfig';

export interface XpBreakdown {
  totalXp: number;
  districtXp: number;
  regionXp: number;
  countryXp: number;
  achievementXp: number;
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
