import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { X, ZoomIn, ArrowLeft, Image as ImageIcon, Film } from 'lucide-react';
import { db } from '../services/db';
import { globalGeoIndex } from '../services/geoIndex';
import { pluralRu } from '../services/timelineService';
import { groupPhotosByClusterKey, type PhotoClusterGroup } from '../services/previewGrouper';
import type { PhotoRecord, ThumbnailRecord } from '../types';

export interface PhotoClusterSelection {
  photos: PhotoRecord[];
  canZoom: boolean;
  center?: [number, number];
  zoom?: number;
}

interface PhotoClusterSheetProps {
  selection: PhotoClusterSelection | null;
  onClose: () => void;
  onZoomIn: () => void;
  onSelectPhoto: (photo: PhotoRecord, thumb?: ThumbnailRecord, photos?: PhotoRecord[], index?: number) => void;
}

const formatDay = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).replace(' г.', '');
};

const formatTimeOrDay = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

const BATCH_SIZE = 60;

export const PhotoClusterSheet: React.FC<PhotoClusterSheetProps> = ({
  selection,
  onClose,
  onZoomIn,
  onSelectPhoto
}) => {
  const [thumbs, setThumbs] = useState<Record<string, ThumbnailRecord>>({});
  const [photoThumbs, setPhotoThumbs] = useState<Record<string, string>>({});
  const [activeGroup, setActiveGroup] = useState<PhotoClusterGroup<PhotoRecord> | null>(null);
  const [groupThumb, setGroupThumb] = useState<ThumbnailRecord | undefined>(undefined);
  const [visibleCount, setVisibleCount] = useState<number>(BATCH_SIZE);
  const [hasMissingThumbs, setHasMissingThumbs] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const groups = useMemo<PhotoClusterGroup<PhotoRecord>[]>(() => {
    if (!selection) return [];
    return groupPhotosByClusterKey(selection.photos);
  }, [selection]);

  useEffect(() => {
    setActiveGroup(null);
    setVisibleCount(BATCH_SIZE);
    setPhotoThumbs({});
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
    if (!activeGroup) {
      setGroupThumb(undefined);
      setHasMissingThumbs(false);
      return;
    }

    let cancelled = false;
    setVisibleCount(Math.min(BATCH_SIZE, activeGroup.photos.length));

    if (activeGroup.thumbId) {
      db.thumbs.get(activeGroup.thumbId).then(t => {
        if (!cancelled && t) setGroupThumb(t);
      }).catch(() => {});
    } else {
      setGroupThumb(undefined);
    }

    const ids = activeGroup.photos.map(p => p.id);
    db.photoThumbs.where('id').anyOf(ids).count().then(foundCount => {
      if (!cancelled) {
        setHasMissingThumbs(foundCount < activeGroup.photos.length);
      }
    }).catch(() => {});

    return () => { cancelled = true; };
  }, [activeGroup]);

  useEffect(() => {
    if (!activeGroup) return;
    let cancelled = false;

    const visiblePhotos = activeGroup.photos.slice(0, visibleCount);
    const missingIds = visiblePhotos.map(p => p.id).filter(id => !photoThumbs[id]);

    if (missingIds.length === 0) return;

    db.photoThumbs.bulkGet(missingIds).then(records => {
      if (cancelled) return;
      const updates: Record<string, string> = {};
      for (const r of records) {
        if (r?.id && r.dataUrl) {
          updates[r.id] = r.dataUrl;
        }
      }
      if (Object.keys(updates).length > 0) {
        setPhotoThumbs(prev => ({ ...prev, ...updates }));
      }
    }).catch(() => {});

    return () => { cancelled = true; };
  }, [activeGroup, visibleCount, photoThumbs]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string; type?: string; dataUrl: string }>).detail;
      if (!detail) return;
      if (detail.type === 'photo') {
        setPhotoThumbs(prev => ({ ...prev, [detail.id]: detail.dataUrl }));
      } else {
        setThumbs(prev => {
          if (!prev[detail.id]) return prev;
          return { ...prev, [detail.id]: { ...prev[detail.id], dataUrl: detail.dataUrl } };
        });
        setGroupThumb(prev => prev && prev.id === detail.id ? { ...prev, dataUrl: detail.dataUrl } : prev);
      }
    };
    window.addEventListener('thumb-updated', handler);
    return () => window.removeEventListener('thumb-updated', handler);
  }, []);

  useEffect(() => {
    if (!selection) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeGroup) setActiveGroup(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selection, activeGroup, onClose]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !activeGroup) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 300) {
      if (visibleCount < activeGroup.photos.length) {
        setVisibleCount(prev => Math.min(prev + BATCH_SIZE, activeGroup.photos.length));
      }
    }
  }, [activeGroup, visibleCount]);

  if (!selection) return null;

  const total = selection.photos.length;
  const dates = selection.photos.map(p => p.takenAt).sort();
  const first = formatDay(dates[0]);
  const last = formatDay(dates[dates.length - 1]);
  const regionIds = [...new Set(selection.photos.map(p => p.regionId))];
  const regionNames = regionIds.slice(0, 2).map(id => globalGeoIndex.getRegionById(id)?.name || id);
  const placeLine = regionNames.join(', ') + (regionIds.length > 2 ? ` и ещё ${regionIds.length - 2}` : '');

  const renderGroupTile = (g: PhotoClusterGroup<PhotoRecord>) => {
    const t = g.thumbId ? thumbs[g.thumbId] : undefined;
    const pThumb = photoThumbs[g.primary.id];
    const imgUrl = t?.dataUrl || pThumb;
    const isVideo = g.primary.mediaType === 'video';

    return (
      <button
        type="button"
        key={g.key}
        className="pcs-item"
        onClick={() => {
          if (g.count > 1) {
            setActiveGroup(g);
          } else {
            onSelectPhoto(g.primary, t, g.photos, 0);
          }
        }}
      >
        {imgUrl ? (
          <img src={imgUrl} alt="" loading="lazy" />
        ) : isVideo ? (
          <span className="pcs-placeholder">
            <Film size={20} />
            <span className="pcs-tag">Видео</span>
          </span>
        ) : (
          <span className="pcs-placeholder">
            <ImageIcon size={20} />
          </span>
        )}
        {g.count > 1 && <span className="pcs-count">{g.count}</span>}
        <span className="pcs-date">{formatDay(g.primary.takenAt)}</span>
      </button>
    );
  };

  const renderActiveGroup = () => {
    if (!activeGroup) return null;
    const visiblePhotos = activeGroup.photos.slice(0, visibleCount);
    const groupPlace = globalGeoIndex.getRegionById(activeGroup.primary.regionId)?.name || activeGroup.primary.regionId;

    return (
      <>
        <div className="pcs-header">
          <div className="pcs-header-left">
            <button
              type="button"
              className="pcs-btn pcs-back-btn"
              onClick={() => setActiveGroup(null)}
              aria-label="Назад к группам"
            >
              <ArrowLeft size={16} />
              <span>Назад</span>
            </button>
            <div className="pcs-titles">
              <h2 className="pcs-title">
                {pluralRu(activeGroup.count, 'фото', 'фото', 'фото')}
              </h2>
              <p className="pcs-subtitle">
                {formatDay(activeGroup.primary.takenAt)} · {groupPlace}
              </p>
            </div>
          </div>
          <button type="button" className="pcs-icon-btn" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>

        {hasMissingThumbs && (
          <div className="pcs-hint">
            Превью есть не у всех снимков — загрузите эти фото ещё раз, дубли не появятся
          </div>
        )}

        <div className="pcs-scroll custom-scrollbar" ref={scrollRef} onScroll={handleScroll}>
          <div className="pcs-grid">
            {visiblePhotos.map((photo, idx) => {
              const url = photoThumbs[photo.id];
              const isVideo = photo.mediaType === 'video';

              return (
                <button
                  type="button"
                  key={photo.id}
                  className="pcs-item"
                  onClick={() => onSelectPhoto(photo, groupThumb, activeGroup.photos, idx)}
                >
                  {url ? (
                    <img src={url} alt="" loading="lazy" />
                  ) : isVideo ? (
                    <span className="pcs-placeholder">
                      <Film size={20} />
                      <span className="pcs-tag">Видео</span>
                    </span>
                  ) : (
                    <span className="pcs-placeholder">
                      <ImageIcon size={20} />
                    </span>
                  )}
                  <span className="pcs-date">{formatTimeOrDay(photo.takenAt)}</span>
                </button>
              );
            })}
          </div>

          {visibleCount < activeGroup.photos.length && (
            <div className="pcs-more-wrap">
              <button
                type="button"
                className="pcs-btn"
                onClick={() => setVisibleCount(c => Math.min(c + BATCH_SIZE, activeGroup.photos.length))}
              >
                Показать ещё
              </button>
            </div>
          )}
        </div>
      </>
    );
  };

  return (
    <div className="pcs-backdrop" onClick={onClose}>
      <div className="pcs-card" onClick={e => e.stopPropagation()} role="dialog" aria-label="Фото в этом месте">
        <div className="pcs-handle" />

        {!activeGroup ? (
          <>
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
                {groups.map(renderGroupTile)}
              </div>
            </div>
          </>
        ) : (
          renderActiveGroup()
        )}
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
          overflow: hidden;
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
          flex-shrink: 0;
        }

        .pcs-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.75rem;
          min-width: 0;
          flex-shrink: 0;
        }

        .pcs-header-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          min-width: 0;
          flex: 1;
        }

        .pcs-back-btn {
          padding: 0 0.625rem;
          flex-shrink: 0;
        }

        .pcs-titles {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
          min-width: 0;
          flex: 1;
        }

        .pcs-title {
          font-size: 1.125rem;
          font-weight: 700;
          line-height: 1.25;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .pcs-subtitle {
          font-size: 0.8125rem;
          color: var(--muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .pcs-hint {
          background: var(--bg-3);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 0.5rem 0.75rem;
          font-size: 0.75rem;
          color: var(--muted);
          line-height: 1.4;
          flex-shrink: 0;
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
          cursor: pointer;
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
          background: transparent;
          border: none;
          cursor: pointer;
          flex-shrink: 0;
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
          cursor: pointer;
        }

        .pcs-item img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .pcs-placeholder {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.25rem;
          color: var(--muted);
        }

        .pcs-tag {
          font-size: 0.625rem;
          font-weight: 600;
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

        .pcs-more-wrap {
          display: flex;
          justify-content: center;
          padding: 0.75rem 0;
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
