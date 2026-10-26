import { describe, it, expect } from 'vitest';
import { resolveSightVisits } from '../src/services/sightsIndex';
import type { MarkRecord } from '../src/types';

const nearby = {
  visitedSightIds: new Set(['A', 'B', 'C']),
  visitedSightFirstDates: new Map([
    ['A', '2025-05-01T10:00:00Z'],
    ['B', '2025-06-01T10:00:00Z'],
    ['C', '2025-07-01T10:00:00Z']
  ])
};

const mark = (targetId: string, markType: MarkRecord['markType']): MarkRecord => ({
  id: `${markType}-${targetId}`,
  targetId,
  targetType: 'sight',
  markType,
  createdAt: '2026-01-10T10:00:00Z',
  country: 'RUS'
});

describe('resolveSightVisits', () => {
  it('photos nearby only make candidates', () => {
    const r = resolveSightVisits(nearby, []);
    expect([...r.visitedSightIds]).toEqual([]);
    expect([...r.candidateSightIds].sort()).toEqual(['A', 'B', 'C']);
  });

  it('confirmed sight counts with photo date, rejected disappears', () => {
    const r = resolveSightVisits(nearby, [mark('A', 'sight_confirmed'), mark('B', 'sight_rejected')]);
    expect([...r.visitedSightIds]).toEqual(['A']);
    expect(r.visitedSightFirstDates.get('A')).toBe('2025-05-01T10:00:00Z');
    expect([...r.candidateSightIds]).toEqual(['C']);
  });

  it('manual mark counts without photos and respects includeManual', () => {
    const marks = [mark('Z', 'visited_manual'), mark('C', 'visited_manual')];
    const r = resolveSightVisits(nearby, marks);
    expect(r.visitedSightIds.has('Z')).toBe(true);
    expect(r.visitedSightIds.has('C')).toBe(true);
    expect(r.candidateSightIds.has('C')).toBe(false);
    expect(r.visitedSightFirstDates.has('Z')).toBe(false);
    const off = resolveSightVisits(nearby, marks, false);
    expect(off.visitedSightIds.size).toBe(0);
  });

  it('ignores marks of other target types', () => {
    const r = resolveSightVisits(nearby, [{ ...mark('A', 'visited_manual'), targetType: 'region' }]);
    expect(r.visitedSightIds.size).toBe(0);
  });
});
