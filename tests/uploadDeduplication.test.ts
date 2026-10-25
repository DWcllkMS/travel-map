import { describe, it, expect } from 'vitest';
import type { PhotoRecord, ThumbnailRecord } from '../src/types';

describe('Upload deduplication and thumbnail update logic', () => {
  it('identifies photo duplicate by takenAt and coordinates with ~6 decimals', () => {
    const existing: PhotoRecord = {
      id: 'photo-1',
      lat: 55.751234,
      lon: 37.618765,
      takenAt: '2025-05-10T12:00:00Z',
      regionId: 'RUS-MOW',
      districtId: 'd-1',
      country: 'RUS',
      h3: '861181b2fffffff',
      proof: 'gold',
      thumbId: 'thumb-1'
    };

    const isDuplicate = (lat: number, lon: number, takenAt: string) => {
      return (
        existing.takenAt === takenAt &&
        Math.abs(existing.lat - lat) < 1e-5 &&
        Math.abs(existing.lon - lon) < 1e-5
      );
    };

    expect(isDuplicate(55.751234, 37.618765, '2025-05-10T12:00:00Z')).toBe(true);
    expect(isDuplicate(55.751236, 37.618763, '2025-05-10T12:00:00Z')).toBe(true);
    expect(isDuplicate(55.752234, 37.618765, '2025-05-10T12:00:00Z')).toBe(false);
    expect(isDuplicate(55.751234, 37.618765, '2025-05-10T12:00:01Z')).toBe(false);
  });

  it('updates thumbId on existing photo if match found and thumbs updated', () => {
    const existingPhotos: PhotoRecord[] = [
      {
        id: 'photo-1',
        lat: 59.93,
        lon: 30.33,
        takenAt: '2024-06-10T12:00:00Z',
        regionId: 'RUS-SPE',
        districtId: 'd-spb',
        country: 'RUS',
        h3: '861106067ffffff',
        proof: 'gold',
        thumbId: 'thumb-1'
      }
    ];

    const pendingThumbs: ThumbnailRecord[] = [];
    let updatedThumbsCount = 0;

    const newThumbUrl = 'data:image/jpeg;base64,UPDATED';
    const candidate = { lat: 59.93, lon: 30.33, takenAt: '2024-06-10T12:00:00Z' };

    const match = existingPhotos.find(
      p =>
        p.takenAt === candidate.takenAt &&
        Math.abs(p.lat - candidate.lat) < 1e-5 &&
        Math.abs(p.lon - candidate.lon) < 1e-5
    );

    if (match) {
      pendingThumbs.push({
        id: match.thumbId!,
        groupKey: 'gk-1',
        dataUrl: newThumbUrl,
        takenAt: candidate.takenAt
      });
      updatedThumbsCount++;
    }

    expect(updatedThumbsCount).toBe(1);
    expect(pendingThumbs.length).toBe(1);
    expect(pendingThumbs[0].id).toBe('thumb-1');
    expect(pendingThumbs[0].dataUrl).toBe(newThumbUrl);
  });
});
