import React from 'react';
import {
  Compass,
  MapPin,
  Award,
  Flag,
  Crown,
  Route,
  Landmark,
  Anchor,
  Sun,
  Mountain,
  Ship,
  Gem,
  Trees,
  Sunrise,
  Waves,
  Snowflake,
  Train,
  Droplets,
  Sparkles,
  Shield,
  Map as MapIcon,
  Navigation,
  Target,
  Trophy,
  Plane,
  Globe,
  Users,
  Handshake,
  Cloud,
  MountainSnow,
  Moon,
  type LucideIcon
} from 'lucide-react';
import { ACHIEVEMENTS } from '../services/achievementsConfig';
import type { UnlockedAchievementRecord, GameContext, AchievementSection } from '../types';

interface AchievementsViewProps {
  unlockedList: UnlockedAchievementRecord[];
  context?: GameContext;
}

const ICON_MAP: Record<string, LucideIcon> = {
  compass: Compass,
  'map-pin': MapPin,
  award: Award,
  flag: Flag,
  crown: Crown,
  route: Route,
  landmark: Landmark,
  anchor: Anchor,
  sun: Sun,
  mountain: Mountain,
  ship: Ship,
  gem: Gem,
  trees: Trees,
  sunrise: Sunrise,
  waves: Waves,
  snowflake: Snowflake,
  train: Train,
  droplets: Droplets,
  sparkles: Sparkles,
  shield: Shield,
  map: MapIcon,
  navigation: Navigation,
  target: Target,
  trophy: Trophy,
  plane: Plane,
  globe: Globe,
  users: Users,
  handshake: Handshake,
  cloud: Cloud,
  'mountain-snow': MountainSnow,
  moon: Moon
};

const SECTIONS: { id: AchievementSection; title: string; subtitle: string }[] = [
  {
    id: 'russia',
    title: 'Россия',
    subtitle: 'Субъекты, федеральные округа, моря и районы Российской Федерации'
  },
  {
    id: 'world',
    title: 'Мир',
    subtitle: 'Страны, континенты, соседи и полушария планеты'
  },
  {
    id: 'special',
    title: 'Особые',
    subtitle: 'Экстремальные высоты, ночные снимки и полярные широты'
  }
];

