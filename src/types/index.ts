export type RarityLevel = 1 | 2 | 3 | 4;

export type ProofLevel = 'gold' | 'silver' | 'bronze';

export interface GeoDistrict {
  id: string;
  name: string;
  regionId: string;
  country: string;
  area: number;
  rarity: RarityLevel;
}

export interface GeoRegion {
  id: string;
  name: string;
  country: string;
  countryName: string;
  area: number;
  rarity: RarityLevel;
}

export interface GeoCountry {
  id: string;
  name: string;
  continent?: string;
  labelY?: number;
}

export type SightKind =
  | 'museum'
  | 'religious'
  | 'fortress'
  | 'palace'
  | 'monument'
  | 'nature'
  | 'mountain'
  | 'water'
  | 'park'
  | 'bridge'
  | 'lighthouse'
  | 'other';

export interface GeoSight {
  id: string;
  name: string;
  kind: SightKind;
  unesco: boolean;
  sitelinks: number;
  tier: 1 | 2 | 3 | 4;
  radius: number;
  regionId: string;
  country: string;
  image?: string;
  wiki?: string;
  lat: number;
  lon: number;
}

export interface PhotoRecord {
  id: string;
  lat: number;
  lon: number;
  alt?: number;
  takenAt: string;
  createdAt?: string;
  districtId?: string;
  regionId: string;
  country: string;
  h3: string;
  proof: ProofLevel;
  thumbId?: string;
  isContested?: boolean;
  contestedDistricts?: string[];
}

export interface ThumbnailRecord {
  id: string;
  groupKey: string;
  dataUrl: string;
  takenAt: string;
}

export type MarkType = 'visited_manual' | 'wishlist' | 'home';

export interface MarkRecord {
  id: string;
  targetId: string;
  targetType: 'district' | 'region' | 'sight';
  markType: MarkType;
  createdAt: string;
  country?: string;
}

export type AchievementSection = 'russia' | 'world' | 'sights' | 'special';

export interface AchievementProgress {
  current: number;
  target: number;
}

export interface AchievementDef {
  id: string;
  section: AchievementSection;
  title: string;
  description: string;
  icon: string;
  xp: number;
  condition: (context: GameContext) => boolean;
  progress: (context: GameContext) => AchievementProgress;
}

export interface UnlockedAchievementRecord {
  id: string;
  unlockedAt: string;
}

export interface UserSettings {
  id: string;
  theme: 'dark' | 'light';
  includeManualInStats: boolean;
  homeRegionId?: string;
  lastBackupPrompt?: string;
}

export interface RegionDistrictStats {
  visited: number;
  total: number;
}

export interface GameContext {
  visitedDistrictIds: Set<string>;
  visitedRegionIds: Set<string>;
  visitedCountries: Set<string>;
  photos: PhotoRecord[];
  marks: MarkRecord[];
  includeManual: boolean;
  visitedRusRegionNames: Set<string>;
  visitedNonRusRegionCount: number;
  visitedContinents: Set<string>;
  visitedEuropeanCountries: Set<string>;
  visitedAsianCountries: Set<string>;
  visitedRussianDistrictsCount: number;
  hasCompletedAnyFullRegion: boolean;
  bestCompletedRegionProgress: RegionDistrictStats;
  hasNorthernHemisphere: boolean;
  hasSouthernHemisphere: boolean;
  visitedSightIds: Set<string>;
  visitedSightFirstDates: Map<string, string>;
  allSights: GeoSight[];
}

export interface UserLevelInfo {
  level: number;
  rank: string;
  currentXp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPercent: number;
}

export interface StatsInfo {
  regionsVisited: number;
  totalRegions: number;
  countriesVisited: number;
  totalCountries: number;
  rusDistrictsVisited: number;
  totalRusDistricts: number;
  landPercent: number;
  countryProgress: { [countryCode: string]: { visited: number; total: number; name: string } };
  sightsVisited: number;
  totalSights: number;
  unescoVisited: number;
  totalUnesco: number;
}
