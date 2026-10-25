import { describe, it, expect } from 'vitest';
import {
  shouldPromptBackup,
  serializeBackupToBlob,
  type BackupData,
  type MergeResult
} from '../src/services/backupService';
import type { PhotoRecord, MarkRecord, ThumbnailRecord } from '../src/types';

function simulateBackupMerge(
  existingPhotos: PhotoRecord[],
  existingMarks: MarkRecord[],
  backup: BackupData,
  existingThumbs: ThumbnailRecord[] = []
): {
  mergedPhotos: PhotoRecord[];
  mergedMarks: MarkRecord[];
  mergedThumbs: ThumbnailRecord[];
  result: MergeResult;
} {
  const photoMap = new Map<string, PhotoRecord>(existingPhotos.map(p => [p.id, p]));
  const markMap = new Map<string, MarkRecord>(existingMarks.map(m => [m.id, m]));
  const thumbMap = new Map<string, ThumbnailRecord>(existingThumbs.map(t => [t.id, t]));

  let addedPhotos = 0;
  let addedMarks = 0;

  for (const t of backup.thumbs || []) {
    if (!thumbMap.has(t.id)) {
      thumbMap.set(t.id, t);
    }
  }

  for (const p of backup.photos) {
    if (!photoMap.has(p.id)) {
      photoMap.set(p.id, p);
      addedPhotos++;
    } else {
      const existing = photoMap.get(p.id)!;
      if (!existing.thumbId && p.thumbId) {
        existing.thumbId = p.thumbId;
      }
    }
  }

  for (const m of backup.marks) {
    if (!markMap.has(m.id)) {
      markMap.set(m.id, m);
      addedMarks++;
    }
  }

  return {
    mergedPhotos: Array.from(photoMap.values()),
    mergedMarks: Array.from(markMap.values()),
    mergedThumbs: Array.from(thumbMap.values()),
    result: {
      addedPhotos,
      addedMarks,
      addedAchievements: 0,
      totalPhotos: photoMap.size
    }
  };
}

