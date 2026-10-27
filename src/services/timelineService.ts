import type {
  PhotoRecord,
  MarkRecord,
  UnlockedAchievementRecord,
  ProofLevel,
  GeoDistrict,
  GeoRegion,
  GeoSight
} from '../types';
import { calculateSubsetXp, distanceKm, type GeoPoint } from './gameService';

export interface TimelineTrip {
  id: string;
  year: number;
  month: number;
  startDate: string;
  endDate: string;
  dateLabel: string;
  photoIds: string[];
  photos: PhotoRecord[];
  regionIds: string[];
  regionNames: string[];
  countryCodes: string[];
  countryNames: string[];
  isHome: boolean;
  proof: ProofLevel;
  thumbIds: string[];
  newDistrictsCount: number;
  newRegionsCount: number;
  newRusRegionsCount: number;
  newCountriesCount: number;
  newSightsCount: number;
  bounds?: [[number, number], [number, number]];
}

export interface TimelineManualItem {
  id: string;
  year: number;
  month: number;
  date: string;
  dateLabel: string;
  targetId: string;
  targetType: 'district' | 'region' | 'sight';
  name: string;
  country?: string;
  proof: ProofLevel;
}

export interface TimelineMonthGroup {
  year: number;
  month: number;
  monthName: string;
  trips: TimelineTrip[];
  manualMarks: TimelineManualItem[];
}

export interface ExtremeRegion {
  id: string;
  name: string;
  coord: number;
}

export interface FurthestPoint {
  km: number;
  regionId: string;
  regionName: string;
  lat: number;
  lon: number;
}

export interface HighestPoint {
  alt: number;
  regionId?: string;
  regionName?: string;
}

export interface MonthHistogramItem {
  month: number;
  monthName: string;
  daysCount: number;
}

export interface YearRecap {
  year: number;
  newCountriesCount: number;
  newRegionsCount: number;
  newRusRegionsCount: number;
  newDistrictsCount: number;
  newSightsCount: number;
  tripsCount: number;
  daysInTravel: number;
  furthestPoint?: FurthestPoint;
  northernRegion?: ExtremeRegion;
  southernRegion?: ExtremeRegion;
  easternRegion?: ExtremeRegion;
  westernRegion?: ExtremeRegion;
  highestPoint?: HighestPoint;
  totalXp: number;
  unlockedAchievementsCount: number;
  unlockedAchievements: UnlockedAchievementRecord[];
  monthlyDays: MonthHistogramItem[];
}

export interface TimelineYearGroup {
  year: number;
  months: TimelineMonthGroup[];
  recap: YearRecap;
}

export interface GroupTripsOptions {
  homeRegionId?: string;
  isNeighbor?: (r1: string, r2: string) => boolean;
  getRegionName?: (rId: string) => string;
  getCountryName?: (cCode: string) => string;
  getDistrictName?: (dId: string) => string;
  matchedSightIdsByPhotoId?: Map<string, string[]>;
  allPhotosForHistory?: PhotoRecord[];
  allMarksForHistory?: MarkRecord[];
}

export interface YearRecapOptions {
  homeRegionId?: string;
  includeManual?: boolean;
  getDistrictById?: (id: string) => GeoDistrict | undefined;
  getRegionById?: (id: string) => GeoRegion | undefined;
  getDistrictCenter?: (id: string) => GeoPoint | undefined;
  getRegionCenter?: (id: string) => GeoPoint | undefined;
  getRegionName?: (rId: string) => string;
  getCountryName?: (cCode: string) => string;
  matchedSightIds?: Set<string>;
  sightFirstDates?: Map<string, string>;
  getSightById?: (id: string) => GeoSight | undefined;
  isNeighbor?: (r1: string, r2: string) => boolean;
}

export const MONTH_NAMES_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря'
];

export const MONTH_NAMES_NOMINATIVE = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь'
];

export const MONTH_INITIALS = ['Я', 'Ф', 'М', 'А', 'М', 'И', 'И', 'А', 'С', 'О', 'Н', 'Д'];

