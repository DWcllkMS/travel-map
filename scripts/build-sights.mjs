import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Flatbush from 'flatbush';
import * as turfHelpers from '@turf/helpers';
import turfBooleanPointInPolygon from '@turf/boolean-point-in-polygon';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const cacheDir = path.join(rootDir, 'data-cache', 'sights');
const outDir = path.join(rootDir, 'public', 'data');
const outFilePath = path.join(outDir, 'sights.json');
const regionsPath = path.join(outDir, 'regions.json');
const countriesPath = path.join(outDir, 'countries.json');

if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const USER_AGENT = 'travel-map/1.1 (https://github.com/DWcllkMS/travel-map)';

async function querySparqlCached(sparql, cacheFileName) {
  const filePath = path.join(cacheDir, cacheFileName);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  const url = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql) + '&_ts=' + Date.now();
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/sparql-results+json'
        }
      });
      if (!res.ok) {
        await new Promise(r => setTimeout(r, 2000 * attempt));
        continue;
      }
      const text = await res.text();
      const json = JSON.parse(text);
      const bindings = json.results?.bindings;
      if (!bindings) throw new Error('No bindings returned');
      fs.writeFileSync(filePath, JSON.stringify(bindings), 'utf8');
      return bindings;
    } catch (e) {
      if (attempt === 4) throw e;
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
  throw new Error(`Failed to query SPARQL for ${cacheFileName}`);
}

const ruwikiCacheFile = path.join(cacheDir, 'ruwiki-titles.json');
let ruwikiTitleMap = {};
if (fs.existsSync(ruwikiCacheFile)) {
  try {
    ruwikiTitleMap = JSON.parse(fs.readFileSync(ruwikiCacheFile, 'utf8'));
  } catch {}
}

async function fetchRuwikiTitles(qids) {
  const missing = qids.filter(q => ruwikiTitleMap[q] === undefined);
  if (missing.length === 0) return ruwikiTitleMap;

  const batchSize = 50;
  for (let i = 0; i < missing.length; i += batchSize) {
    const batch = missing.slice(i, i + batchSize);
    const url = 'https://www.wikidata.org/w/api.php?action=wbgetentities&ids=' + batch.join('|') + '&props=sitelinks&sitefilter=ruwiki&format=json';
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (res.ok) {
        const json = await res.json();
        for (const [id, ent] of Object.entries(json.entities || {})) {
          ruwikiTitleMap[id] = ent.sitelinks?.ruwiki?.title || null;
        }
      }
    } catch {}
    if (i % 250 === 0) {
      fs.writeFileSync(ruwikiCacheFile, JSON.stringify(ruwikiTitleMap), 'utf8');
    }
    await new Promise(r => setTimeout(r, 80));
  }
  fs.writeFileSync(ruwikiCacheFile, JSON.stringify(ruwikiTitleMap), 'utf8');
  return ruwikiTitleMap;
}

const SEVEN_WONDERS = ['Q5513', 'Q1235610', 'Q820002', 'Q4360238', 'Q129846', 'Q2155757', 'Q43105'];
const SEVEN_WONDERS_SET = new Set(SEVEN_WONDERS);
const SEVEN_WONDERS_KINDS = {
  'Q5513': 'water',
  'Q1235610': 'nature',
  'Q820002': 'monument',
  'Q4360238': 'palace',
  'Q129846': 'religious',
  'Q2155757': 'nature',
  'Q43105': 'mountain'
};

const PRESERVED_QIDS = new Set([
  'Q4220287', 'Q837839', 'Q1140434', 'Q18785988', 'Q15980181', 'Q205726', 'Q1421396', 'Q105946882', 'Q221774', 'Q133274'
]);

const ALLOWED_KINDS = new Set([
  'museum', 'religious', 'fortress', 'palace', 'monument',
  'nature', 'mountain', 'water', 'park', 'bridge', 'lighthouse'
]);

const bannedByRoot = JSON.parse(fs.readFileSync(path.join(cacheDir, 'banned_by_root.json'), 'utf8'));
const sightsP31 = JSON.parse(fs.readFileSync(path.join(cacheDir, 'sights_p31.json'), 'utf8'));

const settlementSet = new Set(bannedByRoot.settlement || []);
const adminSet = new Set(bannedByRoot.admin || []);
const histCountrySet = new Set(bannedByRoot.hist_country || []);
const peninsulaSet = new Set(bannedByRoot.peninsula || []);
const isthmusSet = new Set(bannedByRoot.isthmus || []);
const straitSet = new Set(bannedByRoot.strait || []);
const islandSet = new Set(bannedByRoot.island || []);
const powerStationSet = new Set(bannedByRoot.power_station || []);
const stadiumSet = new Set(bannedByRoot.stadium || []);
const enterpriseSet = new Set([...(bannedByRoot.enterprise || []), ...(bannedByRoot.factory || [])]);
const geoRegionSet = new Set(bannedByRoot.geo_region || []);

const typeToKind = {
  Q2977: 'religious', Q16970: 'religious', Q44613: 'religious', Q32815: 'religious', Q34627: 'religious', Q1455219: 'religious', Q108325: 'religious', Q165113: 'religious', Q11784935: 'religious',
  Q23413: 'fortress', Q88291: 'fortress', Q263274: 'fortress', Q57821: 'fortress', Q12518: 'fortress', Q131645: 'fortress', Q860861: 'fortress', Q1437459: 'fortress',
  Q16560: 'palace', Q879050: 'palace', Q1802963: 'palace', Q3947: 'palace', Q3950: 'palace',
  Q33506: 'museum', Q244038: 'museum', Q856584: 'museum', Q24354: 'museum', Q1595639: 'museum', Q7075: 'museum', Q148319: 'museum', Q16889960: 'museum', Q11812394: 'museum', Q2416217: 'museum',
  Q46169: 'park', Q179049: 'park', Q22698: 'park', Q167346: 'park', Q4015: 'park', Q473972: 'park', Q2026833: 'park', Q1959314: 'park', Q1969226: 'park',
  Q8502: 'mountain', Q8072: 'mountain', Q468314: 'mountain', Q168589: 'mountain',
  Q23397: 'water', Q34038: 'water', Q12284: 'water', Q15324: 'water', Q131681: 'water', Q9430: 'water', Q39594: 'water', Q2935978: 'water',
  Q23790: 'nature', Q35509: 'nature', Q207524: 'nature', Q118228: 'nature', Q188451: 'nature', Q124196: 'nature',
  Q4989906: 'monument', Q5003624: 'monument', Q839954: 'monument', Q374294: 'monument', Q200721: 'monument', Q38188: 'monument', Q5737: 'monument', Q39614: 'monument', Q659396: 'monument', Q749607: 'monument', Q23407225: 'monument',
  Q210272: 'monument', Q14750991: 'monument', Q2065736: 'monument', Q19951362: 'monument', Q15661340: 'monument', Q42195: 'monument',
  Q18247357: 'park', Q676050: 'park', Q1497375: 'park', Q28777651: 'park', Q1707610: 'park',
  Q702492: 'nature', Q2319498: 'nature',
  Q1129474: 'religious',
  Q12280: 'bridge',
  Q39715: 'lighthouse'
};

