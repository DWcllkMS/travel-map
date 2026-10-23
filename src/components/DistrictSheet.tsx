import React from 'react';
import { Award, X, Star, Check, Plus, Home } from 'lucide-react';
import type { GeoDistrict, GeoRegion, ThumbnailRecord, ProofLevel } from '../types';

export interface SelectedEntity {
  district?: GeoDistrict;
  region?: GeoRegion;
  country?: string;
  isVisited: boolean;
  proofLevel?: ProofLevel;
  isWishlist: boolean;
  isHome: boolean;
  districtProgress?: { visited: number; total: number };
  thumbnails: ThumbnailRecord[];
}

interface DistrictSheetProps {
  entity: SelectedEntity | null;
  onClose: () => void;
  onToggleWishlist: () => void;
  onToggleManualVisit: () => void;
  onSetHomeRegion: () => void;
  onSelectPhotoThumb?: (thumb: ThumbnailRecord) => void;
}

export const DistrictSheet: React.FC<DistrictSheetProps> = ({
  entity,
  onClose,
  onToggleWishlist,
  onToggleManualVisit,
  onSetHomeRegion,
  onSelectPhotoThumb
}) => {
  if (!entity) return null;

  const title = entity.district ? entity.district.name : (entity.region ? entity.region.name : 'Неизвестное место');
  const parentSubtitle = entity.district
    ? `${entity.region ? entity.region.name : ''}, ${entity.district.country === 'RUS' ? 'Россия' : entity.district.country}`
    : (entity.region ? (entity.region.countryName || entity.region.country) : '');

  const rarity = entity.district ? entity.district.rarity : (entity.region ? entity.region.rarity : 1);
  const area = entity.district ? entity.district.area : (entity.region ? entity.region.area : 0);

  const rarityLabels: Record<number, { text: string; color: string }> = {
    1: { text: 'Обычный', color: 'var(--muted)' },
    2: { text: 'Редкий', color: 'var(--text)' },
    3: { text: 'Эпический', color: 'var(--accent-2)' },
    4: { text: 'Легендарный', color: 'var(--accent)' }
  };

  const proofTitleMap: Record<ProofLevel, string> = {
    gold: 'Золото (EXIF)',
    silver: 'Серебро (Нейросеть)',
    bronze: 'Бронза (Вручную)'
  };

  const proofLevel = entity.proofLevel || 'bronze';

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet-card" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />

        <div className="sheet-header">
          <div className="sheet-titles">
            <h2 className="sheet-title">{title}</h2>
            {parentSubtitle && <p className="sheet-subtitle">{parentSubtitle}</p>}
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>

        <div className="badges-row">
          <span className="badge rarity-badge" style={{ borderColor: rarityLabels[rarity].color }}>
            {rarityLabels[rarity].text}
          </span>

          {entity.isVisited && (
            <span className={`badge proof-badge proof-${proofLevel}`}>
              <Award size={14} className="proof-icon" />
              <span>{proofTitleMap[proofLevel]}</span>
            </span>
          )}

          {entity.isWishlist && (
            <span className="badge wishlist-badge">В вишлисте</span>
          )}

          {entity.isHome && (
            <span className="badge home-badge">Домашний регион</span>
          )}

          {area > 0 && (
            <span className="badge area-badge">{area.toLocaleString('ru-RU')} км²</span>
          )}
        </div>

        {entity.districtProgress && entity.districtProgress.total > 0 && (
          <div className="progress-section">
            <div className="progress-label">
              <span>Исследовано районов</span>
              <span className="progress-count">
                {entity.districtProgress.visited} из {entity.districtProgress.total}
              </span>
            </div>
            <div className="progress-track">
              <div
                className="progress-bar-fill"
                style={{
                  width: `${Math.round((entity.districtProgress.visited / entity.districtProgress.total) * 100)}%`
                }}
              />
            </div>
          </div>
        )}

        {entity.thumbnails.length > 0 && (
          <div className="gallery-section">
            <h4 className="section-heading">Фотографии из этой локации</h4>
            <div className="gallery-scroll custom-scrollbar">
              {entity.thumbnails.map(thumb => (
                <div
                  key={thumb.id}
                  className="gallery-item"
                  onClick={() => onSelectPhotoThumb && onSelectPhotoThumb(thumb)}
                >
                  <img src={thumb.dataUrl} alt="Фото" loading="lazy" />
                  {thumb.takenAt && (
                    <span className="gallery-date">{thumb.takenAt.slice(0, 10)}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="actions-row">
          <button
            className={`action-btn ${entity.isWishlist ? 'active-accent' : ''}`}
            onClick={onToggleWishlist}
          >
            <Star size={16} fill={entity.isWishlist ? 'currentColor' : 'none'} />
            <span>{entity.isWishlist ? 'В вишлисте' : 'Хочу сюда'}</span>
          </button>

          <button
            className={`action-btn ${entity.isVisited ? 'active-accent' : ''}`}
            onClick={onToggleManualVisit}
          >
            {entity.isVisited ? <Check size={16} /> : <Plus size={16} />}
            <span>{entity.isVisited ? 'Посещено' : 'Отметить вручную'}</span>
          </button>

          {entity.region && (
            <button
              className={`action-btn ${entity.isHome ? 'active-accent' : ''}`}
              onClick={onSetHomeRegion}
            >
              <Home size={16} />
              <span>{entity.isHome ? 'Мой дом' : 'Сделать домом'}</span>
            </button>
          )}
        </div>
      </div>

      <style>{`
        .sheet-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.45);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          z-index: 30;
          backdrop-filter: blur(2px);
        }

        .sheet-card {
          width: 100%;
          max-width: 520px;
          background: var(--bg-2);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg) var(--radius-lg) 0 0;
          padding: 16px 20px 24px;
          box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.6);
          display: flex;
          flex-direction: column;
          gap: 16px;
          animation: slideUp var(--transition);
        }

        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }

        .sheet-handle {
          width: 36px;
          height: 4px;
          background: var(--border);
          border-radius: 2px;
          align-self: center;
          margin-bottom: 4px;
        }

        .sheet-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .sheet-titles {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .sheet-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--text);
          letter-spacing: -0.01em;
        }

        .sheet-subtitle {
          font-size: 13px;
          color: var(--muted);
        }

        .close-btn {
          font-size: 16px;
          color: var(--muted);
          padding: 6px;
          border-radius: var(--radius-sm);
        }

        .close-btn:hover {
          color: var(--text);
          background: var(--bg-3);
        }

        .badges-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .badge {
          font-size: 11px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 20px;
          background: var(--bg-3);
          border: 1px solid var(--border);
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }

        .proof-gold {
          background: var(--badge-gold-bg);
          color: var(--badge-gold);
          border-color: var(--badge-gold-border);
        }

        .proof-silver {
          background: var(--badge-silver-bg);
          color: var(--badge-silver);
          border-color: var(--badge-silver-border);
        }

        .proof-bronze {
          background: var(--badge-bronze-bg);
          color: var(--badge-bronze);
          border-color: var(--badge-bronze-border);
        }

        .visited-badge {
          background: rgba(229, 56, 59, 0.15);
          color: var(--accent);
          border-color: var(--accent);
        }

        .wishlist-badge {
          background: var(--bg-3);
          color: var(--text);
          border-color: var(--text);
        }

        .home-badge {
          background: var(--bg-3);
          color: var(--text);
          border-color: var(--accent-2);
        }

        .progress-section {
          background: var(--bg-3);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 10px 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .progress-label {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: var(--muted);
        }

        .progress-count {
          font-weight: 600;
          color: var(--text);
        }

        .progress-track {
          height: 6px;
          background: var(--bg);
          border-radius: 3px;
          overflow: hidden;
        }

        .progress-bar-fill {
          height: 100%;
          background: var(--accent);
          border-radius: 3px;
          transition: width var(--transition);
        }

        .gallery-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .section-heading {
          font-size: 12px;
          font-weight: 600;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .gallery-scroll {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 4px;
        }

        .gallery-item {
          width: 80px;
          height: 80px;
          border-radius: var(--radius-sm);
          overflow: hidden;
          flex-shrink: 0;
          position: relative;
          border: 1px solid var(--border);
          cursor: pointer;
        }

        .gallery-item img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .gallery-date {
          position: absolute;
          bottom: 2px;
          left: 2px;
          right: 2px;
          background: rgba(0, 0, 0, 0.7);
          color: #FFF;
          font-size: 9px;
          text-align: center;
          border-radius: 2px;
        }

        .actions-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 8px;
          margin-top: 4px;
        }

        .action-btn {
          padding: 10px 14px;
          border-radius: var(--radius-sm);
          background: var(--bg-3);
          border: 1px solid var(--border);
          color: var(--text);
          font-weight: 600;
          font-size: 12px;
          text-align: center;
          transition: background var(--transition), border-color var(--transition);
        }

        .action-btn:hover {
          background: var(--border);
        }

        .action-btn.active-accent {
          background: var(--accent);
          color: var(--text);
          border-color: var(--accent);
        }

        @media (min-width: 768px) {
          .sheet-backdrop {
            justify-content: flex-end;
            align-items: stretch;
            background: none;
            pointer-events: none;
          }
          .sheet-card {
            pointer-events: auto;
            width: 380px;
            height: 100%;
            border-radius: 0;
            border-left: 1px solid var(--border);
            border-top: none;
            overflow-y: auto;
            animation: slideRight var(--transition);
          }
          @keyframes slideRight {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
          .sheet-handle {
            display: none;
          }
        }
      `}</style>
    </div>
  );
};
