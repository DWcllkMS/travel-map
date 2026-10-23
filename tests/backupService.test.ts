import { describe, it, expect } from 'vitest';
import { shouldPromptBackup, type BackupData, type MergeResult } from '../src/services/backupService';
import type { PhotoRecord, MarkRecord } from '../src/types';

function simulateBackupMerge(
  existingPhotos: PhotoRecord[],
  existingMarks: MarkRecord[],
  backup: BackupData
): { mergedPhotos: PhotoRecord[]; mergedMarks: MarkRecord[]; result: MergeResult } {
  const photoMap = new Map<string, PhotoRecord>(existingPhotos.map(p => [p.id, p]));
  const markMap = new Map<string, MarkRecord>(existingMarks.map(m => [m.id, m]));

  let addedPhotos = 0;
  let addedMarks = 0;

  for (const p of backup.photos) {
    if (!photoMap.has(p.id)) {
      photoMap.set(p.id, p);
      addedPhotos++;
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