function isClassBanned(qid, classes) {
  if (SEVEN_WONDERS_SET.has(qid) || PRESERVED_QIDS.has(qid)) return false;
  for (const c of classes) {
    if (powerStationSet.has(c)) return 'power_station';
    if (stadiumSet.has(c)) return 'stadium';
    if (enterpriseSet.has(c)) return 'enterprise';
    if (peninsulaSet.has(c)) return 'peninsula';
    if (isthmusSet.has(c)) return 'isthmus';
    if (straitSet.has(c)) return 'strait';
    if (histCountrySet.has(c)) return 'hist_country';
    if (islandSet.has(c) && !ALLOWED_KINDS.has(typeToKind[c])) return 'island';
    if (settlementSet.has(c) && !ALLOWED_KINDS.has(typeToKind[c])) return 'settlement';
    if (adminSet.has(c) && !ALLOWED_KINDS.has(typeToKind[c])) return 'admin';
    if (geoRegionSet.has(c) && !ALLOWED_KINDS.has(typeToKind[c])) return 'geo_region';
  }
  return false;
}

const sevenWondersSparql = `
SELECT ?item ?name ?coord ?sitelinks ?image WHERE {
  VALUES ?item { ${SEVEN_WONDERS.map(q => 'wd:' + q).join(' ')} }
  ?item wdt:P625 ?coord;
        wikibase:sitelinks ?sitelinks;
        rdfs:label ?name.
  FILTER(LANG(?name) = "ru")
  OPTIONAL { ?item wdt:P18 ?image. }
}
`;

const unescoSparql = `
SELECT ?item ?name ?coord ?sitelinks ?image WHERE {
  ?item wdt:P1435 wd:Q9259;
        wdt:P625 ?coord;
        wikibase:sitelinks ?sitelinks;
        rdfs:label ?name.
  FILTER(LANG(?name) = "ru")
  OPTIONAL { ?item wdt:P18 ?image. }
}
`;

const unescoRussiaSparql = `
SELECT ?item ?name ?coord ?sitelinks ?image ?unescoId ?p361 WHERE {
  ?item wdt:P1435 wd:Q9259;
        wdt:P17 wd:Q159;
        wdt:P625 ?coord.
  OPTIONAL { ?item wikibase:sitelinks ?sitelinks. }
  OPTIONAL { ?item wdt:P18 ?image. }
  OPTIONAL { ?item wdt:P757 ?unescoId. }
  OPTIONAL { ?item wdt:P361 ?p361. }
  OPTIONAL { ?item rdfs:label ?ruName. FILTER(LANG(?ruName) = "ru") }
  OPTIONAL { ?item rdfs:label ?enName. FILTER(LANG(?enName) = "en") }
  BIND(COALESCE(?ruName, ?enName) AS ?name)
}
`;

const unescoTypesSparql = `
SELECT ?item ?type WHERE {
  ?item wdt:P1435 wd:Q9259;
        wdt:P31 ?type.
}
`;

const rusQueries = [
  { file: 'rus_kremlin.json', qid: 'wd:Q263274', min: 1, kind: 'fortress' },
  { file: 'rus_fortress.json', qid: 'wd:Q88291', min: 2, kind: 'fortress' },
  { file: 'rus_castle.json', qid: 'wd:Q23413', min: 2, kind: 'fortress' },
  { file: 'rus_palace.json', qid: 'wd:Q16560', min: 2, kind: 'palace' },
  { file: 'rus_manor.json', qid: 'wd:Q879050', min: 2, kind: 'palace' },
  { file: 'rus_manor_all.json', qid: 'wd:Q879050', min: 1, kind: 'palace' },
  { file: 'rus_monastery.json', qid: 'wd:Q44613', min: 2, kind: 'religious' },
  { file: 'rus_cathedral.json', qid: 'wd:Q2977', min: 2, kind: 'religious' },
  { file: 'rus_mosque.json', qid: 'wd:Q32815', min: 2, kind: 'religious' },
  { file: 'rus_church.json', qid: 'wd:Q16970', min: 2, kind: 'religious' },
  { file: 'rus_museum.json', qid: 'wd:Q33506', min: 4, kind: 'museum' },
  { file: 'rus_museum_all.json', qid: 'wd:Q33506', min: 1, kind: 'museum' },
  { file: 'rus_monument.json', qid: 'wd:Q4989906', min: 4, kind: 'monument' },
  { file: 'rus_memorial.json', qid: 'wd:Q5003624', min: 3, kind: 'monument' },
  { file: 'rus_mountain.json', qid: 'wd:Q8502', min: 2, kind: 'mountain' },
  { file: 'rus_volcano.json', qid: 'wd:Q8072', min: 2, kind: 'mountain' },
  { file: 'rus_lake.json', qid: 'wd:Q23397', min: 4, kind: 'water' },
  { file: 'rus_waterfall.json', qid: 'wd:Q34038', min: 2, kind: 'nature' },
  { file: 'rus_cave.json', qid: 'wd:Q35509', min: 2, kind: 'nature' },
  { file: 'rus_natpark.json', qid: 'wd:Q46169', min: 2, kind: 'park' },
  { file: 'rus_reserve.json', qid: 'wd:Q179049', min: 2, kind: 'park' },
  { file: 'rus_nature_monument.json', qid: 'wd:Q23790', min: 1, kind: 'nature' },
  { file: 'rus_bridge.json', qid: 'wd:Q12280', min: 4, kind: 'bridge' },
  { file: 'rus_lighthouse.json', qid: 'wd:Q39715', min: 2, kind: 'lighthouse' }
];

