import type { PhotoRecord, MarkRecord, ProofLevel } from '../types';

export interface TimelapseStep {
  date: string;
  formattedDate: string;
  newPhotos: PhotoRecord[];
  newMarks: MarkRecord[];
  newDistricts: string[];
  newRegions: string[];
  newCountries: string[];
  newDiscoveries: string[];
  districtsDelta: Array<{ id: string; proof: ProofLevel }>;
  regionsDelta: Array<{ id: string; proof: ProofLevel; hasDistricts: boolean }>;
  h3CellsDelta: string[];
  cumulativePhotos: PhotoRecord[];
  cumulativeH3Cells: string[];
  cumulativeDistricts: string[];
  cumulativeRegions: string[];
  cumulativeCountries: string[];
  districtsCount: number;
  regionsCount: number;
  countriesCount: number;
  photosCount: number;
  center?: [number, number];
}

export interface BuildTimelapseOptions {
  getRegionName?: (id: string) => string;
  getCountryName?: (id: string) => string;
  getDistrictById?: (id: string) => { name: string; regionId: string; country: string } | undefined;
  getRegionCenter?: (id: string) => [number, number] | undefined;
  hasDistricts?: (regionId: string) => boolean;
}

export function formatRuDate(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const date = new Date(y, m, d);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    }
  }
  return dateStr;
}

