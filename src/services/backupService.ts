import { db } from './db';
import type { PhotoRecord, ThumbnailRecord, MarkRecord, UnlockedAchievementRecord, UserSettings } from '../types';

export interface BackupData {
  version: string;
  exportedAt: string;
  photos: PhotoRecord[];
  thumbs: ThumbnailRecord[];
  marks: MarkRecord[];
  achievements: UnlockedAchievementRecord[];
  settings?: UserSettings;
}

export interface MergeResult {
  addedPhotos: number;
  addedMarks: number;
  addedAchievements: number;
  totalPhotos: number;
}

export async function createBackup(): Promise<BackupData> {
  const [photos, thumbs, marks, achievements, settings] = await Promise.all([
    db.photos.toArray(),
    db.thumbs.toArray(),
    db.marks.toArray(),
    db.achievements.toArray(),
    db.settings.get('default')
  ]);

  return {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    photos,
    thumbs,
    marks,
    achievements,
    settings
  };
}

export function exportBackupToFile(backup: BackupData): void {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `travel-map-backup-${dateStr}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function mergeBackup(backup: BackupData): Promise<MergeResult> {
  if (!backup || !backup.photos || !backup.marks) {
    throw new Error('Некорректный формат файла бэкапа');
  }

  let addedPhotos = 0;
  let addedMarks = 0;
  let addedAchievements = 0;

  await db.transaction('rw', [db.photos, db.thumbs, db.marks, db.achievements, db.settings], async () => {
    for (const thumb of backup.thumbs || []) {
      const existing = await db.thumbs.get(thumb.id);
      if (!existing) {
        await db.thumbs.put(thumb);
      }
    }

    for (const photo of backup.photos) {
      const existing = await db.photos.get(photo.id);
      if (!existing) {
        photo.createdAt = photo.createdAt || new Date().toISOString();
        await db.photos.put(photo);
        addedPhotos++;
      }
    }

    for (const mark of backup.marks) {
      const existing = await db.marks.get(mark.id);
      if (!existing) {
        await db.marks.put(mark);
        addedMarks++;
      }
    }

    for (const ach of backup.achievements || []) {
      const existing = await db.achievements.get(ach.id);
      if (!existing) {
        await db.achievements.put(ach);
        addedAchievements++;
      }
    }

    if (backup.settings) {
      const current = await db.settings.get('default');
      await db.settings.put({
        ...current,
        ...backup.settings,
        id: 'default'
      });
    }
  });

  const totalPhotos = await db.photos.count();
  return { addedPhotos, addedMarks, addedAchievements, totalPhotos };
}

export function shouldPromptBackup(
  lastBackupDate?: string,
  totalRecordsCount: number = 0,
  oldestRecordDate?: string
): boolean {
  if (totalRecordsCount <= 0) return false;
  if (!lastBackupDate) {
    if (!oldestRecordDate) return false;
    const oldest = new Date(oldestRecordDate).getTime();
    const diffDays = (Date.now() - oldest) / (1000 * 60 * 60 * 24);
    return diffDays >= 7;
  }
  const last = new Date(lastBackupDate).getTime();
  const diffDays = (Date.now() - last) / (1000 * 60 * 60 * 24);
  return diffDays >= 30;
}