const worldQueries = [
  { file: 'world_mountain.json', qid: 'wd:Q8502', min: 35, kind: 'mountain' },
  { file: 'world_volcano.json', qid: 'wd:Q8072', min: 35, kind: 'mountain' },
  { file: 'world_lake.json', qid: 'wd:Q23397', min: 35, kind: 'water' },
  { file: 'world_waterfall.json', qid: 'wd:Q34038', min: 25, kind: 'nature' },
  { file: 'world_natpark.json', qid: 'wd:Q46169', min: 35, kind: 'park' },
  { file: 'world_museum.json', qid: 'wd:Q33506', min: 35, kind: 'museum' },
  { file: 'world_cathedral.json', qid: 'wd:Q2977', min: 35, kind: 'religious' },
  { file: 'world_palace.json', qid: 'wd:Q16560', min: 35, kind: 'palace' },
  { file: 'world_castle.json', qid: 'wd:Q23413', min: 30, kind: 'fortress' },
  { file: 'world_monument.json', qid: 'wd:Q4989906', min: 45, kind: 'monument' },
  { file: 'world_bridge.json', qid: 'wd:Q12280', min: 35, kind: 'bridge' }
];

const swBorderSparql = `
SELECT ?item ?name ?coord ?sitelinks ?image WHERE {
  ?item wdt:P17 wd:Q212;
        wdt:P625 ?coord;
        wikibase:sitelinks ?sitelinks;
        rdfs:label ?name.
  FILTER(LANG(?name) = "ru")
  FILTER(?sitelinks >= 1)
  FILTER(geof:longitude(?coord) >= 33.0 && geof:longitude(?coord) <= 40.5 && geof:latitude(?coord) >= 45.0 && geof:latitude(?coord) <= 50.5)
  OPTIONAL { ?item wdt:P18 ?image. }
} LIMIT 3000
`;

const admSparql = `
SELECT ?item ?name ?coord ?sitelinks ?image ?type WHERE {
  VALUES ?adm { wd:Q2164 wd:Q7730 }
  VALUES ?type { wd:Q33506 wd:Q16970 wd:Q2977 wd:Q44613 wd:Q4989906 wd:Q5003624 wd:Q23397 wd:Q46169 wd:Q179049 wd:Q23790 wd:Q8502 wd:Q23413 wd:Q16560 wd:Q879050 wd:Q263274 wd:Q39715 wd:Q23442 wd:Q207524 wd:Q570116 wd:Q34038 wd:Q35509 }
  ?item wdt:P131 ?adm;
        wdt:P31 ?type;
        wdt:P625 ?coord;
        wikibase:sitelinks ?sitelinks;
        rdfs:label ?name.
  FILTER(LANG(?name) = "ru")
  FILTER(?sitelinks >= 1)
  OPTIONAL { ?item wdt:P18 ?image. }
}
`;

const magadanSparql = `
SELECT ?item ?name ?coord ?sitelinks ?image ?type WHERE {
  VALUES ?adm { wd:Q7971 }
  VALUES ?type { wd:Q33506 wd:Q16970 wd:Q2977 wd:Q44613 wd:Q4989906 wd:Q5003624 wd:Q23397 wd:Q46169 wd:Q179049 wd:Q23790 wd:Q8502 wd:Q23413 wd:Q16560 wd:Q879050 wd:Q263274 wd:Q39715 wd:Q23442 wd:Q207524 wd:Q570116 wd:Q34038 wd:Q35509 wd:Q12280 }
  ?item wdt:P131 ?adm;
        wdt:P31 ?type;
        wdt:P625 ?coord;
        wikibase:sitelinks ?sitelinks;
        rdfs:label ?name.
  FILTER(LANG(?name) = "ru")
  FILTER(?sitelinks >= 1)
  OPTIONAL { ?item wdt:P18 ?image. }
}
`;

const eaoSparql = `
SELECT ?item ?name ?coord ?sitelinks ?image ?type WHERE {
  VALUES ?adm { wd:Q7730 }
  ?item wdt:P131 ?adm;
        wdt:P625 ?coord;
        wikibase:sitelinks ?sitelinks;
        rdfs:label ?name.
  FILTER(LANG(?name) = "ru")
  FILTER(?sitelinks >= 1)
  OPTIONAL { ?item wdt:P18 ?image. }
}
`;

const wikiTitlesSparql = `
SELECT ?item ?wiki WHERE {
  ?item wdt:P17 wd:Q159;
        wdt:P625 ?coord.
  ?article schema:about ?item;
           schema:isPartOf <https://ru.wikipedia.org/>;
           schema:name ?wiki.
}
`;

const fileKindMap = {
  rus_kremlin: 'fortress',
  rus_fortress: 'fortress',
  rus_castle: 'fortress',
  rus_palace: 'palace',
  rus_manor: 'palace',
  rus_manor_all: 'palace',
  rus_monastery: 'religious',
  rus_cathedral: 'religious',
  rus_mosque: 'religious',
  rus_church: 'religious',
  rus_museum: 'museum',
  rus_museum_all: 'museum',
  rus_monument: 'monument',
  rus_memorial: 'monument',
  rus_mountain: 'mountain',
  rus_volcano: 'mountain',
  rus_lake: 'water',
  rus_waterfall: 'nature',
  rus_cave: 'nature',
  rus_natpark: 'park',
  rus_reserve: 'park',
  rus_nature_monument: 'nature',
  rus_bridge: 'bridge',
  rus_lighthouse: 'lighthouse',
  world_mountain: 'mountain',
  world_volcano: 'mountain',
  world_lake: 'water',
  world_waterfall: 'nature',
  world_natpark: 'park',
  world_museum: 'museum',
  world_cathedral: 'religious',
  world_palace: 'palace',
  world_castle: 'fortress',
  world_monument: 'monument',
  world_bridge: 'bridge'
};

