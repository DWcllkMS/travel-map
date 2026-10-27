import Dexie, { type Table } from 'dexie';
import type { PhotoRecord, ThumbnailRecord, PhotoThumbRecord, MarkRecord, UnlockedAchievementRecord, UserSettings } from '../types';

export class TravelMapDatabase extends Dexie {
  photos!: Table<PhotoRecord, string>;
  thumbs!: Table<ThumbnailRecord, string>;
  photoThumbs!: Table<PhotoThumbRecord, string>;
  marks!: Table<MarkRecord, string>;
  achievements!: Table<UnlockedAchievementRecord, string>;
  settings!: Table<UserSettings, string>;

  constructor() {
    super('TravelMapDatabase');
    this.version(1).stores({
      photos: 'id, districtId, regionId, country, takenAt, proof, h3, thumbId',
      thumbs: 'id, groupKey, takenAt',
      marks: 'id, targetId, targetType, markType, country',
      achievements: 'id, unlockedAt',
      settings: 'id'
    });
    this.version(2).stores({
      photos: 'id, districtId, regionId, country, takenAt, proof, h3, thumbId',
      thumbs: 'id, groupKey, takenAt',
      marks: 'id, targetId, targetType, markType, country',
      achievements: 'id, unlockedAt',
      settings: 'id'
    });
    this.version(3).stores({
      photos: 'id, districtId, regionId, country, takenAt, proof, h3, thumbId',
      thumbs: 'id, groupKey, takenAt',
      photoThumbs: 'id',
      marks: 'id, targetId, targetType, markType, country',
      achievements: 'id, unlockedAt',
      settings: 'id'
    });
  }
}

export const db = new TravelMapDatabase();
if (typeof window !== 'undefined') {
  (window as any).__db = db;
}

export async function initStoragePersistence(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }
  return false;
}

export async function getSettings(): Promise<UserSettings> {
  const current = await db.settings.get('default');
  if (current) return current;
  const initial: UserSettings = {
    id: 'default',
    theme: 'dark',
    includeManualInStats: true
  };
  await db.settings.put(initial);
  return initial;
}

export async function updateSettings(partial: Partial<UserSettings>): Promise<UserSettings> {
  const current = await getSettings();
  const updated: UserSettings = { ...current, ...partial };
  await db.settings.put(updated);
  return updated;
}

export async function clearAllData(): Promise<void> {
  await Promise.all([
    db.photos.clear(),
    db.thumbs.clear(),
    db.photoThumbs.clear(),
    db.marks.clear(),
    db.achievements.clear()
  ]);
}

export async function deletePhoto(id: string): Promise<void> {
  await Promise.all([
    db.photos.delete(id),
    db.photoThumbs.delete(id)
  ]);
}
