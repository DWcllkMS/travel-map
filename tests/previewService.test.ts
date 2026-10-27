import { describe, it, expect } from 'vitest';
import { resolvePreview } from '../src/services/previewService';
import { serializeBackupToBlob, type BackupData } from '../src/services/backupService';
import type { PhotoRecord, ThumbnailRecord, PhotoThumbRecord } from '../src/types';

describe('Preview selection logic', () => {
  it('chooses photoThumbs when both photoThumbs and thumbs are available', () => {
    const photo = { id: 'p1', thumbId: 't1' };
    const photoThumbs = { p1: 'data:image/jpeg;base64,photoThumbData' };
    const groupThumbs = { t1: 'data:image/jpeg;base64,groupThumbData' };

    const result = resolvePreview(photo, photoThumbs, groupThumbs);
    expect(result.source).toBe('photo');
    expect(result.dataUrl).toBe('data:image/jpeg;base64,photoThumbData');
    expect(result.key).toBe('p1');
  });

  it('falls back to thumbs when photoThumbs is missing for the photo', () => {
    const photo = { id: 'p2', thumbId: 't1' };
    const photoThumbs = { p1: 'data:image/jpeg;base64,photoThumbData' };
    const groupThumbs = { t1: 'data:image/jpeg;base64,groupThumbData' };

    const result = resolvePreview(photo, photoThumbs, groupThumbs);
    expect(result.source).toBe('group');
    expect(result.dataUrl).toBe('data:image/jpeg;base64,groupThumbData');
    expect(result.key).toBe('t1');
  });

  it('returns none when neither photoThumbs nor groupThumbs has data', () => {
    const photo = { id: 'p3', thumbId: 't2' };
    const photoThumbs = { p1: 'data:image/jpeg;base64,photoThumbData' };
    const groupThumbs = { t1: 'data:image/jpeg;base64,groupThumbData' };

    const result = resolvePreview(photo, photoThumbs, groupThumbs);
    expect(result.source).toBe('none');
    expect(result.dataUrl).toBeUndefined();
  });

  it('handles photos without thumbId gracefully', () => {
    const photo = { id: 'p4' };
    const photoThumbs = {};
    const groupThumbs = {};

    const result = resolvePreview(photo, photoThumbs, groupThumbs);
    expect(result.source).toBe('none');
    expect(result.dataUrl).toBeUndefined();
  });
});

describe('Backup with photoThumbs roundtrip', () => {
  it('serializes and parses backup with photoThumbs roundtrip', async () => {
    const photos: PhotoRecord[] = [
      {
        id: 'photo-1',
        lat: 55.75,
        lon: 37.61,
        takenAt: '2026-06-01T12:00:00Z',
        regionId: 'RUS-2384',
        country: 'RUS',
        h3: '8611846ceffffff',
        proof: 'gold',
        thumbId: 'thumb-1',
        mediaType: 'photo'
      },
      {
        id: 'photo-2',
        lat: 55.76,
        lon: 37.62,
        takenAt: '2026-06-01T12:05:00Z',
        regionId: 'RUS-2384',
        country: 'RUS',
        h3: '8611846ceffffff',
        proof: 'gold',
        thumbId: 'thumb-1',
        mediaType: 'video'
      }
    ];

    const thumbs: ThumbnailRecord[] = [
      {
        id: 'thumb-1',
        groupKey: '2026-06-01_8611846ceffffff',
        dataUrl: 'data:image/jpeg;base64,groupThumbDataUrl',
        takenAt: '2026-06-01T12:00:00Z'
      }
    ];

    const photoThumbs: PhotoThumbRecord[] = [
      {
        id: 'photo-1',
        dataUrl: 'data:image/jpeg;base64,individualPhotoThumb1'
      }
    ];

    const backup: BackupData = {
      version: '1.7.0',
      exportedAt: '2026-10-27T10:00:00Z',
      includesThumbs: true,
      photos,
      thumbs,
      photoThumbs,
      marks: [],
      achievements: []
    };

    const blob = serializeBackupToBlob(backup);
    expect(blob).toBeInstanceOf(Blob);

    const jsonText = await blob.text();
    const restored = JSON.parse(jsonText);

    expect(restored.version).toBe('1.7.0');
    expect(restored.includesThumbs).toBe(true);
    expect(restored.photos.length).toBe(2);
    expect(restored.photos[0].mediaType).toBe('photo');
    expect(restored.photos[1].mediaType).toBe('video');
    expect(restored.thumbs).toEqual(thumbs);
    expect(restored.photoThumbs).toEqual(photoThumbs);
    expect(restored.photoThumbs[0].id).toBe('photo-1');
  });
});
