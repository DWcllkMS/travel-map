import React, { useState, useMemo, useEffect } from 'react';
import {
  CalendarDays,
  Share2,
  MapPin,
  Trophy,
  Compass,
  Mountain,
  Home,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import type {
  PhotoRecord,
  MarkRecord,
  UnlockedAchievementRecord,
  ProofLevel
} from '../types';
import {
  buildTimelineFeed,
  drawYearRecapCanvas,
  shareOrDownloadRecap,
  pluralRu,
  type TimelineTrip,
  type TimelineManualItem
} from '../services/timelineService';
import { globalGeoIndex } from '../services/geoIndex';
import { globalSightsIndex } from '../services/sightsIndex';
import { db } from '../services/db';

interface TimelineViewProps {
  photos: PhotoRecord[];
  marks: MarkRecord[];
  unlockedAchievements: UnlockedAchievementRecord[];
  homeRegionId?: string;
  onNavigateToUpload: () => void;
  onSelectTrip: (bounds: [[number, number], [number, number]]) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  photos,
  marks,
  unlockedAchievements,
  homeRegionId,
  onNavigateToUpload,
  onSelectTrip
}) => {
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [sharing, setSharing] = useState(false);
  const [shareFeedback, setShareFeedback] = useState(false);

  const sightsMatch = useMemo(() => {
    return globalSightsIndex.matchPhotos(photos);
  }, [photos]);

  const matchedSightIdsByPhotoId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const [sightId, dateStr] of sightsMatch.visitedSightFirstDates.entries()) {
      const photo = photos.find(p => (p.takenAt || p.createdAt) === dateStr);
      if (photo) {
        const existing = map.get(photo.id) || [];
        existing.push(sightId);
        map.set(photo.id, existing);
      }
    }
    return map;
  }, [photos, sightsMatch]);

  const feed = useMemo(() => {
    return buildTimelineFeed(photos, marks, unlockedAchievements, {
      homeRegionId,
      isNeighbor: (r1, r2) => globalGeoIndex.areRegionsNeighbors(r1, r2),
      getRegionById: id => globalGeoIndex.getRegionById(id),
      getRegionCenter: id => globalGeoIndex.getRegionCenter(id),
      getRegionName: id => globalGeoIndex.getRegionById(id)?.name || id,
      getCountryName: c => globalGeoIndex.getCountryById(c)?.name || c,
      getDistrictById: id => globalGeoIndex.getAllDistricts().find(d => d.id === id),
      matchedSightIds: sightsMatch.visitedSightIds,
      sightFirstDates: sightsMatch.visitedSightFirstDates,
      getSightById: id => globalSightsIndex.getById(id),
      matchedSightIdsByPhotoId
    });
  }, [photos, marks, unlockedAchievements, homeRegionId, sightsMatch, matchedSightIdsByPhotoId]);

  const availableYears = useMemo(() => {
    return feed.map(g => g.year);
  }, [feed]);

  useEffect(() => {
    if (availableYears.length > 0) {
      if (selectedYear === null || !availableYears.includes(selectedYear)) {
        setSelectedYear(availableYears[0]);
      }
    } else {
      setSelectedYear(null);
    }
  }, [availableYears, selectedYear]);

  const currentYearGroup = useMemo(() => {
    if (selectedYear === null) return null;
    return feed.find(g => g.year === selectedYear) || null;
  }, [feed, selectedYear]);

  useEffect(() => {
    if (!currentYearGroup) return;

    const idsToFetch: string[] = [];
    for (const month of currentYearGroup.months) {
      for (const trip of month.trips) {
        for (const tid of trip.thumbIds) {
          if (!thumbnails[tid]) idsToFetch.push(tid);
        }
      }
    }

    if (idsToFetch.length === 0) return;

    db.thumbs
      .where('id')
      .anyOf(idsToFetch)
      .toArray()
      .then(records => {
        const map: Record<string, string> = {};
        for (const r of records) {
          map[r.id] = r.dataUrl;
        }
        setThumbnails(prev => ({ ...prev, ...map }));
      })
      .catch(() => {});
  }, [currentYearGroup]);

  const handleShare = async () => {
    if (!currentYearGroup || sharing) return;
    setSharing(true);
    try {
      const canvas = document.createElement('canvas');
      drawYearRecapCanvas(canvas, currentYearGroup.recap);
      await shareOrDownloadRecap(canvas, currentYearGroup.recap.year);
      setShareFeedback(true);
      setTimeout(() => setShareFeedback(false), 3000);
    } catch {
    } finally {
      setSharing(false);
    }
  };

  const renderProofBadge = (proof: ProofLevel) => {
    if (proof === 'gold') {
      return (
        <span className="proof-tag proof-gold">
          <ShieldCheck size={13} />
          <span>Золото</span>
        </span>
      );
    }
    if (proof === 'silver') {
      return (
        <span className="proof-tag proof-silver">
          <ShieldCheck size={13} />
          <span>Серебро</span>
        </span>
      );
    }
    return (
      <span className="proof-tag proof-bronze">
        <ShieldCheck size={13} />
        <span>Бронза</span>
      </span>
    );
  };

  if (feed.length === 0 || !currentYearGroup) {
    return (
      <div className="timeline-view custom-scrollbar">
        <div className="timeline-container">
          <div className="timeline-header">
            <div className="header-title-box">
              <CalendarDays size={24} className="accent-icon" />
              <h1 className="header-title">Хроника путешествий</h1>
            </div>
          </div>

          <div className="empty-state">
            <Compass size={48} className="empty-icon" />
            <h2 className="empty-title">У тебя пока нет записей</h2>
            <p className="empty-desc">
              Загрузи фотографии с геолокацией, чтобы приложение сформировало интерактивную
              хронику поездок и итоги каждого года твоих странствий.
            </p>
            <button className="primary-btn" onClick={onNavigateToUpload}>
              Загрузить фотографии
            </button>
          </div>
        </div>
        <style>{timelineStyles}</style>
      </div>
    );
  }

  const recap = currentYearGroup.recap;
  const maxHistoDays = Math.max(...recap.monthlyDays.map(d => d.daysCount), 1);

  return (
    <div className="timeline-view custom-scrollbar">
      <div className="timeline-container">
        <div className="timeline-header">
          <div className="header-title-box">
            <CalendarDays size={24} className="accent-icon" />
            <h1 className="header-title">Хроника</h1>
          </div>

          <div className="year-selector">
            {availableYears.map(year => (
              <button
                key={year}
                className={`year-tab ${year === selectedYear ? 'active' : ''}`}
                onClick={() => setSelectedYear(year)}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        <section className="recap-card">
          <div className="recap-header">
            <div className="recap-title-box">
              <span className="recap-eyebrow">ИТОГИ ГОДА</span>
              <h2 className="recap-main-title">{selectedYear} год в пути</h2>
            </div>
            <button
              className="share-btn"
              onClick={handleShare}
              disabled={sharing}
              title="Поделиться карточкой итогов"
            >
              {shareFeedback ? <CheckCircle2 size={16} /> : <Share2 size={16} />}
              <span>{shareFeedback ? 'Сохранено!' : sharing ? 'Создание...' : 'Поделиться итогами'}</span>
            </button>
          </div>

          <div className="recap-grid">
            <div className="recap-stat-card">
              <div className="stat-card-label">
                <Sparkles size={16} className="stat-icon" />
                <span>Новые открытия</span>
              </div>
              <div className="stat-card-value">{pluralRu(recap.newRegionsCount, 'регион', 'региона', 'регионов')}</div>
              <div className="stat-card-sub">
                {recap.newCountriesCount > 0 ? `${pluralRu(recap.newCountriesCount, 'страна', 'страны', 'стран')} • ` : ''}
                {pluralRu(recap.newRusRegionsCount, 'субъект', 'субъекта', 'субъектов')} РФ • {pluralRu(recap.newDistrictsCount, 'район', 'района', 'районов')}
                {recap.newSightsCount > 0 ? ` • ${pluralRu(recap.newSightsCount, 'место', 'места', 'мест')}` : ''}
              </div>
            </div>

            <div className="recap-stat-card">
              <div className="stat-card-label">
                <MapPin size={16} className="stat-icon" />
                <span>Маршруты</span>
              </div>
              <div className="stat-card-value">{pluralRu(recap.tripsCount, 'поездка', 'поездки', 'поездок')}</div>
              <div className="stat-card-sub">{pluralRu(recap.daysInTravel, 'день', 'дня', 'дней')} в пути вне дома</div>
            </div>

            <div className="recap-stat-card">
              <div className="stat-card-label">
                <Trophy size={16} className="stat-icon" />
                <span>Опыт и ранги</span>
              </div>
              <div className="stat-card-value">+{recap.totalXp.toLocaleString('ru-RU')} XP</div>
              <div className="stat-card-sub">
                {recap.unlockedAchievementsCount > 0
                  ? `${pluralRu(recap.unlockedAchievementsCount, 'новое достижение', 'новых достижения', 'новых достижений')}`
                  : 'Без новых достижений'}
              </div>
            </div>

            <div className="recap-stat-card">
              <div className="stat-card-label">
                <Compass size={16} className="stat-icon" />
                <span>Дальняя точка</span>
              </div>
              <div className="stat-card-value">
                {recap.furthestPoint ? `${recap.furthestPoint.km.toLocaleString('ru-RU')} км` : '—'}
              </div>
              <div className="stat-card-sub">
                {recap.furthestPoint ? recap.furthestPoint.regionName : 'Точка дома не задана'}
              </div>
            </div>
          </div>

          <div className="recap-geography-block">
            <div className="geo-header">
              <span className="geo-title">Географические рекорды года</span>
              {recap.highestPoint && (
                <span className="highest-badge">
                  <Mountain size={14} />
                  <span>Высшая точка: {recap.highestPoint.alt} м ({recap.highestPoint.regionName})</span>
                </span>
              )}
            </div>
            <div className="geo-extremes-grid">
              <div className="extreme-item">
                <span className="extreme-label">Север</span>
                <span className="extreme-val">{recap.northernRegion?.name || '—'}</span>
              </div>
              <div className="extreme-item">
                <span className="extreme-label">Юг</span>
                <span className="extreme-val">{recap.southernRegion?.name || '—'}</span>
              </div>
              <div className="extreme-item">
                <span className="extreme-label">Восток</span>
                <span className="extreme-val">{recap.easternRegion?.name || '—'}</span>
              </div>
              <div className="extreme-item">
                <span className="extreme-label">Запад</span>
                <span className="extreme-val">{recap.westernRegion?.name || '—'}</span>
              </div>
            </div>
          </div>

          <div className="histogram-box">
            <div className="histogram-title">Число активных дней с фото по месяцам</div>
            <div className="histogram-bars">
              {recap.monthlyDays.map((item, idx) => {
                const heightPct =
                  item.daysCount > 0 ? Math.max(12, Math.round((item.daysCount / maxHistoDays) * 100)) : 4;
                return (
                  <div key={idx} className="histo-col" title={`${item.monthName}: ${item.daysCount} дн.`}>
                    <div className="histo-bar-wrap">
                      <div
                        className={`histo-bar ${item.daysCount > 0 ? 'filled' : 'empty'}`}
                        style={{ height: `${heightPct}%` }}
                      >
                        {item.daysCount > 0 && <span className="histo-num">{item.daysCount}</span>}
                      </div>
                    </div>
                    <span className="histo-month-label">{item.monthName.slice(0, 3)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="feed-section">
          <div className="feed-header-line">
            <h3 className="feed-section-title">Хроника поездок</h3>
          </div>

          {currentYearGroup.months.length === 0 ? (
            <div className="feed-empty">Нет поездок в этом году</div>
          ) : (
            currentYearGroup.months.map(monthGroup => (
              <div key={monthGroup.month} className="month-group">
                <div className="month-group-title">
                  <span className="month-name">{monthGroup.monthName}</span>
                  <span className="month-year">{monthGroup.year}</span>
                </div>

                <div className="month-items-list">
                  {monthGroup.trips.map(trip => renderTripCard(trip))}

                  {monthGroup.manualMarks.length > 0 && (
                    <div className="manual-marks-box">
                      <div className="manual-marks-header">
                        <span className="manual-marks-title">Отмечено вручную</span>
                        <span className="proof-tag proof-bronze">
                          <ShieldCheck size={12} />
                          <span>Бронза</span>
                        </span>
                      </div>
                      <div className="manual-marks-list">
                        {monthGroup.manualMarks.map(item => renderManualItem(item))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </section>
      </div>
      <style>{timelineStyles}</style>
    </div>
  );

  function renderTripCard(trip: TimelineTrip) {
    if (trip.isHome) {
      return (
        <div
          key={trip.id}
          className="trip-home-row"
          onClick={() => trip.bounds && onSelectTrip(trip.bounds)}
          title="Показать на карте"
        >
          <div className="home-row-left">
            <span className="home-badge">
              <Home size={13} />
              <span>Дома</span>
            </span>
            <span className="home-dates">{trip.dateLabel}</span>
            <span className="home-stats">• {trip.photos.length} фото в домашнем регионе</span>
          </div>
          <ChevronRight size={16} className="row-chevron" />
        </div>
      );
    }

    const hasDiscoveries =
      trip.newCountriesCount > 0 ||
      trip.newRegionsCount > 0 ||
      trip.newDistrictsCount > 0 ||
      trip.newSightsCount > 0;

    return (
      <div
        key={trip.id}
        className="trip-card"
        onClick={() => trip.bounds && onSelectTrip(trip.bounds)}
        title="Нажми, чтобы показать поездку на карте"
      >
        <div className="trip-card-top">
          <div className="trip-card-dates-box">
            <span className="trip-dates">{trip.dateLabel}</span>
            {renderProofBadge(trip.proof)}
          </div>
          <ChevronRight size={18} className="card-chevron" />
        </div>

        <div className="trip-regions-title">
          {trip.regionNames.join(', ')}
          {trip.countryNames.length > 0 && (
            <span className="trip-country-tag"> ({trip.countryNames.join(', ')})</span>
          )}
        </div>

        {hasDiscoveries && (
          <div className="trip-discoveries">
            <Sparkles size={14} className="accent-icon" />
            <span className="discoveries-text">
              Впервые открыто:{' '}
              {[
                trip.newCountriesCount > 0 ? pluralRu(trip.newCountriesCount, 'страна', 'страны', 'стран') : '',
                trip.newRegionsCount > 0 ? pluralRu(trip.newRegionsCount, 'регион', 'региона', 'регионов') : '',
                trip.newDistrictsCount > 0 ? pluralRu(trip.newDistrictsCount, 'район', 'района', 'районов') : '',
                trip.newSightsCount > 0 ? pluralRu(trip.newSightsCount, 'место', 'места', 'мест') : ''
              ]
                .filter(Boolean)
                .join(' • ')}
            </span>
          </div>
        )}

        {trip.thumbIds.length > 0 && (
          <div className="trip-thumbs-grid">
            {trip.thumbIds.map(tid => {
              const url = thumbnails[tid];
              return (
                <div key={tid} className="thumb-item">
                  {url ? (
                    <img src={url} alt="Превью поездки" className="thumb-img" />
                  ) : (
                    <div className="thumb-placeholder" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function renderManualItem(item: TimelineManualItem) {
    const typeLabel =
      item.targetType === 'district' ? 'Район' : item.targetType === 'region' ? 'Регион' : 'Место';
    return (
      <div key={item.id} className="manual-item-row">
        <span className="manual-item-type">{typeLabel}</span>
        <span className="manual-item-name">{item.name}</span>
        <span className="manual-item-date">{item.dateLabel}</span>
      </div>
    );
  }
};

const timelineStyles = `
  .timeline-view {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    background: var(--bg);
    color: var(--text);
  }

  .timeline-container {
    max-width: 980px;
    margin: 0 auto;
    padding: 24px 20px 80px 20px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    box-sizing: border-box;
  }

  .timeline-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border);
  }

  .header-title-box {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .header-title {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  .accent-icon {
    color: var(--accent);
  }

  .year-selector {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .year-tab {
    padding: 6px 14px;
    border-radius: var(--radius-sm);
    background: var(--bg-2);
    border: 1px solid var(--border);
    color: var(--muted);
    font-size: 14px;
    font-weight: 600;
    transition: var(--transition);
  }

  .year-tab:hover {
    color: var(--text);
    border-color: var(--accent);
  }

  .year-tab.active {
    background: var(--accent);
    color: var(--on-accent);
    border-color: var(--accent);
  }

  .recap-card {
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .recap-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px;
  }

  .recap-title-box {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .recap-eyebrow {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--accent);
  }

  .recap-main-title {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  .share-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text);
    font-size: 13px;
    font-weight: 600;
    transition: var(--transition);
  }

  .share-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .recap-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    gap: 14px;
  }

  .recap-stat-card {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .stat-card-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--muted);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .stat-icon {
    color: var(--accent);
  }

  .stat-card-value {
    font-size: 22px;
    font-weight: 800;
    color: var(--text);
    letter-spacing: -0.01em;
  }

  .stat-card-sub {
    font-size: 12px;
    color: var(--muted);
    line-height: 1.4;
  }

  .recap-geography-block {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .geo-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
  }

  .geo-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .highest-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--accent);
    font-weight: 600;
  }

  .geo-extremes-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
  }

  .extreme-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .extreme-label {
    font-size: 11px;
    color: var(--muted);
    font-weight: 600;
  }

  .extreme-val {
    font-size: 13px;
    font-weight: 700;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .histogram-box {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .histogram-title {
    font-size: 12px;
    color: var(--muted);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .histogram-bars {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    height: 110px;
    gap: 6px;
    padding-top: 18px;
  }

  .histo-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    height: 100%;
  }

  .histo-bar-wrap {
    flex: 1;
    width: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    position: relative;
  }

  .histo-bar {
    width: 100%;
    max-width: 28px;
    border-radius: 4px 4px 0 0;
    position: relative;
    transition: var(--transition);
  }

  .histo-bar.filled {
    background: var(--accent);
  }

  .histo-bar.empty {
    background: var(--bg-3);
  }

  .histo-num {
    position: absolute;
    top: -16px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 10px;
    font-weight: 700;
    color: var(--text);
  }

  .histo-month-label {
    font-size: 11px;
    color: var(--muted);
    font-weight: 600;
  }

  .feed-section {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .feed-header-line {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .feed-section-title {
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  .feed-empty {
    padding: 32px;
    text-align: center;
    color: var(--muted);
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .month-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .month-group-title {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 16px;
    font-weight: 700;
    color: var(--text);
  }

  .month-year {
    font-size: 13px;
    color: var(--muted);
    font-weight: 500;
  }

  .month-items-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .trip-home-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: var(--transition);
  }

  .trip-home-row:hover {
    border-color: var(--muted);
  }

  .home-row-left {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .home-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 4px;
    background: var(--bg-3);
    border: 1px solid var(--border);
    color: var(--muted);
    font-size: 11px;
    font-weight: 600;
  }

  .home-dates {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
  }

  .home-stats {
    font-size: 12px;
    color: var(--muted);
  }

  .row-chevron {
    color: var(--muted);
  }

  .trip-card {
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    cursor: pointer;
    transition: var(--transition);
  }

  .trip-card:hover {
    border-color: var(--accent);
    transform: translateY(-1px);
  }

  .trip-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .trip-card-dates-box {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .trip-dates {
    font-size: 15px;
    font-weight: 700;
    color: var(--text);
  }

  .card-chevron {
    color: var(--muted);
  }

  .proof-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
  }

  .proof-gold {
    color: var(--badge-gold);
    background: var(--badge-gold-bg);
    border: 1px solid var(--badge-gold-border);
  }

  .proof-silver {
    color: var(--badge-silver);
    background: var(--badge-silver-bg);
    border: 1px solid var(--badge-silver-border);
  }

  .proof-bronze {
    color: var(--badge-bronze);
    background: var(--badge-bronze-bg);
    border: 1px solid var(--badge-bronze-border);
  }

  .trip-regions-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text);
  }

  .trip-country-tag {
    color: var(--muted);
    font-size: 14px;
    font-weight: 400;
  }

  .trip-discoveries {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    background: var(--bg);
    border: 1px solid var(--border);
    font-size: 12px;
  }

  .discoveries-text {
    color: var(--text);
    font-weight: 500;
  }

  .trip-thumbs-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-top: 4px;
  }

  .thumb-item {
    aspect-ratio: 4 / 3;
    border-radius: var(--radius-sm);
    overflow: hidden;
    background: var(--bg-3);
    border: 1px solid var(--border);
  }

  .thumb-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .thumb-placeholder {
    width: 100%;
    height: 100%;
    background: var(--bg-3);
  }

  .manual-marks-box {
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .manual-marks-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .manual-marks-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--text);
  }

  .manual-marks-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .manual-item-row {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
  }

  .manual-item-type {
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--bg-3);
    font-size: 10px;
    color: var(--muted);
    font-weight: 600;
  }

  .manual-item-name {
    font-weight: 600;
    color: var(--text);
    flex: 1;
  }

  .manual-item-date {
    font-size: 12px;
    color: var(--muted);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 64px 20px;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    gap: 16px;
    max-width: 520px;
    margin: 40px auto 0 auto;
  }

  .empty-icon {
    color: var(--muted);
  }

  .empty-title {
    font-size: 20px;
    font-weight: 700;
  }

  .empty-desc {
    font-size: 14px;
    color: var(--muted);
    line-height: 1.5;
  }

  .primary-btn {
    padding: 10px 20px;
    background: var(--accent);
    color: var(--on-accent);
    border-radius: var(--radius-sm);
    font-weight: 600;
    font-size: 14px;
    transition: var(--transition);
  }

  .primary-btn:hover {
    background: var(--accent-2);
  }

  @media (max-width: 600px) {
    .timeline-container {
      padding: 16px 12px 90px 12px;
      gap: 16px;
    }

    .recap-card {
      padding: 16px;
    }

    .geo-extremes-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .recap-grid {
      grid-template-columns: 1fr;
    }

    .trip-thumbs-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
`;
