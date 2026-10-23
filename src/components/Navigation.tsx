import React from 'react';
import { Map, UploadCloud, Trophy, CalendarDays, User } from 'lucide-react';

export type ActiveTab = 'map' | 'upload' | 'achievements' | 'timeline' | 'profile';

interface NavigationProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  unlockedAchievementsCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  unlockedAchievementsCount
}) => {
  return (
    <>
      <nav className="desktop-sidebar">
        <div className="sidebar-brand">
          <svg className="brand-icon" viewBox="0 0 24 24" width="28" height="28" fill="none">
            <circle cx="12" cy="12" r="10" stroke="var(--border)" strokeWidth="2" />
            <path d="M12 6L15 11L20 12L16 16L17 21L12 18L7 21L8 16L4 12L9 11L12 6Z" fill="var(--accent)" />
          </svg>
          <span className="brand-title">Карта Путешествий</span>
        </div>

        <div className="sidebar-links">
          <button
            className={`nav-button ${activeTab === 'map' ? 'active' : ''}`}
            onClick={() => onTabChange('map')}
          >
            <Map size={20} className="nav-icon" />
            <span className="nav-label">Карта</span>
          </button>

          <button
            className={`nav-button ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => onTabChange('upload')}
          >
            <UploadCloud size={20} className="nav-icon" />
            <span className="nav-label">Загрузить</span>
          </button>

          <button
            className={`nav-button ${activeTab === 'achievements' ? 'active' : ''}`}
            onClick={() => onTabChange('achievements')}
          >
            <Trophy size={20} className="nav-icon" />
            <span className="nav-label">Достижения</span>
            {unlockedAchievementsCount !== undefined && unlockedAchievementsCount > 0 && (
              <span className="nav-badge">{unlockedAchievementsCount}</span>
            )}
          </button>

          <button
            className={`nav-button ${activeTab === 'timeline' ? 'active' : ''}`}
            onClick={() => onTabChange('timeline')}
          >
            <CalendarDays size={20} className="nav-icon" />
            <span className="nav-label">Хроника</span>
          </button>

          <button
            className={`nav-button ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => onTabChange('profile')}
          >
            <User size={20} className="nav-icon" />
            <span className="nav-label">Профиль</span>
          </button>
        </div>
      </nav>

      <nav className="mobile-bottombar">
        <button
          className={`nav-tab-item ${activeTab === 'map' ? 'active' : ''}`}
          onClick={() => onTabChange('map')}
        >
          <Map size={20} className="nav-tab-icon" />
          <span className="nav-tab-text">Карта</span>
        </button>

        <button
          className={`nav-tab-item ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => onTabChange('upload')}
        >
          <UploadCloud size={20} className="nav-tab-icon" />
          <span className="nav-tab-text">Загрузить</span>
        </button>

        <button
          className={`nav-tab-item ${activeTab === 'achievements' ? 'active' : ''}`}
          onClick={() => onTabChange('achievements')}
        >
          <Trophy size={20} className="nav-tab-icon" />
          <span className="nav-tab-text">Достижения</span>
          {unlockedAchievementsCount !== undefined && unlockedAchievementsCount > 0 && (
            <span className="mobile-badge">{unlockedAchievementsCount}</span>
          )}
        </button>

        <button
          className={`nav-tab-item ${activeTab === 'timeline' ? 'active' : ''}`}
          onClick={() => onTabChange('timeline')}
        >
          <CalendarDays size={20} className="nav-tab-icon" />
          <span className="nav-tab-text">Хроника</span>
        </button>

        <button
          className={`nav-tab-item ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => onTabChange('profile')}
        >
          <User size={20} className="nav-tab-icon" />
          <span className="nav-tab-text">Профиль</span>
        </button>
      </nav>

      <style>{`
        .desktop-sidebar {
          display: none;
          width: 240px;
          height: 100%;
          background: var(--bg-2);
          border-right: 1px solid var(--border);
          flex-direction: column;
          padding: 24px 16px;
          flex-shrink: 0;
          z-index: 10;
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 32px;
          padding-left: 8px;
        }

        .brand-title {
          font-weight: 700;
          font-size: 16px;
          letter-spacing: -0.02em;
          color: var(--text);
        }

        .sidebar-links {
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex: 1;
        }

        .nav-button {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          border-radius: var(--radius-sm);
          color: var(--muted);
          font-weight: 500;
          transition: background var(--transition), color var(--transition);
          position: relative;
        }

        .nav-button:hover {
          background: var(--bg-3);
          color: var(--text);
        }

        .nav-button.active {
          background: var(--bg-3);
          color: var(--accent);
          font-weight: 600;
        }

        .nav-badge {
          margin-left: auto;
          background: var(--accent);
          color: var(--text);
          font-size: 11px;
          padding: 2px 7px;
          border-radius: 10px;
          font-weight: 700;
        }

        .mobile-bottombar {
          display: flex;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 60px;
          background: var(--bg-2);
          border-top: 1px solid var(--border);
          justify-content: space-around;
          align-items: center;
          z-index: 20;
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }

        .nav-tab-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex: 1;
          height: 100%;
          color: var(--muted);
          position: relative;
          gap: 2px;
          transition: color var(--transition);
        }

        .nav-tab-item.active {
          color: var(--accent);
          font-weight: 600;
        }

        .nav-tab-icon {
          font-size: 18px;
        }

        .nav-tab-text {
          font-size: 11px;
        }

        .mobile-badge {
          position: absolute;
          top: 6px;
          right: calc(50% - 18px);
          background: var(--accent);
          color: var(--text);
          font-size: 10px;
          padding: 1px 5px;
          border-radius: 8px;
          font-weight: 700;
        }

        @media (min-width: 768px) {
          .desktop-sidebar {
            display: flex;
          }
          .mobile-bottombar {
            display: none;
          }
        }
      `}</style>
    </>
  );
};
