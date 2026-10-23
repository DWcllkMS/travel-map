import type { StyleSpecification } from 'maplibre-gl';
import { PALETTES } from '../theme/tokens';

export function createHatchImage(strokeColor: string = '#E5383B'): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 16, 16);
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2.5;

  ctx.beginPath();
  ctx.moveTo(0, 16);
  ctx.lineTo(16, 0);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-8, 8);
  ctx.lineTo(8, -8);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(8, 24);
  ctx.lineTo(24, 8);
  ctx.stroke();

  return ctx.getImageData(0, 0, 16, 16);
}

export function buildMapStyle(theme: 'dark' | 'light', baseUrl: string = ''): StyleSpecification {
  const p = PALETTES[theme];
  const dataPrefix = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

  return {
    version: 8,
    name: `TravelMap-${theme}`,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      openfreemap: {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet'
      },
      terrainDem: {
        type: 'raster-dem',
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 14
      },
      countriesSource: {
        type: 'geojson',
        data: `${dataPrefix}data/countries.json`
      },
      regionsSource: {
        type: 'geojson',
        data: `${dataPrefix}data/regions.json`,
        promoteId: 'id'
      },
      districtsSource: {
        type: 'geojson',
        data: `${dataPrefix}data/districts-RUS.json`,
        promoteId: 'id'
      },
      labelsSource: {
        type: 'geojson',
        data: `${dataPrefix}data/labels.json`
      },
      photosSource: {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        },
        cluster: true,
        clusterMaxZoom: 13,
        clusterRadius: 40
      }
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': p.mapLand
        }
      },
      {
        id: 'water',
        type: 'fill',
        source: 'openfreemap',
        'source-layer': 'water',
        paint: {
          'fill-color': p.mapWater
        }
      },
      {
        id: 'hillshading',
        type: 'hillshade',
        source: 'terrainDem',
        paint: {
          'hillshade-exaggeration': 0.65,
          'hillshade-shadow-color': p.mapHillshadeShadow,
          'hillshade-highlight-color': p.mapHillshadeHighlight,
          'hillshade-accent-color': p.mapHillshadeAccent
        }
      },
      {
        id: 'roads-low',
        type: 'line',
        source: 'openfreemap',
        'source-layer': 'transportation',
        minzoom: 6,
        filter: ['!=', ['get', 'class'], 'ferry'],
        paint: {
          'line-color': p.mapRoads,
          'line-width': 0.8,
          'line-opacity': 0.4
        }
      },
      {
        id: 'countries-outline',
        type: 'line',
        source: 'countriesSource',
        paint: {
          'line-color': p.mapCountryOutline,
          'line-width': 1.2
        }
      },
      {
        id: 'regions-fill',
        type: 'fill',
        source: 'regionsSource',
        paint: {
          'fill-color': [
            'case',
            ['boolean', ['feature-state', 'visited'], false],
            [
              'case',
              ['==', ['feature-state', 'proof'], 'bronze'],
              p.mapVisitedBronzeRegion,
              [
                'case',
                ['boolean', ['feature-state', 'hasDistricts'], true],
                p.mapVisitedFill,
                p.mapVisitedCityFill
              ]
            ],
            'rgba(0, 0, 0, 0)'
          ],
          'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'visited'], false],
            1.0,
            0.0
          ]
        }
      },
      {
        id: 'regions-outline',
        type: 'line',
        source: 'regionsSource',
        paint: {
          'line-color': [
            'case',
            ['boolean', ['feature-state', 'visited'], false],
            p.accent,
            ['boolean', ['feature-state', 'wishlist'], false],
            p.mapWishlistOutline,
            p.mapRegionOutline
          ],
          'line-width': [
            'case',
            ['boolean', ['feature-state', 'visited'], false],
            1.5,
            ['boolean', ['feature-state', 'wishlist'], false],
            1.5,
            0.6
          ],
          'line-dasharray': [
            'case',
            ['boolean', ['feature-state', 'wishlist'], false],
            ['literal', [2, 2]],
            ['literal', [1]]
          ]
        }
      },
      {
        id: 'districts-fill',
        type: 'fill',
        source: 'districtsSource',
        minzoom: 4.8,
        paint: {
          'fill-color': [
            'case',
            ['boolean', ['feature-state', 'visited'], false],
            [
              'case',
              ['==', ['feature-state', 'proof'], 'bronze'],
              p.mapVisitedBronzeDistrict,
              p.mapVisitedDistrict
            ],
            'rgba(0, 0, 0, 0)'
          ],
          'fill-pattern': [
            'case',
            [
              'all',
              ['boolean', ['feature-state', 'visited'], false],
              ['==', ['feature-state', 'proof'], 'bronze']
            ],
            'hatch-red',
            ''
          ],
          'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'visited'], false],
            1.0,
            0.0
          ]
        }
      },
      {
        id: 'districts-outline',
        type: 'line',
        source: 'districtsSource',
        minzoom: 4.8,
        paint: {
          'line-color': [
            'case',
            ['boolean', ['feature-state', 'visited'], false],
            p.accent,
            ['boolean', ['feature-state', 'wishlist'], false],
            p.mapWishlistOutline,
            p.mapRegionOutline
          ],
          'line-width': [
            'case',
            ['boolean', ['feature-state', 'visited'], false],
            1.2,
            ['boolean', ['feature-state', 'wishlist'], false],
            1.5,
            0.5
          ],
          'line-dasharray': [
            'case',
            ['boolean', ['feature-state', 'wishlist'], false],
            ['literal', [2, 2]],
            ['literal', [1]]
          ]
        }
      },
      {
        id: 'place-labels',
        type: 'symbol',
        source: 'openfreemap',
        'source-layer': 'place',
        minzoom: 4,
        filter: ['!in', 'class', 'country', 'state', 'province'],
        layout: {
          'text-field': '{name:ru}',
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 4, 10, 10, 14],
          'text-max-width': 8
        },
        paint: {
          'text-color': p.mapText,
          'text-halo-color': p.mapLand,
          'text-halo-width': 1.2
        }
      },
      {
        id: 'labels-countries',
        type: 'symbol',
        source: 'labelsSource',
        filter: ['==', ['get', 'type'], 'country'],
        minzoom: 2,
        maxzoom: 5,
        layout: {
          'text-field': '{name}',
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 2, 11, 5, 14],
          'text-max-width': 8,
          'text-padding': 3
        },
        paint: {
          'text-color': p.mapText,
          'text-halo-color': p.mapLand,
          'text-halo-width': 1.5
        }
      },
      {
        id: 'labels-regions',
        type: 'symbol',
        source: 'labelsSource',
        filter: ['==', ['get', 'type'], 'region'],
        minzoom: 4.5,
        maxzoom: 8,
        layout: {
          'text-field': '{name}',
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 4.5, 10, 8, 13],
          'text-max-width': 8,
          'text-padding': 2
        },
        paint: {
          'text-color': p.mapText,
          'text-halo-color': p.mapLand,
          'text-halo-width': 1.2
        }
      },
      {
        id: 'labels-districts',
        type: 'symbol',
        source: 'labelsSource',
        filter: ['==', ['get', 'type'], 'district'],
        minzoom: 8,
        layout: {
          'text-field': '{name}',
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 8, 10, 12, 13],
          'text-max-width': 8,
          'text-padding': 2
        },
        paint: {
          'text-color': p.mapText,
          'text-halo-color': p.mapLand,
          'text-halo-width': 1.2
        }
      },
      {
        id: 'photos-clusters',
        type: 'circle',
        source: 'photosSource',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': p.accent,
          'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 50, 24],
          'circle-stroke-width': 2,
          'circle-stroke-color': p.mapClusterStroke
        }
      },
      {
        id: 'photos-clusters-count',
        type: 'symbol',
        source: 'photosSource',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['Noto Sans Regular'],
          'text-size': 11
        },
        paint: {
          'text-color': p.mapClusterText
        }
      },
      {
        id: 'photos-unclustered',
        type: 'circle',
        source: 'photosSource',
        filter: ['!', ['has', 'point_count']],
        minzoom: 8,
        paint: {
          'circle-color': p.mapPhotoPointInner,
          'circle-radius': 5.5,
          'circle-stroke-width': 2.5,
          'circle-stroke-color': p.accent
        }
      }
    ]
  };
}
