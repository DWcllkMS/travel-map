import Flatbush from 'flatbush';
import type { FeatureCollection, Geometry } from 'geojson';
import type { GeoSight, MarkRecord, PhotoRecord } from '../types';

export interface SightsMatchResult {
  visitedSightIds: Set<string>;
  visitedSightFirstDates: Map<string, string>;
}

export interface SightVisitsResult extends SightsMatchResult {
  candidateSightIds: Set<string>;
  candidateFirstDates: Map<string, string>;
}

export function resolveSightVisits(
  nearby: SightsMatchResult,
  marks: MarkRecord[],
  includeManual: boolean = true
): SightVisitsResult {
  const confirmed = new Set<string>();
  const rejected = new Set<string>();
  const manual = new Set<string>();
  for (const m of marks) {
    if (m.targetType !== 'sight') continue;
    if (m.markType === 'sight_confirmed') confirmed.add(m.targetId);
    else if (m.markType === 'sight_rejected') rejected.add(m.targetId);
    else if (m.markType === 'visited_manual') manual.add(m.targetId);
  }

  const visitedSightIds = new Set<string>();
  const visitedSightFirstDates = new Map<string, string>();
  const candidateSightIds = new Set<string>();
  const candidateFirstDates = new Map<string, string>();

  for (const id of nearby.visitedSightIds) {
    const date = nearby.visitedSightFirstDates.get(id);
    if (confirmed.has(id)) {
      visitedSightIds.add(id);
      if (date) visitedSightFirstDates.set(id, date);
    } else if (!rejected.has(id) && !manual.has(id)) {
      candidateSightIds.add(id);
      if (date) candidateFirstDates.set(id, date);
    }
  }

  if (includeManual) {
    for (const id of manual) visitedSightIds.add(id);
  }

  return { visitedSightIds, visitedSightFirstDates, candidateSightIds, candidateFirstDates };
}

export class SightsSpatialIndex {
  private sights: GeoSight[] = [];
  private sightById = new Map<string, GeoSight>();
  private flatbush: Flatbush | null = null;
  private maxRadius = 15000;

  init(sightsData: FeatureCollection<Geometry, any>): void {
    this.sights = [];
    this.sightById.clear();

    if (!sightsData || !sightsData.features) return;

    for (const f of sightsData.features) {
      const p = f.properties || {};
      const coords = (f.geometry as any)?.coordinates;
      if (!coords || typeof coords[0] !== 'number') continue;

      const item: GeoSight = {
        id: p.id || String(f.id),
        name: p.name || '',
        kind: p.kind || 'other',
        unesco: Boolean(p.unesco),
        sitelinks: Number(p.sitelinks || 0),
        tier: (p.tier || 1) as 1 | 2 | 3 | 4,
        radius: Number(p.radius || 500),
        regionId: p.regionId || '',
        country: p.country || '',
        image: p.image,
        wiki: p.wiki,
        lon: coords[0],
        lat: coords[1]
      };

      this.sights.push(item);
      this.sightById.set(item.id, item);
      if (item.radius > this.maxRadius) {
        this.maxRadius = item.radius;
      }
    }

    if (this.sights.length > 0) {
      this.flatbush = new Flatbush(this.sights.length);
      for (const s of this.sights) {
        this.flatbush.add(s.lon, s.lat, s.lon, s.lat);
      }
      this.flatbush.finish();
    }
  }

  getAll(): GeoSight[] {
    return this.sights;
  }

  getById(id: string): GeoSight | undefined {
    return this.sightById.get(id);
  }

  getAllSights(): GeoSight[] {
    return this.sights;
  }

  getSightById(id: string): GeoSight | undefined {
    return this.sightById.get(id);
  }

  resolveVisits(photos: PhotoRecord[], marks: MarkRecord[], includeManual: boolean = true): SightVisitsResult {
    return resolveSightVisits(this.matchPhotos(photos), marks, includeManual);
  }

  matchPhotos(photos: PhotoRecord[]): SightsMatchResult {
    const visitedSightIds = new Set<string>();
    const visitedSightFirstDates = new Map<string, string>();

    if (!this.flatbush || this.sights.length === 0 || photos.length === 0) {
      return { visitedSightIds, visitedSightFirstDates };
    }

    const DEG_TO_KM = 111.32;
    const maxRadiusKm = this.maxRadius / 1000;

    for (const photo of photos) {
      if (photo.proof !== 'gold' && photo.proof !== 'silver') continue;
      if (typeof photo.lat !== 'number' || typeof photo.lon !== 'number') continue;

      const lat = photo.lat;
      const lon = photo.lon;
      const cosLat = Math.cos((lat * Math.PI) / 180);
      const deltaLat = maxRadiusKm / DEG_TO_KM;
      const deltaLon = cosLat > 0.001 ? maxRadiusKm / (DEG_TO_KM * cosLat) : deltaLat;

      const candidates = this.flatbush.search(
        lon - deltaLon,
        lat - deltaLat,
        lon + deltaLon,
        lat + deltaLat
      );

      const photoDate = photo.takenAt || photo.createdAt || new Date().toISOString();

      for (const idx of candidates) {
        const sight = this.sights[idx];
        const dx = (lon - sight.lon) * cosLat * DEG_TO_KM * 1000;
        const dy = (lat - sight.lat) * DEG_TO_KM * 1000;
        const distMeters = Math.hypot(dx, dy);

        if (distMeters <= sight.radius) {
          visitedSightIds.add(sight.id);
          const prevDate = visitedSightFirstDates.get(sight.id);
          if (!prevDate || new Date(photoDate).getTime() < new Date(prevDate).getTime()) {
            visitedSightFirstDates.set(sight.id, photoDate);
          }
        }
      }
    }

    return { visitedSightIds, visitedSightFirstDates };
  }
}

export const globalSightsIndex = new SightsSpatialIndex();