export function formatTripDates(startStr: string, endStr: string): string {
  const d1 = new Date(startStr);
  const d2 = new Date(endStr);
  const day1 = d1.getDate();
  const month1 = d1.getMonth();
  const year1 = d1.getFullYear();
  const day2 = d2.getDate();
  const month2 = d2.getMonth();
  const year2 = d2.getFullYear();

  if (year1 === year2 && month1 === month2 && day1 === day2) {
    return `${day1} ${MONTH_NAMES_GENITIVE[month1]}`;
  }
  if (year1 === year2 && month1 === month2) {
    return `${day1}–${day2} ${MONTH_NAMES_GENITIVE[month1]}`;
  }
  if (year1 === year2) {
    return `${day1} ${MONTH_NAMES_GENITIVE[month1]} – ${day2} ${MONTH_NAMES_GENITIVE[month2]}`;
  }
  return `${day1} ${MONTH_NAMES_GENITIVE[month1]} ${year1} – ${day2} ${MONTH_NAMES_GENITIVE[month2]} ${year2}`;
}

export function pluralRu(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  const word = m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
  return `${n} ${word}`;
}

export function localDayKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function toUtcCalendarDay(dateStr: string): number {
  const d = new Date(dateStr);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86400000);
}

export function getUniqueYears(photos: PhotoRecord[], marks: MarkRecord[] = []): number[] {
  const years = new Set<number>();
  for (const p of photos) {
    if (p.takenAt) {
      const y = new Date(p.takenAt).getFullYear();
      if (!isNaN(y)) years.add(y);
    }
  }
  for (const m of marks) {
    if (m.createdAt) {
      const y = new Date(m.createdAt).getFullYear();
      if (!isNaN(y)) years.add(y);
    }
  }
  return Array.from(years).sort((a, b) => b - a);
}

