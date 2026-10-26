import React, { useEffect, useRef, useState } from 'react';
import maplibregl, { type Map as MapLibreInstance, type GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { buildMapStyle, createHatchImage } from '../services/mapStyle';
import { FogOfWarOverlay } from '../services/fogLayer';
import { TopBar, type MapFilters } from './TopBar';
import { DistrictSheet, type SelectedEntity } from './DistrictSheet';
import { SightSheet, type SelectedSightEntity } from './SightSheet';
import { PhotoDetailModal } from './PhotoDetailModal';
import { PhotoClusterSheet, type PhotoClusterSelection } from './PhotoClusterSheet';
import { TimelapseControlPanel } from './TimelapseControlPanel';
import { buildTimelapseSteps, computeBaseStepDuration, type TimelapseStep } from '../services/timelapseService';
import { globalGeoIndex } from '../services/geoIndex';
import { globalSightsIndex } from '../services/sightsIndex';
import { db, updateSettings } from '../services/db';
import { homeDistanceBonus } from '../services/gameService';
import type { UserLevelInfo, PhotoRecord, ThumbnailRecord, MarkRecord, GeoDistrict, GeoRegion, ProofLevel, GameContext } from '../types';

const FRESH_MS = 1600;
const PING_MS = 1400;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
};

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
  fitBoundsTarget?: { bounds: [[number, number], [number, number]]; timestamp: number } | null;
  onTimelapseActiveChange?: (active: boolean) => void;
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
  onLocationPicked,
  fitBoundsTarget,
  onTimelapseActiveChange
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
  const [photoCluster, setPhotoCluster] = useState<(PhotoClusterSelection & { center: [number, number]; zoom: number }) | null>(null);
  const [selectedPhotoModal, setSelectedPhotoModal] = useState<{ photo?: PhotoRecord; thumb?: ThumbnailRecord } | null>(null);

  const [timelapseActive, setTimelapseActive] = useState(false);
  const timelapseActiveRef = useRef(timelapseActive);
  timelapseActiveRef.current = timelapseActive;

  const [timelapseSteps, setTimelapseSteps] = useState<TimelapseStep[]>([]);
  const timelapseStepsRef = useRef<TimelapseStep[]>([]);
  timelapseStepsRef.current = timelapseSteps;
  const [timelapseIndex, setTimelapseIndex] = useState(0);
  const timelapseIndexRef = useRef(timelapseIndex);
  timelapseIndexRef.current = timelapseIndex;

  const [timelapsePlaying, setTimelapsePlaying] = useState(false);
  const [timelapseSpeed, setTimelapseSpeed] = useState(1);
  const [timelapseFollowCamera, setTimelapseFollowCamera] = useState(true);
  const timelapseFollowCameraRef = useRef(timelapseFollowCamera);
  timelapseFollowCameraRef.current = timelapseFollowCamera;
  const [timelapseNotification, setTimelapseNotification] = useState<{ key: number; items: string[] } | null>(null);
  const timelapseSpeedRef = useRef(1);
  timelapseSpeedRef.current = timelapseSpeed;
  const freshRef = useRef(new Map<string, number>());
  const pingStartRef = useRef(0);
  const fxFrameRef = useRef(0);
  const [timelapseFinished, setTimelapseFinished] = useState(false);
  const applyTimelapseStepRef = useRef<(targetIndex: number, isForwardDelta?: boolean) => void>(() => {});

  const canTimelapse = photos.length > 0 || marks.some(m => m.markType === 'visited_manual');
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
    return () => {
      onTimelapseActiveChange?.(false);
    };
  }, [onTimelapseActiveChange]);

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
        if (timelapseActiveRef.current) {
          applyTimelapseStepRef.current(timelapseIndexRef.current, false);
          return;
        }
        applyLayerVisibility();
        updateMapFeatureStates();
        updatePhotosGeoJson();
      });
    };

    const ownSources = new Set(['regionsSource', 'districtsSource', 'photosSource', 'sightsSource']);
    map.on('styleimagemissing', (e) => {
      if (e.id === 'hatch-red') {
        if (!map.hasImage('hatch-red')) {
          map.addImage('hatch-red', createHatchImage());
        }
      }
    });
    map.on('style.load', applyAllStyleData);
    map.on('load', applyAllStyleData);
    map.on('sourcedata', (e) => {
      if (e.sourceId === 'photosSource' && timelapseActiveRef.current) return;
      if (e.sourceId && ownSources.has(e.sourceId) && e.isSourceLoaded && e.sourceDataType === 'metadata') {
        applyAllStyleData();
      }
    });

    map.on('click', (e) => {
      if (timelapseActiveRef.current) return;
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
          const center = (clusterFeatures[0].geometry as any).coordinates as [number, number];
          Promise.all([
            source.getClusterLeaves(clusterId, Infinity, 0),
            source.getClusterExpansionZoom(clusterId)
          ]).then(([leaves, zoom]) => {
            const ids = new Set(leaves.map(l => l.properties?.id));
            const list = photosRef.current.filter(p => ids.has(p.id));
            if (list.length === 0) return;
            setPhotoCluster({ photos: list, canZoom: zoom > map.getZoom() + 0.5, center, zoom });
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

  useEffect(() => {
    if (!fitBoundsTarget || !mapRef.current) return;
    try {
      mapRef.current.resize();
      mapRef.current.fitBounds(fitBoundsTarget.bounds, {
        padding: 80,
        maxZoom: 12,
        duration: 900
      });
    } catch {
    }
  }, [fitBoundsTarget]);

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
    if (timelapseActiveRef.current) return;
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

    const bronzeDistricts: string[] = [];
    const bronzeRegions: string[] = [];

    const regionsWithDistricts = new Set<string>();
    for (const d of globalGeoIndex.getAllDistricts()) {
      regionsWithDistricts.add(d.regionId);
      const isVisited = showVisited && visitedDistrictsMap.has(d.id);
      const isWishlist = showWishlist && wishlistIds.has(d.id);
      const proof = visitedDistrictsMap.get(d.id);
      if (isVisited && proof === 'bronze') {
        bronzeDistricts.push(d.id);
      }

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
      if (isVisited && proof === 'bronze' && !hasDistricts) {
        bronzeRegions.push(r.id);
      }

      map.setFeatureState(
        { source: 'regionsSource', id: r.id },
        { visited: isVisited, proof, wishlist: isWishlist, hasDistricts }
      );
    }

    if (map.getLayer('districts-hatch')) {
      map.setFilter('districts-hatch', ['in', ['get', 'id'], ['literal', bronzeDistricts]]);
    }
    if (map.getLayer('regions-hatch')) {
      map.setFilter('regions-hatch', ['in', ['get', 'id'], ['literal', bronzeRegions]]);
    }

    if (map.getSource('sightsSource')) {
      const visitedSights = gameContextRef.current?.visitedSightIds || new Set<string>();
      const candidateSights = gameContextRef.current?.candidateSightIds || new Set<string>();
      for (const s of globalSightsIndex.getAll()) {
        const isVisited = showVisited && visitedSights.has(s.id);
        const isCandidate = showVisited && candidateSights.has(s.id);
        const isWishlist = showWishlist && wishlistIds.has(s.id);
        map.setFeatureState(
          { source: 'sightsSource', id: s.id },
          { visited: isVisited, candidate: isCandidate, wishlist: isWishlist }
        );
      }
    }
  };

  const openSightCard = (sightId: string) => {
    activeSightCardRef.current = sightId;
    const sight = globalSightsIndex.getById(sightId);
    if (!sight) return;

    const visited = !!gameContextRef.current?.visitedSightIds.has(sight.id);
    const candidate = !visited && !!gameContextRef.current?.candidateSightIds?.has(sight.id);
    const manual = marksRef.current.some(m => m.targetId === sight.id && m.markType === 'visited_manual');
    const wishlist = marksRef.current.some(m => m.targetId === sight.id && m.markType === 'wishlist');
    const firstDate = gameContextRef.current?.visitedSightFirstDates.get(sight.id)
      || marksRef.current.find(m => m.targetId === sight.id && m.markType === 'visited_manual')?.createdAt;
    const nearbyPhotos = candidate || visited
      ? photosRef.current.filter(p => {
          if (p.proof !== 'gold' && p.proof !== 'silver') return false;
          const dx = (p.lon - sight.lon) * Math.cos((sight.lat * Math.PI) / 180) * 111320;
          const dy = (p.lat - sight.lat) * 111320;
          return Math.hypot(dx, dy) <= sight.radius;
        }).length
      : 0;

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
      isCandidate: candidate,
      isManual: manual,
      nearbyPhotos,
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

  const setSightVisit = async (decision: 'confirm' | 'reject' | 'manual' | 'clear') => {
    if (!selectedSightEntity) return;
    const sight = selectedSightEntity.sight;
    const targetId = sight.id;
    await db.marks.where('targetId').equals(targetId)
      .filter(m => m.markType === 'sight_confirmed' || m.markType === 'sight_rejected' || m.markType === 'visited_manual')
      .delete();
    if (decision !== 'clear') {
      const markType = decision === 'confirm' ? 'sight_confirmed' : decision === 'reject' ? 'sight_rejected' : 'visited_manual';
      await db.marks.put({
        id: `mark-${markType}-${targetId}`,
        targetId,
        targetType: 'sight',
        markType,
        createdAt: new Date().toISOString(),
        country: sight.country
      });
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

  const clearTimelapseFx = () => {
    if (fxFrameRef.current) {
      cancelAnimationFrame(fxFrameRef.current);
      fxFrameRef.current = 0;
    }
    const map = mapRef.current;
    if (map && map.style) {
      for (const key of freshRef.current.keys()) {
        const [source, id] = key.split('|');
        if (map.getSource(source)) map.setFeatureState({ source, id }, { fresh: 0 });
      }
      const ping = map.getSource('timelapsePingSource') as GeoJSONSource | undefined;
      ping?.setData({ type: 'FeatureCollection', features: [] });
    }
    freshRef.current.clear();
    pingStartRef.current = 0;
  };

  const runTimelapseFx = () => {
    if (fxFrameRef.current) return;
    const tick = (now: number) => {
      fxFrameRef.current = 0;
      const map = mapRef.current;
      if (!map || !map.style) return;
      let active = false;

      for (const [key, start] of freshRef.current) {
        const [source, id] = key.split('|');
        const k = Math.max(0, (now - start) / FRESH_MS);
        if (k >= 1) {
          map.setFeatureState({ source, id }, { fresh: 0 });
          freshRef.current.delete(key);
          continue;
        }
        const value = k < 0.15 ? k / 0.15 : 1 - easeOutCubic((k - 0.15) / 0.85);
        map.setFeatureState({ source, id }, { fresh: Math.max(0, value) });
        active = true;
      }

      if (pingStartRef.current && map.getLayer('timelapse-ping-ring')) {
        const k = Math.max(0, (now - pingStartRef.current) / PING_MS);
        if (k >= 1) {
          pingStartRef.current = 0;
          map.setPaintProperty('timelapse-ping-ring', 'circle-stroke-opacity', 0);
          map.setPaintProperty('timelapse-ping-dot', 'circle-opacity', 0);
          map.setPaintProperty('timelapse-ping-dot', 'circle-stroke-opacity', 0);
        } else {
          const e = easeOutCubic(k);
          const dot = k < 0.12 ? k / 0.12 : k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
          map.setPaintProperty('timelapse-ping-ring', 'circle-radius', 4 + 20 * e);
          map.setPaintProperty('timelapse-ping-ring', 'circle-stroke-opacity', 0.9 * (1 - e));
          map.setPaintProperty('timelapse-ping-dot', 'circle-radius', k < 0.2 ? 3 + 7.5 * k : 4.5 - 1.5 * Math.min(1, (k - 0.2) / 0.3));
          map.setPaintProperty('timelapse-ping-dot', 'circle-opacity', dot);
          map.setPaintProperty('timelapse-ping-dot', 'circle-stroke-opacity', dot);
          active = true;
        }
      }

      if (active) fxFrameRef.current = requestAnimationFrame(tick);
    };
    fxFrameRef.current = requestAnimationFrame(tick);
  };

  const startTimelapseFx = (step: TimelapseStep) => {
    const map = mapRef.current;
    if (!map || !map.style || prefersReducedMotion()) return;
    const now = performance.now();
    for (const d of step.districtsDelta) freshRef.current.set(`districtsSource|${d.id}`, now);
    for (const r of step.regionsDelta) freshRef.current.set(`regionsSource|${r.id}`, now);

    const seen = new Set<string>();
    const points: [number, number][] = [];
    for (const p of step.newPhotos) {
      if (typeof p.lon !== 'number' || typeof p.lat !== 'number') continue;
      const key = `${p.lon.toFixed(2)}|${p.lat.toFixed(2)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      points.push([p.lon, p.lat]);
      if (points.length >= 60) break;
    }
    if (points.length === 0 && step.center && step.regionsDelta.length > 0) points.push(step.center);
    const ping = map.getSource('timelapsePingSource') as GeoJSONSource | undefined;
    if (ping && points.length > 0) {
      ping.setData({
        type: 'FeatureCollection',
        features: points.map(c => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: c } }))
      });
      pingStartRef.current = now;
    }
    runTimelapseFx();
  };

  const moveTimelapseCamera = (step: TimelapseStep, first: boolean) => {
    const map = mapRef.current;
    if (!map || !step.center) return;
    const container = map.getContainer();
    const w = container.clientWidth;
    const h = container.clientHeight;
    const pt = map.project(step.center);
    const inside = pt.x > w * 0.18 && pt.x < w * 0.82 && pt.y > h * 0.18 && pt.y < h * 0.5;
    if (!first && inside) return;

    const interval = computeBaseStepDuration(timelapseStepsRef.current.length) / timelapseSpeedRef.current;
    const zoom = first ? Math.min(Math.max(map.getZoom(), 3.5), 5) : Math.min(Math.max(map.getZoom(), 3.2), 6);
    const offset: [number, number] = [0, -Math.round(h * 0.14)];
    const from = map.getCenter();
    const km = haversineKm(from.lat, from.lng, step.center[1], step.center[0]);
    const reduce = prefersReducedMotion();

    if (km > 1500 && !reduce) {
      map.flyTo({
        center: step.center,
        zoom: Math.min(zoom, 4.5),
        offset,
        duration: Math.min(2600, Math.max(1200, interval * 1.6)),
        curve: 1.3,
        essential: true
      });
    } else {
      map.easeTo({
        center: step.center,
        zoom,
        offset,
        duration: reduce ? 0 : Math.min(1800, Math.max(500, interval * 0.95)),
        easing: easeInOutCubic
      });
    }
  };

  const applyTimelapseStep = (targetIndex: number, isForwardDelta: boolean = false) => {
    const map = mapRef.current;
    if (!map || !map.style) return;
    const steps = timelapseStepsRef.current;
    const step = steps[targetIndex];
    if (!step) return;

    if (isForwardDelta) {
      for (const d of step.districtsDelta) {
        map.setFeatureState({ source: 'districtsSource', id: d.id }, { visited: true, proof: d.proof, wishlist: false });
      }
      for (const r of step.regionsDelta) {
        map.setFeatureState({ source: 'regionsSource', id: r.id }, { visited: true, proof: r.proof, wishlist: false, hasDistricts: r.hasDistricts });
      }
    } else {
      clearTimelapseFx();
      map.removeFeatureState({ source: 'districtsSource' });
      map.removeFeatureState({ source: 'regionsSource' });

      const targetDistrictsMap = new Map<string, ProofLevel>();
      const targetRegionsMap = new Map<string, { proof: ProofLevel; hasDistricts: boolean }>();

      for (let i = 0; i <= targetIndex; i++) {
        const st = steps[i];
        for (const d of st.districtsDelta) {
          targetDistrictsMap.set(d.id, d.proof);
        }
        for (const r of st.regionsDelta) {
          targetRegionsMap.set(r.id, { proof: r.proof, hasDistricts: r.hasDistricts });
        }
      }

      for (const [dId, proof] of targetDistrictsMap.entries()) {
        map.setFeatureState({ source: 'districtsSource', id: dId }, { visited: true, proof, wishlist: false });
      }
      for (const [rId, { proof, hasDistricts }] of targetRegionsMap.entries()) {
        map.setFeatureState({ source: 'regionsSource', id: rId }, { visited: true, proof, wishlist: false, hasDistricts });
      }
    }

    const bronzeDistricts: string[] = [];
    const bronzeRegions: string[] = [];
    const regionsWithDistricts = new Set(globalGeoIndex.getAllDistricts().map(d => d.regionId));
    for (let i = 0; i <= targetIndex; i++) {
      const st = steps[i];
      for (const d of st.districtsDelta) {
        if (d.proof === 'bronze') bronzeDistricts.push(d.id);
      }
      for (const r of st.regionsDelta) {
        if (r.proof === 'bronze' && !regionsWithDistricts.has(r.id)) bronzeRegions.push(r.id);
      }
    }
    if (map.getLayer('districts-hatch')) {
      map.setFilter('districts-hatch', ['in', ['get', 'id'], ['literal', bronzeDistricts]]);
    }
    if (map.getLayer('regions-hatch')) {
      map.setFilter('regions-hatch', ['in', ['get', 'id'], ['literal', bronzeRegions]]);
    }

    const source = map.getSource('photosSource') as GeoJSONSource | undefined;
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: step.cumulativePhotos.map(p => ({
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
      });
    }

    fogRef.current?.setH3CellsFromPhotos(step.cumulativeH3Cells);

    if (isForwardDelta) {
      startTimelapseFx(step);
      if (timelapseFollowCameraRef.current) moveTimelapseCamera(step, false);
    }

    setTimelapseNotification(step.newDiscoveries.length > 0 ? { key: targetIndex, items: step.newDiscoveries } : null);
  };
  applyTimelapseStepRef.current = applyTimelapseStep;

  useEffect(() => {
    if (!timelapseActive || !timelapsePlaying || timelapseSteps.length === 0) return;

    const base = computeBaseStepDuration(timelapseSteps.length);
    const intervalMs = Math.max(50, Math.round(base / timelapseSpeed));

    const timer = setTimeout(() => {
      const cur = timelapseIndexRef.current;
      if (cur < timelapseSteps.length - 1) {
        const next = cur + 1;
        setTimelapseIndex(next);
        applyTimelapseStep(next, true);
      } else {
        setTimelapsePlaying(false);
        setTimelapseFinished(true);
        showTimelapseOverview();
      }
    }, intervalMs);

    return () => clearTimeout(timer);
  }, [timelapseActive, timelapsePlaying, timelapseIndex, timelapseSpeed, timelapseSteps]);

  useEffect(() => () => {
    if (fxFrameRef.current) cancelAnimationFrame(fxFrameRef.current);
  }, []);

  const showTimelapseOverview = () => {
    const map = mapRef.current;
    const steps = timelapseStepsRef.current;
    const last = steps[steps.length - 1];
    if (!map || !last || !timelapseFollowCameraRef.current) return;
    const pts: [number, number][] = last.cumulativePhotos
      .filter(p => typeof p.lon === 'number' && typeof p.lat === 'number')
      .map(p => [p.lon, p.lat]);
    for (const st of steps) if (st.center) pts.push(st.center);
    if (pts.length < 2) return;
    const bounds = new maplibregl.LngLatBounds(pts[0], pts[0]);
    for (const pt of pts) bounds.extend(pt);
    const h = map.getContainer().clientHeight;
    const w = map.getContainer().clientWidth;
    map.fitBounds(bounds, {
      padding: { top: Math.round(h * 0.18), bottom: Math.round(h * 0.38), left: Math.round(w * 0.08), right: Math.round(w * 0.08) },
      maxZoom: 7,
      duration: prefersReducedMotion() ? 0 : 1800,
      essential: true
    });
  };

  const playFromStart = (steps: TimelapseStep[]) => {
    applyTimelapseStep(0, false);
    startTimelapseFx(steps[0]);
    moveTimelapseCamera(steps[0], true);
  };

  const handleStartTimelapse = () => {
    const steps = buildTimelapseSteps(photosRef.current, marksRef.current, {
      getRegionName: id => globalGeoIndex.getRegionById(id)?.name || id,
      getCountryName: c => globalGeoIndex.getCountryById(c)?.name || c,
      getDistrictById: id => globalGeoIndex.getAllDistricts().find(d => d.id === id),
      getRegionCenter: id => {
        const c = globalGeoIndex.getRegionCenter(id);
        return c ? [c.lon, c.lat] : undefined;
      },
      hasDistricts: id => globalGeoIndex.getAllDistricts().some(d => d.regionId === id)
    });
    if (steps.length === 0) return;

    setSelectedEntity(null);
    setSelectedSightEntity(null);
    setSelectedPhotoModal(null);
    setPhotoCluster(null);
    activeCardRef.current = null;
    activeSightCardRef.current = null;

    timelapseStepsRef.current = steps;
    timelapseIndexRef.current = 0;
    setTimelapseSteps(steps);
    setTimelapseIndex(0);
    setTimelapseActive(true);
    setTimelapsePlaying(true);
    setTimelapseFinished(false);
    onTimelapseActiveChange?.(true);

    playFromStart(steps);
  };

  const handleCloseTimelapse = () => {
    clearTimelapseFx();
    setTimelapseActive(false);
    setTimelapsePlaying(false);
    setTimelapseFinished(false);
    setTimelapseNotification(null);
    onTimelapseActiveChange?.(false);
    const map = mapRef.current;
    if (!map || !map.style) return;
    try {
      if (!map.hasImage('hatch-red')) {
        map.addImage('hatch-red', createHatchImage());
      }
    } catch {}
    applyLayerVisibility();
    updateMapFeatureStates();
    updatePhotosGeoJson();
    if (fogRef.current) {
      const h3s = photosRef.current.map(p => p.h3).filter(Boolean);
      fogRef.current.setH3CellsFromPhotos(h3s);
    }
  };

  const handleScrub = (idx: number) => {
    setTimelapseIndex(idx);
    setTimelapseFinished(idx === timelapseSteps.length - 1);
    applyTimelapseStep(idx, false);
  };

  const handleReplay = () => {
    setTimelapseIndex(0);
    timelapseIndexRef.current = 0;
    setTimelapseFinished(false);
    setTimelapsePlaying(true);
    if (timelapseStepsRef.current.length > 0) playFromStart(timelapseStepsRef.current);
  };

  return (
    <div className="map-view-wrapper">
      <TopBar
        levelInfo={levelInfo}
        filters={filters}
        onFilterChange={setFilters}
        onOpenLevelDetails={onOpenLevelDetails}
        canTimelapse={canTimelapse}
        timelapseActive={timelapseActive}
        onStartTimelapse={handleStartTimelapse}
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
        onSetVisit={setSightVisit}
      />

      <PhotoClusterSheet
        selection={photoCluster}
        onClose={() => setPhotoCluster(null)}
        onZoomIn={() => {
          const map = mapRef.current;
          if (map && photoCluster) {
            map.easeTo({ center: photoCluster.center, zoom: Math.min(photoCluster.zoom + 0.5, 14), duration: 700 });
          }
          setPhotoCluster(null);
        }}
        onSelectPhoto={(photo, thumb) => setSelectedPhotoModal({ photo, thumb })}
      />

      <PhotoDetailModal
        photo={selectedPhotoModal?.photo}
        thumb={selectedPhotoModal?.thumb}
        onClose={() => setSelectedPhotoModal(null)}
      />

      {timelapseActive && timelapseSteps[timelapseIndex] && (
        <TimelapseControlPanel
          step={timelapseSteps[timelapseIndex]}
          stepIndex={timelapseIndex}
          totalSteps={timelapseSteps.length}
          startLabel={timelapseSteps[0].formattedDate}
          endLabel={timelapseSteps[timelapseSteps.length - 1].formattedDate}
          isPlaying={timelapsePlaying}
          isFinished={timelapseFinished}
          speed={timelapseSpeed}
          followCamera={timelapseFollowCamera}
          notification={timelapseNotification}
          onTogglePlay={() => setTimelapsePlaying(!timelapsePlaying)}
          onScrub={handleScrub}
          onSpeedChange={setTimelapseSpeed}
          onToggleFollow={() => setTimelapseFollowCamera(!timelapseFollowCamera)}
          onReplay={handleReplay}
          onClose={handleCloseTimelapse}
        />
      )}

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
