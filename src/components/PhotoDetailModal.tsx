import React from 'react';
import { Award, X } from 'lucide-react';
import type { PhotoRecord, ThumbnailRecord } from '../types';

interface PhotoDetailModalProps {
  photo?: PhotoRecord;
  thumb?: ThumbnailRecord;
  onClose: () => void;
}

export const PhotoDetailModal: React.FC<PhotoDetailModalProps> = ({
  photo,
  thumb,
  onClose
}) => {
  if (!photo && !thumb) return null;

  const proofLabels = {
    gold: 'Золотое доказательство (GPS в EXIF/видео)',
    silver: 'Серебряное доказательство (подтверждено нейросетью)',
    bronze: 'Бронзовая ручная отметка'
  };

  const takenDate = photo?.takenAt || thumb?.takenAt;
  const proof = photo?.proof || 'gold';

  return (
    <div className="photo-modal-backdrop" onClick={onClose}>
      <div className="photo-modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-top">
          <span className="modal-title">Детали снимка</span>
          <button className="close-btn" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>

        {thumb?.dataUrl && (
          <div className="preview-container">
            <img src={thumb.dataUrl} alt="Фотоснимок" />
          </div>
        )}

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

          {photo && (
            <>
              <div className="info-item">
                <span className="info-label">Координаты:</span>
                <span className="info-value">{photo.lat.toFixed(5)}, {photo.lon.toFixed(5)}</span>
              </div>

              {photo.alt !== undefined && (
                <div className="info-item">
                  <span className="info-label">Высота над уровнем моря:</span>
                  <span className="info-value">{photo.alt} м</span>
                </div>
              )}

              <div className="info-item">
                <span className="info-label">H3 ячейка (res 6):</span>
                <span className="info-value code-font">{photo.h3}</span>
              </div>
            </>
          )}
        </div>

        <button className="done-btn" onClick={onClose}>Закрыть</button>
      </div>

      <style>{`
        .photo-modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 50;
          padding: 16px;
          backdrop-filter: blur(4px);
        }

        .photo-modal-card {
          width: 100%;
          max-width: 440px;
          background: var(--bg-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
        }

        .modal-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .modal-title {
          font-weight: 700;
          font-size: 16px;
          color: var(--text);
        }

        .close-btn {
          font-size: 16px;
          color: var(--muted);
          padding: 4px;
        }

        .preview-container {
          width: 100%;
          max-height: 260px;
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
          max-height: 260px;
          object-fit: contain;
        }

        .info-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          font-size: 13px;
        }

        .info-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
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
          font-size: 12px;
        }

        .code-font {
          font-family: monospace;
          background: var(--bg-3);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 11px;
        }

        .done-btn {
          padding: 10px;
          background: var(--bg-3);
          border: 1px solid var(--border);
          color: var(--text);
          border-radius: var(--radius-sm);
          font-weight: 600;
          text-align: center;
        }

        .done-btn:hover {
          background: var(--border);
        }
      `}</style>
    </div>
  );
};