export function groupPhotosIntoTrips(
  photos: PhotoRecord[],
  options?: GroupTripsOptions
): TimelineTrip[] {
  if (!photos || photos.length === 0) return [];

  const validPhotos = photos
    .filter(p => p.takenAt && !isNaN(new Date(p.takenAt).getTime()))
    .sort((a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime());

  if (validPhotos.length === 0) return [];

  const rawTrips: PhotoRecord[][] = [];
  let currentGroup: PhotoRecord[] = [];

  for (const photo of validPhotos) {
    if (currentGroup.length === 0) {
      currentGroup.push(photo);
      continue;
    }

    const prevPhoto = currentGroup[currentGroup.length - 1];
    const prevDay = toUtcCalendarDay(prevPhoto.takenAt);
    const currDay = toUtcCalendarDay(photo.takenAt);
    const diffDays = currDay - prevDay;

    const sameOrNeighbor =
      photo.regionId === prevPhoto.regionId ||
      Boolean(options?.isNeighbor && options.isNeighbor(prevPhoto.regionId, photo.regionId)) ||
      currentGroup.some(
        p => p.regionId === photo.regionId || Boolean(options?.isNeighbor && options.isNeighbor(p.regionId, photo.regionId))
      );

    if (diffDays <= 2 && sameOrNeighbor) {
      currentGroup.push(photo);
    } else {
      rawTrips.push(currentGroup);
      currentGroup = [photo];
    }
  }

  if (currentGroup.length > 0) {
    rawTrips.push(currentGroup);
  }

  const seenCountries = new Set<string>();
  const seenRegions = new Set<string>();
  const seenDistricts = new Set<string>();
  const seenSights = new Set<string>();

  if (options?.allPhotosForHistory && options.allPhotosForHistory !== photos) {
    const historyPhotos = [...options.allPhotosForHistory]
      .filter(p => p.takenAt && !isNaN(new Date(p.takenAt).getTime()))
      .sort((a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime());

    const firstTripStart = new Date(validPhotos[0].takenAt).getTime();
    for (const hp of historyPhotos) {
      if (new Date(hp.takenAt).getTime() < firstTripStart) {
        if (hp.country) seenCountries.add(hp.country);
        if (hp.regionId) seenRegions.add(hp.regionId);
        if (hp.districtId) seenDistricts.add(hp.districtId);
        const sights = options.matchedSightIdsByPhotoId?.get(hp.id);
        if (sights) {
          for (const s of sights) seenSights.add(s);
        }
      }
    }
  }

  const timelineTrips: TimelineTrip[] = [];

  for (let i = 0; i < rawTrips.length; i++) {
    const tripPhotos = rawTrips[i];
    const startDate = tripPhotos[0].takenAt;
    const endDate = tripPhotos[tripPhotos.length - 1].takenAt;
    const startObj = new Date(startDate);
    const year = startObj.getFullYear();
    const month = startObj.getMonth();

    const isHome = Boolean(
      options?.homeRegionId && tripPhotos.every(p => p.regionId === options.homeRegionId)
    );

    const regionIdsSet = new Set<string>();
    const countryCodesSet = new Set<string>();
    const photoIds: string[] = [];
    const thumbIdsSet = new Set<string>();

    let minLon = Infinity;
    let maxLon = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    let hasGold = false;
    let hasSilver = false;

    let newDistrictsCount = 0;
    let newRegionsCount = 0;
    let newRusRegionsCount = 0;
    let newCountriesCount = 0;
    let newSightsCount = 0;

    for (const p of tripPhotos) {
      photoIds.push(p.id);
      if (p.regionId) regionIdsSet.add(p.regionId);
      if (p.country) countryCodesSet.add(p.country);
      if (p.thumbId) thumbIdsSet.add(p.thumbId);

      if (p.proof === 'gold') hasGold = true;
      else if (p.proof === 'silver') hasSilver = true;

      if (typeof p.lon === 'number' && !isNaN(p.lon) && typeof p.lat === 'number' && !isNaN(p.lat)) {
        if (p.lon < minLon) minLon = p.lon;
        if (p.lon > maxLon) maxLon = p.lon;
        if (p.lat < minLat) minLat = p.lat;
        if (p.lat > maxLat) maxLat = p.lat;
      }

      if (p.districtId && !seenDistricts.has(p.districtId)) {
        seenDistricts.add(p.districtId);
        newDistrictsCount++;
      }

      if (p.regionId && !seenRegions.has(p.regionId)) {
        seenRegions.add(p.regionId);
        newRegionsCount++;
        if (p.country === 'RUS' || p.regionId.startsWith('RUS-')) {
          newRusRegionsCount++;
        }
      }

      if (p.country && !seenCountries.has(p.country)) {
        seenCountries.add(p.country);
        newCountriesCount++;
      }

      const sights = options?.matchedSightIdsByPhotoId?.get(p.id);
      if (sights) {
        for (const s of sights) {
          if (!seenSights.has(s)) {
            seenSights.add(s);
            newSightsCount++;
          }
        }
      }
    }

    const proof: ProofLevel = hasGold ? 'gold' : hasSilver ? 'silver' : 'bronze';

    let bounds: [[number, number], [number, number]] | undefined;
    if (minLon !== Infinity && maxLon !== -Infinity && minLat !== Infinity && maxLat !== -Infinity) {
      if (minLon === maxLon && minLat === maxLat) {
        bounds = [
          [minLon - 0.05, minLat - 0.05],
          [maxLon + 0.05, maxLat + 0.05]
        ];
      } else {
        bounds = [
          [minLon, minLat],
          [maxLon, maxLat]
        ];
      }
    }

    const regionIds = Array.from(regionIdsSet);
    const countryCodes = Array.from(countryCodesSet);
    const regionNames = regionIds.map(rId => options?.getRegionName?.(rId) || rId);
    const countryNames = countryCodes.map(c => options?.getCountryName?.(c) || c);

    timelineTrips.push({
      id: `trip-${year}-${month}-${i}-${tripPhotos[0].id}`,
      year,
      month,
      startDate,
      endDate,
      dateLabel: formatTripDates(startDate, endDate),
      photoIds,
      photos: tripPhotos,
      regionIds,
      regionNames,
      countryCodes,
      countryNames,
      isHome,
      proof,
      thumbIds: Array.from(thumbIdsSet).slice(0, 4),
      newDistrictsCount,
      newRegionsCount,
      newRusRegionsCount,
      newCountriesCount,
      newSightsCount,
      bounds
    });
  }

  return timelineTrips;
}

export function calculateYearRecap(
  year: number,
  allPhotos: PhotoRecord[],
  allMarks: MarkRecord[] = [],
  unlockedAchievements: UnlockedAchievementRecord[] = [],
  options?: YearRecapOptions
): YearRecap {
  const firstCountryDates = new Map<string, number>();
  const firstRegionDates = new Map<string, number>();
  const firstDistrictDates = new Map<string, number>();
  const regionCountryMap = new Map<string, string>();

  for (const p of allPhotos) {
    if (!p.takenAt) continue;
    const time = new Date(p.takenAt).getTime();
    if (isNaN(time)) continue;

    if (p.country) {
      const prev = firstCountryDates.get(p.country);
      if (prev === undefined || time < prev) firstCountryDates.set(p.country, time);
    }
    if (p.regionId) {
      const prev = firstRegionDates.get(p.regionId);
      if (prev === undefined || time < prev) firstRegionDates.set(p.regionId, time);
      if (p.country) regionCountryMap.set(p.regionId, p.country);
    }
    if (p.districtId) {
      const prev = firstDistrictDates.get(p.districtId);
      if (prev === undefined || time < prev) firstDistrictDates.set(p.districtId, time);
    }
  }

  for (const m of allMarks) {
    if (!m.createdAt || m.markType !== 'visited_manual') continue;
    const time = new Date(m.createdAt).getTime();
    if (isNaN(time)) continue;

    if (m.country) {
      const prev = firstCountryDates.get(m.country);
      if (prev === undefined || time < prev) firstCountryDates.set(m.country, time);
    }
    if (m.targetType === 'region') {
      const prev = firstRegionDates.get(m.targetId);
      if (prev === undefined || time < prev) firstRegionDates.set(m.targetId, time);
      if (m.country) regionCountryMap.set(m.targetId, m.country);
    } else if (m.targetType === 'district') {
      const prev = firstDistrictDates.get(m.targetId);
      if (prev === undefined || time < prev) firstDistrictDates.set(m.targetId, time);
    }
  }

  let newCountriesCount = 0;
  for (const [, time] of firstCountryDates) {
    if (new Date(time).getFullYear() === year) newCountriesCount++;
  }

  let newRegionsCount = 0;
  let newRusRegionsCount = 0;
  for (const [rId, time] of firstRegionDates) {
    if (new Date(time).getFullYear() === year) {
      newRegionsCount++;
      const country = regionCountryMap.get(rId) || options?.getRegionById?.(rId)?.country;
      if (country === 'RUS' || rId.startsWith('RUS-')) {
        newRusRegionsCount++;
      }
    }
  }

  let newDistrictsCount = 0;
  for (const [, time] of firstDistrictDates) {
    if (new Date(time).getFullYear() === year) newDistrictsCount++;
  }

  let newSightsCount = 0;
  if (options?.sightFirstDates) {
    for (const [, dateStr] of options.sightFirstDates) {
      const y = new Date(dateStr).getFullYear();
      if (y === year) newSightsCount++;
    }
  }

  const yearPhotos = allPhotos.filter(p => {
    if (!p.takenAt) return false;
    const y = new Date(p.takenAt).getFullYear();
    return y === year;
  });

  const yearMarks = allMarks.filter(m => {
    if (!m.createdAt) return false;
    const y = new Date(m.createdAt).getFullYear();
    return y === year;
  });

  const trips = groupPhotosIntoTrips(allPhotos, {
    homeRegionId: options?.homeRegionId,
    isNeighbor: options?.isNeighbor,
    getRegionName: options?.getRegionName,
    getCountryName: options?.getCountryName,
    getDistrictName: options?.getDistrictById ? id => options.getDistrictById!(id)?.name || id : undefined
  });

  const yearTrips = trips.filter(t => t.year === year);
  const tripsCount = options?.homeRegionId ? yearTrips.filter(t => !t.isHome).length : yearTrips.length;

  const travelDates = new Set<string>();
  for (const p of yearPhotos) {
    if (!options?.homeRegionId || p.regionId !== options.homeRegionId) {
      const ds = localDayKey(p.takenAt);
      travelDates.add(ds);
    }
  }
  const daysInTravel = travelDates.size;

  let furthestPoint: FurthestPoint | undefined;
  if (options?.homeRegionId) {
    const homeCenter = options.getRegionCenter?.(options.homeRegionId);
    if (homeCenter) {
      let maxKm = 0;
      let maxPhoto: PhotoRecord | undefined;
      for (const p of yearPhotos) {
        if (typeof p.lat === 'number' && typeof p.lon === 'number' && !isNaN(p.lat) && !isNaN(p.lon)) {
          const d = distanceKm(homeCenter, { lat: p.lat, lon: p.lon });
          if (d > maxKm) {
            maxKm = d;
            maxPhoto = p;
          }
        }
      }
      if (maxPhoto && maxKm > 0) {
        furthestPoint = {
          km: Math.round(maxKm),
          regionId: maxPhoto.regionId,
          regionName: options.getRegionName?.(maxPhoto.regionId) || maxPhoto.regionId,
          lat: maxPhoto.lat,
          lon: maxPhoto.lon
        };
      }
    }
  }

  let highestPoint: HighestPoint | undefined;
  let maxAlt = -Infinity;
  let maxAltPhoto: PhotoRecord | undefined;
  for (const p of yearPhotos) {
    if (typeof p.alt === 'number' && !isNaN(p.alt)) {
      if (p.alt > maxAlt) {
        maxAlt = p.alt;
        maxAltPhoto = p;
      }
    }
  }
  if (maxAltPhoto && maxAlt > -Infinity) {
    highestPoint = {
      alt: Math.round(maxAlt),
      regionId: maxAltPhoto.regionId,
      regionName: options?.getRegionName?.(maxAltPhoto.regionId) || maxAltPhoto.regionId
    };
  }

  const visitedRegionIdsInYear = new Set<string>();
  for (const p of yearPhotos) {
    if (p.regionId) visitedRegionIdsInYear.add(p.regionId);
  }
  for (const m of yearMarks) {
    if (m.markType === 'visited_manual' && m.targetType === 'region' && m.targetId) {
      visitedRegionIdsInYear.add(m.targetId);
    }
  }

  let northernRegion: ExtremeRegion | undefined;
  let southernRegion: ExtremeRegion | undefined;
  let easternRegion: ExtremeRegion | undefined;
  let westernRegion: ExtremeRegion | undefined;

  let maxLat = -Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let minLon = Infinity;

  for (const rId of visitedRegionIdsInYear) {
    let center = options?.getRegionCenter?.(rId);
    if (!center) {
      const sample = yearPhotos.find(p => p.regionId === rId);
      if (sample && typeof sample.lat === 'number' && typeof sample.lon === 'number') {
        center = { lat: sample.lat, lon: sample.lon };
      }
    }
    if (!center) continue;

    const name = options?.getRegionName?.(rId) || rId;

    if (center.lat > maxLat) {
      maxLat = center.lat;
      northernRegion = { id: rId, name, coord: center.lat };
    }
    if (center.lat < minLat) {
      minLat = center.lat;
      southernRegion = { id: rId, name, coord: center.lat };
    }
    if (center.lon > maxLon) {
      maxLon = center.lon;
      easternRegion = { id: rId, name, coord: center.lon };
    }
    if (center.lon < minLon) {
      minLon = center.lon;
      westernRegion = { id: rId, name, coord: center.lon };
    }
  }

  const yearAchievements = unlockedAchievements.filter(a => {
    if (!a.unlockedAt) return false;
    return new Date(a.unlockedAt).getFullYear() === year;
  });

  const yearSightIds = new Set<string>();
  if (options?.sightFirstDates) {
    for (const [sId, dateStr] of options.sightFirstDates.entries()) {
      if (new Date(dateStr).getFullYear() === year) {
        yearSightIds.add(sId);
      }
    }
  }

  const yearEnd = new Date(year + 1, 0, 1).getTime();
  const yearStart = new Date(year, 0, 1).getTime();
  const before = (iso: string | undefined, limit: number) => !!iso && new Date(iso).getTime() < limit;
  const xpFor = (limit: number) =>
    calculateSubsetXp({
      photos: allPhotos.filter(p => before(p.takenAt, limit)),
      marks: allMarks.filter(m => before(m.createdAt, limit)),
      includeManual: options?.includeManual ?? true,
      homePoint: options?.homeRegionId ? options.getRegionCenter?.(options.homeRegionId) : undefined,
      homeRegionId: options?.homeRegionId,
      getDistrictById: options?.getDistrictById,
      getRegionById: options?.getRegionById,
      getDistrictCenter: options?.getDistrictCenter,
      getRegionCenter: options?.getRegionCenter
    }).totalXp;
  const extraXp = calculateSubsetXp({
    photos: [],
    unlockedAchievements: yearAchievements,
    homePoint: options?.homeRegionId ? options.getRegionCenter?.(options.homeRegionId) : undefined,
    homeRegionId: options?.homeRegionId,
    visitedSightIds: yearSightIds,
    getSightById: options?.getSightById
  }).totalXp;
  const xpRes = { totalXp: xpFor(yearEnd) - xpFor(yearStart) + extraXp };

  const monthlyDays: MonthHistogramItem[] = [];
  for (let m = 0; m < 12; m++) {
    const datesInMonth = new Set<string>();
    for (const p of yearPhotos) {
      const d = new Date(p.takenAt);
      if (d.getMonth() === m) {
        datesInMonth.add(localDayKey(p.takenAt));
      }
    }
    monthlyDays.push({
      month: m,
      monthName: MONTH_NAMES_NOMINATIVE[m],
      daysCount: datesInMonth.size
    });
  }

  return {
    year,
    newCountriesCount,
    newRegionsCount,
    newRusRegionsCount,
    newDistrictsCount,
    newSightsCount,
    tripsCount,
    daysInTravel,
    furthestPoint,
    northernRegion,
    southernRegion,
    easternRegion,
    westernRegion,
    highestPoint,
    totalXp: xpRes.totalXp,
    unlockedAchievementsCount: yearAchievements.length,
    unlockedAchievements: yearAchievements,
    monthlyDays
  };
}

export function buildTimelineFeed(
  photos: PhotoRecord[],
  marks: MarkRecord[] = [],
  unlockedAchievements: UnlockedAchievementRecord[] = [],
  options?: GroupTripsOptions & YearRecapOptions
): TimelineYearGroup[] {
  const years = getUniqueYears(photos, marks);
  if (years.length === 0) return [];

  const allTrips = groupPhotosIntoTrips(photos, {
    ...options,
    allPhotosForHistory: photos,
    allMarksForHistory: marks
  });

  const manualMarks = marks.filter(m => m.markType === 'visited_manual' && m.createdAt);

  const yearGroups: TimelineYearGroup[] = [];

  for (const year of years) {
    const recap = calculateYearRecap(year, photos, marks, unlockedAchievements, options);

    const yearTrips = allTrips.filter(t => t.year === year);
    const yearManualMarks = manualMarks.filter(m => new Date(m.createdAt).getFullYear() === year);

    const monthsMap = new Map<number, { trips: TimelineTrip[]; manual: TimelineManualItem[] }>();

    for (const t of yearTrips) {
      if (!monthsMap.has(t.month)) {
        monthsMap.set(t.month, { trips: [], manual: [] });
      }
      monthsMap.get(t.month)!.trips.push(t);
    }

    for (const m of yearManualMarks) {
      const d = new Date(m.createdAt);
      const mIdx = d.getMonth();
      if (!monthsMap.has(mIdx)) {
        monthsMap.set(mIdx, { trips: [], manual: [] });
      }
      let targetName = m.targetId;
      if (m.targetType === 'region') {
        targetName = options?.getRegionName?.(m.targetId) || m.targetId;
      } else if (m.targetType === 'district') {
        targetName = options?.getDistrictById?.(m.targetId)?.name || options?.getDistrictName?.(m.targetId) || m.targetId;
      } else if (m.targetType === 'sight') {
        targetName = options?.getSightById?.(m.targetId)?.name || m.targetId;
      }
      monthsMap.get(mIdx)!.manual.push({
        id: m.id,
        year,
        month: mIdx,
        date: m.createdAt,
        dateLabel: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }),
        targetId: m.targetId,
        targetType: m.targetType,
        name: targetName,
        country: m.country,
        proof: 'bronze'
      });
    }

    const sortedMonthIndices = Array.from(monthsMap.keys()).sort((a, b) => b - a);

    const months: TimelineMonthGroup[] = sortedMonthIndices.map(mIdx => {
      const data = monthsMap.get(mIdx)!;
      data.trips.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
      data.manual.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return {
        year,
        month: mIdx,
        monthName: MONTH_NAMES_NOMINATIVE[mIdx],
        trips: data.trips,
        manualMarks: data.manual
      };
    });

    yearGroups.push({
      year,
      months,
      recap
    });
  }

  return yearGroups;
}

