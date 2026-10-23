import React, { useEffect, useState } from 'react';
import { X, Award, Bookmark, ExternalLink, Globe } from 'lucide-react';
import type { GeoSight, SightKind } from '../types';

const RASTER_EXT = /\.(jpe?g|png|gif|webp)$/i;

function commonsImageUrls(fileName: string): string[] {
  const encoded = encodeURIComponent(fileName.replace(/ /g, '_'));
  const urls = [`https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}?width=480`];
  if (!RASTER_EXT.test(fileName)) {
    urls.push(`https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}?width=480&format=png`);
  }
  urls.push(`https://commons.m.wikimedia.org/wiki/Special:FilePath/${encoded}?width=480`);
  return urls;
}

export interface SelectedSightEntity {
  sight: GeoSight;
  regionName?: string;
  countryName?: string;
  isVisited: boolean;
  firstVisitedDate?: string;
  isWishlist: boolean;
  distanceBonus?: { km: number; multiplier: number };
}

interface SightSheetProps {
  entity: SelectedSightEntity | null;
  onClose: () => void;
  onToggleWishlist: () => void;
}

const KIND_NAMES: Record<SightKind, string> = {
  museum: 'Музей',
  religious: 'Храм / монастырь',
  fortress: 'Крепость / кремль',
  palace: 'Дворец / усадьба',
  monument: 'Памятник / монумент',
  nature: 'Природный памятник',
  mountain: 'Гора / вулкан',
  water: 'Озеро / водоём',
  park: 'Заповедник / нацпарк',
  bridge: 'Мост',
  lighthouse: 'Маяк',
  other: 'Достопримечательность'
};

