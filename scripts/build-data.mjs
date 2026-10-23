import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mapshaper from 'mapshaper';
import osmtogeojson from 'osmtogeojson';
import * as turfHelpers from '@turf/helpers';
import turfArea from '@turf/area';
import turfCentroid from '@turf/centroid';
import turfDistance from '@turf/distance';
import turfBooleanPointInPolygon from '@turf/boolean-point-in-polygon';
import turfPointOnFeature from '@turf/point-on-feature';
import turfDifference from '@turf/difference';
import turfIntersect from '@turf/intersect';
import polygonClipping from 'polygon-clipping';
import Flatbush from 'flatbush';

const intersect = turfIntersect.default || turfIntersect;
const difference = turfDifference.default || turfDifference;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const cacheDir = path.join(rootDir, 'data-cache');
const outDir = path.join(rootDir, 'public', 'data');

if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

async function downloadCached(url, cacheFileName) {
  const filePath = path.join(cacheDir, cacheFileName);
  if (fs.existsSync(filePath) && fs.statSync(filePath).size > 1000) {
    return filePath;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filePath, buf);
  return filePath;
}

const overpassEndpoints = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
];

async function fetchOverpassCached(query, cacheFileName) {
  const filePath = path.join(cacheDir, cacheFileName);
  if (fs.existsSync(filePath) && fs.statSync(filePath).size > 1000) {
    return filePath;
  }
  for (const ep of overpassEndpoints) {
    try {
      const res = await fetch(ep, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query),
        headers: {
          'User-Agent': 'TravelMapDataCollector/1.0',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        }
      });
      if (res.ok) {
        const text = await res.text();
        if (text.startsWith('{')) {
          fs.writeFileSync(filePath, text, 'utf8');
          return filePath;
        }
      }
    } catch {
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw new Error(`Failed to fetch Overpass data for ${cacheFileName}`);
}

function getBBox(feature) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  function walk(coords) {
    if (typeof coords[0] === 'number') {
      const [x, y] = coords;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    } else {
      for (const c of coords) walk(c);
    }
  }
  walk(feature.geometry.coordinates);
  return [minX, minY, maxX, maxY];
}

function toMultiPolygonCoords(geom) {
  if (geom.type === 'Polygon') return [geom.coordinates];
  if (geom.type === 'MultiPolygon') return geom.coordinates;
  return [];
}

const PREFIX_REGEX = /^(уезд|ил|округ|провинция|департамент|община|район)\s+/i;

const COUNTRY_SHORT_NAMES = {
  CHN: 'Китай',
  COD: 'ДР Конго',
  COG: 'Конго',
  ARE: 'ОАЭ',
  CAF: 'ЦАР',
  KOR: 'Южная Корея',
  HTI: 'Гаити',
  ATF: 'Французские Южные территории',
};

