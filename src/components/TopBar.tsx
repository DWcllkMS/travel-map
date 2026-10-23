import React from 'react';
import type { UserLevelInfo } from '../types';

export interface MapFilters {
  visited: boolean;
  wishlist: boolean;
  photos: boolean;
  fog: boolean;
  sights: boolean;
}

interface TopBarProps {
  levelInfo: UserLevelInfo;
  filters: MapFilters;
  onFilterChange: (filters: MapFilters) => void;
  onOpenLevelDetails?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  levelInfo,
  filters,
  onFilterChange,
  onOpenLevelDetails
}) => {
  const toggleFilter = (key: keyof MapFilters) => {
    onFilterChange({
      ...filters,
      [key]: !filters[key]
    });
  };

  return (
    <div className="topbar-container">
      <div className="level-widget" onClick={onOpenLevelDetails} role="button" tabIndex={0}>
        <div className="level-badge">Ур. {levelInfo.level}</div>
        <div className="level-details">
          <div className="rank-name">{levelInfo.rank}</div>
          <div className="xp-bar-container">
            <div
              className="xp-bar-fill"
              style={{ width: `${levelInfo.progressPercent}%` }}
            />
          </div>
        </div>
        <div className="xp-text">{levelInfo.currentXp} XP</div>
      </div>

      <div className="filter-chips">
        <button
          className={`chip ${filters.visited ? 'active' : ''}`}
          onClick={() => toggleFilter('visited')}
        >
          <span className="chip-indicator visited-indicator" />
          Была
        </button>

        <button
          className={`chip ${filters.wishlist ? 'active' : ''}`}
          onClick={() => toggleFilter('wishlist')}
        >
          <span className="chip-indicator wishlist-indicator" />
          Хочу
        </button>

        <button
          className={`chip ${filters.photos ? 'active' : ''}`}
          onClick={() => toggleFilter('photos')}
        >
          <span className="chip-indicator photo-indicator" />
          Фото
        </button>

        <button
          className={`chip ${filters.fog ? 'active' : ''}`}
          onClick={() => toggleFilter('fog')}
        >
          <span className="chip-indicator fog-indicator" />
          Туман
        </button>

        <button
          className={`chip ${filters.sights ? 'active' : ''}`}
          onClick={() => toggleFilter('sights')}
        >
          <span className="chip-indicator sights-indicator" />
          Места
        </button>
      </div>

      <style>{`
        .topbar-container {
          position: absolute;
          top: 12px;
          left: 12px;
          right: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          z-index: 5;
          pointer-events: none;
        }

        .level-widget {
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--bg-2);
          border: 1px solid var(--border);
          padding: 6px 14px;
          border-radius: var(--radius);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
          pointer-events: auto;
          cursor: pointer;
          backdrop-filter: blur(8px);
          flex-shrink: 0;
          white-space: nowrap;
        }

        .level-badge {
          background: var(--accent);
          color: var(--text);
          font-weight: 700;
          font-size: 12px;
          padding: 3px 8px;
          border-radius: var(--radius-sm);
        }

        .level-details {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .rank-name {
          font-size: 11px;
          font-weight: 600;
          color: var(--text);
          line-height: 1;
        }

        .xp-bar-container {
          width: 90px;
          height: 5px;
          background: var(--bg-3);
          border-radius: 3px;
          overflow: hidden;
        }

        .xp-bar-fill {
          height: 100%;
          background: var(--accent);
          border-radius: 3px;
          transition: width var(--transition);
        }

        .xp-text {
          font-size: 11px;
          color: var(--muted);
          font-weight: 500;
        }

        .filter-chips {
          display: flex;
          align-items: center;
          gap: 6px;
          justify-content: flex-end;
          flex-wrap: wrap;
          flex: 1 1 auto;
          min-width: 0;
          pointer-events: auto;
        }

        .chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: var(--bg-2);
          border: 1px solid var(--border);
          color: var(--muted);
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          white-space: nowrap;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          transition: background var(--transition), color var(--transition), border-color var(--transition);
        }

        .chip:hover {
          color: var(--text);
          background: var(--bg-3);
        }

        .chip.active {
          background: var(--bg-3);
          color: var(--text);
          border-color: var(--accent);
          font-weight: 600;
        }

        .chip-indicator {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--muted);
        }

        .chip.active .chip-indicator.visited-indicator {
          background: var(--accent);
        }

        .chip.active .chip-indicator.wishlist-indicator {
          background: var(--text);
        }

        .chip.active .chip-indicator.photo-indicator {
          background: var(--accent-2);
        }

        .chip.active .chip-indicator.fog-indicator {
          background: var(--muted);
        }

        .chip.active .chip-indicator.sights-indicator {
          background: var(--accent);
        }

        @media (max-width: 600px) {
          .topbar-container {
            flex-direction: column;
            align-items: stretch;
            gap: 8px;
          }
          .filter-chips {
            justify-content: flex-start;
          }
          .xp-bar-container {
            width: 70px;
          }
        }
      `}</style>
    </div>
  );
};