describe('Backup Merge Logic', () => {
  it('correctly merges backup data without duplicates', () => {
    const existingPhotos: PhotoRecord[] = [
      {
        id: 'photo-1',
        lat: 43.257,
        lon: 42.511,
        takenAt: '2026-06-15T12:00:00Z',
        regionId: 'RUS-2304',
        country: 'RUS',
        h3: '8611846cfffffff',
        proof: 'gold'
      }
    ];

    const existingMarks: MarkRecord[] = [
      {
        id: 'mark-1',
        targetId: 'RUS-2371',
        targetType: 'region',
        markType: 'visited_manual',
        createdAt: '2026-06-10T10:00:00Z'
      }
    ];

    const backup: BackupData = {
      version: '1.0.0',
      exportedAt: '2026-06-20T10:00:00Z',
      photos: [
        {
          id: 'photo-1',
          lat: 43.257,
          lon: 42.511,
          takenAt: '2026-06-15T12:00:00Z',
          regionId: 'RUS-2304',
          country: 'RUS',
          h3: '8611846cfffffff',
          proof: 'gold'
        },
        {
          id: 'photo-2',
          lat: 55.7558,
          lon: 37.6173,
          takenAt: '2026-06-18T15:00:00Z',
          regionId: 'RUS-2384',
          country: 'RUS',
          h3: '8611846ceffffff',
          proof: 'gold'
        }
      ],
      thumbs: [],
      marks: [
        {
          id: 'mark-1',
          targetId: 'RUS-2371',
          targetType: 'region',
          markType: 'visited_manual',
          createdAt: '2026-06-10T10:00:00Z'
        },
        {
          id: 'mark-2',
          targetId: 'RUS-2372',
          targetType: 'region',
          markType: 'wishlist',
          createdAt: '2026-06-19T10:00:00Z'
        }
      ],
      achievements: []
    };

    const { mergedPhotos, mergedMarks, result } = simulateBackupMerge(existingPhotos, existingMarks, backup);

    expect(result.addedPhotos).toBe(1);
    expect(result.addedMarks).toBe(1);
    expect(mergedPhotos.length).toBe(2);
    expect(mergedMarks.length).toBe(2);
  });

  it('correctly merges backup without thumbs or with empty thumbs', () => {
    const existingPhotos: PhotoRecord[] = [];
    const existingMarks: MarkRecord[] = [];

    const backupWithoutThumbs: BackupData = {
      version: '1.4.0',
      exportedAt: '2026-10-25T12:00:00Z',
      includesThumbs: false,
      photos: [
        {
          id: 'photo-1',
          lat: 43.257,
          lon: 42.511,
          takenAt: '2026-06-15T12:00:00Z',
          regionId: 'RUS-2304',
          country: 'RUS',
          h3: '8611846cfffffff',
          proof: 'gold',
          thumbId: 'thumb-legacy-1'
        }
      ],
      marks: [
        {
          id: 'mark-1',
          targetId: 'RUS-2371',
          targetType: 'region',
          markType: 'visited_manual',
          createdAt: '2026-06-10T10:00:00Z'
        }
      ],
      achievements: []
    };

    const { mergedPhotos, mergedMarks, result } = simulateBackupMerge(
      existingPhotos,
      existingMarks,
      backupWithoutThumbs
    );

    expect(result.addedPhotos).toBe(1);
    expect(result.addedMarks).toBe(1);
    expect(mergedPhotos.length).toBe(1);
    expect(mergedPhotos[0].thumbId).toBe('thumb-legacy-1');
    expect(mergedMarks.length).toBe(1);
  });

  it('preserves existing photos and adds thumbs on subsequent merge', () => {
    const existingPhotos: PhotoRecord[] = [
      {
        id: 'photo-1',
        lat: 43.257,
        lon: 42.511,
        takenAt: '2026-06-15T12:00:00Z',
        regionId: 'RUS-2304',
        country: 'RUS',
        h3: '8611846cfffffff',
        proof: 'gold',
        thumbId: 'thumb-1'
      }
    ];
    const existingMarks: MarkRecord[] = [];

    const subsequentBackupWithThumbs: BackupData = {
      version: '1.4.0',
      exportedAt: '2026-10-25T12:00:00Z',
      includesThumbs: true,
      photos: [
        {
          id: 'photo-1',
          lat: 43.257,
          lon: 42.511,
          takenAt: '2026-06-15T12:00:00Z',
          regionId: 'RUS-2304',
          country: 'RUS',
          h3: '8611846cfffffff',
          proof: 'gold',
          thumbId: 'thumb-1'
        }
      ],
      thumbs: [
        {
          id: 'thumb-1',
          groupKey: 'gk-1',
          dataUrl: 'data:image/jpeg;base64,abc',
          takenAt: '2026-06-15T12:00:00Z'
        }
      ],
      marks: [],
      achievements: []
    };

    const { mergedPhotos, mergedThumbs, result } = simulateBackupMerge(
      existingPhotos,
      existingMarks,
      subsequentBackupWithThumbs,
      []
    );

    expect(result.addedPhotos).toBe(0);
    expect(mergedPhotos.length).toBe(1);
    expect(mergedThumbs.length).toBe(1);
    expect(mergedThumbs[0].id).toBe('thumb-1');
  });

  it('evaluates shouldPromptBackup according to rules', () => {
    expect(shouldPromptBackup(undefined, 0)).toBe(false);

    const now = Date.now();
    const fourDaysAgo = new Date(now - 4 * 86400 * 1000).toISOString();
    const eightDaysAgo = new Date(now - 8 * 86400 * 1000).toISOString();
    const twentyDaysAgo = new Date(now - 20 * 86400 * 1000).toISOString();
    const thirtyOneDaysAgo = new Date(now - 31 * 86400 * 1000).toISOString();

    expect(shouldPromptBackup(undefined, 5, fourDaysAgo)).toBe(false);
    expect(shouldPromptBackup(undefined, 5, eightDaysAgo)).toBe(true);

    expect(shouldPromptBackup(twentyDaysAgo, 5, eightDaysAgo)).toBe(false);
    expect(shouldPromptBackup(thirtyOneDaysAgo, 5, eightDaysAgo)).toBe(true);
  });
});

