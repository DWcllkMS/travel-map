import { latLngToCell } from 'h3-js';

export interface GroupCandidate {
  id: string;
  lat: number;
  lon: number;
  takenAt: string;
}

export function computeGroupKey(lat: number, lon: number, takenAt: string): string {
  const dateStr = takenAt ? takenAt.slice(0, 10) : 'unknown-date';
  const h3Cell = latLngToCell(lat, lon, 7);
  return `${dateStr}_${h3Cell}`;
}

export function groupPhotosForPreviews<T extends GroupCandidate>(items: T[]): Map<string, T> {
  const groups = new Map<string, T>();
  for (const item of items) {
    const key = computeGroupKey(item.lat, item.lon, item.takenAt);
    if (!groups.has(key)) {
      groups.set(key, item);
    }
  }
  return groups;
}

export interface PhotoClusterGroup<T> {
  key: string;
  photos: T[];
  primary: T;
  count: number;
  thumbId?: string;
}

export function groupPhotosByClusterKey<T extends { id: string; takenAt: string; thumbId?: string; districtId?: string; regionId?: string; lat?: number; lon?: number }>(
  photos: T[]
): PhotoClusterGroup<T>[] {
  const map = new Map<string, PhotoClusterGroup<T>>();
  const sorted = [...photos].sort((a, b) => b.takenAt.localeCompare(a.takenAt));
  for (const p of sorted) {
    const key = p.thumbId || `${p.takenAt.slice(0, 10)}|${p.districtId || p.regionId || 'unknown'}`;
    const existing = map.get(key);
    if (existing) {
      existing.photos.push(p);
      existing.count++;
    } else {
      map.set(key, {
        key,
        photos: [p],
        primary: p,
        count: 1,
        thumbId: p.thumbId
      });
    }
  }
  const groups = [...map.values()];
  for (const g of groups) g.photos.reverse();
  return groups;
}
