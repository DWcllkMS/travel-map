import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Award, X, RotateCw, ChevronLeft, ChevronRight, Image as ImageIcon, Film } from 'lucide-react';
import type { PhotoRecord, ThumbnailRecord } from '../types';
import { getPhotoPreview, rotatePhotoPreview, type ResolvedPreview } from '../services/previewService';

export interface PhotoDetailModalProps {
  photo?: PhotoRecord;
  thumb?: ThumbnailRecord;
  photos?: PhotoRecord[];
  initialIndex?: number;
  onClose: () => void;
}

export const PhotoDetailModal: React.FC<PhotoDetailModalProps> = ({
  photo,
  thumb,
  photos,
  initialIndex = 0,
  onClose
}) => {
  const photosList = photos && photos.length > 0 ? photos : (photo ? [photo] : []);
  const [currentIndex, setCurrentIndex] = useState<number>(() => {
    if (initialIndex >= 0 && initialIndex < photosList.length) return initialIndex;
    if (photo) {
      const idx = photosList.findIndex(p => p.id === photo.id);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  });

  const [preview, setPreview] = useState<ResolvedPreview>({
    dataUrl: thumb?.dataUrl,
    source: thumb?.dataUrl ? 'group' : 'none',
    key: thumb?.id
  });
  const [rotating, setRotating] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const currentPhoto = photosList[currentIndex] || photo;

  useEffect(() => {
    if (initialIndex >= 0 && initialIndex < photosList.length) {
      setCurrentIndex(initialIndex);
    } else if (photo) {
      const idx = photosList.findIndex(p => p.id === photo.id);
      if (idx >= 0) setCurrentIndex(idx);
    }
  }, [photo?.id, initialIndex, photosList.length]);

  useEffect(() => {
    if (!currentPhoto) return;
    let cancelled = false;

    getPhotoPreview(currentPhoto).then(res => {
      if (cancelled) return;
      if (res.dataUrl) {
        setPreview(res);
      } else if (thumb?.dataUrl && (!currentPhoto.thumbId || currentPhoto.thumbId === thumb.id)) {
        setPreview({
          dataUrl: thumb.dataUrl,
          source: 'group',
          key: thumb.id
        });
      } else {
        setPreview({ dataUrl: undefined, source: 'none' });
      }
    }).catch(() => {
      if (!cancelled) setPreview({ dataUrl: undefined, source: 'none' });
    });

    return () => { cancelled = true; };
  }, [currentPhoto?.id, currentPhoto?.thumbId, thumb]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string; type?: string; dataUrl: string }>).detail;
      if (detail?.id && preview?.key && detail.id === preview.key) {
        setPreview(prev => ({ ...prev, dataUrl: detail.dataUrl }));
      }
    };
    window.addEventListener('thumb-updated', handler);
    return () => window.removeEventListener('thumb-updated', handler);
  }, [preview?.key]);

  const hasMultiple = photosList.length > 1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < photosList.length - 1;

  const goPrev = useCallback(() => {
    if (hasPrev) setCurrentIndex(i => i - 1);
  }, [hasPrev]);

  const goNext = useCallback(() => {
    if (hasNext) setCurrentIndex(i => i + 1);
  }, [hasNext]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
      else return;
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose, goPrev, goNext]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (diff > 45) goPrev();
    else if (diff < -45) goNext();
  };

  const handleRotate = async () => {
    if (!preview.dataUrl || rotating) return;
    setRotating(true);
    try {
      const res = await rotatePhotoPreview(preview);
      if (res) {
        setPreview(prev => ({ ...prev, dataUrl: res.dataUrl, source: res.source, key: res.key }));
      }
    } catch {} finally {
      setRotating(false);
    }
  };

  if (!currentPhoto && !thumb) return null;

  const proofLabels = {
    gold: 'Золотое доказательство (GPS в EXIF/видео)',
    silver: 'Серебряное доказательство (подтверждено нейросетью)',
    bronze: 'Бронзовая ручная отметка'
  };

  const proof = currentPhoto?.proof || 'gold';
  const takenDate = currentPhoto?.takenAt || thumb?.takenAt;
  const isVideo = currentPhoto?.mediaType === 'video';

  return (
    <div className="photo-modal-backdrop" onClick={onClose}>
      <div
        className="photo-modal-card"
        onClick={e => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="modal-top">
          <div className="modal-title-group">
            <span className="modal-title">Детали снимка</span>
            {hasMultiple && (
              <span className="modal-counter">{currentIndex + 1} / {photosList.length}</span>
            )}
          </div>
          <div className="modal-top-actions">
            {preview.dataUrl && (
              <button
                type="button"
                className="rotate-btn"
                onClick={handleRotate}
                title="Повернуть на 90°"
                aria-label="Повернуть"
                disabled={rotating}
              >
                <RotateCw size={15} />
                <span>Повернуть</span>
              </button>
            )}
            <button className="close-btn" onClick={onClose} aria-label="Закрыть">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="preview-area">
          {hasMultiple && (
            <button
              type="button"
              className="nav-btn nav-btn-left"
              onClick={goPrev}
              disabled={!hasPrev}
              aria-label="Предыдущее фото"
            >
              <ChevronLeft size={20} />
            </button>
          )}

          <div className="preview-container">
            {preview.dataUrl ? (
              <>
                <img src={preview.dataUrl} alt="Фотоснимок" />
                {hasMultiple && preview.source === 'group' && (
                  <span className="preview-note">Общее превью серии</span>
                )}
              </>
            ) : isVideo ? (
              <div className="preview-placeholder">
                <Film size={40} className="placeholder-icon" />
                <span className="placeholder-text">Видео</span>
              </div>
            ) : (
              <div className="preview-placeholder">
                <ImageIcon size={40} className="placeholder-icon" />
                <span className="placeholder-text">
                  {takenDate ? new Date(takenDate).toLocaleDateString('ru-RU') : 'Нет превью'}
                </span>
              </div>
            )}
          </div>

          {hasMultiple && (
            <button
              type="button"
              className="nav-btn nav-btn-right"
              onClick={goNext}
              disabled={!hasNext}
              aria-label="Следующее фото"
            >
              <ChevronRight size={20} />
            </button>
          )}
        </div>

        <div className="info-list">
          <div className="info-item">
            <span className="info-label">Статус:</span>
            <span className={`proof-tag proof-${proof}`}>
              <Award size={14} />
              <span>{proofLabels[proof]}</span>
            </span>
          </div>

          {takenDate && (
            <div className="info-item">
              <span className="info-label">Дата съёмки:</span>
              <span className="info-value">{new Date(takenDate).toLocaleString('ru-RU')}</span>
            </div>
          )}

          {currentPhoto && (
            <>
              <div className="info-item">
                <span className="info-label">Координаты:</span>
                <span className="info-value">{currentPhoto.lat.toFixed(5)}, {currentPhoto.lon.toFixed(5)}</span>
              </div>

              {currentPhoto.alt !== undefined && (
                <div className="info-item">
                  <span className="info-label">Высота над уровнем моря:</span>
                  <span className="info-value">{currentPhoto.alt} м</span>
                </div>
              )}

              <div className="info-item">
                <span className="info-label">H3 ячейка (res 6):</span>
                <span className="info-value code-font">{currentPhoto.h3}</span>
              </div>
            </>
          )}
        </div>

        <button className="done-btn" onClick={onClose}>Закрыть</button>
      </div>

      <style>{`
        .photo-modal-backdrop {
          position: fixed;
          inset: 0;
          background: color-mix(in srgb, var(--bg) 70%, transparent);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 50;
          padding: 1rem;
          backdrop-filter: blur(4px);
        }

        .photo-modal-card {
          width: 100%;
          max-width: 28rem;
          background: var(--bg-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          box-shadow: 0 1rem 2.5rem color-mix(in srgb, var(--bg) 80%, transparent);
          user-select: none;
        }

        .modal-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.75rem;
        }

        .modal-title-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          min-width: 0;
        }

        .modal-title {
          font-weight: 700;
          font-size: 1rem;
          color: var(--text);
          white-space: nowrap;
        }

        .modal-counter {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--muted);
          background: var(--bg-3);
          padding: 0.125rem 0.5rem;
          border-radius: 999px;
          border: 1px solid var(--border);
          white-space: nowrap;
        }

        .modal-top-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-shrink: 0;
        }

        .rotate-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          background: var(--bg-3);
          border: 1px solid var(--border);
          color: var(--text);
          padding: 0.375rem 0.75rem;
          border-radius: var(--radius-sm);
          font-size: 0.8125rem;
          cursor: pointer;
          transition: background var(--transition);
        }

        .rotate-btn:hover:not(:disabled) {
          background: var(--border);
        }

        .rotate-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .close-btn {
          font-size: 1rem;
          color: var(--muted);
          background: transparent;
          border: none;
          padding: 0.25rem;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-sm);
        }

        .close-btn:hover {
          color: var(--text);
          background: var(--bg-3);
        }

        .preview-area {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
        }

        .nav-btn {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 2.25rem;
          height: 2.25rem;
          border-radius: 50%;
          background: color-mix(in srgb, var(--bg-2) 85%, transparent);
          border: 1px solid var(--border);
          color: var(--text);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 2;
          box-shadow: 0 4px 12px color-mix(in srgb, var(--bg) 60%, transparent);
          transition: background var(--transition), opacity var(--transition);
        }

        .nav-btn:hover:not(:disabled) {
          background: var(--bg-3);
        }

        .nav-btn:disabled {
          opacity: 0.25;
          cursor: not-allowed;
        }

        .nav-btn-left {
          left: 0.5rem;
        }

        .nav-btn-right {
          right: 0.5rem;
        }

        .preview-note {
          position: absolute;
          left: 0.5rem;
          bottom: 0.5rem;
          padding: 0.125rem 0.5rem;
          border-radius: 999px;
          background: var(--scrim);
          color: var(--on-scrim);
          font-size: 0.6875rem;
          font-weight: 500;
        }

        .preview-container {
          position: relative;
          width: 100%;
          height: 16.25rem;
          border-radius: var(--radius-sm);
          overflow: hidden;
          background: var(--bg);
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .preview-container img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }

        .preview-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          color: var(--muted);
        }

        .placeholder-icon {
          color: var(--muted);
        }

        .placeholder-text {
          font-size: 0.8125rem;
          font-weight: 500;
        }

        .info-list {
          display: flex;
          flex-direction: column;
          gap: 0.625rem;
          font-size: 0.8125rem;
        }

        .info-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.5rem;
        }

        .info-label {
          color: var(--muted);
        }

        .info-value {
          color: var(--text);
          font-weight: 500;
        }

        .proof-tag {
          color: var(--accent);
          font-weight: 600;
          font-size: 0.75rem;
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
        }

        .code-font {
          font-family: monospace;
          background: var(--bg-3);
          padding: 0.125rem 0.375rem;
          border-radius: 4px;
          font-size: 0.6875rem;
        }

        .done-btn {
          padding: 0.625rem;
          background: var(--bg-3);
          border: 1px solid var(--border);
          color: var(--text);
          border-radius: var(--radius-sm);
          font-weight: 600;
          text-align: center;
          cursor: pointer;
        }

        .done-btn:hover {
          background: var(--border);
        }
      `}</style>
    </div>
  );
};