const FEDERAL_DISTRICTS = {
  'Центральный': new Set([
    'Белгородская область', 'Брянская область', 'Владимирская область', 'Воронежская область',
    'Ивановская область', 'Калужская область', 'Костромская область', 'Курская область',
    'Липецкая область', 'Москва', 'Московская область', 'Орловская область', 'Рязанская область',
    'Смоленская область', 'Тамбовская область', 'Тверская область', 'Тульская область', 'Ярославская область'
  ]),
  'Северо-Западный': new Set([
    'Архангельская область', 'Вологодская область', 'Калининградская область', 'Карелия',
    'Республика Коми', 'Ленинградская область', 'Мурманская область', 'Ненецкий автономный округ',
    'Новгородская область', 'Псковская область', 'Санкт-Петербург'
  ]),
  'Южный': new Set([
    'Адыгея', 'Астраханская область', 'Волгоградская область', 'Калмыкия', 'Краснодарский край',
    'Крым', 'Ростовская область', 'Севастополь'
  ]),
  'Северо-Кавказский': new Set([
    'Дагестан', 'Ингушетия', 'Кабардино-Балкария', 'Карачаево-Черкесия',
    'Северная Осетия — Алания', 'Ставропольский край', 'Чечня'
  ]),
  'Приволжский': new Set([
    'Башкортостан', 'Кировская область', 'Марий Эл', 'Мордовия', 'Нижегородская область',
    'Оренбургская область', 'Пензенская область', 'Пермский край', 'Самарская область',
    'Саратовская область', 'Татарстан', 'Удмуртия', 'Ульяновская область', 'Чувашия', 'Республика Башкортостан'
  ]),
  'Уральский': new Set([
    'Курганская область', 'Свердловская область', 'Тюменская область', 'Ханты-Мансийский автономный округ — Югра',
    'Челябинская область', 'Ямало-Ненецкий автономный округ'
  ]),
  'Сибирский': new Set([
    'Алтайский край', 'Иркутская область', 'Кемеровская область', 'Красноярский край',
    'Новосибирская область', 'Омская область', 'Республика Алтай', 'Томская область',
    'Тыва', 'Хакасия'
  ]),
  'Дальневосточный': new Set([
    'Амурская область', 'Бурятия', 'Еврейская автономная область', 'Забайкальский край',
    'Камчатский край', 'Магаданская область', 'Приморский край', 'Якутия',
    'Сахалинская область', 'Хабаровский край', 'Чукотский автономный округ'
  ]),
  'Новые регионы': new Set([
    'Донецкая Народная Республика', 'Луганская Народная Республика', 'Запорожская область', 'Херсонская область'
  ])
};

function getFo(regionName) {
  for (const [fo, set] of Object.entries(FEDERAL_DISTRICTS)) {
    if (set.has(regionName)) return fo;
  }
  return null;
}

const LATIN_LOOKALIKES = {
  'A': 'А', 'B': 'В', 'C': 'С', 'E': 'Е', 'H': 'Н', 'K': 'К', 'M': 'М', 'O': 'О', 'P': 'Р', 'T': 'Т', 'X': 'Х', 'Y': 'У',
  'a': 'а', 'c': 'с', 'e': 'е', 'i': 'і', 'j': 'ј', 'k': 'к', 'o': 'о', 'p': 'р', 's': 'ѕ', 'x': 'х', 'y': 'у'
};

function fixLatinLookalikes(str) {
  if (!/[а-яА-ЯёЁ]/.test(str)) return str;
  let res = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    res += LATIN_LOOKALIKES[ch] || ch;
  }
  return res;
}

const ROMAN_NUMERAL_REGEX = /^[IVXLCDM]+$/;

function hasForbiddenLatin(str) {
  const words = str.split(/[^\wа-яА-ЯёЁa-zA-Z]/).filter(Boolean);
  for (const w of words) {
    if (/[a-zA-Z]/.test(w) && !ROMAN_NUMERAL_REGEX.test(w)) {
      return true;
    }
  }
  return false;
}

function guessKindFromName(name) {
  const n = name.toLowerCase();
  if (/\bмост\b/.test(n) || /мост\b/.test(n)) return 'bridge';
  if (/\bмаяк\b/.test(n) || /маяк\b/.test(n)) return 'lighthouse';
  if (/(собор|храм|мечеть|монастырь|церков|базилик|синагог|аббатств|часовн|пагод|скит|святилищ|гробниц|мавзолей|лавра)/.test(n)) return 'religious';
  if (/(крепост|замок|форт|кремл|цитадел|башн|вал|стена|укреплен|акропол|руин|городищ|касба)/.test(n)) return 'fortress';
  if (/(дворец|вилл|усадьб|шато|резиденци|павильон|альгамбр)/.test(n)) return 'palace';
  if (/(музей|галере|библиотек|театр|цирк|обсерватори)/.test(n)) return 'museum';
  if (/(национальный парк|парк|сад|заповедник|резерват|заказник|пуща|леса)/.test(n)) return 'park';
  if (/(гора|вулкан|хребет|пик|массив|вершин|сопк|кратер)/.test(n)) return 'mountain';
  if (/(озер|водопад|залив|лагун|фьорд|бухт|лиман|пруд|гейзер|море|канал|бассейн|источник)/.test(n)) return 'water';
  if (/(пещер|ущель|долин|каньон|риф|пустын|ледник|столб|скал|мыс|коса|побережье|ландшафт|памятник природы|пески|гряда)/.test(n)) return 'nature';
  if (/(памятник|монумент|мемориал|обелиск|стату|колонн|курган|могил|бюст|пирамид|сфинкс|комплекс|ансамбль|археологическ|погост)/.test(n)) return 'monument';
  return null;
}

function isBannedPlace(name) {
  const n = name.toLowerCase();
  if (/(^|\s)(улица|проспект|переулок|проезд|бульвар|тупик|шоссе|тракт)(\s|$)/.test(n)) return true;
  if (/(^|\s)(площадь)(\s|$)/.test(n)) return true;
  if (/(жилой дом|доходный дом|станция метро)/.test(n)) return true;
  if (/(^|\s)(река|ручей|протока)(\s|$)/.test(n) && !/(водопад|порог|каньон|ущелье)/.test(n)) return true;
  if (/(сельсовет|район|поселение|городской округ|муниципальный округ|область|край|республика)(\s|$)/.test(n)) return true;
  if (/(полуостров|перешеек|пролив|аэс|грэс|тэц|стадион|завод|фабрика)/.test(n)) return true;
  if (n === 'крымскотатарский язык' || n === 'татарский язык') return true;
  return false;
}

