import React, { useRef } from 'react';
import { Home, Star, Globe, Settings, Save, FolderOpen } from 'lucide-react';
import type { StatsInfo, UserSettings, GeoRegion, MarkRecord } from '../types';
import { createBackup, exportBackupToFile, mergeBackup } from '../services/backupService';

interface WishlistItem {
  mark: MarkRecord;
  name: string;
  distanceKm?: number;
}

interface ProfileViewProps {
  stats: StatsInfo;
  settings: UserSettings;
  regions: GeoRegion[];
  wishlistItems: WishlistItem[];
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  onSelectWishlistItem: (mark: MarkRecord) => void;
  onRefreshData: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  stats,
  settings,
  regions,
  wishlistItems,
  onUpdateSettings,
  onSelectWishlistItem,
  onRefreshData
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportBackup = async () => {
    try {
      const backup = await createBackup();
      exportBackupToFile(backup);
    } catch {
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await mergeBackup(data);
      onRefreshData();
      alert('Бэкап успешно загружен и объединён с текущими данными.');
    } catch (err: any) {
      alert('Ошибка при чтении бэкапа: ' + (err.message || 'некорректный JSON'));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const sortedCountries = Object.entries(stats.countryProgress || {})
    .sort((a, b) => b[1].visited - a[1].visited);

  return (
    <div className="profile-container custom-scrollbar">
      <div className="profile-card">
        <h2 className="profile-title">Личный профиль</h2>

        <div className="stats-cards-grid">
          <div className="stat-card">
            <span className="stat-title">Регионы</span>
            <span className="stat-number accent-text">
              {stats.regionsVisited} <span className="stat-sub">/ {stats.totalRegions}</span>
            </span>
          </div>

          <div className="stat-card">
            <span className="stat-title">Страны</span>
            <span className="stat-number">
              {stats.countriesVisited} <span className="stat-sub">/ {stats.totalCountries}</span>
            </span>
          </div>

          <div className="stat-card">
            <span className="stat-title">Районы РФ</span>
            <span className="stat-number">
              {stats.rusDistrictsVisited} <span className="stat-sub">/ {stats.totalRusDistricts}</span>
            </span>
          </div>

          <div className="stat-card">
            <span className="stat-title">Открыто суши</span>
            <span className="stat-number accent-text">{stats.landPercent}%</span>
          </div>
        </div>

        <div className="section-box">
          <div className="section-title-row" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Home size={18} color="var(--accent)" />
            <h3 className="section-title" style={{ margin: 0 }}>Домашний регион</h3>
          </div>
          <p className="section-desc">
            Используется для расчёта расстояний до точек из твоего вишлиста.
          </p>
          <select
            className="home-select"
            value={settings.homeRegionId || ''}
            onChange={e => onUpdateSettings({ homeRegionId: e.target.value })}
          >
            <option value="">Не выбран</option>
            {regions
              .filter(r => r.country === 'RUS')
              .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
              .map(r => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </select>
        </div>

        <div className="section-box">
          <div className="section-title-row" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Star size={18} color="var(--badge-gold)" fill="var(--badge-gold)" />
            <h3 className="section-title" style={{ margin: 0 }}>Список «Хочу сюда» ({wishlistItems.length})</h3>
          </div>
          {wishlistItems.length === 0 ? (
            <p className="empty-text">
              Ты пока не добавил ни одного региона или района в вишлист. Нажми «Хочу сюда» на карточке места.
            </p>
          ) : (
            <div className="wishlist-list">
              {wishlistItems.map(item => (
                <div
                  key={item.mark.id}
                  className="wishlist-item"
                  onClick={() => onSelectWishlistItem(item.mark)}
                >
                  <span className="item-name">{item.name}</span>
                  {item.distanceKm !== undefined && (
                    <span className="item-distance">~{item.distanceKm} км от дома</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="section-box">
          <div className="section-title-row" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Globe size={18} color="var(--muted)" />
            <h3 className="section-title" style={{ margin: 0 }}>Прогресс по странам</h3>
          </div>
          <div className="countries-progress-list custom-scrollbar">
            {sortedCountries.slice(0, 15).map(([code, c]) => (
              <div key={code} className="country-progress-row">
                <div className="country-info">
                  <span className="country-name">{c.name}</span>
                  <span className="country-counts">{c.visited} из {c.total} рег.</span>
                </div>
                <div className="country-bar">
                  <div
                    className="country-fill"
                    style={{ width: `${Math.round((c.visited / c.total) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="section-box">
          <div className="section-title-row" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Settings size={18} color="var(--muted)" />
            <h3 className="section-title" style={{ margin: 0 }}>Настройки и данные</h3>
          </div>
          <div className="settings-list">
            <label className="setting-toggle-row">
              <span>Засчитывать ручные отметки («Бронза») в достижения</span>
              <input
                type="checkbox"
                checked={settings.includeManualInStats}
                onChange={e => onUpdateSettings({ includeManualInStats: e.target.checked })}
              />
            </label>

            <label className="setting-toggle-row">
              <span>Тема оформления</span>
              <select
                value={settings.theme}
                onChange={e => onUpdateSettings({ theme: e.target.value as 'dark' | 'light' })}
              >
                <option value="dark">Тёмная (графит / красный)</option>
                <option value="light">Светлая</option>
              </select>
            </label>
          </div>

          <div className="backup-actions-row">
            <button className="backup-btn" onClick={handleExportBackup} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Save size={16} />
              <span>Сохранить бэкап (JSON)</span>
            </button>
            <button className="backup-btn" onClick={() => fileInputRef.current?.click()} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <FolderOpen size={16} />
              <span>Загрузить бэкап со слиянием</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImportBackup}
            />
          </div>
        </div>
      </div>

      <style>{`
        .profile-container {
          flex: 1;
          height: 100%;
          overflow-y: auto;
          padding: 24px 16px 80px;
          display: flex;
          justify-content: center;
        }

        .profile-card {
          width: 100%;
          max-width: 680px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .profile-title {
          font-size: 22px;
          font-weight: 700;
          color: var(--text);
        }

        .stats-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 10px;
        }

        .stat-card {
          background: var(--bg-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .stat-title {
          font-size: 11px;
          color: var(--muted);
          text-transform: uppercase;
        }

        .stat-number {
          font-size: 20px;
          font-weight: 700;
          color: var(--text);
        }

        .stat-sub {
          font-size: 12px;
          color: var(--muted);
          font-weight: 500;
        }

        .accent-text {
          color: var(--accent);
        }

        .section-box {
          background: var(--bg-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .section-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--text);
        }

        .section-desc {
          font-size: 12px;
          color: var(--muted);
        }

        .home-select {
          width: 100%;
        }

        .empty-text {
          font-size: 13px;
          color: var(--muted);
          line-height: 1.4;
        }

        .wishlist-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .wishlist-item {
          background: var(--bg-3);
          padding: 10px 14px;
          border-radius: var(--radius-sm);
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          transition: background var(--transition);
        }

        .wishlist-item:hover {
          background: var(--border);
        }

        .item-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--text);
        }

        .item-distance {
          font-size: 11px;
          color: var(--accent);
        }

        .countries-progress-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-height: 240px;
          overflow-y: auto;
        }

        .country-progress-row {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .country-info {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
        }

        .country-name {
          font-weight: 600;
          color: var(--text);
        }

        .country-counts {
          color: var(--muted);
        }

        .country-bar {
          height: 5px;
          background: var(--bg-3);
          border-radius: 3px;
          overflow: hidden;
        }

        .country-fill {
          height: 100%;
          background: var(--accent);
          border-radius: 3px;
        }

        .settings-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .setting-toggle-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
          color: var(--text);
          cursor: pointer;
        }

        .backup-actions-row {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 8px;
        }

        .backup-btn {
          flex: 1;
          min-width: 180px;
          padding: 10px 14px;
          background: var(--bg-3);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          color: var(--text);
          font-weight: 600;
          font-size: 12px;
          text-align: center;
        }

        .backup-btn:hover {
          background: var(--border);
        }

        @media (min-width: 768px) {
          .profile-container {
            padding-bottom: 24px;
          }
        }
      `}</style>
    </div>
  );
};
