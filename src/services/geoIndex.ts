import Flatbush from 'flatbush';
import * as turfHelpers from '@turf/helpers';
import turfBooleanPointInPolygon from '@turf/boolean-point-in-polygon';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { GeoDistrict, GeoRegion, GeoCountry } from '../types';

export interface MatchResult {
  district?: GeoDistrict;
  region?: GeoRegion;
  country?: string;
  isContested?: boolean;
  contestedDistricts?: GeoDistrict[];
}

function pointToSegmentDistanceKm(px: number, py: number, x1: number, y1: number, x2: number, y2: number, cosLat: number): number {
  const DEG_TO_KM = 111.32;
  const pX = px * cosLat * DEG_TO_KM;
  const pY = py * DEG_TO_KM;
  const aX = x1 * cosLat * DEG_TO_KM;
  const aY = y1 * DEG_TO_KM;
  const bX = x2 * cosLat * DEG_TO_KM;
  const bY = y2 * DEG_TO_KM;

  const dx = bX - aX;
  const dy = bY - aY;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(pX - aX, pY - aY);

  let t = ((pX - aX) * dx + (pY - aY) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = aX + t * dx;
  const projY = aY + t * dy;
  return Math.hypot(pX - projX, pY - projY);
}

function minDistanceToPolygonBoundaryKm(lon: number, lat: number, geometry: Geometry): number {
  const cosLat = Math.cos((lat * Math.PI) / 180);
  let minDist = Infinity;

  function checkRing(ring: number[][]) {
    for (let i = 0; i < ring.length - 1; i++) {
      const dist = pointToSegmentDistanceKm(lon, lat, ring[i][0], ring[i][1], ring[i + 1][0], ring[i + 1][1], cosLat);
      if (dist < minDist) {
        minDist = dist;
        if (minDist === 0) return;
      }
    }
  }

  const geom = geometry as any;
  if (geom.type === 'Polygon') {
    for (const ring of geom.coordinates) checkRing(ring);
  } else if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates) {
      for (const ring of poly) checkRing(ring);
    }
  }
  return minDist;
}

function computeBBox(feature: Feature<Geometry>): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  function walk(coords: any) {
    if (typeof coords[0] === 'number') {
      const [x, y] = coords;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    } else {
      for (const c of coords) walk(c);
    }
  }
  walk((feature.geometry as any).coordinates);
  return [minX, minY, maxX, maxY];
}

export class GeoSpatialIndex {
  private districtFeatures: Feature<Geometry, GeoDistrict>[] = [];
  private districtBBoxes: [number, number, number, number][] = [];
  private districtIndex: Flatbush | null = null;

  private regionFeatures: Feature<Geometry, GeoRegion>[] = [];
  private regionBBoxes: [number, number, number, number][] = [];
  private regionIndex: Flatbush | null = null;
  private regionById = new Map<string, GeoRegion>();

  private countries: GeoCountry[] = [];
  private countryById = new Map<string, GeoCountry>();
  private districtCountByRegionId = new Map<string, number>();

  init(
    districtsData: FeatureCollection<Geometry, any>,
    regionsData: FeatureCollection<Geometry, any>,
    countriesData?: FeatureCollection<Geometry, any>
  ) {
    this.districtFeatures = districtsData.features.map(f => ({
      type: 'Feature',
      geometry: f.geometry,
      properties: {
        id: f.properties.id || String(f.id),
        name: f.properties.name,
        regionId: f.properties.regionId,
        country: f.properties.country || 'RUS',
        area: f.properties.area || 0,
        rarity: f.properties.rarity || 1
      }
    }));

    this.districtCountByRegionId.clear();
    for (const f of this.districtFeatures) {
      const rId = f.properties.regionId;
      if (rId) {
        this.districtCountByRegionId.set(rId, (this.districtCountByRegionId.get(rId) || 0) + 1);
      }
    }

    this.countryById.clear();
    this.countries = [];
    if (countriesData?.features) {
      for (const f of countriesData.features) {
        const item: GeoCountry = {
          id: f.properties.id || String(f.id),
          name: f.properties.name,
          continent: f.properties.continent,
          labelY: f.properties.labelY
        };
        this.countries.push(item);
        this.countryById.set(item.id, item);
      }
    }

    this.districtBBoxes = this.districtFeatures.map(f => computeBBox(f));
    this.districtIndex = new Flatbush(this.districtFeatures.length);
    for (const b of this.districtBBoxes) {
      this.districtIndex.add(b[0], b[1], b[2], b[3]);
    }
    this.districtIndex.finish();

    this.regionFeatures = regionsData.features.map(f => ({
      type: 'Feature',
      geometry: f.geometry,
      properties: {
        id: f.properties.id || String(f.id),
        name: f.properties.name,
        country: f.properties.country,
        countryName: f.properties.countryName,
        area: f.properties.area || 0,
        rarity: f.properties.rarity || 1,
        labelX: f.properties.labelX,
        labelY: f.properties.labelY
      }
    }));

    this.regionBBoxes = this.regionFeatures.map(f => computeBBox(f));
    this.regionIndex = new Flatbush(this.regionFeatures.length);
    for (const b of this.regionBBoxes) {
      this.regionIndex.add(b[0], b[1], b[2], b[3]);
    }
    this.regionIndex.finish();

    this.regionById.clear();
    for (const rf of this.regionFeatures) {
      this.regionById.set(rf.properties.id, rf.properties);
    }
  }