export const SightSheet: React.FC<SightSheetProps> = ({
  entity,
  onClose,
  onToggleWishlist
}) => {
  const [imageAttempt, setImageAttempt] = useState(0);
  const sightId = entity?.sight.id;

  useEffect(() => {
    setImageAttempt(0);
  }, [sightId]);

  if (!entity) return null;
  const { sight } = entity;

  const multiplier = entity.distanceBonus?.multiplier ?? 1;
  const xpValue = Math.round((150 * sight.tier + (sight.unesco ? 500 : 0)) * multiplier);
  const kindTitle = KIND_NAMES[sight.kind] || 'Достопримечательность';
  const locationSubtitle = [entity.regionName, entity.countryName || sight.country].filter(Boolean).join(', ');

  const radiusKm = sight.radius >= 1000 ? `${sight.radius / 1000} км` : `${sight.radius} м`;

  const imageSources = sight.image ? commonsImageUrls(sight.image) : [];
  const imageUrl = imageAttempt < imageSources.length ? imageSources[imageAttempt] : null;
  const imageFailed = imageSources.length > 0 && imageUrl === null;

  const formattedDate = entity.firstVisitedDate
    ? new Date(entity.firstVisitedDate).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    : null;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet-card" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />

        <div className="sheet-header">
          <div className="sheet-titles">
            <h2 className="sheet-title">{sight.name}</h2>
            {locationSubtitle && <p className="sheet-subtitle">{locationSubtitle}</p>}
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>

        <div className="badges-row">
          <span className="badge rarity-badge">
            {kindTitle}
          </span>

          {sight.unesco && (
            <span className="badge unesco-badge">
              <Globe size={13} style={{ marginRight: 4 }} />
              ЮНЕСКО
            </span>
          )}

          <span className="badge xp-badge">
            +{xpValue} XP
          </span>

          {entity.distanceBonus && multiplier > 1 && (
            <span className="badge xp-badge">
              ×{multiplier.toLocaleString('ru-RU')} · {Math.round(entity.distanceBonus.km).toLocaleString('ru-RU')} км от дома
            </span>
          )}

          {entity.isVisited ? (
            <span className="badge status-visited-badge">
              <Award size={13} style={{ marginRight: 4 }} />
              Открыто {formattedDate ? `(${formattedDate})` : ''}
            </span>
          ) : (
            <span className="badge status-unvisited-badge">
              Сфотографируй в радиусе {radiusKm}
            </span>
          )}

          {entity.isWishlist && (
            <span className="badge wishlist-badge">В вишлисте</span>
          )}
        </div>

        {imageUrl && (
          <div className="sight-thumb-container">
            <img
              src={imageUrl}
              alt={sight.name}
              className="sight-thumb-img"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImageAttempt(a => a + 1)}
            />
            <span className="sight-thumb-caption">Фото: Wikimedia Commons</span>
          </div>
        )}

        {imageFailed && (
          <div className="sight-thumb-missing">
            Фото не загрузилось — проверь интернет.{' '}
            <a
              href={`https://commons.wikimedia.org/wiki/File:${encodeURIComponent(sight.image!.replace(/ /g, '_'))}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Открыть на Wikimedia Commons
            </a>
          </div>
        )}

        <div className="sight-actions-row">
          <button
            className={`action-btn ${entity.isWishlist ? 'active-accent' : ''}`}
            onClick={onToggleWishlist}
          >
            <Bookmark size={16} />
            <span>{entity.isWishlist ? 'В вишлисте' : 'Хочу сюда'}</span>
          </button>

          {sight.wiki && (
            <a
              href={`https://ru.wikipedia.org/wiki/${encodeURIComponent(sight.wiki)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="action-btn link-btn"
            >
              <ExternalLink size={16} />
              <span>Статья в Википедии</span>
            </a>
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
          gap: 14px;
          animation: slideUp var(--transition);
          max-height: 90vh;
          overflow-y: auto;
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
          margin-bottom: 2px;
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
          margin: 0;
        }

        .sheet-subtitle {
          font-size: 13px;
          color: var(--muted);
          margin: 0;
        }

        .close-btn {
          font-size: 16px;
          color: var(--muted);
          padding: 6px;
          border-radius: var(--radius-sm);
          background: none;
          border: none;
          cursor: pointer;
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
          display: inline-flex;
          align-items: center;
          font-size: 11px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: var(--radius-full);
          border: 1px solid var(--border);
          color: var(--text);
          background: var(--bg-3);
        }

        .unesco-badge {
          border-color: var(--accent);
          color: var(--accent-2);
          background: rgba(229, 56, 59, 0.12);
        }

        .xp-badge {
          border-color: var(--border);
          color: var(--text);
          background: var(--bg);
        }

        .status-visited-badge {
          border-color: var(--accent);
          color: var(--accent);
          background: rgba(229, 56, 59, 0.15);
        }

        .status-unvisited-badge {
          border-color: var(--border);
          color: var(--muted);
        }

        .wishlist-badge {
          border-color: var(--accent-2);
          color: var(--accent-2);
          background: rgba(255, 107, 110, 0.15);
        }

        .sight-thumb-container {
          position: relative;
          width: 100%;
          max-height: 220px;
          border-radius: var(--radius);
          overflow: hidden;
          background: var(--bg-3);
          border: 1px solid var(--border);
        }

        .sight-thumb-missing {
          margin-top: 0.75rem;
          padding: 0.75rem 1rem;
          border: 1px dashed var(--border);
          border-radius: var(--radius);
          color: var(--muted);
          font-size: 0.8125rem;
          overflow-wrap: anywhere;
        }

        .sight-thumb-missing a {
          color: var(--accent);
        }

        .sight-thumb-img {
          width: 100%;
          height: 180px;
          object-fit: cover;
          display: block;
        }

        .sight-thumb-caption {
          display: block;
          font-size: 10px;
          color: var(--muted);
          padding: 4px 8px;
          background: var(--bg-2);
          border-top: 1px solid var(--border);
        }

        .sight-actions-row {
          display: flex;
          gap: 8px;
          margin-top: 4px;
        }

        .action-btn {
          flex: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px 14px;
          border-radius: var(--radius);
          font-size: 13px;
          font-weight: 600;
          background: var(--bg-3);
          color: var(--text);
          border: 1px solid var(--border);
          cursor: pointer;
          text-decoration: none;
          transition: background var(--transition), border-color var(--transition);
        }

        .action-btn:hover {
          background: var(--bg);
          border-color: var(--text);
        }

        .action-btn.active-accent {
          background: var(--accent);
          border-color: var(--accent);
          color: #ffffff;
        }

        .link-btn {
          color: var(--text);
        }
      `}</style>
    </div>
  );
};