export function buildTimelapseSteps(
  photos: PhotoRecord[],
  marks: MarkRecord[],
  options: BuildTimelapseOptions = {}
): TimelapseStep[] {
  const manualMarks = marks.filter(m => m.markType === 'visited_manual' && m.createdAt);
  const validPhotos = photos.filter(p => p.takenAt);

  const dateMap = new Map<string, { photos: PhotoRecord[]; marks: MarkRecord[] }>();

  for (const p of validPhotos) {
    const d = p.takenAt.slice(0, 10);
    if (!d || d.length !== 10) continue;
    let entry = dateMap.get(d);
    if (!entry) {
      entry = { photos: [], marks: [] };
      dateMap.set(d, entry);
    }
    entry.photos.push(p);
  }

  for (const m of manualMarks) {
    const d = m.createdAt.slice(0, 10);
    if (!d || d.length !== 10) continue;
    let entry = dateMap.get(d);
    if (!entry) {
      entry = { photos: [], marks: [] };
      dateMap.set(d, entry);
    }
    entry.marks.push(m);
  }

  const sortedDates = Array.from(dateMap.keys()).sort();
  if (sortedDates.length === 0) return [];

  const visitedDistrictsMap = new Map<string, ProofLevel>();
  const visitedRegionsMap = new Map<string, ProofLevel>();
  const visitedCountriesSet = new Set<string>();

  const cumulativePhotos: PhotoRecord[] = [];
  const cumulativeH3CellsSet = new Set<string>();
  const cumulativeH3CellsList: string[] = [];

  const steps: TimelapseStep[] = [];

  for (const d of sortedDates) {
    const bucket = dateMap.get(d)!;
    const newDistrictsThisStep: string[] = [];
    const newRegionsThisStep: string[] = [];
    const newCountriesThisStep: string[] = [];
    const districtsDelta: Array<{ id: string; proof: ProofLevel }> = [];
    const regionsDelta: Array<{ id: string; proof: ProofLevel; hasDistricts: boolean }> = [];
    const h3CellsDelta: string[] = [];
    const stepPoints: Array<[number, number]> = [];

    for (const p of bucket.photos) {
      cumulativePhotos.push(p);
      if (typeof p.lon === 'number' && typeof p.lat === 'number') {
        stepPoints.push([p.lon, p.lat]);
      }
      if (p.h3 && !cumulativeH3CellsSet.has(p.h3)) {
        cumulativeH3CellsSet.add(p.h3);
        cumulativeH3CellsList.push(p.h3);
        h3CellsDelta.push(p.h3);
      }

      if (p.districtId && !visitedDistrictsMap.has(p.districtId)) {
        visitedDistrictsMap.set(p.districtId, p.proof);
        newDistrictsThisStep.push(p.districtId);
        districtsDelta.push({ id: p.districtId, proof: p.proof });
      }

      if (p.regionId && !visitedRegionsMap.has(p.regionId)) {
        visitedRegionsMap.set(p.regionId, p.proof);
        newRegionsThisStep.push(p.regionId);
        const hasD = options.hasDistricts ? options.hasDistricts(p.regionId) : true;
        regionsDelta.push({ id: p.regionId, proof: p.proof, hasDistricts: hasD });
      }

      const country = p.country || 'RUS';
      if (!visitedCountriesSet.has(country)) {
        visitedCountriesSet.add(country);
        newCountriesThisStep.push(country);
      }
    }

    for (const m of bucket.marks) {
      if (m.targetType === 'district') {
        const district = options.getDistrictById?.(m.targetId);
        const regId = district?.regionId;
        const cntry = m.country || district?.country || 'RUS';

        if (!visitedDistrictsMap.has(m.targetId)) {
          visitedDistrictsMap.set(m.targetId, 'bronze');
          newDistrictsThisStep.push(m.targetId);
          districtsDelta.push({ id: m.targetId, proof: 'bronze' });
        }

        if (regId && !visitedRegionsMap.has(regId)) {
          visitedRegionsMap.set(regId, 'bronze');
          newRegionsThisStep.push(regId);
          const hasD = options.hasDistricts ? options.hasDistricts(regId) : true;
          regionsDelta.push({ id: regId, proof: 'bronze', hasDistricts: hasD });
          const center = options.getRegionCenter?.(regId);
          if (center) stepPoints.push(center);
        }

        if (cntry && !visitedCountriesSet.has(cntry)) {
          visitedCountriesSet.add(cntry);
          newCountriesThisStep.push(cntry);
        }
      } else if (m.targetType === 'region') {
        if (!visitedRegionsMap.has(m.targetId)) {
          visitedRegionsMap.set(m.targetId, 'bronze');
          newRegionsThisStep.push(m.targetId);
          const hasD = options.hasDistricts ? options.hasDistricts(m.targetId) : false;
          regionsDelta.push({ id: m.targetId, proof: 'bronze', hasDistricts: hasD });
          const center = options.getRegionCenter?.(m.targetId);
          if (center) stepPoints.push(center);
        }

        const cntry = m.country || 'RUS';
        if (!visitedCountriesSet.has(cntry)) {
          visitedCountriesSet.add(cntry);
          newCountriesThisStep.push(cntry);
        }
      }
    }

    let center: [number, number] | undefined;
    if (stepPoints.length > 0) {
      let sumLon = 0;
      let sumLat = 0;
      for (const pt of stepPoints) {
        sumLon += pt[0];
        sumLat += pt[1];
      }
      center = [sumLon / stepPoints.length, sumLat / stepPoints.length];
    }

    const newDiscoveries: string[] = [];
    for (const c of newCountriesThisStep) {
      const name = options.getCountryName ? options.getCountryName(c) : c;
      newDiscoveries.push(`+ ${name}`);
    }
    for (const r of newRegionsThisStep) {
      const name = options.getRegionName ? options.getRegionName(r) : r;
      newDiscoveries.push(`+ ${name}`);
    }

    steps.push({
      date: d,
      formattedDate: formatRuDate(d),
      newPhotos: bucket.photos,
      newMarks: bucket.marks,
      newDistricts: newDistrictsThisStep,
      newRegions: newRegionsThisStep,
      newCountries: newCountriesThisStep,
      newDiscoveries,
      districtsDelta,
      regionsDelta,
      h3CellsDelta,
      cumulativePhotos: [...cumulativePhotos],
      cumulativeH3Cells: [...cumulativeH3CellsList],
      cumulativeDistricts: Array.from(visitedDistrictsMap.keys()),
      cumulativeRegions: Array.from(visitedRegionsMap.keys()),
      cumulativeCountries: Array.from(visitedCountriesSet.keys()),
      districtsCount: visitedDistrictsMap.size,
      regionsCount: visitedRegionsMap.size,
      countriesCount: visitedCountriesSet.size,
      photosCount: cumulativePhotos.length,
      center
    });
  }

  return steps;
}

export function computeBaseStepDuration(stepCount: number): number {
  if (stepCount <= 0) return 1500;
  const targetMs = 25000;
  const raw = Math.round(targetMs / stepCount);
  return Math.max(50, Math.min(1500, raw));
}
