import React, { useEffect, useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Trophy } from 'lucide-react';
import { Navigation, type ActiveTab } from './components/Navigation';
import { MapView } from './components/MapView';
import { UploadView } from './components/UploadView';
import { AchievementsView } from './components/AchievementsView';
import { ProfileView } from './components/ProfileView';
import { BackupReminderBanner } from './components/BackupReminderBanner';
import { SilverVerificationModal, type UnlocatedPhotoItem } from './components/SilverVerificationModal';
import { db, updateSettings, initStoragePersistence } from './services/db';
import { globalGeoIndex } from './services/geoIndex';
import { applyTheme } from './theme/tokens';
import { latLngToCell } from 'h3-js';
import {
  calculateDistrictXp,
  calculateRegionXp,
  calculateCountryXp,
  calculateUserLevel,
  evaluateAchievements,
  calculateLandCoveragePercent
} from './services/gameService';
import { ACHIEVEMENTS, FEDERAL_DISTRICTS } from './services/achievementsConfig';
import { createBackup, exportBackupToFile, shouldPromptBackup } from './services/backupService';
import type {
  UnlockedAchievementRecord,
  UserSettings,
  UserLevelInfo,
  StatsInfo,
  GeoDistrict,
  GeoRegion,
  GameContext
} from './types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('map');
  const [dataLoaded, setDataLoaded] = useState(false);

  const livePhotos = useLiveQuery(() => db.photos.toArray(), []);
  const liveMarks = useLiveQuery(() => db.marks.toArray(), []);
  const liveAchievements = useLiveQuery(() => db.achievements.toArray(), []);
  const liveSettings = useLiveQuery(() => db.settings.get('default'), []);

  const photos = livePhotos || [];
  const marks = liveMarks || [];
  const unlockedAchievements = liveAchievements || [];
  const settings: UserSettings = liveSettings || {
    id: 'default',
    theme: 'dark',
    includeManualInStats: true
  };

  const [newlyUnlockedNotification, setNewlyUnlockedNotification] = useState<string | null>(null);
  const [showBackupReminder, setShowBackupReminder] = useState(false);

  const [silverPhotoCandidate, setSilverPhotoCandidate] = useState<UnlocatedPhotoItem | null>(null);
  const [silverSelectedLocation, setSilverSelectedLocation] = useState<{
    lat: number;
    lon: number;
    district?: GeoDistrict;
    region?: GeoRegion;
  } | null>(null);
  const [pickLocationMode, setPickLocationMode] = useState(false);

  useEffect(() => {
    initStoragePersistence();

    const baseUrl = import.meta.env.BASE_URL || './';
    const dataPrefix = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

    Promise.all([
      fetch(`${dataPrefix}data/districts-RUS.json`).then(r => r.json()),
      fetch(`${dataPrefix}data/regions.json`).then(r => r.json()),
      fetch(`${dataPrefix}data/countries.json`).then(r => r.json())
    ]).then(([districts, regions, countries]) => {
      globalGeoIndex.init(districts, regions, countries);
      setDataLoaded(true);
    }).catch(err => {
      console.error('Error loading geo data:', err);
    });
  }, []);

  useEffect(() => {
    if (settings.theme) {
      applyTheme(settings.theme);
    }
  }, [settings.theme]);

  const oldestRecordDate = useMemo(() => {
    const dates: number[] = [];
    for (const p of photos) {
      if (p.createdAt) dates.push(new Date(p.createdAt).getTime());
      else dates.push(Date.now());
    }
    for (const m of marks) {
      if (m.createdAt) dates.push(new Date(m.createdAt).getTime());
      else dates.push(Date.now());
    }
    if (dates.length === 0) return undefined;
    return new Date(Math.min(...dates)).toISOString();
  }, [photos, marks]);

  useEffect(() => {
    const totalRecords = photos.length + marks.length;
    if (shouldPromptBackup(settings.lastBackupPrompt, totalRecords, oldestRecordDate)) {
      setShowBackupReminder(true);
    } else {
      setShowBackupReminder(false);
    }
  }, [settings.lastBackupPrompt, photos.length, marks.length, oldestRecordDate]);

  const refreshDbData = async () => {};

  const gameContext: GameContext = useMemo(() => {
    const visitedDistrictIds = new Set<string>();
    const visitedRegionIds = new Set<string>();
    const visitedCountries = new Set<string>();

    for (const p of photos) {
      if (p.districtId) visitedDistrictIds.add(p.districtId);
      if (p.regionId) visitedRegionIds.add(p.regionId);
      if (p.country) visitedCountries.add(p.country);
    }

    if (settings.includeManualInStats) {
      for (const m of marks) {
        if (m.markType === 'visited_manual') {
          if (m.targetType === 'district') {
            visitedDistrictIds.add(m.targetId);
            const d = globalGeoIndex.getAllDistricts().find(x => x.id === m.targetId);
            if (d?.regionId) visitedRegionIds.add(d.regionId);
            if (d?.country) visitedCountries.add(d.country);
          } else {
            visitedRegionIds.add(m.targetId);
            const r = globalGeoIndex.getRegionById(m.targetId);
            if (r?.country) visitedCountries.add(r.country);
          }
        }
      }
    }

    const asianRegions = new Set([...FEDERAL_DISTRICTS.ufo, ...FEDERAL_DISTRICTS.sfo, ...FEDERAL_DISTRICTS.dfo]);
    const europeanRegions = new Set([...FEDERAL_DISTRICTS.cfo, ...FEDERAL_DISTRICTS.szfo, ...FEDERAL_DISTRICTS.yufo, ...FEDERAL_DISTRICTS.skfo, ...FEDERAL_DISTRICTS.pfo]);

    const visitedRusRegionNames = new Set<string>();
    let visitedNonRusRegionCount = 0;
    let hasEuropeanRussia = false;
    let hasAsianRussia = false;

    for (const rId of visitedRegionIds) {
      const r = globalGeoIndex.getRegionById(rId);
      if (r) {
        if (r.country === 'RUS') {
          visitedRusRegionNames.add(r.name);
          if (asianRegions.has(r.name)) hasAsianRussia = true;
          if (europeanRegions.has(r.name)) hasEuropeanRussia = true;
        } else {
          visitedNonRusRegionCount++;
        }
      }
    }

    const visitedContinents = new Set<string>();
    const visitedEuropeanCountries = new Set<string>();
    const visitedAsianCountries = new Set<string>();

    for (const cCode of visitedCountries) {
      if (cCode === 'RUS') {
        if (hasEuropeanRussia) {
          visitedContinents.add('Европа');
          visitedEuropeanCountries.add('RUS');
        }
        if (hasAsianRussia) {
          visitedContinents.add('Азия');
          visitedAsianCountries.add('RUS');
        }
      } else {
        const cObj = globalGeoIndex.getCountryById(cCode);
        const cont = cObj?.continent;
        if (cont) {
          visitedContinents.add(cont);
          if (cont === 'Европа') visitedEuropeanCountries.add(cCode);
          if (cont === 'Азия') visitedAsianCountries.add(cCode);
        }
      }
    }

    const allDistricts = globalGeoIndex.getAllDistricts();
    const districtMap = new Map(allDistricts.map(d => [d.id, d]));
    const visitedDistrictsPerRegion = new Map<string, number>();
    let visitedRussianDistrictsCount = 0;

    for (const dId of visitedDistrictIds) {
      const d = districtMap.get(dId);
      if (d?.country === 'RUS' || d?.regionId?.startsWith('RUS')) {
        visitedRussianDistrictsCount++;
        if (d.regionId) {
          visitedDistrictsPerRegion.set(d.regionId, (visitedDistrictsPerRegion.get(d.regionId) || 0) + 1);
        }
      }
    }

    const allDistrictCounts = globalGeoIndex.getAllDistrictCountsByRegion();
    let hasCompletedAnyFullRegion = false;
    let bestCompletedRegionProgress = { visited: 0, total: 1 };
    let bestRatio = -1;

    for (const [rId, totalInReg] of allDistrictCounts.entries()) {
      if (totalInReg <= 0) continue;
      const visitedInReg = visitedDistrictsPerRegion.get(rId) || 0;
      if (visitedInReg >= totalInReg) {
        hasCompletedAnyFullRegion = true;
      }
      const ratio = visitedInReg / totalInReg;
      if (ratio > bestRatio) {
        bestRatio = ratio;
        bestCompletedRegionProgress = { visited: visitedInReg, total: totalInReg };
      }
    }

    let hasNorthernHemisphere = false;
    let hasSouthernHemisphere = false;

    for (const p of photos) {
      if (p.lat >= 0) hasNorthernHemisphere = true;
      if (p.lat < 0) hasSouthernHemisphere = true;
    }

    for (const rId of visitedRegionIds) {
      const r = globalGeoIndex.getRegionById(rId);
      if (r?.country === 'RUS') {
        hasNorthernHemisphere = true;
      }
    }

    for (const cCode of visitedCountries) {
      const c = globalGeoIndex.getCountryById(cCode);
      if (cCode === 'RUS') {
        hasNorthernHemisphere = true;
      } else if (c?.labelY !== undefined) {
        if (c.labelY >= 0) hasNorthernHemisphere = true;
        if (c.labelY < 0) hasSouthernHemisphere = true;
      }
    }

    return {
      visitedDistrictIds,
      visitedRegionIds,
      visitedCountries,
      photos,
      marks,
      includeManual: settings.includeManualInStats,
      visitedRusRegionNames,
      visitedNonRusRegionCount,
      visitedContinents,
      visitedEuropeanCountries,
      visitedAsianCountries,
      visitedRussianDistrictsCount,
      hasCompletedAnyFullRegion,
      bestCompletedRegionProgress,
      hasNorthernHemisphere,
      hasSouthernHemisphere
    };
  }, [photos, marks, settings.includeManualInStats, dataLoaded]);

  useEffect(() => {
    if (!dataLoaded) return;

    const existingUnlockedIds = new Set(unlockedAchievements.map(a => a.id));
    const newUnlocked = evaluateAchievements(gameContext, existingUnlockedIds);

    if (newUnlocked.length > 0) {
      const records: UnlockedAchievementRecord[] = newUnlocked.map(a => ({
        id: a.id,
        unlockedAt: new Date().toISOString()
      }));

      db.achievements.bulkPut(records).then(() => {
        setNewlyUnlockedNotification(newUnlocked[0].title);
        setTimeout(() => setNewlyUnlockedNotification(null), 5000);
      });
    }
  }, [gameContext, dataLoaded]);

  const levelInfo: UserLevelInfo = useMemo(() => {
    let totalXp = 0;

    const manualDistrictMarks = new Set<string>();
    const manualRegionMarks = new Set<string>();

    if (settings.includeManualInStats) {
      for (const m of marks) {
        if (m.markType === 'visited_manual') {
          if (m.targetType === 'district') manualDistrictMarks.add(m.targetId);
          else manualRegionMarks.add(m.targetId);
        }
      }
    }

    const photoDistrictIds = new Set<string>();
    const photoRegionIds = new Set<string>();
    const photoCountries = new Set<string>();

    for (const p of photos) {
      if (p.districtId) photoDistrictIds.add(p.districtId);
      if (p.regionId) photoRegionIds.add(p.regionId);
      if (p.country) photoCountries.add(p.country);
    }

    const allDistricts = globalGeoIndex.getAllDistricts();
    const districtById = new Map(allDistricts.map(d => [d.id, d]));

    for (const dId of photoDistrictIds) {
      const d = districtById.get(dId);
      const rarity = d ? d.rarity : 1;
      totalXp += calculateDistrictXp(rarity, 'gold');
    }

    for (const dId of manualDistrictMarks) {
      if (!photoDistrictIds.has(dId)) {
        const d = districtById.get(dId);
        const rarity = d ? d.rarity : 1;
        totalXp += calculateDistrictXp(rarity, 'bronze');
      }
    }

    const allRegions = globalGeoIndex.getAllRegions();
    const regionById = new Map(allRegions.map(r => [r.id, r]));

    for (const rId of photoRegionIds) {
      const r = regionById.get(rId);
      const rarity = r ? r.rarity : 1;
      totalXp += calculateRegionXp(rarity, 'gold');
    }

    for (const rId of manualRegionMarks) {
      if (!photoRegionIds.has(rId)) {
        const r = regionById.get(rId);
        const rarity = r ? r.rarity : 1;
        totalXp += calculateRegionXp(rarity, 'bronze');
      }
    }

    for (const _c of photoCountries) {
      totalXp += calculateCountryXp('gold');
    }

    const achMap = new Map(ACHIEVEMENTS.map(a => [a.id, a]));
    for (const aRec of unlockedAchievements) {
      const def = achMap.get(aRec.id);
      if (def) totalXp += def.xp;
    }

    return calculateUserLevel(totalXp);
  }, [photos, marks, unlockedAchievements, settings.includeManualInStats, dataLoaded]);

  const stats: StatsInfo = useMemo(() => {
    const allRegions = globalGeoIndex.getAllRegions();
    const allDistricts = globalGeoIndex.getAllDistricts();

    const countryProgress: { [c: string]: { visited: number; total: number; name: string } } = {};
    for (const r of allRegions) {
      const c = r.country || 'OTHER';
      if (!countryProgress[c]) {
        countryProgress[c] = { visited: 0, total: 0, name: r.countryName || c };
      }
      countryProgress[c].total++;
      if (gameContext.visitedRegionIds.has(r.id)) {
        countryProgress[c].visited++;
      }
    }

    const uniqueH3 = new Set(photos.map(p => p.h3).filter(Boolean)).size;

    return {
      regionsVisited: gameContext.visitedRegionIds.size,
      totalRegions: allRegions.length,
      countriesVisited: gameContext.visitedCountries.size,
      totalCountries: Object.keys(countryProgress).length,
      rusDistrictsVisited: gameContext.visitedDistrictIds.size,
      totalRusDistricts: allDistricts.length,
      landPercent: calculateLandCoveragePercent(uniqueH3),
      countryProgress
    };
  }, [gameContext, photos, dataLoaded]);

  const wishlistItems = useMemo(() => {
    const wishMarks = marks.filter(m => m.markType === 'wishlist');
    const allDistricts = globalGeoIndex.getAllDistricts();
    const allRegions = globalGeoIndex.getAllRegions();

    const dMap = new Map(allDistricts.map(d => [d.id, d]));
    const rMap = new Map(allRegions.map(r => [r.id, r]));

    return wishMarks.map(m => {
      let name = m.targetId;
      if (m.targetType === 'district') {
        const d = dMap.get(m.targetId);
        if (d) name = d.name;
      } else {
        const r = rMap.get(m.targetId);
        if (r) name = r.name;
      }
      return {
        mark: m,
        name,
        distanceKm: undefined
      };
    });
  }, [marks, dataLoaded]);

  const handleUpdateSettings = async (partial: Partial<UserSettings>) => {
    await updateSettings(partial);
    if (partial.theme) {
      applyTheme(partial.theme);
    }
  };

  const handleDismissBackupReminder = async () => {
    setShowBackupReminder(false);
    await handleUpdateSettings({ lastBackupPrompt: new Date().toISOString() });
  };

  const handleExportBackupNow = async () => {
    setShowBackupReminder(false);
    const backup = await createBackup();
    exportBackupToFile(backup);
    await handleUpdateSettings({ lastBackupPrompt: new Date().toISOString() });
  };

  const handleRequestSilver = (photo: UnlocatedPhotoItem) => {
    setSilverPhotoCandidate(photo);
    setSilverSelectedLocation(null);
  };

  const handleLocationPicked = (loc: { lat: number; lon: number; district?: GeoDistrict; region?: GeoRegion }) => {
    setSilverSelectedLocation(loc);
    setPickLocationMode(false);
  };

  const handleConfirmSilver = async (
    photo: UnlocatedPhotoItem,
    _result: any,
    lat: number,
    lon: number
  ) => {
    const match = globalGeoIndex.findDistrictAndRegion(lat, lon);
    const h3Cell = latLngToCell(lat, lon, 6);
    let thumbId: string | undefined;

    if (photo.dataUrl) {
      thumbId = `thumb-${Date.now()}`;
      await db.thumbs.put({
        id: thumbId,
        groupKey: `${(photo.takenAt || '').slice(0, 10)}_${h3Cell}`,
        dataUrl: photo.dataUrl,
        takenAt: photo.takenAt || new Date().toISOString()
      });
    }

    await db.photos.put({
      id: photo.id,
      lat,
      lon,
      takenAt: photo.takenAt || new Date().toISOString(),
      createdAt: new Date().toISOString(),
      districtId: match.district?.id,
      regionId: match.region?.id || match.district?.regionId || 'RUS-283',
      country: match.country || 'RUS',
      h3: h3Cell,
      proof: 'silver',
      thumbId
    });

    setSilverPhotoCandidate(null);
    setSilverSelectedLocation(null);
    refreshDbData();
    setActiveTab('map');
  };

  const handleConfirmBronzeManual = async (
    _photo: UnlocatedPhotoItem,
    lat: number,
    lon: number
  ) => {
    const match = globalGeoIndex.findDistrictAndRegion(lat, lon);
    const targetId = match.district?.id || match.region?.id;
    const targetType = match.district ? 'district' : 'region';

    if (targetId) {
      await db.marks.put({
        id: `mark-manual-${targetId}`,
        targetId,
        targetType,
        markType: 'visited_manual',
        createdAt: new Date().toISOString(),
        country: match.country || 'RUS'
      });
    }

    setSilverPhotoCandidate(null);
    setSilverSelectedLocation(null);
    refreshDbData();
    setActiveTab('map');
  };

  const validUnlockedCount = useMemo(() => {
    const achIds = new Set(ACHIEVEMENTS.map(a => a.id));
    return unlockedAchievements.filter(a => achIds.has(a.id)).length;
  }, [unlockedAchievements]);

  return (
    <div className="app-layout">
      <Navigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        unlockedAchievementsCount={validUnlockedCount}
      />

      <main className="app-main">
        {newlyUnlockedNotification && (
          <div className="achievement-popup">
            <Trophy size={24} color="var(--accent)" />
            <div className="popup-text">
              <span className="popup-sub">Новое достижение разблокировано!</span>
              <strong className="popup-title">{newlyUnlockedNotification}</strong>
            </div>
          </div>
        )}

        <div className={`tab-page ${activeTab === 'map' ? 'active-page' : ''}`}>
          <MapView
            theme={settings.theme}
            levelInfo={levelInfo}
            photos={photos}
            marks={marks}
            geoReady={dataLoaded}
            onOpenLevelDetails={() => setActiveTab('achievements')}
            pickLocationMode={pickLocationMode}
            onLocationPicked={handleLocationPicked}
          />
        </div>

        {activeTab === 'upload' && (
          <div className="tab-page active-page">
            <UploadView
              onImportDone={refreshDbData}
              onRequestSilverVerification={handleRequestSilver}
            />
          </div>
        )}

        {activeTab === 'achievements' && (
          <div className="tab-page active-page">
            <AchievementsView
              unlockedList={unlockedAchievements}
              context={gameContext}
            />
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="tab-page active-page">
            <ProfileView
              stats={stats}
              settings={settings}
              regions={globalGeoIndex.getAllRegions()}
              wishlistItems={wishlistItems}
              onUpdateSettings={handleUpdateSettings}
              onSelectWishlistItem={() => setActiveTab('map')}
              onRefreshData={refreshDbData}
            />
          </div>
        )}

        {showBackupReminder && (
          <BackupReminderBanner
            onExport={handleExportBackupNow}
            onDismiss={handleDismissBackupReminder}
          />
        )}

        {silverPhotoCandidate && !pickLocationMode && (
          <SilverVerificationModal
            photo={silverPhotoCandidate}
            selectedLocation={silverSelectedLocation}
            onSelectLocationOnMap={() => {
              setActiveTab('map');
              setPickLocationMode(true);
            }}
            onConfirmSilver={handleConfirmSilver}
            onConfirmBronzeManual={handleConfirmBronzeManual}
            onClose={() => {
              setSilverPhotoCandidate(null);
              setSilverSelectedLocation(null);
            }}
          />
        )}
      </main>

      <style>{`
        .app-layout {
          width: 100vw;
          height: 100vh;
          display: flex;
          background: var(--bg);
          color: var(--text);
          position: relative;
          overflow: hidden;
        }

        .app-main {
          flex: 1;
          height: 100%;
          position: relative;
          overflow: hidden;
        }

        .tab-page {
          width: 100%;
          height: 100%;
          display: none;
        }

        .tab-page.active-page {
          display: flex;
        }

        .achievement-popup {
          position: absolute;
          bottom: 24px;
          right: 24px;
          top: auto;
          background: var(--bg-2);
          border: 1px solid var(--accent);
          border-radius: var(--radius);
          padding: 12px 18px;
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
          z-index: 100;
          animation: popIn 0.3s cubic-bezier(0.2, 0, 0, 1);
        }

        @media (max-width: 768px) {
          .achievement-popup {
            bottom: 76px;
            left: 16px;
            right: 16px;
          }
        }

        @keyframes popIn {
          from { opacity: 0; transform: scale(0.9) translateY(-10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .popup-icon {
          font-size: 24px;
        }

        .popup-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .popup-sub {
          font-size: 11px;
          color: var(--accent);
          font-weight: 600;
        }

        .popup-title {
          font-size: 14px;
          color: var(--text);
        }
      `}</style>
    </div>
  );
};