describe('Backup Serialization', () => {
  it('serializes backup to valid JSON Blob matching the source data', async () => {
    const backup: BackupData = {
      version: '1.4.0',
      exportedAt: '2026-10-25T12:00:00.000Z',
      includesThumbs: true,
      photos: [
        {
          id: 'p1',
          lat: 55.75,
          lon: 37.61,
          takenAt: '2026-06-01T10:00:00Z',
          regionId: 'RUS-2384',
          country: 'RUS',
          h3: '8611846ceffffff',
          proof: 'gold',
          thumbId: 't1'
        }
      ],
      thumbs: [
        {
          id: 't1',
          groupKey: '2026-06-01_8611846ceffffff',
          dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
          takenAt: '2026-06-01T10:00:00Z'
        }
      ],
      marks: [
        {
          id: 'm1',
          targetId: 'RUS-2384',
          targetType: 'region',
          markType: 'visited_manual',
          createdAt: '2026-06-01T12:00:00Z'
        }
      ],
      achievements: [
        {
          id: 'ach-1',
          unlockedAt: '2026-06-01T12:00:00Z'
        }
      ],
      settings: {
        id: 'default',
        theme: 'dark',
        includeManualInStats: true
      }
    };

    const blob = serializeBackupToBlob(backup);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/json');

    const text = await blob.text();
    const parsed = JSON.parse(text);

    expect(parsed.version).toBe('1.4.0');
    expect(parsed.exportedAt).toBe('2026-10-25T12:00:00.000Z');
    expect(parsed.includesThumbs).toBe(true);
    expect(parsed.photos).toEqual(backup.photos);
    expect(parsed.thumbs).toEqual(backup.thumbs);
    expect(parsed.marks).toEqual(backup.marks);
    expect(parsed.achievements).toEqual(backup.achievements);
    expect(parsed.settings).toEqual(backup.settings);
  });

  it('serializes backup without thumbs having includesThumbs false and empty thumbs array', async () => {
    const backup: BackupData = {
      version: '1.4.0',
      exportedAt: '2026-10-25T12:00:00.000Z',
      includesThumbs: false,
      photos: [
        {
          id: 'p1',
          lat: 55.75,
          lon: 37.61,
          takenAt: '2026-06-01T10:00:00Z',
          regionId: 'RUS-2384',
          country: 'RUS',
          h3: '8611846ceffffff',
          proof: 'gold',
          thumbId: 't1'
        }
      ],
      thumbs: [],
      marks: [
        {
          id: 'm1',
          targetId: 'RUS-2384',
          targetType: 'region',
          markType: 'visited_manual',
          createdAt: '2026-06-01T12:00:00Z'
        }
      ],
      achievements: [
        {
          id: 'ach-1',
          unlockedAt: '2026-06-01T12:00:00Z'
        }
      ],
      settings: {
        id: 'default',
        theme: 'dark',
        includeManualInStats: true
      }
    };

    const blob = serializeBackupToBlob(backup);
    const text = await blob.text();
    const parsed = JSON.parse(text);

    expect(parsed.includesThumbs).toBe(false);
    expect(parsed.thumbs).toEqual([]);
    expect(parsed.photos.length).toBe(1);
    expect(parsed.photos[0].id).toBe('p1');
    expect(parsed.photos[0].thumbId).toBe('t1');
    expect(parsed.marks.length).toBe(1);
    expect(parsed.achievements.length).toBe(1);
    expect(parsed.settings).toBeDefined();
    expect(parsed.settings.theme).toBe('dark');
  });
});