const SPECIAL_OVERRIDES = {
  'RUS-2399': 'Алтайский край',
  'RUS-2400': 'Республика Алтай',
  'RUS-283': 'Республика Крым',
  'RUS-5482': 'Севастополь',
  'RUS-DNR': 'Донецкая Народная Республика',
  'RUS-LNR': 'Луганская Народная Республика',
  'RUS-ZPR': 'Запорожская область',
  'RUS-KHS': 'Херсонская область',
  'RUS-2280': 'Карачаево-Черкесия',
  'RUS-2304': 'Кабардино-Балкария',
  'RUS-2305': 'Республика Северная Осетия-Алания',
  'RUS-2303': 'Ингушетия',
  'RUS-2416': 'Чечня',
  'RUS-2417': 'Дагестан',
  'RUS-2353': 'Карелия',
  'RUS-2606': 'Бурятия',
  'RUS-2605': 'Тыва',
  'RUS-2612': 'Якутия',
  'RUS-2390': 'Калмыкия',
  'RUS-2378': 'Республика Башкортостан',
  'RUS-2396': 'Ханты-Мансийский автономный округ — Югра',
  'RUS-2394': 'Татарстан',
  'RUS-2402': 'Хакасия',
  'RUS-2372': 'Мордовия',
  'RUS-2389': 'Чувашия',
  'RUS-2385': 'Марий Эл',
  'RUS-2387': 'Удмуртия',
  'RUS-2383': 'Республика Коми',
  'RUS-2279': 'Адыгея',

  'MDA-1628': 'Приднестровье',
  'MDA-1645': 'Рыбницкий район',
  'ARE-344': 'Нейтральная зона Фуджейры',
  'ARE-347': 'Нейтральная зона Сайх-Мудайра',
  'MDG-5864': 'Андруа',
  'ASM-4998': 'Восточный район',
  'ASM-4999': 'Острова Мануа',
  'HKG-5155': 'Истерн',

  'KOS-5902': 'Приштина',
  'KOS-5907': 'Косовска-Каменица',
  'KOS-5908': 'Призрен',
  'KOS-5894': 'Косовска-Митровица',

  'LVA-5796': 'Руйиена',
  'LVA-5791': 'Мазсалаца',
  'LVA-5792': 'Наукшены',
  'LVA-5782': 'Апе',
  'LVA-5798': 'Смилтене',
  'LVA-5795': 'Стренчи',
  'LVA-5783': 'Беверина',
  'LVA-5784': 'Буртниеки',
  'LVA-5788': 'Коцени',
  'LVA-5797': 'Вецпиебалга',
  'LVA-5799': 'Рауна',
  'LVA-5794': 'Приекуле',
  'LVA-5793': 'Паргауя',
  'LVA-5787': 'Яунпиебалга',
  'LVA-5790': 'Лубана',
  'LVA-5800': 'Варакляны',
  'LVA-5781': 'Амата',
  'LVA-5786': 'Эргли',
  'LVA-5785': 'Цесвайне',
  'LVA-1093': 'Валмиера',
  'LVA-5789': 'Лигатне',
  'LVA-1084': 'Елгавский край',
  'LVA-4849': 'Елгава',
  'LVA-1081': 'Даугавпилсский край',
  'LVA-4850': 'Даугавпилс',
  'LVA-934': 'Вентспилсский край',
  'LVA-4852': 'Вентспилс',
  'LVA-1066': 'Резекненский край',
  'LVA-4851': 'Резекне',
  'LVA-5725': 'Екабпилсский край',
  'LVA-1085': 'Екабпилс',

  'UKR-321': 'Киевская область',
  'UKR-4826': 'Киев',

  'SYR-144': 'Риф Дамаск',
  'SYR-4843': 'Дамаск',

  'AZE-1735': 'Лачинский район',
  'AZE-1707': 'Ленкоранский район',
  'AZE-5562': 'Ленкорань',
  'AZE-1737': 'Шушинский район',
  'AZE-5565': 'Шуша',

  'MOZ-1927': 'Провинция Мапуту',
  'MOZ-5854': 'Мапуту',

  'LAO-3283': 'Префектура Вьентьян',
  'LAO-3284': 'Провинция Вьентьян',

  'USA-3519': 'Вашингтон',
  'USA-3556': 'Округ Колумбия',

  'SVN-958': 'Посавский регион',
  'SVN-939': 'Кршко',

  'ARG-1295': 'Провинция Буэнос-Айрес',
  'ARG-5493': 'Буэнос-Айрес',

  'MDG-5863': 'Аналанджируфу',
  'MDG-5868': 'Ацинанана',
  'MDG-5860': 'Алаутра-Мангуру',
  'MDG-5862': 'Аналаманга',
  'MDG-5871': 'Бунгулава',
  'MDG-5881': 'Вакинанкарантра',
  'MDG-5875': 'Итаси',

  'PER-591': 'Департамент Лима',
  'PER-587': 'Провинция Лима',

  'PHL-5522': 'Город Себу',
  'PHL-2514': 'Себу',
  'PHL-5526': 'Город Илоило',
  'PHL-2529': 'Илоило',
  'PHL-5527': 'Котабато',
  'PHL-2579': 'Северный Котабато',

  'NIC-659': 'Манагуа',
  'NIC-655': 'Гранада',

  'IRL-1444': 'Графство Уотерфорд',
  'IRL-5571': 'Уотерфорд',
  'IRL-78': 'Графство Корк',
  'IRL-5569': 'Корк',
  'IRL-726': 'Графство Лимерик',
  'IRL-5570': 'Лимерик',
  'IRL-713': 'Графство Голуэй',
  'IRL-5568': 'Голуэй',
  'IRL-724': 'Северный Типперэри',
  'IRL-5572': 'Южный Типперэри',

  'GBR-2108': 'Приход Халтон',
  'GBR-5708': 'Халтон',

  'TTO-50': 'Восточный Тобаго',
  'TTO-5090': 'Западный Тобаго',

  'BMU-5137': 'Округ Гамильтон',
  'BMU-5134': 'Гамильтон',

  'MUS-5190': 'Порт-Луи',
  'MUS-5189': 'Округ Порт-Луи',

  'SYC-5210': 'Гранд-Анс-Маэ',
  'SYC-5211': 'Гранд-Анс-Праслен',

  'YEM-3496': 'Мухафаза Сана',
  'YEM-3498': 'Сана',

  'AFG-1752': 'Урузган',
  'AFG-1753': 'Дайкунди',
  'AFG-1769': 'Панджшер',
  'AFG-1772': 'Парван',

  'UGA-3370': 'Исингиро',
  'UGA-3371': 'Мбарара',
  'UGA-3374': 'Кашари',

  'MEX-2731': 'Штат Мехико',
  'MEX-2727': 'Мехико',

  'HUN-3158': 'Медье Веспрем',
  'HUN-4909': 'Веспрем',

  'MWI-1194': 'Каронга',
  'MWI-1873': 'Читипа',

  'GUY-671': 'Махайка-Бербис',
  'GUY-679': 'Эссекибо-Айлендс-Уэст-Демерара',

  'KIR+99?': 'Острова Феникс',
  'GAZ+00?': 'Сектор Газа'
};

