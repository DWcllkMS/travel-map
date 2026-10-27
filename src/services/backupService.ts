import { db } from './db';
import type { PhotoRecord, ThumbnailRecord, PhotoThumbRecord, MarkRecord, UnlockedAchievementRecord, UserSettings } from '../types';

export interface BackupData {
  version: string;
  exportedAt: string;
  includesThumbs?: boolean;
  photos: PhotoRecord[];
  thumbs?: ThumbnailRecord[];
  photoThumbs?: PhotoThumbRecord[];
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

export interface CreateBackupOptions {
  includeThumbs?: boolean;
}

export async function createBackup(options: CreateBackupOptions = { includeThumbs: true }): Promise<BackupData> {
  const includeThumbs = options.includeThumbs ?? true;

  const [photos, thumbs, photoThumbs, marks, achievements, settings] = await Promise.all([
    db.photos.toArray(),
    includeThumbs ? db.thumbs.toArray() : Promise.resolve([]),
    includeThumbs ? db.photoThumbs.toArray() : Promise.resolve([]),
    db.marks.toArray(),
    db.achievements.toArray(),
    db.settings.get('default')
  ]);

  return {
    version: '1.7.0',
    exportedAt: new Date().toISOString(),
    includesThumbs: includeThumbs,
    photos,
    thumbs,
    photoThumbs,
    marks,
    achievements,
    settings
  };
}

export function serializeBackupToBlob(backup: BackupData): Blob {
  const parts: string[] = [];

  parts.push('{"version":' + JSON.stringify(backup.version || '1.7.0'));
  parts.push(',"exportedAt":' + JSON.stringify(backup.exportedAt || new Date().toISOString()));
  if (backup.includesThumbs !== undefined) {
    parts.push(',"includesThumbs":' + JSON.stringify(backup.includesThumbs));
  }
  if (backup.settings) {
    parts.push(',"settings":' + JSON.stringify(backup.settings));
  }

  function appendArray(key: string, arr?: any[]) {
    parts.push(',"' + key + '":[');
    if (arr && arr.length > 0) {
      for (let i = 0; i < arr.length; i++) {
        if (i > 0) parts.push(',');
        parts.push(JSON.stringify(arr[i]));
      }
    }
    parts.push(']');
  }

  appendArray('photos', backup.photos || []);
  appendArray('thumbs', backup.thumbs || []);
  appendArray('photoThumbs', backup.photoThumbs || []);
  appendArray('marks', backup.marks || []);
  appendArray('achievements', backup.achievements || []);

  parts.push('}');

  return new Blob(parts, { type: 'application/json' });
}

export function exportBackupToFile(backup: BackupData, filename?: string): void {
  const blob = serializeBackupToBlob(backup);
  const dateStr = new Date().toISOString().slice(0, 10);
  const defaultFilename = backup.includesThumbs === false
    ? `travel-map-backup-${dateStr}-no-photos.json`
    : `travel-map-backup-${dateStr}.json`;
  const name = filename || defaultFilename;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.style.display = 'none';

  if (typeof document !== 'undefined' && document.body) {
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 60000);
  } else {
    a.click();
  }
}

export async function mergeBackup(backup: BackupData): Promise<MergeResult> {
  if (!backup || !Array.isArray(backup.photos) || !Array.isArray(backup.marks)) {
    throw new Error('Некорректный формат файла бэкапа');
  }

  let addedPhotos = 0;
  let addedMarks = 0;
  let addedAchievements = 0;

  await db.transaction('rw', [db.photos, db.thumbs, db.photoThumbs, db.marks, db.achievements, db.settings], async () => {
    for (const thumb of backup.thumbs || []) {
      const existing = await db.thumbs.get(thumb.id);
      if (!existing && thumb.dataUrl) {
        await db.thumbs.put(thumb);
      }
    }

    for (const pt of backup.photoThumbs || []) {
      const existing = await db.photoThumbs.get(pt.id);
      if (!existing && pt.dataUrl) {
        await db.photoThumbs.put(pt);
      }
    }

    for (const photo of backup.photos) {
      const existing = await db.photos.get(photo.id);
      if (!existing) {
        photo.createdAt = photo.createdAt || new Date().toISOString();
        await db.photos.put(photo);
        addedPhotos++;
      } else if (!existing.thumbId && photo.thumbId) {
        await db.photos.update(photo.id, { thumbId: photo.thumbId });
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
