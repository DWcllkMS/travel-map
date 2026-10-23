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