  findDistrictAndRegion(lat: number, lon: number): MatchResult {
    const pt = turfHelpers.point([lon, lat]);
    let matchedDistrict: GeoDistrict | undefined;
    let matchedRegion: GeoRegion | undefined;
    let country: string | undefined;

    if (this.districtIndex && this.districtFeatures.length > 0) {
      const candidateIndices = this.districtIndex.search(lon, lat, lon, lat);
      for (const idx of candidateIndices) {
        const feat = this.districtFeatures[idx];
        if (turfBooleanPointInPolygon(pt, feat as any)) {
          matchedDistrict = feat.properties;
          country = feat.properties.country;
          if (feat.properties.regionId) {
            matchedRegion = this.regionById.get(feat.properties.regionId);
          }
          break;
        }
      }
    }

    if (matchedDistrict && matchedDistrict.regionId) {
      matchedRegion = this.regionById.get(matchedDistrict.regionId);
      country = matchedRegion?.country || matchedDistrict.country || 'RUS';
    }

    if (!matchedRegion && this.regionIndex && this.regionFeatures.length > 0) {
      const candidateIndices = this.regionIndex.search(lon, lat, lon, lat);
      for (const idx of candidateIndices) {
        const feat = this.regionFeatures[idx];
        if (turfBooleanPointInPolygon(pt, feat as any)) {
          matchedRegion = feat.properties;
          country = feat.properties.country;
          break;
        }
      }
    }

    if (!matchedRegion && this.regionIndex && this.regionFeatures.length > 0) {
      const cosLat = Math.cos((lat * Math.PI) / 180);
      const deltaLat = 10.0 / 111.32;
      const deltaLon = 10.0 / (111.32 * (cosLat || 1));
      const nearbyRegionIndices = this.regionIndex.search(
        lon - deltaLon,
        lat - deltaLat,
        lon + deltaLon,
        lat + deltaLat
      );

      let closestRegion: GeoRegion | undefined;
      let minRegionDist = Infinity;

      for (const idx of nearbyRegionIndices) {
        const feat = this.regionFeatures[idx];
        const dist = minDistanceToPolygonBoundaryKm(lon, lat, feat.geometry);
        if (dist <= 10.0 && dist < minRegionDist) {
          minRegionDist = dist;
          closestRegion = feat.properties;
        }
      }

      if (closestRegion) {
        matchedRegion = closestRegion;
        country = closestRegion.country;
      }
    }

    if (matchedDistrict && this.districtIndex) {
      const cosLat = Math.cos((lat * Math.PI) / 180);
      const deltaLat = 2.5 / 111.32;
      const deltaLon = 2.5 / (111.32 * (cosLat || 1));
      const nearbyIndices = this.districtIndex.search(
        lon - deltaLon,
        lat - deltaLat,
        lon + deltaLon,
        lat + deltaLat
      );

      const contestedList: GeoDistrict[] = [matchedDistrict];
      for (const idx of nearbyIndices) {
        const cand = this.districtFeatures[idx];
        if (cand.properties.id === matchedDistrict.id) continue;
        const d = minDistanceToPolygonBoundaryKm(lon, lat, cand.geometry);
        if (d < 2.0) {
          contestedList.push(cand.properties);
        }
      }

      if (contestedList.length > 1) {
        return {
          district: matchedDistrict,
          region: matchedRegion,
          country,
          isContested: true,
          contestedDistricts: contestedList
        };
      }
    }

    return {
      district: matchedDistrict,
      region: matchedRegion,
      country,
      isContested: false
    };
  }

  getRegionById(id: string): GeoRegion | undefined {
    return this.regionById.get(id);
  }

  getAllRegions(): GeoRegion[] {
    return this.regionFeatures.map(f => f.properties);
  }

  getAllDistricts(): GeoDistrict[] {
    return this.districtFeatures.map(f => f.properties);
  }

  getAllCountries(): GeoCountry[] {
    return this.countries;
  }

  getCountryById(id: string): GeoCountry | undefined {
    return this.countryById.get(id);
  }

  getRegionCenter(regionId: string): { lat: number; lon: number } | undefined {
    const r = this.regionById.get(regionId);
    if (r && r.labelX !== undefined && r.labelY !== undefined) {
      return { lat: r.labelY, lon: r.labelX };
    }
    const idx = this.regionFeatures.findIndex(f => f.properties.id === regionId);
    if (idx < 0) return undefined;
    const [minX, minY, maxX, maxY] = this.regionBBoxes[idx];
    return { lat: (minY + maxY) / 2, lon: (minX + maxX) / 2 };
  }

  getDistrictCenter(districtId: string): { lat: number; lon: number } | undefined {
    const idx = this.districtFeatures.findIndex(f => f.properties.id === districtId);
    if (idx < 0) return undefined;
    const [minX, minY, maxX, maxY] = this.districtBBoxes[idx];
    return { lat: (minY + maxY) / 2, lon: (minX + maxX) / 2 };
  }

  getDistrictCountByRegionId(regionId: string): number {
    return this.districtCountByRegionId.get(regionId) || 0;
  }

  getAllDistrictCountsByRegion(): Map<string, number> {
    return this.districtCountByRegionId;
  }
}

export const globalGeoIndex = new GeoSpatialIndex();
