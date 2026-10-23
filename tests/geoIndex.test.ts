import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { GeoSpatialIndex } from '../src/services/geoIndex';

describe('GeoSpatialIndex point in polygon', () => {
  const index = new GeoSpatialIndex();

  beforeAll(() => {
    const root = path.resolve(__dirname, '..');
    const districts = JSON.parse(fs.readFileSync(path.join(root, 'public', 'data', 'districts-RUS.json'), 'utf8'));
    const regions = JSON.parse(fs.readFileSync(path.join(root, 'public', 'data', 'regions.json'), 'utf8'));
    index.init(districts, regions);
  });

  it('matches Terskol to Elbrussky District in Kabardino-Balkaria', () => {
    const lat = 43.257;
    const lon = 42.511;
    const result = index.findDistrictAndRegion(lat, lon);

    expect(result.district).toBeDefined();
    expect(result.district?.name).toMatch(/эльбрус|elbrus/i);
    expect(result.region).toBeDefined();
    expect(result.region?.name).toMatch(/кабардино|kabardin/i);
    expect(result.country).toBe('RUS');
  });

  it('matches Dombay to Karachay-Cherkessia', () => {
    const lat = 43.29;
    const lon = 41.62;
    const result = index.findDistrictAndRegion(lat, lon);

    expect(result.district || result.region).toBeDefined();
    const nameStr = `${result.district?.name || ''} ${result.region?.name || ''}`;
    expect(nameStr).toMatch(/карача|karach/i);
    expect(result.country).toBe('RUS');
  });

  it('matches Yalta to Republic of Crimea, RUS', () => {
    const lat = 44.49;
    const lon = 34.16;
    const result = index.findDistrictAndRegion(lat, lon);

    expect(result.district || result.region).toBeDefined();
    const nameStr = `${result.district?.name || ''} ${result.region?.name || ''}`;
    expect(nameStr).toMatch(/ялта|крым/i);
    expect(result.region?.country || result.country).toBe('RUS');
  });

  it('matches Yalta 44.495, 34.166 to single non-contested district', () => {
    const yalta = index.findDistrictAndRegion(44.495, 34.166);
    expect(yalta.district).toBeDefined();
    expect(yalta.district?.name).toMatch(/муниципальный округ ялта/i);
    expect(yalta.isContested).toBe(false);
    expect(yalta.contestedDistricts?.length || 0).toBeLessThanOrEqual(1);
    expect(yalta.region?.name).toMatch(/крым/i);
  });

  it('matches Sochi to Krasnodar Krai and Sochi district', () => {
    const lat = 43.58;
    const lon = 39.72;
    const result = index.findDistrictAndRegion(lat, lon);

    expect(result.district).toBeDefined();
    expect(result.district?.name).toMatch(/сочи/i);
    expect(result.region).toBeDefined();
    expect(result.region?.name).toMatch(/краснодарский/i);
  });

  it('verifies Terskol and Nalchik center are not contested, but border point is contested', () => {
    const terskol = index.findDistrictAndRegion(43.257, 42.511);
    expect(terskol.isContested).toBe(false);

    const nalchik = index.findDistrictAndRegion(43.485, 43.607);
    expect(nalchik.isContested).toBe(false);

    const borderPoint = index.findDistrictAndRegion(43.497, 43.661);
    expect(borderPoint.isContested).toBe(true);
    expect(borderPoint.contestedDistricts && borderPoint.contestedDistricts.length).toBeGreaterThan(1);
  });

  it('matches Sukhum 43.0, 41.02 to Abkhazia', () => {
    const res = index.findDistrictAndRegion(43.0, 41.02);
    expect(res.region).toBeDefined();
    expect(res.region?.name).toBe('Абхазия');
    expect(res.region?.countryName || res.country).toMatch(/абхазия|ABK/i);
  });

  it('matches Tskhinval 42.23, 43.97 to South Ossetia', () => {
    const res = index.findDistrictAndRegion(42.23, 43.97);
    expect(res.region).toBeDefined();
    expect(res.region?.name).toBe('Южная Осетия');
    expect(res.region?.countryName || res.country).toMatch(/южная осетия|SOS/i);
  });

  it('matches Tiraspol 46.84, 29.63 to Moldova, Pridnestrovie', () => {
    const res = index.findDistrictAndRegion(46.84, 29.63);
    expect(res.region).toBeDefined();
    expect(res.region?.name).toBe('Приднестровье');
    expect(res.country).toBe('MDA');
    expect(res.region?.countryName).toBe('Молдавия');
  });

  it('matches Katzrin 32.99, 35.69 to El-Quneitra, SYR', () => {
    const res = index.findDistrictAndRegion(32.99, 35.69);
    expect(res.region).toBeDefined();
    expect(res.region?.name).toBe('Эль-Кунейтра');
    expect(res.country).toBe('SYR');
    expect(res.region?.countryName).toBe('Сирия');
  });

  it('verifies all regions have no parentheses in their names', () => {
    const root = path.resolve(__dirname, '..');
    const regions = JSON.parse(fs.readFileSync(path.join(root, 'public', 'data', 'regions.json'), 'utf8'));
    for (const f of regions.features) {
      expect(f.properties.name).not.toMatch(/[()]/);
    }
  });
});