const RUSSIAN_UNESCO_NAMES = {
  'Q64532917': 'Древний город Херсонес Таврический и его хора',
  'Q64787152': 'Центральный Сихотэ-Алинь',
  'Q64787456': 'Ландшафты Даурии',
  'Q64797735': 'Убсунурская котловина',
  'Q64798261': 'Западный Кавказ',
  'Q128597769': 'Культурный ландшафт Кенозерья',
  'Q122730525': 'Астрономические обсерватории Казанского федерального университета',
  'Q16961872': 'Московский Кремль и Красная площадь',
  'Q15980181': 'Историко-культурный комплекс Соловецких островов',
  'Q64763166': 'Цитадель, старый город и крепостные сооружения Дербента'
};

const RUSSIAN_UNESCO_KINDS = {
  'Q64532917': 'monument',
  'Q64787152': 'nature',
  'Q64787456': 'nature',
  'Q64797735': 'nature',
  'Q64798261': 'nature',
  'Q128597769': 'park',
  'Q122730525': 'museum',
  'Q16961872': 'fortress',
  'Q15980181': 'monument',
  'Q277576': 'nature',
  'Q64763166': 'fortress',
  'Q616578': 'monument',
  'Q603622': 'fortress',
  'Q211962': 'religious',
  'Q477462': 'monument',
  'Q4204534': 'monument',
  'Q838264': 'monument',
  'Q220951': 'religious',
  'Q66053233': 'religious',
  'Q64808630': 'monument',
  'Q64746144': 'mountain',
  'Q277683': 'nature',
  'Q593870': 'park',
  'Q985595': 'park',
  'Q155495': 'mountain',
  'Q5513': 'water',
  'Q5595': 'nature',
  'Q192243': 'monument'
};

const RUSSIAN_UNESCO_SUBCOMPONENTS = new Set([
  'Q2263092',
  'Q2494499',
  'Q4071782',
  'Q4071797',
  'Q4116323',
  'Q4158660',
  'Q4158661',
  'Q4505008',
  'Q24937319',
  'Q110279772',
  'Q116505071',
  'Q18785988',
  'Q205711',
  'Q131416'
]);

