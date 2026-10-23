import React, { useState } from 'react';
import { Award, X, MapPin, Search, Check } from 'lucide-react';
import { verifyPhotoWithClip, type ClipVerificationResult, CLIP_SIMILARITY_THRESHOLD } from '../services/clipService';
import type { GeoDistrict, GeoRegion } from '../types';

export interface UnlocatedPhotoItem {
  id: string;
  name: string;
  dataUrl?: string;
  file?: File;
  takenAt?: string;
}

interface SilverVerificationModalProps {
  photo: UnlocatedPhotoItem;
  selectedLocation: { lat: number; lon: number; district?: GeoDistrict; region?: GeoRegion } | null;
  onSelectLocationOnMap: () => void;
  onConfirmSilver: (photo: UnlocatedPhotoItem, result: ClipVerificationResult, lat: number, lon: number) => void;
  onConfirmBronzeManual: (photo: UnlocatedPhotoItem, lat: number, lon: number) => void;
  onClose: () => void;
}

export const SilverVerificationModal: React.FC<SilverVerificationModalProps> = ({
  photo,
  selectedLocation,
  onSelectLocationOnMap,
  onConfirmSilver,
  onConfirmBronzeManual,
  onClose
}) => {
  const [loading, setLoading] = useState(false);
  const [modelProgress, setModelProgress] = useState<number | null>(null);
  const [verificationResult, setVerificationResult] = useState<ClipVerificationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const startVerification = async () => {
    if (!selectedLocation || !photo.dataUrl) return;
    setLoading(true);
    setErrorMsg(null);
    setVerificationResult(null);

    try {
      const result = await verifyPhotoWithClip(
        photo.dataUrl,
        selectedLocation.lat,
        selectedLocation.lon,
        (progress) => setModelProgress(progress)
      );
      setVerificationResult(result);
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка проверки нейросетью');
    } finally {
      setLoading(false);
      setModelProgress(null);
    }
  };

  return (
    <div className="silver-modal-backdrop" onClick={onClose}>
      <div className="silver-modal-card custom-scrollbar" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-row">
            <Award size={18} color="var(--badge-silver)" />
            <h3 className="modal-title">Подтверждение места снимка (CLIP)</h3>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>

        <div className="photos-comparison-row">
          <div className="user-photo-box">
            <span className="box-title">Твоё фото</span>
            {photo.dataUrl ? (
              <img src={photo.dataUrl} alt={photo.name} className="preview-img" />
            ) : (
              <div className="placeholder">Без превью</div>
            )}
          </div>

          <div className="location-box">
            <span className="box-title">Предполагаемое место</span>
            {selectedLocation ? (
              <div className="location-info">
                <strong>{selectedLocation.district?.name || selectedLocation.region?.name || 'Выбранная точка'}</strong>
                <span>{selectedLocation.lat.toFixed(4)}, {selectedLocation.lon.toFixed(4)}</span>
                <button className="change-loc-btn" onClick={onSelectLocationOnMap}>
                  Изменить точку на карте
                </button>
              </div>
            ) : (
              <button className="pick-point-btn" onClick={onSelectLocationOnMap}>
                <MapPin size={16} />
                <span>Указать место на карте</span>
              </button>
            )}
          </div>
        </div>

        {selectedLocation && !verificationResult && (
          <div className="verify-action-box">
            <button
              className="start-verify-btn"
              disabled={loading || !photo.dataUrl}
              onClick={startVerification}
            >
              {loading ? (
                modelProgress !== null
                  ? `Загрузка нейросети (~90 МБ): ${modelProgress}%`
                  : 'Сравнение с изображениями местности...'
              ) : (
                <>
                  <Search size={16} />
                  <span>Проверить сходство с Wikimedia Commons</span>
                </>
              )}
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="error-alert">{errorMsg}</div>
        )}

        {verificationResult && (
          <div className="result-container">
            {verificationResult.isMatch ? (
              <div className="success-banner">
                <h4>
                  <Check size={18} />
                  <span>Место подтверждено! (Silver)</span>
                </h4>
                <p>
                  Сходство с фото местности: <strong>{verificationResult.score}</strong> (порог {CLIP_SIMILARITY_THRESHOLD}).
                </p>
                <button
                  className="confirm-btn gold-accent"
                  onClick={() => onConfirmSilver(photo, verificationResult, selectedLocation!.lat, selectedLocation!.lon)}
                >
                  Засчитать район как «Серебро»
                </button>
              </div>
            ) : (
              <div className="fail-banner">
                <h4>Фото не похоже на места вокруг</h4>
                <p>
                  Максимальное сходство: {verificationResult.score} (порог {CLIP_SIMILARITY_THRESHOLD}). Ты можешь отметить район вручную («Бронза»).
                </p>
                <button
                  className="confirm-btn bronze-accent"
                  onClick={() => onConfirmBronzeManual(photo, selectedLocation!.lat, selectedLocation!.lon)}
                >
                  Отметить район вручную (Бронза)
                </button>
              </div>
            )}

            {verificationResult.comparedImages.length > 0 && (
              <div className="compared-section">
                <h5>Сравнение с фото из Wikimedia Commons:</h5>
                <div className="commons-list custom-scrollbar">
                  {verificationResult.comparedImages.map((img, i) => (
                    <div key={i} className="commons-card">
                      <img src={img.thumbUrl} alt={img.title} />
                      <div className="commons-meta">
                        <span className="commons-score">Близость: {img.score}</span>
                        <span className="commons-author">{img.author}</span>
                        <span className="commons-lic">{img.license}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        .silver-modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.75);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 60;
          padding: 16px;
          backdrop-filter: blur(4px);
        }

        .silver-modal-card {
          width: 100%;
          max-width: 580px;
          max-height: 90vh;
          overflow-y: auto;
          background: var(--bg-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .modal-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--text);
        }

        .photos-comparison-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .user-photo-box, .location-box {
          background: var(--bg-3);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .box-title {
          font-size: 11px;
          font-weight: 600;
          color: var(--muted);
          text-transform: uppercase;
        }

        .preview-img {
          width: 100%;
          height: 140px;
          object-fit: cover;
          border-radius: var(--radius-sm);
        }

        .placeholder {
          height: 140px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--muted);
          font-size: 12px;
        }

        .location-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 12px;
        }

        .pick-point-btn, .change-loc-btn {
          padding: 10px;
          background: var(--bg-2);
          border: 1px dashed var(--border);
          color: var(--text);
          border-radius: var(--radius-sm);
          font-weight: 600;
          font-size: 12px;
          text-align: center;
        }

        .pick-point-btn:hover, .change-loc-btn:hover {
          border-color: var(--accent);
          color: var(--accent);
        }

        .start-verify-btn {
          width: 100%;
          padding: 12px;
          background: var(--accent);
          color: var(--text);
          border-radius: var(--radius-sm);
          font-weight: 600;
          font-size: 13px;
        }

        .start-verify-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .error-alert {
          background: rgba(229, 56, 59, 0.15);
          border: 1px solid var(--accent);
          color: var(--accent);
          padding: 10px;
          border-radius: var(--radius-sm);
          font-size: 12px;
        }

        .success-banner {
          background: rgba(229, 56, 59, 0.15);
          border: 1px solid var(--accent);
          border-radius: var(--radius-sm);
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .fail-banner {
          background: var(--bg-3);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .confirm-btn {
          padding: 10px;
          border-radius: var(--radius-sm);
          font-weight: 600;
          font-size: 13px;
          color: var(--text);
          margin-top: 4px;
        }

        .confirm-btn.gold-accent {
          background: var(--accent);
        }

        .confirm-btn.bronze-accent {
          background: var(--border);
        }

        .compared-section {
          margin-top: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .compared-section h5 {
          font-size: 12px;
          color: var(--muted);
        }

        .commons-list {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 6px;
        }

        .commons-card {
          width: 120px;
          flex-shrink: 0;
          background: var(--bg-3);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .commons-card img {
          width: 100%;
          height: 80px;
          object-fit: cover;
        }

        .commons-meta {
          padding: 6px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          font-size: 10px;
        }

        .commons-score {
          font-weight: 700;
          color: var(--accent);
        }

        .commons-author, .commons-lic {
          color: var(--muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>
    </div>
  );
};