export const AchievementsView: React.FC<AchievementsViewProps> = ({
  unlockedList,
  context
}) => {
  const unlockedMap = new Map<string, string>();
  for (const item of unlockedList) {
    unlockedMap.set(item.id, item.unlockedAt);
  }

  const validUnlockedAchievements = ACHIEVEMENTS.filter(a => unlockedMap.has(a.id));
  const unlockedCount = validUnlockedAchievements.length;
  const totalCount = ACHIEVEMENTS.length;
  const totalXpEarned = validUnlockedAchievements.reduce((acc, a) => acc + a.xp, 0);

  const fallbackContext: GameContext = context || {
    visitedDistrictIds: new Set(),
    visitedRegionIds: new Set(),
    visitedCountries: new Set(),
    photos: [],
    marks: [],
    includeManual: true,
    visitedRusRegionNames: new Set(),
    visitedNonRusRegionCount: 0,
    visitedContinents: new Set(),
    visitedEuropeanCountries: new Set(),
    visitedAsianCountries: new Set(),
    visitedRussianDistrictsCount: 0,
    hasCompletedAnyFullRegion: false,
    bestCompletedRegionProgress: { visited: 0, total: 1 },
    hasNorthernHemisphere: false,
    hasSouthernHemisphere: false
  };

  return (
    <div className="achievements-container custom-scrollbar">
      <div className="achievements-header">
        <div className="header-titles">
          <h2 className="title">Достижения</h2>
          <p className="subtitle">
            Выполняй условия путешествий, открывай редкие места и получай дополнительный опыт.
          </p>
        </div>
        <div className="stats-pill">
          <div className="pill-item">
            <span className="pill-val accent-val">{unlockedCount} / {totalCount}</span>
            <span className="pill-lbl">Получено</span>
          </div>
          <div className="pill-divider" />
          <div className="pill-item">
            <span className="pill-val">{totalXpEarned} XP</span>
            <span className="pill-lbl">Опыт наград</span>
          </div>
        </div>
      </div>

      <div className="sections-list">
        {SECTIONS.map(section => {
          const sectionAchievements = ACHIEVEMENTS.filter(a => a.section === section.id);
          const sectionUnlockedCount = sectionAchievements.filter(a => unlockedMap.has(a.id)).length;

          return (
            <section key={section.id} className="achievement-section">
              <div className="section-header">
                <div className="section-title-wrap">
                  <h3 className="section-title">{section.title}</h3>
                  <span className="section-subtitle">{section.subtitle}</span>
                </div>
                <span className="section-badge">
                  {sectionUnlockedCount} / {sectionAchievements.length}
                </span>
              </div>

              <div className="achievements-grid">
                {sectionAchievements.map(ach => {
                  const unlockedAt = unlockedMap.get(ach.id);
                  const isUnlocked = Boolean(unlockedAt);
                  const IconComp = ICON_MAP[ach.icon] || Trophy;
                  const progress = ach.progress(fallbackContext);
                  const targetVal = Math.max(1, progress.target);
                  const percent = Math.min(100, Math.max(0, Math.round((progress.current / targetVal) * 100)));

                  return (
                    <div
                      key={ach.id}
                      className={`achievement-card ${isUnlocked ? 'unlocked' : 'locked'}`}
                    >
                      <div className="card-top">
                        <span className="ach-icon">
                          <IconComp size={24} color={isUnlocked ? 'var(--accent)' : 'var(--muted)'} />
                        </span>
                        <span className="ach-xp">+{ach.xp} XP</span>
                      </div>

                      <div className="card-content">
                        <h4 className="ach-title">{ach.title}</h4>
                        <p className="ach-desc">{ach.description}</p>
                      </div>

                      <div className="card-bottom">
                        {isUnlocked ? (
                          <span className="unlocked-date">
                            Получено {new Date(unlockedAt!).toLocaleDateString('ru-RU')}
                          </span>
                        ) : (
                          <div className="progress-box">
                            <div className="progress-bar-bg">
                              <div
                                className="progress-bar-fill"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <span className="progress-label">
                              {progress.current} / {progress.target}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <style>{`
        .achievements-container {
          flex: 1;
          height: 100%;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 24px 16px 80px;
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
          box-sizing: border-box;
        }

        .achievements-header {
          width: 100%;
          max-width: 960px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 28px;
          flex-wrap: wrap;
        }

        .header-titles {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .title {
          font-size: 22px;
          font-weight: 700;
          color: var(--text);
          margin: 0;
        }

        .subtitle {
          font-size: 13px;
          color: var(--muted);
          max-width: 500px;
          margin: 0;
        }

        .stats-pill {
          display: flex;
          align-items: center;
          gap: 16px;
          background: var(--bg-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 8px 16px;
        }

        .pill-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        .pill-val {
          font-size: 15px;
          font-weight: 700;
          color: var(--text);
        }

        .accent-val {
          color: var(--accent);
        }

        .pill-lbl {
          font-size: 10px;
          color: var(--muted);
          text-transform: uppercase;
        }

        .pill-divider {
          width: 1px;
          height: 24px;
          background: var(--border);
        }

        .sections-list {
          width: 100%;
          max-width: 960px;
          display: flex;
          flex-direction: column;
          gap: 36px;
        }

        .achievement-section {
          display: flex;
          flex-direction: column;
          gap: 14px;
          width: 100%;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--border);
          gap: 12px;
        }

        .section-title-wrap {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .section-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--text);
          margin: 0;
        }

        .section-subtitle {
          font-size: 12px;
          color: var(--muted);
        }

        .section-badge {
          font-size: 12px;
          font-weight: 600;
          color: var(--accent);
          background: var(--bg-2);
          border: 1px solid var(--border);
          padding: 3px 10px;
          border-radius: var(--radius-sm);
          white-space: nowrap;
        }

        .achievements-grid {
          width: 100%;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 14px;
        }

        .achievement-card {
          background: var(--bg-2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 16px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 12px;
          box-sizing: border-box;
          transition: border-color var(--transition), transform var(--transition);
        }

        .achievement-card.unlocked {
          border-color: var(--accent);
          background: linear-gradient(180deg, var(--bg-2) 0%, rgba(229, 56, 59, 0.05) 100%);
        }

        .achievement-card.locked {
          opacity: 0.8;
        }

        .card-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .ach-icon {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .ach-xp {
          font-size: 12px;
          font-weight: 700;
          color: var(--accent);
          background: var(--bg-3);
          padding: 3px 8px;
          border-radius: var(--radius-sm);
        }

        .card-content {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .ach-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--text);
          margin: 0;
        }

        .ach-desc {
          font-size: 12px;
          color: var(--muted);
          line-height: 1.4;
          margin: 0;
        }

        .card-bottom {
          display: flex;
          align-items: center;
          font-size: 11px;
          min-height: 24px;
        }

        .unlocked-date {
          color: var(--accent);
          font-weight: 600;
        }

        .progress-box {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
        }

        .progress-bar-bg {
          flex: 1;
          height: 6px;
          background: var(--bg-3);
          border-radius: 3px;
          overflow: hidden;
        }

        .progress-bar-fill {
          height: 100%;
          background: var(--accent);
          border-radius: 3px;
          transition: width var(--transition);
        }

        .progress-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--muted);
          white-space: nowrap;
          font-variant-numeric: tabular-nums;
        }

        @media (max-width: 480px) {
          .achievements-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (min-width: 768px) {
          .achievements-container {
            padding-bottom: 24px;
          }
        }
      `}</style>
    </div>
  );
};