async function syncWikidataLabels(regionsFeatures) {
  const cachePath = path.join(cacheDir, 'wikidata-labels.json');
  let labels = {};
  if (fs.existsSync(cachePath)) {
    try {
      labels = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    } catch {}
  }
  const qids = new Set();
  for (const f of regionsFeatures) {
    const qid = f.properties.wikidataid;
    if (qid && /^Q\d+$/.test(qid)) {
      qids.add(qid);
    }
  }
  const toFetch = Array.from(qids).filter(qid => !labels[qid]);
  if (toFetch.length > 0) {
    console.log(`Fetching ${toFetch.length} missing labels from Wikidata...`);
    const batchSize = 50;
    for (let i = 0; i < toFetch.length; i += batchSize) {
      const batch = toFetch.slice(i, i + batchSize);
      const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${batch.join('|')}&props=labels&languages=ru&format=json`;
      let success = false;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const res = await fetch(url, {
            headers: {
              'User-Agent': 'TravelMapDataCollector/1.0 (https://github.com/DWcllkMS/travel-map)'
            }
          });
          if (res.ok) {
            const data = await res.json();
            for (const [id, entity] of Object.entries(data.entities || {})) {
              labels[id] = entity.labels?.ru?.value || null;
            }
            success = true;
            break;
          }
          if (res.status === 429) {
            await new Promise(r => setTimeout(r, 4000));
          }
        } catch {
          await new Promise(r => setTimeout(r, 1500));
        }
      }
      if (!success) {
        console.warn(`Warning: failed to fetch batch starting at ${i}`);
      }
      await new Promise(r => setTimeout(r, 100));
    }
    fs.writeFileSync(cachePath, JSON.stringify(labels, null, 2), 'utf8');
  }
  return labels;
}

async function buildData(targetCountries = ['RUS']) {
  console.log('Downloading base datasets...');
  const countriesUrl = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries_rus.geojson';
  const regionsUrl = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson';
  const placesUrl = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places.geojson';

  const [countriesPath, regionsPath, placesPath] = await Promise.all([
    downloadCached(countriesUrl, 'ne_10m_admin_0_countries_rus.geojson'),
    downloadCached(regionsUrl, 'ne_10m_admin_1_states_provinces.geojson'),
    downloadCached(placesUrl, 'ne_10m_populated_places.geojson')
  ]);

  const placesRaw = JSON.parse(fs.readFileSync(placesPath, 'utf8'));
  const places = placesRaw.features.map(f => ({
    coords: f.geometry.coordinates,
    pop: f.properties.POP_MAX || 0
  }));

  const placesIndex = new Flatbush(places.length);
  for (const p of places) {
    placesIndex.add(p.coords[0], p.coords[1], p.coords[0], p.coords[1]);
  }
  placesIndex.finish();

  function calcRarityAndArea(feature) {
    const sqMeters = turfArea(feature);
    const sqKm = Math.round(sqMeters / 1e6);
    const bbox = getBBox(feature);
    const candidateIndices = placesIndex.search(bbox[0], bbox[1], bbox[2], bbox[3]);
    let totalPop = 0;
    for (const idx of candidateIndices) {
      const p = places[idx];
      const pt = turfHelpers.point(p.coords);
      if (turfBooleanPointInPolygon(pt, feature)) {
        totalPop += p.pop;
      }
    }
    const density = sqKm > 0 ? totalPop / sqKm : 0;
    let rarity = 1;
    if (density < 1.0) rarity = 4;
    else if (density < 10.0) rarity = 3;
    else if (density < 35.0) rarity = 2;
    else rarity = 1;

    return { areaKm2: sqKm, rarity };
  }

  const countriesRaw = JSON.parse(fs.readFileSync(countriesPath, 'utf8'));
  const regionsRaw = JSON.parse(fs.readFileSync(regionsPath, 'utf8'));
  const wikidataLabels = await syncWikidataLabels(regionsRaw.features);

  const CONTINENT_RU_MAP = {
    'Europe': 'Европа',
    'Asia': 'Азия',
    'Africa': 'Африка',
    'North America': 'Северная Америка',
    'South America': 'Южная Америка',
    'Oceania': 'Океания',
    'Antarctica': 'Антарктида'
  };

  const CONTINENT_OVERRIDES = {
    ABK: 'Азия',
    SOS: 'Азия',
    ATF: 'Антарктида',
    SYC: 'Африка',
    HMD: 'Антарктида',
    SHN: 'Африка',
    MUS: 'Африка',
    IOT: 'Азия',
    MDV: 'Азия',
    SGS: 'Антарктида',
    CLP: 'Северная Америка'
  };

  const rawContinentMap = new Map();
  for (const f of countriesRaw.features) {
    const p = f.properties;
    const id = p.ADM0_A3 || p.ISO_A3 || p.adm0_a3 || p.SOV_A3;
    if (id && p.CONTINENT) {
      rawContinentMap.set(id, p.CONTINENT);
    }
  }

  const cMap = new Map();
  for (const f of countriesRaw.features) {
    const p = f.properties;
    const id = p.ADM0_A3 || p.ISO_A3 || p.adm0_a3 || p.SOV_A3;
    if (id && p.NAME_RU) {
      let cName = String(p.NAME_RU).replace(/[\u0300-\u036f\u200B-\u200F\u202A-\u202E\uFEFF]/g, '').trim();
      cName = cName.charAt(0).toUpperCase() + cName.slice(1);
      cMap.set(id, cName);
    }
  }
  for (const [id, name] of Object.entries(COUNTRY_SHORT_NAMES)) cMap.set(id, name);
  cMap.set('ABK', 'Абхазия');
  cMap.set('SOS', 'Южная Осетия');

  const c0Features = countriesRaw.features.map(f => {
    const p = f.properties;
    const id = p.ADM0_A3 || p.ISO_A3 || p.adm0_a3 || p.SOV_A3;
    let n = p.NAME_RU || p.NAME || p.ADMIN;
    if (n) {
      n = String(n).replace(/[\u0300-\u036f\u200B-\u200F\u202A-\u202E\uFEFF]/g, '').trim();
      n = n.charAt(0).toUpperCase() + n.slice(1);
    }
    return {
      ...f,
      id,
      bbox: getBBox(f),
      nameRu: n
    };
  });

  const c0Index = new Flatbush(c0Features.length);
  for (const c of c0Features) {
    c0Index.add(c.bbox[0], c.bbox[1], c.bbox[2], c.bbox[3]);
  }
  c0Index.finish();

  const southOssetiaC0 = countriesRaw.features.find(f => f.properties.ADM0_A3 === 'B37' || f.properties.NAME_RU === 'Южная Осетия');

  console.log('Processing regions (ADM1)...');
  const rawFeatures = regionsRaw.features;
  const mda1628 = rawFeatures.find(f => f.properties.adm1_code === 'MDA-1628');
  const mda1650 = rawFeatures.find(f => f.properties.adm1_code === 'MDA-1650');
  const mda1638 = rawFeatures.find(f => f.properties.adm1_code === 'MDA-1638');

  if (mda1628 && mda1650 && mda1638) {
    mda1628.geometry = {
      type: 'MultiPolygon',
      coordinates: [
        ...toMultiPolygonCoords(mda1628.geometry),
        ...toMultiPolygonCoords(mda1650.geometry),
        ...toMultiPolygonCoords(mda1638.geometry)
      ]
    };
  }

  const syr145 = rawFeatures.find(f => f.properties.adm1_code === 'SYR-145');
  const syr5261 = rawFeatures.find(f => f.properties.adm1_code === 'SYR-5261');
  if (syr145 && syr5261) {
    delete syr145.bbox;
    delete syr5261.bbox;
    syr145.geometry = {
      type: 'MultiPolygon',
      coordinates: polygonClipping.union(
        toMultiPolygonCoords(syr145.geometry),
        toMultiPolygonCoords(syr5261.geometry)
      )
    };
  }

  const processedList = [];
  const rusNamelessFragments = [];

  for (const f of rawFeatures) {
    delete f.bbox;
    const p = f.properties;
    let id = p.adm1_code || p.iso_3166_2 || p.code_hasc;
    let country = p.adm0_a3 || p.iso_a2;

    if (id === 'MDA-1650' || id === 'MDA-1638' || id === 'SYR-5261') {
      continue;
    }

    if ((country === 'RUS' || p.adm0_a3 === 'RUS') && (id === 'RUS+99?' || (!p.name_ru && !p.name && !p.name_en))) {
      rusNamelessFragments.push(f);
      continue;
    }

    const checkStr = `${p.adm1_code} ${p.name} ${p.name_ru || ''} ${p.name_en || ''}`;
    let isSpecialDisputed = false;

    if (/RUS-283|автономная республика крым|crimea/i.test(checkStr)) {
      id = 'RUS-283';
      country = 'RUS';
      isSpecialDisputed = true;
    } else if (/RUS-5482|севастополь|sevastopol/i.test(checkStr)) {
      id = 'RUS-5482';
      country = 'RUS';
      isSpecialDisputed = true;
    } else if (/UKR-327|donets|донецк/i.test(checkStr)) {
      id = 'RUS-DNR';
      country = 'RUS';
      isSpecialDisputed = true;
    } else if (/UKR-329|luhans|lugans|луганск/i.test(checkStr)) {
      id = 'RUS-LNR';
      country = 'RUS';
      isSpecialDisputed = true;
    } else if (/UKR-331|zaporozh|запорож/i.test(checkStr)) {
      id = 'RUS-ZPR';
      country = 'RUS';
      isSpecialDisputed = true;
    } else if (/UKR-4827|kherson|херсон/i.test(checkStr)) {
      id = 'RUS-KHS';
      country = 'RUS';
      isSpecialDisputed = true;
    } else if (id === 'GEO-3015') {
      country = 'ABK';
      isSpecialDisputed = true;
    } else if (country === 'GEO' || p.adm0_a3 === 'GEO') {
      country = 'GEO';
      isSpecialDisputed = true;
    } else if (country === 'KOS' || String(id).startsWith('KOS-')) {
      country = 'SRB';
      isSpecialDisputed = true;
    } else if (country === 'TWN' || String(id).startsWith('TWN-')) {
      country = 'CHN';
      isSpecialDisputed = true;
    } else if (id === 'CYN+00?' || country === 'CYN') {
      country = 'CYP';
      isSpecialDisputed = true;
    } else if (id === 'SOL+00?' || country === 'SOL') {
      country = 'SOM';
      isSpecialDisputed = true;
    } else if (id === 'KAB+00?' || country === 'KAB') {
      country = 'KAZ';
      isSpecialDisputed = true;
    } else if (id === 'KAS+00?') {
      country = 'IND';
      isSpecialDisputed = true;
    } else if (id === 'USG+00?') {
      country = 'CUB';
      isSpecialDisputed = true;
    } else if (country === 'MDA') {
      country = 'MDA';
      isSpecialDisputed = true;
    }

    if (!isSpecialDisputed) {
      let pt;
      try {
        pt = turfPointOnFeature(f);
      } catch {
        pt = turfCentroid(f);
      }
      const [x, y] = pt.geometry.coordinates;
      const candidates = c0Index.search(x, y, x, y);
      let matched = null;
      const matching = [];
      for (const idx of candidates) {
        const cf = c0Features[idx];
        if (turfBooleanPointInPolygon(pt, cf)) {
          matching.push(cf);
        }
      }
      if (matching.length > 0) {
        matched = matching.find(cf => cf.id === p.adm0_a3) || matching[0];
      }
      if (matched && matched.id) {
        country = matched.id;
      }
    }

    let rawName = p.wikidataid ? wikidataLabels[p.wikidataid] : null;
    if (!rawName) rawName = p.name_ru;
    if (!rawName) rawName = p.name;
    if (!rawName) rawName = p.name_en;
    if (!rawName || rawName === 'null') rawName = cMap.get(country) || country;

    let cleanName = String(rawName).replace(/[\u0300-\u036f\u200B-\u200F\u202A-\u202E\uFEFF]/g, '').trim();
    cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

    if (p.adm0_a3 === 'GEO' && southOssetiaC0) {
      try {
        const inter = turfIntersect(f, southOssetiaC0);
        if (inter) {
          const diff = turfDifference(turfHelpers.featureCollection([f, southOssetiaC0]));
          if (diff) {
            f.geometry = diff.geometry;
          }
        }
      } catch {}
    }

    let regCountryName = cMap.get(country) || p.admin || country;
    regCountryName = String(regCountryName).replace(/[\u0300-\u036f\u200B-\u200F\u202A-\u202E\uFEFF]/g, '').trim();
    regCountryName = regCountryName.charAt(0).toUpperCase() + regCountryName.slice(1);

    processedList.push({
      feature: f,
      id,
      country,
      countryName: regCountryName,
      cleanName
    });
  }

  if (southOssetiaC0) {
    processedList.push({
      feature: {
        type: 'Feature',
        id: 'SOS-01',
        properties: {},
        geometry: southOssetiaC0.geometry
      },
      id: 'SOS-01',
      country: 'SOS',
      countryName: 'Южная Осетия',
      cleanName: 'Южная Осетия'
    });
  }

  for (const item of processedList) {
    if (item.country === 'RUS' || item.country === 'ABK' || item.country === 'SOS') continue;
    if (['RUS-283', 'RUS-5482', 'RUS-DNR', 'RUS-LNR', 'RUS-ZPR', 'RUS-KHS'].includes(item.id)) continue;

    const b = getBBox(item.feature);
    const candIndices = c0Index.search(b[0], b[1], b[2], b[3]);

    for (const idx of candIndices) {
      const cf = c0Features[idx];
      if (!cf.id || cf.id === '-99' || cf.id === item.country || cf.id === 'BRT' || cf.id === 'B37') continue;

      let inter = null;
      try {
        inter = intersect(item.feature, cf);
      } catch {}

      if (!inter) continue;
      const areaKm2 = Math.round(turfArea(inter) / 1e6);
      if (areaKm2 < 50) continue;

      const candTargets = processedList.filter(r => r.country === cf.id && r.id !== item.id);
      if (candTargets.length === 0) continue;

      let target = null;
      let cutCentroid;
      try {
        cutCentroid = turfCentroid(inter);
      } catch {
        cutCentroid = turfPointOnFeature(inter);
      }

      let minDist = Infinity;
      for (const cand of candTargets) {
        let d = Infinity;
        try {
          const candCentroid = turfCentroid(cand.feature);
          d = turfDistance(cutCentroid, candCentroid);
        } catch {}
        if (d < minDist) {
          minDist = d;
          target = cand;
        }
      }

      if (!target) continue;

      let diff = null;
      try {
        diff = difference(turfHelpers.featureCollection([item.feature, inter]));
      } catch {}

      if (diff) {
        item.feature.geometry = diff.geometry;
        delete item.feature.bbox;
        target.feature.geometry = {
          type: 'MultiPolygon',
          coordinates: polygonClipping.union(
            toMultiPolygonCoords(target.feature.geometry),
            toMultiPolygonCoords(inter.geometry)
          )
        };
        delete target.feature.bbox;
        console.log(`Transferred ${areaKm2} km2 from ${item.id} (${item.country}) to ${target.id} (${target.country})`);
      }
    }
  }

  const byCountry = new Map();
  for (const item of processedList) {
    if (!byCountry.has(item.country)) byCountry.set(item.country, []);
    byCountry.get(item.country).push(item);
  }

  for (const [country, list] of byCountry.entries()) {
    for (const item of list) {
      if (SPECIAL_OVERRIDES[item.id]) {
        item.finalName = SPECIAL_OVERRIDES[item.id];
        continue;
      }
      const m = item.cleanName.match(PREFIX_REGEX);
      if (m) {
        const withoutPrefix = item.cleanName.slice(m[0].length).trim();
        const capWithout = withoutPrefix.charAt(0).toUpperCase() + withoutPrefix.slice(1);
        const collision = list.some(other => other.id !== item.id && (SPECIAL_OVERRIDES[other.id] || other.cleanName).toLowerCase() === capWithout.toLowerCase());
        if (collision) {
          item.finalName = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase() + ' ' + withoutPrefix;
        } else {
          item.finalName = capWithout;
        }
      } else {
        item.finalName = item.cleanName;
      }
      item.finalName = item.finalName.replace(/\s*\([^)]*\)/g, '').trim();
      item.finalName = item.finalName.charAt(0).toUpperCase() + item.finalName.slice(1);
    }
  }

  const processedRegionsFeatures = [];
  const rusRegionsForJoin = [];

  for (const item of processedList) {
    const { areaKm2, rarity } = calcRarityAndArea(item.feature);
    const regionFeature = {
      type: 'Feature',
      id: item.id,
      properties: {
        id: item.id,
        name: item.finalName,
        country: item.country,
        countryName: item.countryName,
        area: areaKm2,
        rarity
      },
      geometry: item.feature.geometry
    };
    processedRegionsFeatures.push(regionFeature);
    if (item.country === 'RUS' && !['RUS-2365', 'RUS-2337', 'RUS-5482'].includes(item.id)) {
      rusRegionsForJoin.push({
        id: item.id,
        name: item.finalName,
        feature: regionFeature,
        bbox: getBBox(regionFeature)
      });
    }
  }

  for (const frag of rusNamelessFragments) {
    const fragPt = turfPointOnFeature(frag);
    let minDist = Infinity;
    let bestRegion = null;
    for (const rf of processedRegionsFeatures) {
      if (rf.properties.country !== 'RUS') continue;
      let d = Infinity;
      try {
        const rc = turfCentroid(rf);
        d = turfDistance(fragPt, rc);
      } catch {}
      if (d < minDist) {
        minDist = d;
        bestRegion = rf;
      }
    }
    if (bestRegion) {
      if (bestRegion.geometry.type === 'Polygon') {
        bestRegion.geometry = {
          type: 'MultiPolygon',
          coordinates: [bestRegion.geometry.coordinates]
        };
      }
      if (frag.geometry.type === 'Polygon') {
        bestRegion.geometry.coordinates.push(frag.geometry.coordinates);
      } else if (frag.geometry.type === 'MultiPolygon') {
        bestRegion.geometry.coordinates.push(...frag.geometry.coordinates);
      }
      const { areaKm2, rarity } = calcRarityAndArea(bestRegion);
      bestRegion.properties.area = areaKm2;
      bestRegion.properties.rarity = rarity;
    }
  }

  const tempRegionsPath = path.join(cacheDir, 'temp-regions.json');
  fs.writeFileSync(tempRegionsPath, JSON.stringify({
    type: 'FeatureCollection',
    features: processedRegionsFeatures
  }), 'utf8');

  const outRegionsPath = path.join(outDir, 'regions.json');
  await mapshaper.runCommands(`-i snap ${tempRegionsPath} -simplify interval=3000 keep-shapes -clean -o format=geojson precision=0.001 ${outRegionsPath}`);

  console.log('Dissolving countries from regions...');
  const outCountriesPath = path.join(outDir, 'countries.json');
  await mapshaper.runCommands(`-i ${outRegionsPath} -dissolve country copy-fields=countryName -rename-fields id=country,name=countryName -o format=geojson precision=0.001 ${outCountriesPath}`);

  if (targetCountries.includes('RUS')) {
    console.log('Processing districts for RUS...');
    const gbApiRes = await fetch('https://www.geoboundaries.org/api/current/gbOpen/RUS/ADM2/');
    const gbApiData = await gbApiRes.json();
    const gbDistrictsPath = await downloadCached(gbApiData.simplifiedGeometryGeoJSON, 'geoBoundaries-RUS-ADM2_simplified.geojson');
    const gbData = JSON.parse(fs.readFileSync(gbDistrictsPath, 'utf8'));

    const queryCrimea = `[out:json][timeout:90];
(
  relation["boundary"="administrative"]["admin_level"="6"](44.3,32.4,46.3,36.7);
);
out geom;`;

    const queryRuOsm = `[out:json][timeout:120];
area["ISO3166-1"="RU"][admin_level=2]->.ru;
relation(area.ru)["boundary"="administrative"]["admin_level"="6"];
out center tags;`;

    const crimeaOsmPath = await fetchOverpassCached(queryCrimea, 'osm-crimea-adm6.json');
    const ruOsmPath = await fetchOverpassCached(queryRuOsm, 'osm-ru-adm6.json');

    const osmRu = JSON.parse(fs.readFileSync(ruOsmPath, 'utf8'));
    const osmElements = (osmRu.elements || []).filter(e => e.tags && (e.tags.name || e.tags['name:ru']));

    const osmByEn = new Map();
    for (const el of osmElements) {
      const en = el.tags['name:en']?.toLowerCase().trim();
      if (en) {
        osmByEn.set(en, el);
        osmByEn.set(en.replace(/\s+(district|rayon|urban okrug|okrug)/gi, '').trim(), el);
      }
    }

    const processedDistricts = [];

    const LATIN_DISTRICT_NAMES = {
      'pirovsky rayon': 'Пировский муниципальный округ',
      'plesetsky district': 'Плесецкий муниципальный округ',
      'iultinsky district': 'Иультинский муниципальный округ',
      'louhi district': 'Лоухский муниципальный район',
      'mezensky district': 'Мезенский муниципальный округ',
      'kantalahti district': 'Кандалакшский муниципальный район',
      'tigilsky district': 'Тигильский муниципальный район',
      'anadyrsky district': 'Анадырский муниципальный район'
    };

    for (const f of gbData.features) {
      const rawName = f.properties.shapeName || '';
      const cleanRaw = rawName.replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, '').trim();
      const nameEn = cleanRaw.toLowerCase();
      const cleanEn = nameEn.replace(/\s+(district|rayon|urban okrug|okrug)/gi, '').trim();

      let ruName = null;
      if (LATIN_DISTRICT_NAMES[nameEn]) {
        ruName = LATIN_DISTRICT_NAMES[nameEn];
      } else if (LATIN_DISTRICT_NAMES[cleanEn]) {
        ruName = LATIN_DISTRICT_NAMES[cleanEn];
      }

      let matchedOsm = osmByEn.get(nameEn) || osmByEn.get(cleanEn);

      const c = turfCentroid(f).geometry.coordinates;

      if (!ruName && !matchedOsm) {
        let minDist = Infinity;
        let best = null;
        for (const el of osmElements) {
          if (!el.center) continue;
          const d = turfDistance(c, [el.center.lon, el.center.lat]);
          if (d < minDist) {
            minDist = d;
            best = el;
          }
        }
        if (minDist < 50) matchedOsm = best;
      }

      if (!ruName && matchedOsm) {
        ruName = matchedOsm.tags['name:ru'] || matchedOsm.tags.name;
      }
      if (!ruName) {
        ruName = cleanRaw;
      }
      ruName = String(ruName).replace(/[\u0300-\u036f\u200B-\u200F\u202A-\u202E\uFEFF]/g, '').trim();
      if (LATIN_DISTRICT_NAMES[ruName.toLowerCase()]) {
        ruName = LATIN_DISTRICT_NAMES[ruName.toLowerCase()];
      }
      ruName = ruName.charAt(0).toUpperCase() + ruName.slice(1);

      let matchedRegionId = null;

      try {
        const pOnF = turfPointOnFeature(f);
        for (const r of rusRegionsForJoin) {
          if (turfBooleanPointInPolygon(pOnF, r.feature)) {
            matchedRegionId = r.id;
            break;
          }
        }
      } catch {}

      if (!matchedRegionId) {
        const pt = turfHelpers.point(c);
        for (const r of rusRegionsForJoin) {
          if (c[0] >= r.bbox[0] && c[0] <= r.bbox[2] && c[1] >= r.bbox[1] && c[1] <= r.bbox[3]) {
            if (turfBooleanPointInPolygon(pt, r.feature)) {
              matchedRegionId = r.id;
              break;
            }
          }
        }
      }

      if (!matchedRegionId) {
        let minDist = Infinity;
        let bestId = null;
        for (const r of rusRegionsForJoin) {
          const rc = turfCentroid(r.feature).geometry.coordinates;
          const d = turfDistance(c, rc);
          if (d < minDist) {
            minDist = d;
            bestId = r.id;
          }
        }
        matchedRegionId = bestId;
      }

      const { areaKm2, rarity } = calcRarityAndArea(f);
      const districtId = f.properties.shapeID || `RUS-ADM2-${processedDistricts.length + 1}`;

      processedDistricts.push({
        type: 'Feature',
        id: districtId,
        properties: {
          id: districtId,
          name: ruName,
          regionId: matchedRegionId || 'RUS-UNKNOWN',
          country: 'RUS',
          area: areaKm2,
          rarity
        },
        geometry: f.geometry
      });
    }

    const crimeaOsm = JSON.parse(fs.readFileSync(crimeaOsmPath, 'utf8'));
    const crimeaGeo = osmtogeojson(crimeaOsm);
    const seenNames = new Set();

    for (const f of crimeaGeo.features) {
      if (!f.geometry || !f.properties) continue;
      if (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon') continue;
      const p = f.properties;
      const name = p['name:ru'] || p.name;
      if (!name) continue;
      if (name.includes('район') || name.includes('округ')) {
        if (name.includes('Темрюкский') || name.includes('Генический') || name.includes('Каховский') || name.includes('Херсонский') || name.includes('Скадовский') || name.includes('Мелитопольский')) {
          continue;
        }
        if (seenNames.has(name)) continue;
        seenNames.add(name);

        let regionId = 'RUS-283';

        const { areaKm2, rarity } = calcRarityAndArea(f);
        const districtId = `RUS-CRM-${p.id || processedDistricts.length + 1}`;
        let cleanDistName = String(name).replace(/[\u0300-\u036f\u200B-\u200F\u202A-\u202E\uFEFF]/g, '').trim();
        cleanDistName = cleanDistName.charAt(0).toUpperCase() + cleanDistName.slice(1);

        processedDistricts.push({
          type: 'Feature',
          id: districtId,
          properties: {
            id: districtId,
            name: cleanDistName,
            regionId,
            country: 'RUS',
            area: areaKm2,
            rarity
          },
          geometry: f.geometry
        });
      }
    }

    function getDistrictPriority(feature) {
      const name = feature.properties.name || '';
      if (/городской округ|муниципальный округ|муниципальный район/i.test(name)) return 100;
      if (/район/i.test(name)) {
        if (/^(Курманский|Перекопский|Евпаторийский|Керченский|Феодосийский|Ялтинский) район$/i.test(name.trim())) {
          return 10;
        }
        return 50;
      }
      if (/городской совет/i.test(name)) return 5;
      return 20;
    }

    const districtBBoxes = processedDistricts.map(getBBox);
    const districtAreas = processedDistricts.map(d => turfArea(d));
    const toRemoveIndices = new Set();
    const removedDistrictsList = [];

    for (let i = 0; i < processedDistricts.length; i++) {
      if (toRemoveIndices.has(i)) continue;
      const b1 = districtBBoxes[i];
      for (let j = i + 1; j < processedDistricts.length; j++) {
        if (toRemoveIndices.has(j)) continue;
        const b2 = districtBBoxes[j];
        if (b1[0] > b2[2] || b1[2] < b2[0] || b1[1] > b2[3] || b1[3] < b2[1]) continue;
        try {
          const inter = turfIntersect(processedDistricts[i], processedDistricts[j]);
          if (inter) {
            const interArea = turfArea(inter);
            const minArea = Math.min(districtAreas[i], districtAreas[j]);
            if (minArea > 0 && interArea / minArea > 0.3) {
              const p1 = getDistrictPriority(processedDistricts[i]);
              const p2 = getDistrictPriority(processedDistricts[j]);
              if (p1 >= p2) {
                toRemoveIndices.add(j);
                removedDistrictsList.push({
                  name: processedDistricts[j].properties.name,
                  id: processedDistricts[j].id,
                  keptName: processedDistricts[i].properties.name,
                  ratio: (interArea / minArea * 100).toFixed(1) + '%'
                });
              } else {
                toRemoveIndices.add(i);
                removedDistrictsList.push({
                  name: processedDistricts[i].properties.name,
                  id: processedDistricts[i].id,
                  keptName: processedDistricts[j].properties.name,
                  ratio: (interArea / minArea * 100).toFixed(1) + '%'
                });
                break;
              }
            }
          }
        } catch {}
      }
    }

    const finalDistricts = processedDistricts.filter((_, idx) => !toRemoveIndices.has(idx));

    const finalBBoxes = finalDistricts.map(getBBox);
    const finalAreas = finalDistricts.map(d => turfArea(d));
    for (let i = 0; i < finalDistricts.length; i++) {
      const b1 = finalBBoxes[i];
      for (let j = i + 1; j < finalDistricts.length; j++) {
        const b2 = finalBBoxes[j];
        if (b1[0] > b2[2] || b1[2] < b2[0] || b1[1] > b2[3] || b1[3] < b2[1]) continue;
        try {
          const inter = turfIntersect(finalDistricts[i], finalDistricts[j]);
          if (inter) {
            const interArea = turfArea(inter);
            const minArea = Math.min(finalAreas[i], finalAreas[j]);
            if (minArea > 0 && interArea / minArea > 0.3) {
              throw new Error(`Remaining overlap > 30% between ${finalDistricts[i].properties.name} and ${finalDistricts[j].properties.name}: ${(interArea / minArea * 100).toFixed(1)}%`);
            }
          }
        } catch (e) {
          if (e.message?.includes('Remaining overlap')) throw e;
        }
      }
    }

    const crimeaCheck = finalDistricts.filter(d => d.properties.regionId === 'RUS-283');
    const crimeaRayons = crimeaCheck.filter(d => d.properties.name.includes('район'));
    const crimeaOkrugs = crimeaCheck.filter(d => d.properties.name.includes('округ'));
    if (crimeaRayons.length !== 14 || crimeaOkrugs.length !== 11) {
      throw new Error(`Crimea municipal structure mismatch: ${crimeaRayons.length} rayons (expected 14), ${crimeaOkrugs.length} okrugs (expected 11)`);
    }

    for (const d of finalDistricts) {
      if (!d.properties.regionId || d.properties.regionId === 'RUS-UNKNOWN') {
        throw new Error(`District ${d.properties.name} (${d.id}) has UNKNOWN regionId`);
      }
      if (['RUS-2365', 'RUS-2337', 'RUS-5482'].includes(d.properties.regionId)) {
        throw new Error(`District ${d.properties.name} (${d.id}) assigned to federal city ${d.properties.regionId}`);
      }
      if (/[a-zA-Z]/.test(d.properties.name)) {
        throw new Error(`District ${d.id} has latin characters: "${d.properties.name}"`);
      }
      if (/^[а-яё]/.test(d.properties.name)) {
        throw new Error(`District ${d.id} has lowercase first letter: "${d.properties.name}"`);
      }
      if (/[\u0300-\u036f]/.test(d.properties.name)) {
        throw new Error(`District ${d.id} has combining marks: "${d.properties.name}"`);
      }
    }

    const tempDistrictsPath = path.join(cacheDir, 'temp-districts-RUS.json');
    fs.writeFileSync(tempDistrictsPath, JSON.stringify({
      type: 'FeatureCollection',
      features: finalDistricts
    }), 'utf8');

    const outDistrictsPath = path.join(outDir, 'districts-RUS.json');
    await mapshaper.runCommands(`-i ${tempDistrictsPath} -simplify 15% keep-shapes -o format=geojson precision=0.001 ${outDistrictsPath}`);
  }

  const finalDistrictsPath = path.join(outDir, 'districts-RUS.json');

  const countriesData = JSON.parse(fs.readFileSync(outCountriesPath, 'utf8'));
  for (const f of countriesData.features) {
    const cId = f.properties.id;
    const cont = CONTINENT_OVERRIDES[cId] || CONTINENT_RU_MAP[rawContinentMap.get(cId)];
    if (cont) {
      f.properties.continent = cont;
    }
  }
  const regionsData = JSON.parse(fs.readFileSync(outRegionsPath, 'utf8'));
  const districtsData = fs.existsSync(finalDistrictsPath) ? JSON.parse(fs.readFileSync(finalDistrictsPath, 'utf8')) : { type: 'FeatureCollection', features: [] };

  const allLabels = [];

  function addLabels(fc, type) {
    for (const f of fc.features) {
      try {
        const pt = turfPointOnFeature(f);
        const [lx, ly] = pt.geometry.coordinates;
        f.properties.labelX = Number(lx.toFixed(4));
        f.properties.labelY = Number(ly.toFixed(4));
        if (f.properties.name) {
          allLabels.push({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [f.properties.labelX, f.properties.labelY]
            },
            properties: {
              id: f.id || f.properties.id,
              name: f.properties.name,
              type
            }
          });
        }
      } catch {
        const c = turfCentroid(f);
        const [lx, ly] = c.geometry.coordinates;
        f.properties.labelX = Number(lx.toFixed(4));
        f.properties.labelY = Number(ly.toFixed(4));
        if (f.properties.name) {
          allLabels.push({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [f.properties.labelX, f.properties.labelY]
            },
            properties: {
              id: f.id || f.properties.id,
              name: f.properties.name,
              type
            }
          });
        }
      }
    }
  }

  addLabels(countriesData, 'country');
  addLabels(regionsData, 'region');
  addLabels(districtsData, 'district');

  fs.writeFileSync(outCountriesPath, JSON.stringify(countriesData), 'utf8');
  fs.writeFileSync(outRegionsPath, JSON.stringify(regionsData), 'utf8');
  if (districtsData.features.length > 0) {
    fs.writeFileSync(finalDistrictsPath, JSON.stringify(districtsData), 'utf8');
  }

  const outLabelsPath = path.join(outDir, 'labels.json');
  fs.writeFileSync(outLabelsPath, JSON.stringify({
    type: 'FeatureCollection',
    features: allLabels
  }), 'utf8');

  console.log('Running validation checks...');
  const countryMap = new Map(countriesData.features.map(f => [f.properties.id, f.properties.name]));

  for (const f of countriesData.features) {
    const n = f.properties.name;
    if (!n || n.trim() === '') throw new Error(`Empty country name: ${f.properties.id}`);
    if (/[a-zA-Z]/.test(n)) throw new Error(`Latin in country name: ${f.properties.id} "${n}"`);
    if (/[\u0300-\u036f]/.test(n)) throw new Error(`Accent mark in country name: ${f.properties.id} "${n}"`);
    if (/^[а-яё]/.test(n)) throw new Error(`Lowercase first letter in country name: ${f.properties.id} "${n}"`);
    if (!f.properties.continent || f.properties.continent.trim() === '') {
      throw new Error(`Country ${f.properties.id} (${n}) has no continent`);
    }
  }

  const regionNamesByCountry = new Map();
  for (const f of regionsData.features) {
    const p = f.properties;
    const n = p.name;
    if (!n || n.trim() === '') throw new Error(`Empty region name: ${p.id}`);
    if (/[a-zA-Z]/.test(n)) throw new Error(`Latin in region name: ${p.id} "${n}"`);
    if (/[\u0300-\u036f]/.test(n)) throw new Error(`Accent mark in region name: ${p.id} "${n}"`);
    if (/^[а-яё]/.test(n)) throw new Error(`Lowercase first letter in region name: ${p.id} "${n}"`);
    if (/[()]/.test(n)) throw new Error(`Parentheses in region name: ${p.id} "${n}"`);

    if (!countryMap.has(p.country)) throw new Error(`Region ${p.id} has country ${p.country} not found in countries.json`);
    if (/[a-zA-Z]/.test(p.countryName || '')) throw new Error(`Latin in region countryName: ${p.id} "${p.countryName}"`);
    if (/[\u0300-\u036f]/.test(p.countryName || '')) throw new Error(`Accent mark in region countryName: ${p.id} "${p.countryName}"`);

    if (!regionNamesByCountry.has(p.country)) regionNamesByCountry.set(p.country, new Set());
    const seenSet = regionNamesByCountry.get(p.country);
    if (seenSet.has(n)) throw new Error(`Duplicate region name in ${p.country}: "${n}"`);
    seenSet.add(n);
  }

  for (const f of districtsData.features) {
    const n = f.properties.name;
    if (!n || n.trim() === '') throw new Error(`Empty district name: ${f.id}`);
    if (/[a-zA-Z]/.test(n)) throw new Error(`Latin in district name: ${f.id} "${n}"`);
    if (/[\u0300-\u036f]/.test(n)) throw new Error(`Accent mark in district name: ${f.id} "${n}"`);
    if (/^[а-яё]/.test(n)) throw new Error(`Lowercase first letter in district name: ${f.id} "${n}"`);
  }

  const rusRegionNames = new Set(regionsData.features.filter(f => f.properties.country === 'RUS').map(f => f.properties.name));
  const requiredRusNames = [
    'Алтайский край',
    'Республика Алтай',
    'Республика Крым',
    'Севастополь',
    'Донецкая Народная Республика',
    'Луганская Народная Республика',
    'Запорожская область',
    'Херсонская область'
  ];
  for (const name of requiredRusNames) {
    if (!rusRegionNames.has(name)) throw new Error(`Required Russian region missing: "${name}"`);
  }

  const ptSukhum = turfHelpers.point([41.02, 43.0]);
  const ptTskhinval = turfHelpers.point([43.97, 42.23]);
  const ptTiraspol = turfHelpers.point([29.63, 46.84]);

  const regSukhum = regionsData.features.find(f => turfBooleanPointInPolygon(ptSukhum, f));
  if (!regSukhum || regSukhum.properties.country !== 'ABK' || regSukhum.properties.name !== 'Абхазия') {
    throw new Error(`Sukhum point validation failed: ${regSukhum?.properties.name} (${regSukhum?.properties.country})`);
  }

  const regTskhinval = regionsData.features.find(f => turfBooleanPointInPolygon(ptTskhinval, f));
  if (!regTskhinval || regTskhinval.properties.country !== 'SOS' || regTskhinval.properties.name !== 'Южная Осетия') {
    throw new Error(`Tskhinval point validation failed: ${regTskhinval?.properties.name} (${regTskhinval?.properties.country})`);
  }

  const regTiraspol = regionsData.features.find(f => turfBooleanPointInPolygon(ptTiraspol, f));
  if (!regTiraspol || regTiraspol.properties.country !== 'MDA' || regTiraspol.properties.name !== 'Приднестровье') {
    throw new Error(`Tiraspol point validation failed: ${regTiraspol?.properties.name} (${regTiraspol?.properties.country})`);
  }

  const ptKatzrin = turfHelpers.point([35.69, 32.99]);
  const regKatzrin = regionsData.features.find(f => turfBooleanPointInPolygon(ptKatzrin, f));
  if (!regKatzrin || regKatzrin.properties.country !== 'SYR' || regKatzrin.properties.name !== 'Эль-Кунейтра') {
    throw new Error(`Katzrin point validation failed: ${regKatzrin?.properties.name} (${regKatzrin?.properties.country})`);
  }

  const meta = {
    version: '1.0.0',
    buildDate: new Date().toISOString().slice(0, 10),
    districtCountries: targetCountries,
    sources: {
      countries: 'Natural Earth 10m ne_10m_admin_0_countries_rus (Public Domain)',
      regions: 'Natural Earth 10m ne_10m_admin_1_states_provinces (Public Domain) + Wikidata (CC0)',
      districtsRUS: 'geoBoundaries RUS ADM2 (ODbL) + OpenStreetMap via Overpass API (ODbL)',
      populatedPlaces: 'Natural Earth 10m ne_10m_populated_places (Public Domain)'
    }
  };
  fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');
  console.log('Build data finished successfully!');
}

const args = process.argv.slice(2);
const countriesArg = args.find(a => a.startsWith('--countries='));
const targetCountries = countriesArg ? countriesArg.split('=')[1].split(',') : ['RUS'];

buildData(targetCountries).catch(err => {
  console.error(err);
  process.exit(1);
});
