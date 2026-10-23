import React, { useEffect, useRef, useState } from 'react';
import maplibregl, { type Map as MapLibreInstance, type GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { buildMapStyle, createHatchImage } from '../services/mapStyle';
import { FogOfWarOverlay } from '../services/fogLayer';
import { TopBar, type MapFilters } from './TopBar';
import { DistrictSheet, type SelectedEntity } from './DistrictSheet';
import { SightSheet, type SelectedSightEntity } from './SightSheet';
import { PhotoDetailModal } from './PhotoDetailModal';
import { globalGeoIndex } from '../services/geoIndex';
import { globalSightsIndex } from '../services/sightsIndex';
import { db, updateSettings } from '../services/db';
import { homeDistanceBonus } from '../services/gameService';
import type { UserLevelInfo, PhotoRecord, ThumbnailRecord, MarkRecord, GeoDistrict, GeoRegion, ProofLevel, GameContext } from '../types';

interface MapViewProps {
  theme: 'dark' | 'light';
  levelInfo: UserLevelInfo;
  photos: PhotoRecord[];
  marks: MarkRecord[];
  geoReady: boolean;
  gameContext?: GameContext;
  homeRegionId?: string;
  onOpenLevelDetails?: () => void;
  pickLocationMode?: boolean;
  onLocationPicked?: (loc: { lat: number; lon: number; district?: GeoDistrict; region?: GeoRegion }) => void;
}

export const MapView: React.FC<MapViewProps> = ({
  theme,
  levelInfo,
  photos,
  marks,
  geoReady,
  gameContext,
  homeRegionId,
  onOpenLevelDetails,
  pickLocationMode,
  onLocationPicked
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreInstance | null>(null);
  const fogRef = useRef<FogOfWarOverlay | null>(null);

  const [filters, setFilters] = useState<MapFilters>({
    visited: true,
    wishlist: true,
    photos: true,
    fog: true,
    sights: true
  });
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity | null>(null);
  const [selectedSightEntity, setSelectedSightEntity] = useState<SelectedSightEntity | null>(null);
  const [selectedPhotoModal, setSelectedPhotoModal] = useState<{ photo?: PhotoRecord; thumb?: ThumbnailRecord } | null>(null);
  const activeCardRef = useRef<{ district?: GeoDistrict; region?: GeoRegion } | null>(null);
  const activeSightCardRef = useRef<string | null>(null);

  const gameContextRef = useRef(gameContext);
  gameContextRef.current = gameContext;

  const pickLocationModeRef = useRef(pickLocationMode);
  pickLocationModeRef.current = pickLocationMode;

  const onLocationPickedRef = useRef(onLocationPicked);
  onLocationPickedRef.current = onLocationPicked;

  const photosRef = useRef(photos);
  photosRef.current = photos;

  const marksRef = useRef(marks);
  marksRef.current = marks;

  const homeRegionIdRef = useRef(homeRegionId);
  homeRegionIdRef.current = homeRegionId;

  const getHomePoint = () =>
    homeRegionIdRef.current ? globalGeoIndex.getRegionCenter(homeRegionIdRef.current) : undefined;

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const baseUrl = import.meta.env.BASE_URL || './';
    const style = buildMapStyle(theme, baseUrl);

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style,
      center: [42.5, 43.3],
      zoom: 5.5,
      attributionControl: false
    });

    const fog = new FogOfWarOverlay();
    fog.attach(map, mapContainerRef.current, theme === 'dark');
    fogRef.current = fog;
    mapRef.current = map;
    (window as any).__map = map;

    let applyFrame = 0;
    const applyAllStyleData = () => {
      if (applyFrame) return;
      applyFrame = requestAnimationFrame(() => {
        applyFrame = 0;
        try {
          if (!map.hasImage('hatch-red')) {
            map.addImage('hatch-red', createHatchImage());
          }
        } catch {
        }
        applyLayerVisibility();
        updateMapFeatureStates();
        updatePhotosGeoJson();
      });
    };

    const ownSources = new Set(['regionsSource', 'districtsSource', 'photosSource', 'sightsSource']);
    map.on('style.load', applyAllStyleData);
    map.on('load', applyAllStyleData);
    map.on('sourcedata', (e) => {
      if (e.sourceId && ownSources.has(e.sourceId) && e.isSourceLoaded && e.sourceDataType === 'metadata') {
        applyAllStyleData();
      }
    });

    map.on('click', (e) => {
      if (pickLocationModeRef.current && onLocationPickedRef.current) {
        const match = globalGeoIndex.findDistrictAndRegion(e.lngLat.lat, e.lngLat.lng);
        onLocationPickedRef.current({
          lat: e.lngLat.lat,
          lon: e.lngLat.lng,
          district: match.district,
          region: match.region
        });
        return;
      }

      const clusterFeatures = map.queryRenderedFeatures(e.point, { layers: ['photos-clusters'] });
      if (clusterFeatures.length > 0) {
        const clusterId = clusterFeatures[0].properties?.cluster_id;
        const source = map.getSource('photosSource') as GeoJSONSource;
        if (source && clusterId !== undefined) {
          source.getClusterExpansionZoom(clusterId).then(zoom => {
            map.easeTo({
              center: (clusterFeatures[0].geometry as any).coordinates,
              zoom
            });
          }).catch(() => {});
        }
        return;
      }

      const pointFeatures = map.queryRenderedFeatures(e.point, { layers: ['photos-unclustered'] });
      if (pointFeatures.length > 0) {
        const pId = pointFeatures[0].properties?.id;
        const matched = photosRef.current.find(p => p.id === pId);
        if (matched) {
          if (matched.thumbId) {
            db.thumbs.get(matched.thumbId).then(thumb => {
              setSelectedPhotoModal({ photo: matched, thumb });
            });
          } else {
            setSelectedPhotoModal({ photo: matched });
          }
          return;
        }
      }

      const sightLayers = ['sights-points-low', 'sights-points-mid', 'sights-points-high'];
      const activeSightLayers = sightLayers.filter(l => map.getLayer(l));
      if (activeSightLayers.length > 0) {
        const bbox: [[number, number], [number, number]] = [
          [e.point.x - 8, e.point.y - 8],
          [e.point.x + 8, e.point.y + 8]
        ];
        const sightFeatures = map.queryRenderedFeatures(bbox, { layers: activeSightLayers });
        if (sightFeatures.length > 0) {
          const sId = sightFeatures[0].id || sightFeatures[0].properties?.id;
          if (sId) {
            openSightCard(String(sId));
            return;
          }
        }
      }

      let clickedDistrict: GeoDistrict | undefined;
      const districtFeatures = map.queryRenderedFeatures(e.point, { layers: ['districts-fill'] });
      if (districtFeatures.length > 0) {
        const dId = districtFeatures[0].id || districtFeatures[0].properties?.id;
        clickedDistrict = globalGeoIndex.getAllDistricts().find(d => d.id === dId);
      }

      let clickedRegion: GeoRegion | undefined = clickedDistrict
        ? globalGeoIndex.getRegionById(clickedDistrict.regionId)
        : undefined;
      const regionFeatures = clickedRegion ? [] : map.queryRenderedFeatures(e.point, { layers: ['regions-fill'] });
      if (regionFeatures.length > 0) {
        const rId = regionFeatures[0].id || regionFeatures[0].properties?.id;
        clickedRegion = globalGeoIndex.getRegionById(String(rId));
      }

      if (clickedDistrict || clickedRegion) {
        openDistrictCard(clickedDistrict, clickedRegion);
      }
    });

    return () => {
      if (applyFrame) cancelAnimationFrame(applyFrame);
      mapRef.current = null;
      fog.detach();
      map.remove();
      fogRef.current = null;
      (window as any).__map = null;
    };
  }, []);

  const appliedThemeRef = useRef(theme);

  useEffect(() => {
    const map = mapRef.current;
    if (map && appliedThemeRef.current !== theme) {
      appliedThemeRef.current = theme;
      const baseUrl = import.meta.env.BASE_URL || './';
      map.setStyle(buildMapStyle(theme, baseUrl));
    }
    if (fogRef.current) {
      fogRef.current.setTheme(theme === 'dark');
    }
  }, [theme]);

  const applyLayerVisibility = () => {
    const map = mapRef.current;
    if (!map || !map.style) return;
    const current = filtersRef.current;

    const setVis = (layerId: string, visible: boolean) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
      }
    };

    setVis('photos-clusters', current.photos);
    setVis('photos-clusters-count', current.photos);
    setVis('photos-unclustered', current.photos);
    setVis('sights-points-low', current.sights);
    setVis('sights-points-mid', current.sights);
    setVis('sights-points-high', current.sights);
    setVis('sights-labels', current.sights);
  };

  useEffect(() => {
    if (fogRef.current) {
      fogRef.current.setActive(filters.fog);
    }
    applyLayerVisibility();
    updateMapFeatureStates();
  }, [filters]);

  useEffect(() => {
    updateMapFeatureStates();
    updatePhotosGeoJson();

    if (fogRef.current) {
      const h3s = photos.map(p => p.h3).filter(Boolean);
      fogRef.current.setH3CellsFromPhotos(h3s);
    }

    if (activeCardRef.current) {
      openDistrictCard(activeCardRef.current.district, activeCardRef.current.region);
    }
    if (activeSightCardRef.current) {
      openSightCard(activeSightCardRef.current);
    }
  }, [photos, marks, geoReady, gameContext]);

  const updatePhotosGeoJson = () => {
    const map = mapRef.current;
    if (!map || !map.style) return;

    const source = map.getSource('photosSource') as GeoJSONSource | undefined;
    if (!source) return;

    const geojson = {
      type: 'FeatureCollection',
      features: photosRef.current.map(p => ({
        type: 'Feature',
        id: p.id,
        properties: {
          id: p.id,
          proof: p.proof,
          takenAt: p.takenAt,
          districtId: p.districtId,
          regionId: p.regionId
        },
        geometry: {
          type: 'Point',
          coordinates: [p.lon, p.lat]
        }
      }))
    };

    source.setData(geojson as any);
  };

  const updateMapFeatureStates = () => {
    const map = mapRef.current;
    if (!map || !map.style || !map.getSource('regionsSource') || !map.getSource('districtsSource')) return;

    const visitedDistrictsMap = new Map<string, ProofLevel>();
    const visitedRegionsMap = new Map<string, ProofLevel>();
    const wishlistIds = new Set<string>();

    for (const m of marksRef.current) {
      if (m.markType === 'visited_manual') {
        if (m.targetType === 'district') {
          visitedDistrictsMap.set(m.targetId, 'bronze');
        } else {
          visitedRegionsMap.set(m.targetId, 'bronze');
        }
      } else if (m.markType === 'wishlist') {
        wishlistIds.add(m.targetId);
      }
    }

    for (const p of photosRef.current) {
      if (p.districtId) {
        visitedDistrictsMap.set(p.districtId, p.proof);
      }
      if (p.regionId) {
        const cur = visitedRegionsMap.get(p.regionId);
        if (!cur || cur === 'bronze') {
          visitedRegionsMap.set(p.regionId, p.proof);
        }
      }
    }

    const showVisited = filtersRef.current.visited;
    const showWishlist = filtersRef.current.wishlist;

    const regionsWithDistricts = new Set<string>();
    for (const d of globalGeoIndex.getAllDistricts()) {
      regionsWithDistricts.add(d.regionId);
      const isVisited = showVisited && visitedDistrictsMap.has(d.id);
      const isWishlist = showWishlist && wishlistIds.has(d.id);
      const proof = visitedDistrictsMap.get(d.id);

      map.setFeatureState(
        { source: 'districtsSource', id: d.id },
        { visited: isVisited, proof, wishlist: isWishlist }
      );
    }

    for (const r of globalGeoIndex.getAllRegions()) {
      const isVisited = showVisited && visitedRegionsMap.has(r.id);
      const isWishlist = showWishlist && wishlistIds.has(r.id);
      const proof = visitedRegionsMap.get(r.id);
      const hasDistricts = regionsWithDistricts.has(r.id);

      map.setFeatureState(
        { source: 'regionsSource', id: r.id },
        { visited: isVisited, proof, wishlist: isWishlist, hasDistricts }
      );
    }

    if (map.getSource('sightsSource')) {
      const visitedSights = gameContextRef.current?.visitedSightIds || new Set<string>();
      for (const s of globalSightsIndex.getAll()) {
        const isVisited = visitedSights.has(s.id);
        const isWishlist = showWishlist && wishlistIds.has(s.id);
        map.setFeatureState(
          { source: 'sightsSource', id: s.id },
          { visited: isVisited, wishlist: isWishlist }
        );
      }
    }
  };

  const openSightCard = (sightId: string) => {
    activeSightCardRef.current = sightId;
    const sight = globalSightsIndex.getById(sightId);
    if (!sight) return;

    const visited = !!gameContextRef.current?.visitedSightIds.has(sight.id);
    const wishlist = marksRef.current.some(m => m.targetId === sight.id && m.markType === 'wishlist');
    const firstDate = gameContextRef.current?.visitedSightFirstDates.get(sight.id);

    let regionName: string | undefined;
    if (sight.regionId) {
      const reg = globalGeoIndex.getRegionById(sight.regionId);
      regionName = reg?.name;
    }
    let countryName: string | undefined;
    if (sight.country) {
      const c = globalGeoIndex.getAllCountries().find(cnt => cnt.id === sight.country);
      countryName = c?.name;
    }

    setSelectedSightEntity({
      sight,
      regionName,
      countryName,
      isVisited: visited,
      firstVisitedDate: firstDate,
      isWishlist: wishlist,
      distanceBonus: sight.regionId === homeRegionIdRef.current
        ? undefined
        : homeDistanceBonus(getHomePoint(), { lat: sight.lat, lon: sight.lon })
    });
  };

  const handleToggleSightWishlist = async () => {
    if (!selectedSightEntity) return;
    const targetId = selectedSightEntity.sight.id;
    if (selectedSightEntity.isWishlist) {
      await db.marks.where({ targetId, markType: 'wishlist' }).delete();
      setSelectedSightEntity({ ...selectedSightEntity, isWishlist: false });
    } else {
      await db.marks.put({
        id: `mark-wishlist-${targetId}`,
        targetId,
        targetType: 'sight',
        markType: 'wishlist',
        createdAt: new Date().toISOString(),
        country: selectedSightEntity.sight.country
      });
      setSelectedSightEntity({ ...selectedSightEntity, isWishlist: true });
    }
  };

  const openDistrictCard = async (district?: GeoDistrict, region?: GeoRegion) => {
    activeCardRef.current = { district, region };
    const matchedRegion = region || (district ? globalGeoIndex.getRegionById(district.regionId) : undefined);
    const targetId = district ? district.id : (matchedRegion ? matchedRegion.id : '');
    if (!targetId) return;

    const currentMarks = marksRef.current;
    const currentPhotos = photosRef.current;

    let isVisited = false;
    let proofLevel: ProofLevel | undefined;
    let isWishlist = currentMarks.some(m => m.targetId === targetId && m.markType === 'wishlist');
    const isHome = !!matchedRegion && matchedRegion.id === homeRegionIdRef.current;
    const targetCenter = district ? globalGeoIndex.getDistrictCenter(district.id) : (matchedRegion ? globalGeoIndex.getRegionCenter(matchedRegion.id) : undefined);
    const distanceBonus = isHome ? undefined : homeDistanceBonus(getHomePoint(), targetCenter);

    const matchingPhotos = currentPhotos.filter(p => district ? p.districtId === district.id : p.regionId === matchedRegion?.id);
    if (matchingPhotos.length > 0) {
      isVisited = true;
      proofLevel = matchingPhotos.some(p => p.proof === 'gold')
        ? 'gold'
        : (matchingPhotos.some(p => p.proof === 'silver') ? 'silver' : 'bronze');
    } else {
      const manual = currentMarks.find(m => m.targetId === targetId && m.markType === 'visited_manual');
      if (manual) {
        isVisited = true;
        proofLevel = 'bronze';
      }
    }

    const thumbIds = Array.from(new Set(matchingPhotos.map(p => p.thumbId).filter(Boolean))) as string[];
    const thumbs: ThumbnailRecord[] = [];
    for (const tid of thumbIds.slice(0, 10)) {
      const t = await db.thumbs.get(tid);
      if (t) thumbs.push(t);
    }

    let districtProgress: { visited: number; total: number } | undefined;
    if (matchedRegion) {
      const regDistricts = globalGeoIndex.getAllDistricts().filter(d => d.regionId === matchedRegion.id);
      if (regDistricts.length > 0) {
        const visitedInReg = regDistricts.filter(d => {
          return currentPhotos.some(p => p.districtId === d.id) || currentMarks.some(m => m.targetId === d.id && m.markType === 'visited_manual');
        }).length;
        districtProgress = { visited: visitedInReg, total: regDistricts.length };
      }
    }

    setSelectedEntity({
      district,
      region: matchedRegion,
      country: district?.country || matchedRegion?.country,
      isVisited,
      proofLevel,
      isWishlist,
      isHome,
      distanceBonus,
      districtProgress,
      thumbnails: thumbs
    });
  };

  const handleToggleWishlist = async () => {
    if (!selectedEntity) return;
    const targetId = selectedEntity.district?.id || selectedEntity.region?.id;
    const targetType = selectedEntity.district ? 'district' : 'region';
    if (!targetId) return;

    if (selectedEntity.isWishlist) {
      await db.marks.where({ targetId, markType: 'wishlist' }).delete();
      setSelectedEntity({ ...selectedEntity, isWishlist: false });
    } else {
      await db.marks.put({
        id: `mark-wishlist-${targetId}`,
        targetId,
        targetType,
        markType: 'wishlist',
        createdAt: new Date().toISOString(),
        country: selectedEntity.country
      });
      setSelectedEntity({ ...selectedEntity, isWishlist: true });
    }
  };

  const handleToggleManualVisit = async () => {
    if (!selectedEntity) return;
    const targetId = selectedEntity.district?.id || selectedEntity.region?.id;
    const targetType = selectedEntity.district ? 'district' : 'region';
    if (!targetId) return;

    if (selectedEntity.isVisited) {
      await db.marks.where({ targetId, markType: 'visited_manual' }).delete();
      setSelectedEntity({ ...selectedEntity, isVisited: false, proofLevel: undefined });
    } else {
      await db.marks.put({
        id: `mark-manual-${targetId}`,
        targetId,
        targetType,
        markType: 'visited_manual',
        createdAt: new Date().toISOString(),
        country: selectedEntity.country
      });
      setSelectedEntity({ ...selectedEntity, isVisited: true, proofLevel: 'bronze' });
    }
  };

  const handleSetHomeRegion = async () => {
    if (!selectedEntity || !selectedEntity.region) return;
    const regId = selectedEntity.region.id;

    await db.marks.where({ markType: 'home' }).delete();
    await updateSettings({ homeRegionId: regId });
    setSelectedEntity({ ...selectedEntity, isHome: true, distanceBonus: undefined });
  };

  return (
    <div className="map-view-wrapper">
      <TopBar
        levelInfo={levelInfo}
        filters={filters}
        onFilterChange={setFilters}
        onOpenLevelDetails={onOpenLevelDetails}
      />

      {pickLocationMode && (
        <div className="pick-location-banner">
          <span>Нажми на карту, чтобы выбрать точку для проверки нейросетью</span>
        </div>
      )}

      <div ref={mapContainerRef} className="map-container" />

      <div className="map-attribution">
        © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> (ODbL) · Natural Earth · geoBoundaries · OpenFreeMap · Mapzen
      </div>

      <DistrictSheet
        entity={selectedEntity}
        onClose={() => {
          activeCardRef.current = null;
          setSelectedEntity(null);
        }}
        onToggleWishlist={handleToggleWishlist}
        onToggleManualVisit={handleToggleManualVisit}
        onSetHomeRegion={handleSetHomeRegion}
        onSelectPhotoThumb={(thumb) => setSelectedPhotoModal({ thumb })}
      />

      <SightSheet
        entity={selectedSightEntity}
        onClose={() => {
          activeSightCardRef.current = null;
          setSelectedSightEntity(null);
        }}
        onToggleWishlist={handleToggleSightWishlist}
      />

      <PhotoDetailModal
        photo={selectedPhotoModal?.photo}
        thumb={selectedPhotoModal?.thumb}
        onClose={() => setSelectedPhotoModal(null)}
      />

      <style>{`
        .map-view-wrapper {
          position: relative;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }

        .map-container {
          width: 100%;
          height: 100%;
        }

        .map-attribution {
          position: absolute;
          bottom: 4px;
          right: 6px;
          background: rgba(14, 15, 18, 0.7);
          padding: 3px 6px;
          border-radius: 4px;
          font-size: 10px;
          color: var(--muted);
          z-index: 4;
          pointer-events: auto;
          backdrop-filter: blur(2px);
        }

        .map-attribution a {
          color: var(--text);
          text-decoration: none;
        }

        .map-attribution a:hover {
          text-decoration: underline;
        }

        .pick-location-banner {
          position: absolute;
          top: 64px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--accent);
          color: var(--text);
          font-weight: 600;
          font-size: 13px;
          padding: 8px 16px;
          border-radius: 20px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
          z-index: 10;
          pointer-events: none;
          text-align: center;
          white-space: nowrap;
        }

        @media (max-width: 600px) {
          .pick-location-banner {
            top: 90px;
            font-size: 12px;
            width: 90%;
            white-space: normal;
          }
        }
      `}</style>
    </div>
  );
};