export function drawYearRecapCanvas(canvas: HTMLCanvasElement, recap: YearRecap): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = 1080;
  const height = 1350;
  canvas.width = width;
  canvas.height = height;

  const rootStyles = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
  const bg = rootStyles?.getPropertyValue('--bg')?.trim() || '';
  const bg2 = rootStyles?.getPropertyValue('--bg-2')?.trim() || '';
  const bg3 = rootStyles?.getPropertyValue('--bg-3')?.trim() || '';
  const border = rootStyles?.getPropertyValue('--border')?.trim() || '';
  const text = rootStyles?.getPropertyValue('--text')?.trim() || '';
  const muted = rootStyles?.getPropertyValue('--muted')?.trim() || '';
  const accent = rootStyles?.getPropertyValue('--accent')?.trim() || '';
  const fontFamily = rootStyles?.getPropertyValue('--font-family')?.trim() || "'Inter', sans-serif";

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  ctx.strokeRect(36, 36, width - 72, height - 72);

  ctx.fillStyle = accent;
  ctx.font = `bold 24px ${fontFamily}`;
  ctx.fillText('СЛЕДОПЫТ', 64, 96);

  ctx.fillStyle = text;
  ctx.font = `900 68px ${fontFamily}`;
  ctx.fillText(`Итоги ${recap.year} года`, 64, 180);

  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(64, 204);
  ctx.lineTo(260, 204);
  ctx.stroke();

  const drawCard = (x: number, y: number, w: number, h: number, title: string, mainStat: string, subStat: string) => {
    ctx.fillStyle = bg2;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = border;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = muted;
    ctx.font = `600 18px ${fontFamily}`;
    ctx.fillText(title.toUpperCase(), x + 24, y + 42);

    ctx.fillStyle = text;
    ctx.font = `bold 36px ${fontFamily}`;
    ctx.fillText(mainStat, x + 24, y + 92);

    ctx.fillStyle = muted;
    ctx.font = `400 20px ${fontFamily}`;
    ctx.fillText(subStat, x + 24, y + 130);
  };

  const cardW = (width - 128 - 24) / 2;
  const startY = 240;

  drawCard(
    64,
    startY,
    cardW,
    160,
    'Новые открытия',
    pluralRu(recap.newRegionsCount, 'регион', 'региона', 'регионов'),
    [pluralRu(recap.newCountriesCount, 'страна', 'страны', 'стран'), `${recap.newRusRegionsCount} в РФ`, `районов: ${recap.newDistrictsCount}`, pluralRu(recap.newSightsCount, 'место', 'места', 'мест')].join(' • ')
  );

  drawCard(
    64 + cardW + 24,
    startY,
    cardW,
    160,
    'В пути',
    pluralRu(recap.tripsCount, 'поездка', 'поездки', 'поездок'),
    `${pluralRu(recap.daysInTravel, 'день', 'дня', 'дней')} вне дома`
  );

  drawCard(
    64,
    startY + 184,
    cardW,
    160,
    'Опыт и ранги',
    `+${recap.totalXp.toLocaleString('ru-RU')} XP`,
    pluralRu(recap.unlockedAchievementsCount, 'новое достижение', 'новых достижения', 'новых достижений')
  );

  const furthestText = recap.furthestPoint ? `${recap.furthestPoint.km.toLocaleString('ru-RU')} км` : '—';
  const furthestSub = recap.furthestPoint ? recap.furthestPoint.regionName : 'Точка дома не задана';
  drawCard(
    64 + cardW + 24,
    startY + 184,
    cardW,
    160,
    'Самая дальняя точка',
    furthestText,
    furthestSub
  );

  ctx.fillStyle = bg2;
  const geoBoxY = startY + 368;
  const geoBoxH = 170;
  ctx.fillRect(64, geoBoxY, width - 128, geoBoxH);
  ctx.strokeStyle = border;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(64, geoBoxY, width - 128, geoBoxH);

  ctx.fillStyle = muted;
  ctx.font = `600 18px ${fontFamily}`;
  ctx.fillText('ГЕОГРАФИЯ И РЕКОРДЫ ГОДА', 88, geoBoxY + 38);

  const extremes = [
    `Север: ${recap.northernRegion?.name || '—'}`,
    `Юг: ${recap.southernRegion?.name || '—'}`,
    `Восток: ${recap.easternRegion?.name || '—'}`,
    `Запад: ${recap.westernRegion?.name || '—'}`
  ];

  ctx.fillStyle = text;
  ctx.font = `500 20px ${fontFamily}`;
  ctx.fillText(extremes[0], 88, geoBoxY + 80);
  ctx.fillText(extremes[1], 88, geoBoxY + 120);
  ctx.fillText(extremes[2], 560, geoBoxY + 80);
  ctx.fillText(extremes[3], 560, geoBoxY + 120);

  if (recap.highestPoint) {
    ctx.fillStyle = accent;
    ctx.font = `600 20px ${fontFamily}`;
    ctx.fillText(`Высшая точка: ${recap.highestPoint.alt} м (${recap.highestPoint.regionName || ''})`, 88, geoBoxY + 155);
  }

  const histoBoxY = geoBoxY + geoBoxH + 24;
  const histoBoxH = 340;
  ctx.fillStyle = bg2;
  ctx.fillRect(64, histoBoxY, width - 128, histoBoxH);
  ctx.strokeStyle = border;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(64, histoBoxY, width - 128, histoBoxH);

  ctx.fillStyle = muted;
  ctx.font = `600 18px ${fontFamily}`;
  ctx.fillText('АКТИВНОСТЬ ПО МЕСЯЦАМ (ДНЕЙ С ФОТО)', 88, histoBoxY + 38);

  const maxDays = Math.max(...recap.monthlyDays.map(d => d.daysCount), 1);
  const barAreaW = width - 176;
  const barSlotW = barAreaW / 12;
  const barWidth = 36;
  const barMaxH = 180;
  const barBaseY = histoBoxY + 270;

  for (let i = 0; i < 12; i++) {
    const item = recap.monthlyDays[i];
    const x = 88 + i * barSlotW + (barSlotW - barWidth) / 2;
    const h = item.daysCount > 0 ? Math.max(8, (item.daysCount / maxDays) * barMaxH) : 3;
    const y = barBaseY - h;

    ctx.fillStyle = bg3;
    ctx.fillRect(x, barBaseY - barMaxH, barWidth, barMaxH);

    ctx.fillStyle = item.daysCount > 0 ? accent : border;
    ctx.fillRect(x, y, barWidth, h);

    if (item.daysCount > 0) {
      ctx.fillStyle = text;
      ctx.font = `bold 16px ${fontFamily}`;
      ctx.textAlign = 'center';
      ctx.fillText(String(item.daysCount), x + barWidth / 2, y - 8);
    }

    ctx.fillStyle = muted;
    ctx.font = `500 16px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.fillText(MONTH_INITIALS[i], x + barWidth / 2, barBaseY + 28);
  }
  ctx.textAlign = 'left';

  ctx.fillStyle = muted;
  ctx.font = `400 18px ${fontFamily}`;
  ctx.fillText('dwcllkms.github.io/travel-map', 64, height - 60);
}

export async function shareOrDownloadRecap(canvas: HTMLCanvasElement, year: number): Promise<void> {
  return new Promise<void>((resolve) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        resolve();
        return;
      }
      const fileName = `travel-recap-${year}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
        try {
          await navigator.share({
            title: `Итоги путешествий за ${year} год`,
            files: [file]
          });
          resolve();
          return;
        } catch {
        }
      }

      if (typeof document !== 'undefined') {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      resolve();
    }, 'image/png');
  });
}