async function build() {
  await querySparqlCached(sevenWondersSparql, 'seven_wonders.json');
  await querySparqlCached(unescoSparql, 'unesco_world.json');
  await querySparqlCached(unescoRussiaSparql, 'unesco_russia.json');
  await querySparqlCached(unescoTypesSparql, 'unesco_types.json');

  for (const q of rusQueries) {
    const sparql = `
SELECT ?item ?name ?coord ?sitelinks ?image WHERE {
  ?item wdt:P17 wd:Q159;
        wdt:P31/wdt:P279* ${q.qid};
        wdt:P625 ?coord;
        wikibase:sitelinks ?sitelinks;
        rdfs:label ?name.
  FILTER(LANG(?name) = "ru")
  FILTER(?sitelinks >= ${q.min})
  OPTIONAL { ?item wdt:P18 ?image. }
}
`;
    await querySparqlCached(sparql, q.file);
  }

  for (const q of worldQueries) {
    const sparql = `
SELECT ?item ?name ?coord ?sitelinks ?image WHERE {
  ?item wdt:P31/wdt:P279* ${q.qid};
        wdt:P625 ?coord;
        wikibase:sitelinks ?sitelinks;
        rdfs:label ?name.
  FILTER(LANG(?name) = "ru")
  FILTER(?sitelinks >= ${q.min})
  OPTIONAL { ?item wdt:P18 ?image. }
}
`;
    await querySparqlCached(sparql, q.file);
  }

  await querySparqlCached(swBorderSparql, 'rus_sw_border.json');
  await querySparqlCached(admSparql, 'rus_adm_nao_eao.json');
  await querySparqlCached(magadanSparql, 'rus_magadan.json');
  await querySparqlCached(eaoSparql, 'rus_eao.json');
  await querySparqlCached(wikiTitlesSparql, 'wiki_titles.json');

  const regionsData = JSON.parse(fs.readFileSync(regionsPath, 'utf8'));
  const countriesData = JSON.parse(fs.readFileSync(countriesPath, 'utf8'));

  const regionNamesSet = new Set(regionsData.features.map(f => f.properties.name.trim().toLowerCase()));
  const countryNamesSet = new Set(countriesData.features.map(f => f.properties.name.trim().toLowerCase()));

  function computeBBox(feature) {
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

  const regionBBoxes = regionsData.features.map(f => computeBBox(f));
  const regionIndex = new Flatbush(regionsData.features.length);
  for (const b of regionBBoxes) {
    regionIndex.add(b[0], b[1], b[2], b[3]);
  }
  regionIndex.finish();

  function findRegion(lon, lat) {
    const pt = turfHelpers.point([lon, lat]);
    const candidates = regionIndex.search(lon, lat, lon, lat);
    for (const idx of candidates) {
      const feat = regionsData.features[idx];
      if (turfBooleanPointInPolygon(pt, feat)) {
        return feat.properties;
      }
    }
    const delta = 0.5;
    const nearCandidates = regionIndex.search(lon - delta, lat - delta, lon + delta, lat + delta);
    if (nearCandidates.length > 0) {
      let bestDist = Infinity;
      let bestFeat = null;
      for (const idx of nearCandidates) {
        const bbox = regionBBoxes[idx];
        const cx = (bbox[0] + bbox[2]) / 2;
        const cy = (bbox[1] + bbox[3]) / 2;
        const d = Math.hypot(lon - cx, lat - cy);
        if (d < bestDist) {
          bestDist = d;
          bestFeat = regionsData.features[idx];
        }
      }
      if (bestFeat) return bestFeat.properties;
    }
    return null;
  }

  const unescoTypesRaw = JSON.parse(fs.readFileSync(path.join(cacheDir, 'unesco_types.json'), 'utf8'));
  const qidKind = new Map();
  for (const b of unescoTypesRaw) {
    const qid = b.item?.value?.split('/').pop();
    const t = b.type?.value?.split('/').pop();
    if (typeToKind[t]) {
      if (!qidKind.has(qid) || typeToKind[t] !== 'monument') {
        qidKind.set(qid, typeToKind[t]);
      }
    }
  }

  const unescoWorld = JSON.parse(fs.readFileSync(path.join(cacheDir, 'unesco_world.json'), 'utf8'));
  const unescoRus = JSON.parse(fs.readFileSync(path.join(cacheDir, 'unesco_russia.json'), 'utf8'));

  const unescoSet = new Set();
  for (const b of unescoWorld) {
    const q = b.item.value.split('/').pop();
    if (!RUSSIAN_UNESCO_SUBCOMPONENTS.has(q)) unescoSet.add(q);
  }
  for (const b of unescoRus) {
    const q = b.item.value.split('/').pop();
    if (!RUSSIAN_UNESCO_SUBCOMPONENTS.has(q)) unescoSet.add(q);
  }
  for (const q of Object.keys(RUSSIAN_UNESCO_NAMES)) {
    unescoSet.add(q);
  }

  const files = fs.readdirSync(cacheDir).filter(f => f.endsWith('.json') && f !== 'ruwiki-titles.json' && f !== 'unesco_types.json' && !f.includes('banned') && f !== 'sights_p31.json' && f !== 'item_classes.json');
  const itemsById = new Map();

  for (const f of files) {
    const base = f.replace('.json', '');
    const defaultKind = fileKindMap[base] || 'other';
    const list = JSON.parse(fs.readFileSync(path.join(cacheDir, f), 'utf8'));
    for (const b of list) {
      const qid = b.item?.value?.split('/').pop();
      if (!qid || !qid.startsWith('Q')) continue;

      const coordStr = b.coord?.value;
      if (!coordStr) continue;
      const match = coordStr.match(/Point\(([-\d.]+)\s+([-\d.]+)\)/);
      if (!match) continue;
      let lon = parseFloat(match[1]);
      let lat = parseFloat(match[2]);

      if (qid === 'Q64797735') {
        lon = 95.15;
        lat = 50.25;
      }

      const rawName = b.name?.value;
      if (!rawName) continue;
      let cleanName = String(rawName).replace(/[\u0300-\u036f\u200B-\u200F\u202A-\u202E\uFEFF]/g, '').trim();
      cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

      if (RUSSIAN_UNESCO_NAMES[qid]) {
        cleanName = RUSSIAN_UNESCO_NAMES[qid];
      }

      if (!cleanName || !/[а-яА-ЯёЁ]/.test(cleanName)) continue;

      cleanName = fixLatinLookalikes(cleanName);
      if (qid === 'Q4306210') cleanName = 'Музей актуального искусства АРТ4';
      if (qid === 'Q2227225') cleanName = 'Китайский павильон в Дроттнингхольме';
      if (qid === 'Q16961872' || qid === 'Q133274') cleanName = 'Московский Кремль и Красная площадь';

      if (hasForbiddenLatin(cleanName)) continue;

      const isUnesco = unescoSet.has(qid) && !RUSSIAN_UNESCO_SUBCOMPONENTS.has(qid);

      if (!isUnesco) {
        if (isBannedPlace(cleanName) && !SEVEN_WONDERS_SET.has(qid) && !PRESERVED_QIDS.has(qid)) continue;
        const lowerName = cleanName.toLowerCase();
        if (countryNamesSet.has(lowerName) || regionNamesSet.has(lowerName)) {
          continue;
        }

        const classes = sightsP31[qid] || [];
        if (isClassBanned(qid, classes)) {
          continue;
        }
      } else {
        const lowerName = cleanName.toLowerCase();
        if (countryNamesSet.has(lowerName) || regionNamesSet.has(lowerName)) {
          continue;
        }
      }

      const sitelinks = parseInt(b.sitelinks?.value || '0', 10);
      let kind = defaultKind;
      if (SEVEN_WONDERS_KINDS[qid]) kind = SEVEN_WONDERS_KINDS[qid];
      if (qidKind.has(qid)) kind = qidKind.get(qid);

      if (b.type?.value) {
        const t = b.type.value.split('/').pop();
        if (typeToKind[t]) kind = typeToKind[t];
      }

      const classes = sightsP31[qid] || [];
      for (const c of classes) {
        if (typeToKind[c] && (kind === 'other' || kind === 'monument')) {
          kind = typeToKind[c];
        }
      }

      const guessed = guessKindFromName(cleanName);
      if (kind === 'other' && guessed) kind = guessed;

      if (RUSSIAN_UNESCO_KINDS[qid]) kind = RUSSIAN_UNESCO_KINDS[qid];

      if (['rus_sw_border', 'rus_adm_nao_eao', 'rus_magadan', 'rus_eao'].includes(base) && kind === 'other') {
        continue;
      }

      let image = undefined;
      if (b.image?.value) {
        try {
          const decoded = decodeURIComponent(b.image.value.split('/Special:FilePath/').pop() || '');
          if (decoded) image = decoded;
        } catch {}
      }

      const existing = itemsById.get(qid);
      if (!existing) {
        itemsById.set(qid, {
          id: qid,
          name: cleanName,
          lat,
          lon,
          kind,
          unesco: isUnesco,
          sitelinks,
          image
        });
      } else {
        if (isUnesco) existing.unesco = true;
        if (kind !== 'other' && (existing.kind === 'other' || existing.kind === 'monument')) existing.kind = kind;
        if (sitelinks > existing.sitelinks) existing.sitelinks = sitelinks;
        if (!existing.image && image) existing.image = image;
      }
    }
  }

  if (itemsById.has('Q133274') && itemsById.has('Q16961872')) {
    const kremlin = itemsById.get('Q133274');
    const unescoKremlin = itemsById.get('Q16961872');
    unescoKremlin.sitelinks = Math.max(unescoKremlin.sitelinks, kremlin.sitelinks);
    unescoKremlin.name = 'Московский Кремль и Красная площадь';
    unescoKremlin.kind = 'fortress';
    unescoKremlin.unesco = true;
    if (!unescoKremlin.image && kremlin.image) unescoKremlin.image = kremlin.image;
    itemsById.delete('Q133274');
  } else if (itemsById.has('Q133274') && !itemsById.has('Q16961872')) {
    const kremlin = itemsById.get('Q133274');
    kremlin.name = 'Московский Кремль и Красная площадь';
    kremlin.kind = 'fortress';
    kremlin.unesco = true;
  }

  if (itemsById.has('Q638445') && itemsById.has('Q64532917')) {
    const cher = itemsById.get('Q638445');
    const unescoCher = itemsById.get('Q64532917');
    unescoCher.sitelinks = Math.max(unescoCher.sitelinks, cher.sitelinks);
    unescoCher.name = 'Древний город Херсонес Таврический и его хора';
    unescoCher.kind = 'monument';
    unescoCher.unesco = true;
    if (!unescoCher.image && cher.image) unescoCher.image = cher.image;
    itemsById.delete('Q638445');
  } else if (itemsById.has('Q638445') && !itemsById.has('Q64532917')) {
    const cher = itemsById.get('Q638445');
    cher.name = 'Древний город Херсонес Таврический и его хора';
    cher.kind = 'monument';
    cher.unesco = true;
  }

  if (itemsById.has('Q205711') && itemsById.has('Q15980181')) {
    const isl = itemsById.get('Q205711');
    const unescoSol = itemsById.get('Q15980181');
    unescoSol.sitelinks = Math.max(unescoSol.sitelinks, isl.sitelinks);
    unescoSol.name = 'Историко-культурный комплекс Соловецких островов';
    unescoSol.kind = 'monument';
    unescoSol.unesco = true;
    if (!unescoSol.image && isl.image) unescoSol.image = isl.image;
    itemsById.delete('Q205711');
  }

  const rusRegionItems = new Map();
  const worldItems = [];

  for (const item of itemsById.values()) {
    if (item.id === 'Q192243') {
      item.regionId = 'RUS-2336';
      item.country = 'RUS';
      item.regionName = 'Ленинградская область';
      item.lon = 26.9806;
      item.lat = 60.0844;
    } else {
      const reg = findRegion(item.lon, item.lat);
      if (!reg) continue;
      item.regionId = reg.id;
      item.country = reg.country;
      item.regionName = reg.name;
    }

    if (item.country === 'RUS') {
      if (!rusRegionItems.has(item.regionName)) rusRegionItems.set(item.regionName, []);
      rusRegionItems.get(item.regionName).push(item);
    } else {
      if (item.unesco || item.sitelinks >= 35) {
        if (item.kind === 'bridge' && item.sitelinks < 45) continue;
        worldItems.push(item);
      }
    }
  }

  const rusBridges = [];
  for (const items of rusRegionItems.values()) {
    for (const it of items) {
      if (it.kind === 'bridge') rusBridges.push(it);
    }
  }
  rusBridges.sort((a,b) => b.sitelinks - a.sitelinks);
  const allowedRusBridges = new Set(
    rusBridges
      .filter(b => !/ГЭС/i.test(b.name))
      .slice(0, 15)
      .map(b => b.id)
  );

  const selectedRusItems = [];
  const rusRegionCounts = {};
  for (const f of regionsData.features) {
    if (f.properties.country === 'RUS') rusRegionCounts[f.properties.name] = 0;
  }

  for (const [regName, candidates] of rusRegionItems.entries()) {
    const filtered = candidates.filter(it => it.kind !== 'bridge' || allowedRusBridges.has(it.id) || candidates.length < 10);
    const isCapital = (regName === 'Москва' || regName === 'Санкт-Петербург');
    const cap = isCapital ? 80 : 45;

    const guaranteed = [];
    const rest = [];
    for (const it of filtered) {
      if (SEVEN_WONDERS_SET.has(it.id) || it.unesco) {
        guaranteed.push(it);
      } else {
        rest.push(it);
      }
    }
    rest.sort((a,b) => b.sitelinks - a.sitelinks);

    const availableSlots = Math.max(0, cap - guaranteed.length);
    const neededFor10 = Math.max(0, 10 - guaranteed.length);
    const countToTake = Math.min(rest.length, Math.max(availableSlots, neededFor10));

    const selected = guaranteed.concat(rest.slice(0, countToTake));
    selectedRusItems.push(...selected);
    rusRegionCounts[regName] = selected.length;
  }

  const allCandidates = selectedRusItems.concat(worldItems);

  const DEG_TO_KM = 111.32;
  const spatialIndex = new Flatbush(allCandidates.length);
  for (const s of allCandidates) {
    spatialIndex.add(s.lon, s.lat, s.lon, s.lat);
  }
  spatialIndex.finish();

  const dropped = new Set();
  for (let i = 0; i < allCandidates.length; i++) {
    if (dropped.has(i)) continue;
    const a = allCandidates[i];
    const delta = 0.002;
    const cands = spatialIndex.search(a.lon - delta, a.lat - delta, a.lon + delta, a.lat + delta);
    for (const j of cands) {
      if (i >= j || dropped.has(j)) continue;
      const b = allCandidates[j];
      const cosLat = Math.cos((a.lat * Math.PI) / 180);
      const distMeters = Math.hypot((a.lon - b.lon) * cosLat * DEG_TO_KM * 1000, (a.lat - b.lat) * DEG_TO_KM * 1000);
      if (distMeters < 150) {
        if (SEVEN_WONDERS_SET.has(a.id)) {
          dropped.add(j);
        } else if (SEVEN_WONDERS_SET.has(b.id)) {
          dropped.add(i);
          break;
        } else if (a.unesco && !b.unesco) {
          dropped.add(j);
        } else if (b.unesco && !a.unesco) {
          dropped.add(i);
          break;
        } else if (a.sitelinks >= b.sitelinks) {
          dropped.add(j);
        } else {
          dropped.add(i);
          break;
        }
      }
    }
  }

  const finalSights = allCandidates.filter((_, idx) => !dropped.has(idx));

  for (const k of Object.keys(rusRegionCounts)) rusRegionCounts[k] = 0;
  for (const s of finalSights) {
    if (s.country === 'RUS' && s.regionName) {
      rusRegionCounts[s.regionName] = (rusRegionCounts[s.regionName] || 0) + 1;
    }
  }

  let wikiMap = {};
  const wikiFile = path.join(cacheDir, 'wiki_titles.json');
  if (fs.existsSync(wikiFile)) {
    try {
      const list = JSON.parse(fs.readFileSync(wikiFile, 'utf8'));
      for (const row of list) {
        const id = row.item?.value?.split('/').pop();
        if (id && row.wiki?.value) wikiMap[id] = row.wiki.value;
      }
    } catch {}
  }

  const allQids = finalSights.map(s => s.id);
  const fetchedTitles = await fetchRuwikiTitles(allQids);
  for (const [id, title] of Object.entries(fetchedTitles)) {
    if (title && !wikiMap[id]) wikiMap[id] = title;
  }

  for (const s of finalSights) {
    if (wikiMap[s.id]) {
      s.wiki = wikiMap[s.id];
    } else {
      s.wiki = s.name;
    }
  }

  const features = finalSights.map(s => {
    const sitelinks = s.sitelinks || 0;
    let tier = 1;
    if (sitelinks >= 50) tier = 4;
    else if (sitelinks >= 20) tier = 3;
    else if (sitelinks >= 8) tier = 2;

    if (s.unesco) tier = Math.max(tier, 3);
    if (SEVEN_WONDERS_SET.has(s.id)) tier = 4;

    const radius = s.kind === 'park' ? 15000 : (s.kind === 'mountain' || s.kind === 'water') ? 5000 : s.kind === 'nature' ? 2000 : 500;
    const properties = {
      id: s.id,
      name: s.name,
      kind: s.kind,
      unesco: s.unesco,
      sitelinks: s.sitelinks,
      tier,
      radius,
      regionId: s.regionId,
      country: s.country
    };
    if (s.image) properties.image = s.image;
    if (s.wiki) properties.wiki = s.wiki;
    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [parseFloat(s.lon.toFixed(5)), parseFloat(s.lat.toFixed(5))]
      },
      properties
    };
  });

  const geojson = {
    type: 'FeatureCollection',
    features
  };

  const jsonStr = JSON.stringify(geojson);
  const sizeMb = jsonStr.length / (1024 * 1024);
  if (sizeMb > 1.6) {
    throw new Error(`sights.json size exceeds limit: ${sizeMb.toFixed(2)} MB`);
  }

  fs.writeFileSync(outFilePath, jsonStr, 'utf8');

  let rusCount = 0;
  let worldCount = 0;
  let unescoCount = 0;
  const foCounts = {};
  const kindCounts = {};
  const tierCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };

  for (const f of features) {
    const p = f.properties;
    if (p.country === 'RUS') {
      rusCount++;
    } else {
      worldCount++;
    }
    if (p.unesco) unescoCount++;
    kindCounts[p.kind] = (kindCounts[p.kind] || 0) + 1;
    tierCounts[p.tier]++;
  }

  for (const [name, c] of Object.entries(rusRegionCounts)) {
    const fo = getFo(name);
    if (fo) foCounts[fo] = (foCounts[fo] || 0) + c;
  }

  const sortedSubjects = Object.entries(rusRegionCounts).sort((a,b) => a[1] - b[1]);
  const rusTier4 = features.filter(f => f.properties.country === 'RUS' && f.properties.tier === 4);
  rusTier4.sort((a,b) => b.properties.sitelinks - a.properties.sitelinks);
  const rusOthers = features.filter(f => f.properties.country === 'RUS' && f.properties.kind === 'other');
  const totalOthers = features.filter(f => f.properties.kind === 'other');

  const rusUnescoSights = features.filter(f => f.properties.country === 'RUS' && f.properties.unesco);
  const rusUnescoIds = new Set(rusUnescoSights.map(f => f.properties.id));

  const expectedRusUnescoQids = new Set();
  for (const b of unescoRus) {
    const q = b.item.value.split('/').pop();
    if (!RUSSIAN_UNESCO_SUBCOMPONENTS.has(q)) {
      expectedRusUnescoQids.add(q);
    }
  }
  for (const q of Object.keys(RUSSIAN_UNESCO_NAMES)) {
    if (!RUSSIAN_UNESCO_SUBCOMPONENTS.has(q)) {
      expectedRusUnescoQids.add(q);
    }
  }

  const missingRusUnesco = [];
  for (const q of expectedRusUnescoQids) {
    if (!rusUnescoIds.has(q)) {
      missingRusUnesco.push(q);
    }
  }

  if (missingRusUnesco.length > 0) {
    throw new Error(`Russian UNESCO verification failed. Missing sites: ${missingRusUnesco.join(', ')}`);
  }

  if (unescoCount < 900 || unescoCount > 1050) {
    throw new Error(`World UNESCO count out of expected range (900-1050): ${unescoCount}`);
  }

  for (const [subj, c] of Object.entries(rusRegionCounts)) {
    if (c < 6) {
      throw new Error(`Subject ${subj} has fewer than 6 sights: ${c}`);
    }
  }

  if (rusOthers.length > 0) {
    throw new Error(`Russian sights must not have 'other' kind, but found: ${rusOthers.length}`);
  }

  if ((totalOthers.length / features.length) > 0.05) {
    throw new Error(`Total other sights exceed 5%: ${((totalOthers.length / features.length) * 100).toFixed(2)}%`);
  }

  console.log('Build completed successfully.');
  console.log(`Total sights: ${finalSights.length}`);
  console.log(`Russia: ${rusCount}, World: ${worldCount}, UNESCO: ${unescoCount}`);
  console.log('Federal districts:', JSON.stringify(foCounts));
  console.log('Kinds:', JSON.stringify(kindCounts));
  console.log('Tiers:', JSON.stringify(tierCounts));
  console.log('Poorest 10 regions:', JSON.stringify(sortedSubjects.slice(0, 10)));
  console.log('Richest 5 regions:', JSON.stringify(sortedSubjects.slice(-5)));
  console.log(`Russia Tier 4 (${rusTier4.length}):`, JSON.stringify(rusTier4.map(f => ({ name: f.properties.name, kind: f.properties.kind, sitelinks: f.properties.sitelinks }))));
  console.log(`Russia Other (${rusOthers.length}):`, JSON.stringify(rusOthers.map(f => ({ name: f.properties.name, id: f.properties.id }))));
  console.log(`File size: ${sizeMb.toFixed(3)} MB`);
}

build().catch(err => {
  console.error('Build sights failed:', err);
  process.exit(1);
});
