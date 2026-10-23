import { describe, it, expect } from 'vitest';
import { computeGroupKey, groupPhotosForPreviews } from '../src/services/previewGrouper';

describe('Preview Grouper', () => {
  it('computes stable group key from date and coordinates', () => {
    const key1 = computeGroupKey(43.257, 42.511, '2026-06-15T12:00:00Z');
    const key2 = computeGroupKey(43.2571, 42.5111, '2026-06-15T14:30:00Z');
    expect(key1).toBe(key2);
  });

  it('separates photos taken on different dates or distant locations', () => {
    const keyDate1 = computeGroupKey(43.257, 42.511, '2026-06-15T12:00:00Z');
    const keyDate2 = computeGroupKey(43.257, 42.511, '2026-06-16T12:00:00Z');
    expect(keyDate1).not.toBe(keyDate2);

    const keyDist = computeGroupKey(55.7558, 37.6173, '2026-06-15T12:00:00Z');
    expect(keyDate1).not.toBe(keyDist);
  });

  it('selects exactly one candidate per group from hundreds of items', () => {
    const items = [
      { id: '1', lat: 43.257, lon: 42.511, takenAt: '2026-06-15T10:00:00Z' },
      { id: '2', lat: 43.2571, lon: 42.5112, takenAt: '2026-06-15T11:00:00Z' },
      { id: '3', lat: 43.2572, lon: 42.5113, takenAt: '2026-06-15T12:00:00Z' },
      { id: '4', lat: 55.7558, lon: 37.6173, takenAt: '2026-06-15T12:00:00Z' },
      { id: '5', lat: 43.257, lon: 42.511, takenAt: '2026-06-16T10:00:00Z' }
    ];

    const groups = groupPhotosForPreviews(items);
    expect(groups.size).toBe(3);
    const selectedIds = Array.from(groups.values()).map(g => g.id);
    expect(selectedIds).toContain('1');
    expect(selectedIds).toContain('4');
    expect(selectedIds).toContain('5');
    expect(selectedIds).not.toContain('2');
  });
});
