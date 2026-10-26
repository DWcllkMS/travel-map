import React, { useEffect, useMemo, useState } from 'react';
import { X, ZoomIn, ImageOff } from 'lucide-react';
import { db } from '../services/db';
import { globalGeoIndex } from '../services/geoIndex';
import { pluralRu } from '../services/timelineService';
import type { PhotoRecord, ThumbnailRecord } from '../types';

export interface PhotoClusterSelection {
  photos: PhotoRecord[];
  canZoom: boolean;
}

interface PhotoClusterSheetProps {
  selection: PhotoClusterSelection | null;
  onClose: () => void;
  onZoomIn: () => void;
  onSelectPhoto: (photo: PhotoRecord, thumb?: ThumbnailRecord) => void;
}

interface PhotoGroup {
  key: string;
  photo: PhotoRecord;
  count: number;
  thumbId?: string;
}

const formatDay = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).replace(' г.', '');
};

export const PhotoClusterSheet: React.FC<PhotoClusterSheetProps> = ({ selection, onClose, onZoomIn, onSelectPhoto }) => {
  const [thumbs, setThumbs] = useState<Record<string, ThumbnailRecord>>({});

  const groups = useMemo<PhotoGroup[]>(() => {
    if (!selection) return [];
    const map = new Map<string, PhotoGroup>();
    const sorted = [...selection.photos].sort((a, b) => b.takenAt.localeCompare(a.takenAt));
    for (const p of sorted) {
      const key = p.thumbId || `${p.takenAt.slice(0, 10)}|${p.districtId || p.regionId}`;
      const g = map.get(key);
      if (g) g.count++;
      else map.set(key, { key, photo: p, count: 1, thumbId: p.thumbId });
    }
    return [...map.values()];
  }, [selection]);

  useEffect(() => {
    let cancelled = false;
    const ids = groups.map(g => g.thumbId).filter((x): x is string => !!x);
    if (ids.length === 0) {
      setThumbs({});
      return;
    }
    db.thumbs.bulkGet(ids).then(list => {
      if (cancelled) return;
      const next: Record<string, ThumbnailRecord> = {};
      for (const t of list) if (t) next[t.id] = t;
      setThumbs(next);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [groups]);

  useEffect(() => {
    if (!selection) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selection, onClose]);

  if (!selection) return null;

  const total = selection.photos.length;
  const dates = selection.photos.map(p => p.takenAt).sort();
  const first = formatDay(dates[0]);
  const last = formatDay(dates[dates.length - 1]);
  const regionIds = [...new Set(selection.photos.map(p => p.regionId))];
  const regionNames = regionIds.slice(0, 2).map(id => globalGeoIndex.getRegionById(id)?.name || id);
  const placeLine = regionNames.join(', ') + (regionIds.length > 2 ? ` и ещё ${regionIds.length - 2}` : '');

  return (
    <div className="pcs-backdrop" onClick={onClose}>
      <div className="pcs-card" onClick={e => e.stopPropagation()} role="dialog" aria-label="Фото в этом месте">
        <div className="pcs-handle" />
        <div className="pcs-header">
          <div className="pcs-titles">
            <h2 className="pcs-title">{pluralRu(total, 'фото', 'фото', 'фото')}</h2>
            <p className="pcs-subtitle">
              {placeLine}
              {first && <> · {first === last ? first : `${first} — ${last}`}</>}
            </p>
          </div>
          <div className="pcs-header-actions">
            {selection.canZoom && (
              <button type="button" className="pcs-btn" onClick={onZoomIn}>
                <ZoomIn size={16} />
                <span>Приблизить</span>
              </button>
            )}
            <button type="button" className="pcs-icon-btn" onClick={onClose} aria-label="Закрыть">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="pcs-scroll custom-scrollbar">
          <div className="pcs-grid">
          {groups.map(g => {
            const t = g.thumbId ? thumbs[g.thumbId] : undefined;
            return (
              <button
                type="button"
                key={g.key}
                className="pcs-item"
                onClick={() => onSelectPhoto(g.photo, t)}
              >
                {t ? (
                  <img src={t.dataUrl} alt="" loading="lazy" />
                ) : (
                  <span className="pcs-noimg"><ImageOff size={18} /></span>
                )}
                {g.count > 1 && <span className="pcs-count">{g.count}</span>}
                <span className="pcs-date">{formatDay(g.photo.takenAt)}</span>
              </button>
            );
          })}
          </div>
        </div>
      </div>

      <style>{`
        .pcs-backdrop {
          position: fixed;
          inset: 0;
          background: color-mix(in srgb, var(--bg) 45%, transparent);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          z-index: 30;
        }

        .pcs-card {
          width: 100%;
          max-width: 40rem;
          max-height: min(75vh, 46rem);
          background: var(--bg-2);
          border: 1px solid var(--border);
          border-bottom: none;
          border-radius: var(--radius-lg) var(--radius-lg) 0 0;
          padding: 0.75rem 1rem calc(1rem + env(safe-area-inset-bottom, 0px));
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          box-shadow: 0 -8px 32px color-mix(in srgb, var(--bg) 70%, transparent);
          animation: pcsUp 0.22s cubic-bezier(0.2, 0, 0, 1);
          min-width: 0;
        }

        @keyframes pcsUp {
          from { transform: translateY(1.5rem); opacity: 0; }
          to { transform: none; opacity: 1; }
        }

        .pcs-handle {
          width: 2.25rem;
          height: 4px;
          border-radius: 999px;
          background: var(--border);
          align-self: center;
        }

        .pcs-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.75rem;
          min-width: 0;
        }

        .pcs-titles {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
          min-width: 0;
        }

        .pcs-title {
          font-size: 1.125rem;
          font-weight: 700;
          line-height: 1.25;
          color: var(--text);
        }

        .pcs-subtitle {
          font-size: 0.8125rem;
          color: var(--muted);
          overflow-wrap: anywhere;
        }

        .pcs-header-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-shrink: 0;
        }

        .pcs-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          height: 2.25rem;
          padding: 0 0.75rem;
          border-radius: var(--radius-sm);
          background: var(--bg-3);
          border: 1px solid var(--border);
          color: var(--text);
          font-size: 0.8125rem;
          font-weight: 600;
          white-space: nowrap;
        }

        .pcs-btn:hover {
          border-color: var(--muted);
        }

        .pcs-icon-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 2.25rem;
          height: 2.25rem;
          border-radius: var(--radius-sm);
          color: var(--muted);
        }

        .pcs-icon-btn:hover {
          color: var(--text);
          background: var(--bg-3);
        }

        .pcs-scroll {
          flex: 1 1 auto;
          min-height: 0;
          overflow-y: auto;
          overscroll-behavior: contain;
        }

        .pcs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(min(100%, 6.25rem), 1fr));
          gap: 0.375rem;
        }

        .pcs-item {
          position: relative;
          display: block;
          width: 100%;
          aspect-ratio: 1;
          border-radius: var(--radius-sm);
          overflow: hidden;
          background: var(--bg-3);
          border: 1px solid var(--border);
          padding: 0;
        }

        .pcs-item img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .pcs-noimg {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--muted);
        }

        .pcs-count {
          position: absolute;
          top: 0.25rem;
          right: 0.25rem;
          min-width: 1.25rem;
          height: 1.25rem;
          padding: 0 0.3rem;
          border-radius: 999px;
          background: var(--accent);
          color: var(--on-accent);
          font-size: 0.6875rem;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .pcs-date {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          padding: 0.875rem 0.375rem 0.25rem;
          background: linear-gradient(transparent, var(--scrim));
          color: var(--on-scrim);
          font-size: 0.6875rem;
          font-weight: 500;
          text-align: left;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        @media (min-width: 768px) {
          .pcs-backdrop {
            align-items: center;
            padding: 1.5rem;
          }

          .pcs-card {
            border-bottom: 1px solid var(--border);
            border-radius: var(--radius-lg);
          }

          .pcs-handle {
            display: none;
          }
        }
      `}</style>
    </div>
  );
};
