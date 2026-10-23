import type { AchievementDef, GameContext } from '../types';

export const FEDERAL_DISTRICTS: Record<string, string[]> = {
  cfo: [
    'Москва', 'Белгородская область', 'Брянская область', 'Владимирская область',
    'Воронежская область', 'Ивановская область', 'Калужская область', 'Костромская область',
    'Курская область', 'Липецкая область', 'Московская область', 'Орловская область',
    'Рязанская область', 'Смоленская область', 'Тамбовская область', 'Тверская область',
    'Тульская область', 'Ярославская область'
  ],
  szfo: [
    'Санкт-Петербург', 'Архангельская область', 'Вологодская область', 'Калининградская область',
    'Карелия', 'Республика Коми', 'Ленинградская область', 'Мурманская область',
    'Ненецкий автономный округ', 'Новгородская область', 'Псковская область'
  ],
  yufo: [
    'Адыгея', 'Астраханская область', 'Волгоградская область', 'Калмыкия',
    'Краснодарский край', 'Ростовская область', 'Республика Крым', 'Севастополь',
    'Донецкая Народная Республика', 'Луганская Народная Республика',
    'Запорожская область', 'Херсонская область'
  ],
  skfo: [
    'Дагестан', 'Ингушетия', 'Кабардино-Балкария', 'Карачаево-Черкесия',
    'Республика Северная Осетия-Алания', 'Ставропольский край', 'Чечня'
  ],
  pfo: [
    'Республика Башкортостан', 'Кировская область', 'Марий Эл', 'Мордовия',
    'Нижегородская область', 'Оренбургская область', 'Пензенская область', 'Пермский край',
    'Самарская область', 'Саратовская область', 'Татарстан', 'Удмуртия',
    'Ульяновская область', 'Чувашия'
  ],
  ufo: [
    'Курганская область', 'Свердловская область', 'Тюменская область',
    'Ханты-Мансийский автономный округ — Югра', 'Челябинская область',
    'Ямало-Ненецкий автономный округ'
  ],
  sfo: [
    'Республика Алтай', 'Алтайский край', 'Иркутская область', 'Кемеровская область',
    'Красноярский край', 'Новосибирская область', 'Омская область', 'Томская область',
    'Тыва', 'Хакасия'
  ],
  dfo: [
    'Амурская область', 'Бурятия', 'Еврейская автономная область', 'Забайкальский край',
    'Камчатский край', 'Магаданская область', 'Приморский край', 'Сахалинская область',
    'Хабаровский край', 'Чукотский автономный округ', 'Якутия'
  ]
};

export const RUSSIAN_SEAS: Record<string, string[]> = {
  baltic: ['Калининградская область', 'Санкт-Петербург', 'Ленинградская область'],
  black: ['Краснодарский край', 'Республика Крым', 'Севастополь'],
  azov: ['Ростовская область', 'Краснодарский край', 'Республика Крым', 'Донецкая Народная Республика', 'Запорожская область'],
  caspian: ['Дагестан', 'Калмыкия', 'Астраханская область'],
  barentsWhite: ['Мурманская область', 'Архангельская область', 'Ненецкий автономный округ', 'Карелия'],
  japan: ['Приморский край', 'Хабаровский край', 'Сахалинская область'],
  okhotsk: ['Магаданская область', 'Камчатский край', 'Сахалинская область', 'Хабаровский край']
};

export const ARCTIC_REGIONS = [
  'Мурманская область', 'Архангельская область', 'Ненецкий автономный округ',
  'Ямало-Ненецкий автономный округ', 'Красноярский край', 'Якутия', 'Чукотский автономный округ'
];

export const EXTREME_POINTS = [
  'Калининградская область', 'Чукотский автономный округ', 'Мурманская область', 'Дагестан'
];

export const TRANSSIB_REGIONS = [
  'Москва', 'Свердловская область', 'Новосибирская область', 'Иркутская область',
  'Забайкальский край', 'Приморский край'
];

export const BAIKAL_REGIONS = [
  'Иркутская область', 'Бурятия'
];

export const GOLDEN_RING_REGIONS = [
  'Ярославская область', 'Владимирская область', 'Костромская область',
  'Ивановская область', 'Московская область'
];

export const CAUCASUS_REPUBLICS = [
  'Дагестан', 'Чечня', 'Ингушетия', 'Республика Северная Осетия-Алания',
  'Кабардино-Балкария', 'Карачаево-Черкесия', 'Адыгея'
];

export const RUSSIAN_REPUBLICS = [
  'Адыгея', 'Республика Алтай', 'Республика Башкортостан', 'Бурятия',
  'Дагестан', 'Ингушетия', 'Кабардино-Балкария', 'Калмыкия',
  'Карачаево-Черкесия', 'Карелия', 'Республика Коми', 'Республика Крым',
  'Марий Эл', 'Мордовия', 'Республика Северная Осетия-Алания', 'Татарстан',
  'Тыва', 'Удмуртия', 'Хакасия', 'Чечня', 'Чувашия', 'Якутия',
  'Донецкая Народная Республика', 'Луганская Народная Республика'
];

export const RUSSIA_LAND_NEIGHBORS = [
  'NOR', 'FIN', 'EST', 'LVA', 'LTU', 'POL', 'BLR', 'UKR',
  'ABK', 'GEO', 'SOS', 'AZE', 'KAZ', 'MNG', 'CHN', 'PRK'
];

export const CIS_MEMBERS = [
  'RUS', 'BLR', 'ARM', 'AZE', 'KAZ', 'KGZ', 'TJK', 'UZB'
];

function countVisitedNames(names: string[], visitedNames: Set<string>): number {
  let count = 0;
  for (const n of names) {
    if (visitedNames.has(n)) count++;
  }
  return count;
}

function countVisitedCodes(codes: string[], visitedCodes: Set<string>): number {
  let count = 0;
  for (const c of codes) {
    if (visitedCodes.has(c)) count++;
  }
  return count;
}

function isNightTime(takenAt?: string): boolean {
  if (!takenAt) return false;
  const d = new Date(takenAt);
  if (isNaN(d.getTime())) return false;
  const localH = d.getHours();
  const utcH = d.getUTCHours();
  return (localH >= 0 && localH < 4) || (utcH >= 0 && utcH < 4);
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'rus_subjects_5',
    section: 'russia',
    title: 'Первые шаги по России',
    description: 'Посети 5 субъектов Российской Федерации',
    icon: 'compass',
    xp: 300,
    condition: (ctx: GameContext) => (ctx.visitedRusRegionNames?.size || 0) >= 5,
    progress: (ctx: GameContext) => ({
      current: Math.min(5, ctx.visitedRusRegionNames?.size || 0),
      target: 5
    })
  },
  {
    id: 'rus_subjects_15',
    section: 'russia',
    title: 'Русские просторы',
    description: 'Посети 15 субъектов Российской Федерации',
    icon: 'map-pin',
    xp: 800,
    condition: (ctx: GameContext) => (ctx.visitedRusRegionNames?.size || 0) >= 15,
    progress: (ctx: GameContext) => ({
      current: Math.min(15, ctx.visitedRusRegionNames?.size || 0),
      target: 15
    })
  },
  {
    id: 'rus_subjects_30',
    section: 'russia',
    title: 'Большая страна',
    description: 'Посети 30 субъектов Российской Федерации',
    icon: 'award',
    xp: 1800,
    condition: (ctx: GameContext) => (ctx.visitedRusRegionNames?.size || 0) >= 30,
    progress: (ctx: GameContext) => ({
      current: Math.min(30, ctx.visitedRusRegionNames?.size || 0),
      target: 30
    })
  },
  {
    id: 'rus_subjects_50',
    section: 'russia',
    title: 'Хозяин просторов',
    description: 'Посети 50 субъектов Российской Федерации',
    icon: 'flag',
    xp: 3500,
    condition: (ctx: GameContext) => (ctx.visitedRusRegionNames?.size || 0) >= 50,
    progress: (ctx: GameContext) => ({
      current: Math.min(50, ctx.visitedRusRegionNames?.size || 0),
      target: 50
    })
  },
  {
    id: 'rus_subjects_89',
    section: 'russia',
    title: 'Вся Россия',
    description: 'Посети все 89 субъектов Российской Федерации',
    icon: 'crown',
    xp: 12000,
    condition: (ctx: GameContext) => (ctx.visitedRusRegionNames?.size || 0) >= 89,
    progress: (ctx: GameContext) => ({
      current: Math.min(89, ctx.visitedRusRegionNames?.size || 0),
      target: 89
    })
  },
  {
    id: 'rus_fo_all',
    section: 'russia',
    title: 'Связующая нить',
    description: 'Побывай хотя бы в одном субъекте каждого из 8 федеральных округов России',
    icon: 'route',
    xp: 2000,
    condition: (ctx: GameContext) => {
      const names = ctx.visitedRusRegionNames || new Set();
      return Object.values(FEDERAL_DISTRICTS).every(list => list.some(n => names.has(n)));
    },
    progress: (ctx: GameContext) => {
      const names = ctx.visitedRusRegionNames || new Set();
      let okrugsCovered = 0;
      for (const list of Object.values(FEDERAL_DISTRICTS)) {
        if (list.some(n => names.has(n))) okrugsCovered++;
      }
      return { current: okrugsCovered, target: 8 };
    }
  },
  {
    id: 'rus_fo_cfo',
    section: 'russia',
    title: 'Сердце России',
    description: 'Посети все 18 субъектов Центрального федерального округа',
    icon: 'landmark',
    xp: 2500,
    condition: (ctx: GameContext) => countVisitedNames(FEDERAL_DISTRICTS.cfo, ctx.visitedRusRegionNames || new Set()) >= 18,
    progress: (ctx: GameContext) => ({
      current: countVisitedNames(FEDERAL_DISTRICTS.cfo, ctx.visitedRusRegionNames || new Set()),
      target: 18
    })
  },
  {
    id: 'rus_fo_szfo',
    section: 'russia',
    title: 'Русский Север',
    description: 'Посети все 11 субъектов Северо-Западного федерального округа',
    icon: 'anchor',
    xp: 2500,
    condition: (ctx: GameContext) => countVisitedNames(FEDERAL_DISTRICTS.szfo, ctx.visitedRusRegionNames || new Set()) >= 11,
    progress: (ctx: GameContext) => ({
      current: countVisitedNames(FEDERAL_DISTRICTS.szfo, ctx.visitedRusRegionNames || new Set()),
      target: 11
    })
  },
  {
    id: 'rus_fo_yufo',
    section: 'russia',
    title: 'Южные горизонты',
    description: 'Посети все 12 субъектов Южного федерального округа',
    icon: 'sun',
    xp: 2500,
    condition: (ctx: GameContext) => countVisitedNames(FEDERAL_DISTRICTS.yufo, ctx.visitedRusRegionNames || new Set()) >= 12,
    progress: (ctx: GameContext) => ({
      current: countVisitedNames(FEDERAL_DISTRICTS.yufo, ctx.visitedRusRegionNames || new Set()),
      target: 12
    })
  },
  {
    id: 'rus_fo_skfo',
    section: 'russia',
    title: 'Вершины Кавказа',
    description: 'Посети все 7 субъектов Северо-Кавказского федерального округа',
    icon: 'mountain',
    xp: 2000,
    condition: (ctx: GameContext) => countVisitedNames(FEDERAL_DISTRICTS.skfo, ctx.visitedRusRegionNames || new Set()) >= 7,
    progress: (ctx: GameContext) => ({
      current: countVisitedNames(FEDERAL_DISTRICTS.skfo, ctx.visitedRusRegionNames || new Set()),
      target: 7
    })
  },
  {
    id: 'rus_fo_pfo',
    section: 'russia',
    title: 'Волжские просторы',
    description: 'Посети все 14 субъектов Приволжского федерального округа',
    icon: 'ship',
    xp: 2500,
    condition: (ctx: GameContext) => countVisitedNames(FEDERAL_DISTRICTS.pfo, ctx.visitedRusRegionNames || new Set()) >= 14,
    progress: (ctx: GameContext) => ({
      current: countVisitedNames(FEDERAL_DISTRICTS.pfo, ctx.visitedRusRegionNames || new Set()),
      target: 14
    })
  },
  {
    id: 'rus_fo_ufo',
    section: 'russia',
    title: 'Опорный край',
    description: 'Посети все 6 субъектов Уральского федерального округа',
    icon: 'gem',
    xp: 2000,
    condition: (ctx: GameContext) => countVisitedNames(FEDERAL_DISTRICTS.ufo, ctx.visitedRusRegionNames || new Set()) >= 6,
    progress: (ctx: GameContext) => ({
      current: countVisitedNames(FEDERAL_DISTRICTS.ufo, ctx.visitedRusRegionNames || new Set()),
      target: 6
    })
  },
  {
    id: 'rus_fo_sfo',
    section: 'russia',
    title: 'Сибирская мощь',
    description: 'Посети все 10 субъектов Сибирского федерального округа',
    icon: 'trees',
    xp: 2500,
    condition: (ctx: GameContext) => countVisitedNames(FEDERAL_DISTRICTS.sfo, ctx.visitedRusRegionNames || new Set()) >= 10,
    progress: (ctx: GameContext) => ({
      current: countVisitedNames(FEDERAL_DISTRICTS.sfo, ctx.visitedRusRegionNames || new Set()),
      target: 10
    })
  },
  {
    id: 'rus_fo_dfo',
    section: 'russia',
    title: 'Дальневосточный рубеж',
    description: 'Посети все 11 субъектов Дальневосточного федерального округа',
    icon: 'sunrise',
    xp: 3000,
    condition: (ctx: GameContext) => countVisitedNames(FEDERAL_DISTRICTS.dfo, ctx.visitedRusRegionNames || new Set()) >= 11,
    progress: (ctx: GameContext) => ({
      current: countVisitedNames(FEDERAL_DISTRICTS.dfo, ctx.visitedRusRegionNames || new Set()),
      target: 11
    })
  },
  {
    id: 'rus_theme_seas',
    section: 'russia',
    title: 'Семь морей',
    description: 'Побывай на побережьях минимум 5 из 7 морей России (Балтийское, Чёрное, Азовское, Каспийское, Баренцево/Белое, Японское, Охотское)',
    icon: 'waves',
    xp: 2500,
    condition: (ctx: GameContext) => {
      const names = ctx.visitedRusRegionNames || new Set();
      let seasCount = 0;
      for (const seaRegs of Object.values(RUSSIAN_SEAS)) {
        if (seaRegs.some(n => names.has(n))) seasCount++;
      }
      return seasCount >= 5;
    },
    progress: (ctx: GameContext) => {
      const names = ctx.visitedRusRegionNames || new Set();
      let seasCount = 0;
      for (const seaRegs of Object.values(RUSSIAN_SEAS)) {
        if (seaRegs.some(n => names.has(n))) seasCount++;
      }
      return { current: Math.min(5, seasCount), target: 5 };
    }
  },
  {
    id: 'rus_theme_arctic',
    section: 'russia',
    title: 'Арктический пояс',
    description: 'Посети минимум 4 из 7 арктических субъектов (Мурманская, Архангельская области, НАО, ЯНАО, Красноярский край, Якутия, Чукотка)',
    icon: 'snowflake',
    xp: 2500,
    condition: (ctx: GameContext) => countVisitedNames(ARCTIC_REGIONS, ctx.visitedRusRegionNames || new Set()) >= 4,
    progress: (ctx: GameContext) => ({
      current: Math.min(4, countVisitedNames(ARCTIC_REGIONS, ctx.visitedRusRegionNames || new Set())),
      target: 4
    })
  },
  {
    id: 'rus_theme_extremes',
    section: 'russia',
    title: 'Четыре стороны',
    description: 'Посети крайние субъекты России: Калининградскую область, Чукотку, Мурманскую область и Дагестан',
    icon: 'compass',
    xp: 3500,
    condition: (ctx: GameContext) => countVisitedNames(EXTREME_POINTS, ctx.visitedRusRegionNames || new Set()) >= 4,
    progress: (ctx: GameContext) => ({
      current: countVisitedNames(EXTREME_POINTS, ctx.visitedRusRegionNames || new Set()),
      target: 4
    })
  },
  {
    id: 'rus_theme_transsib',
    section: 'russia',
    title: 'Великий Сибирский путь',
    description: 'Посети ключевые регионы Транссиба: Москву, Свердловскую, Новосибирскую, Иркутскую области, Забайкальский и Приморский края',
    icon: 'train',
    xp: 2500,
    condition: (ctx: GameContext) => countVisitedNames(TRANSSIB_REGIONS, ctx.visitedRusRegionNames || new Set()) >= 6,
    progress: (ctx: GameContext) => ({
      current: countVisitedNames(TRANSSIB_REGIONS, ctx.visitedRusRegionNames || new Set()),
      target: 6
    })
  },
  {
    id: 'rus_theme_baikal',
    section: 'russia',
    title: 'Око Сибири',
    description: 'Посети оба региона вокруг Байкала: Иркутскую область и Бурятию',
    icon: 'droplets',
    xp: 1200,
    condition: (ctx: GameContext) => countVisitedNames(BAIKAL_REGIONS, ctx.visitedRusRegionNames || new Set()) >= 2,
    progress: (ctx: GameContext) => ({
      current: countVisitedNames(BAIKAL_REGIONS, ctx.visitedRusRegionNames || new Set()),
      target: 2
    })
  },
  {
    id: 'rus_theme_golden_ring',
    section: 'russia',
    title: 'Золотое кольцо',
    description: 'Посети все 5 регионов Золотого кольца: Ярославскую, Владимирскую, Костромскую, Ивановскую и Московскую области',
    icon: 'sparkles',
    xp: 1500,
    condition: (ctx: GameContext) => countVisitedNames(GOLDEN_RING_REGIONS, ctx.visitedRusRegionNames || new Set()) >= 5,
    progress: (ctx: GameContext) => ({
      current: countVisitedNames(GOLDEN_RING_REGIONS, ctx.visitedRusRegionNames || new Set()),
      target: 5
    })
  },
  {
    id: 'rus_theme_caucasus',
    section: 'russia',
    title: 'Покоритель Кавказа',
    description: 'Посети все 7 республик Северного Кавказа: Дагестан, Чечню, Ингушетию, Северную Осетию, Кабардино-Балкарию, Карачаево-Черкесию и Адыгею',
    icon: 'mountain',
    xp: 2500,
    condition: (ctx: GameContext) => countVisitedNames(CAUCASUS_REPUBLICS, ctx.visitedRusRegionNames || new Set()) >= 7,
    progress: (ctx: GameContext) => ({
      current: countVisitedNames(CAUCASUS_REPUBLICS, ctx.visitedRusRegionNames || new Set()),
      target: 7
    })
  },
  {
    id: 'rus_theme_republics',
    section: 'russia',
    title: 'Созвездие республик',
    description: 'Посети 10 любых национальных республик Российской Федерации',
    icon: 'shield',
    xp: 2000,
    condition: (ctx: GameContext) => countVisitedNames(RUSSIAN_REPUBLICS, ctx.visitedRusRegionNames || new Set()) >= 10,
    progress: (ctx: GameContext) => ({
      current: Math.min(10, countVisitedNames(RUSSIAN_REPUBLICS, ctx.visitedRusRegionNames || new Set())),
      target: 10
    })
  },
  {
    id: 'rus_districts_25',
    section: 'russia',
    title: 'Знаток окрестностей',
    description: 'Посети 25 районов России',
    icon: 'map',
    xp: 500,
    condition: (ctx: GameContext) => (ctx.visitedRussianDistrictsCount || 0) >= 25,
    progress: (ctx: GameContext) => ({
      current: Math.min(25, ctx.visitedRussianDistrictsCount || 0),
      target: 25
    })
  },
  {
    id: 'rus_districts_100',
    section: 'russia',
    title: 'Сотня районов',
    description: 'Посети 100 районов России',
    icon: 'navigation',
    xp: 1800,
    condition: (ctx: GameContext) => (ctx.visitedRussianDistrictsCount || 0) >= 100,
    progress: (ctx: GameContext) => ({
      current: Math.min(100, ctx.visitedRussianDistrictsCount || 0),
      target: 100
    })
  },
  {
    id: 'rus_districts_300',
    section: 'russia',
    title: 'Хозяин карты',
    description: 'Посети 300 районов России',
    icon: 'trophy',
    xp: 4500,
    condition: (ctx: GameContext) => (ctx.visitedRussianDistrictsCount || 0) >= 300,
    progress: (ctx: GameContext) => ({
      current: Math.min(300, ctx.visitedRussianDistrictsCount || 0),
      target: 300
    })
  },
  {
    id: 'rus_districts_full_region',
    section: 'russia',
    title: 'Весь регион',
    description: 'Посети абсолютно все районы хотя бы одного субъекта Российской Федерации',
    icon: 'target',
    xp: 3500,
    condition: (ctx: GameContext) => Boolean(ctx.hasCompletedAnyFullRegion),
    progress: (ctx: GameContext) => {
      const stats = ctx.bestCompletedRegionProgress || { visited: 0, total: 1 };
      return {
        current: stats.visited,
        target: Math.max(1, stats.total)
      };
    }
  },

  {
    id: 'world_countries_5',
    section: 'world',
    title: 'Выход в свет',
    description: 'Посети 5 стран мира',
    icon: 'plane',
    xp: 500,
    condition: (ctx: GameContext) => (ctx.visitedCountries?.size || 0) >= 5,
    progress: (ctx: GameContext) => ({
      current: Math.min(5, ctx.visitedCountries?.size || 0),
      target: 5
    })
  },
  {
    id: 'world_countries_15',
    section: 'world',
    title: 'Опытный загран',
    description: 'Посети 15 стран мира',
    icon: 'globe',
    xp: 1500,
    condition: (ctx: GameContext) => (ctx.visitedCountries?.size || 0) >= 15,
    progress: (ctx: GameContext) => ({
      current: Math.min(15, ctx.visitedCountries?.size || 0),
      target: 15
    })
  },
  {
    id: 'world_countries_30',
    section: 'world',
    title: 'Гражданин мира',
    description: 'Посети 30 стран мира',
    icon: 'globe',
    xp: 3500,
    condition: (ctx: GameContext) => (ctx.visitedCountries?.size || 0) >= 30,
    progress: (ctx: GameContext) => ({
      current: Math.min(30, ctx.visitedCountries?.size || 0),
      target: 30
    })
  },
  {
    id: 'world_countries_50',
    section: 'world',
    title: 'Планетарный масштаб',
    description: 'Посети 50 стран мира',
    icon: 'globe',
    xp: 7000,
    condition: (ctx: GameContext) => (ctx.visitedCountries?.size || 0) >= 50,
    progress: (ctx: GameContext) => ({
      current: Math.min(50, ctx.visitedCountries?.size || 0),
      target: 50
    })
  },
  {
    id: 'world_countries_100',
    section: 'world',
    title: 'Половина Земли',
    description: 'Посети 100 стран мира',
    icon: 'award',
    xp: 15000,
    condition: (ctx: GameContext) => (ctx.visitedCountries?.size || 0) >= 100,
    progress: (ctx: GameContext) => ({
      current: Math.min(100, ctx.visitedCountries?.size || 0),
      target: 100
    })
  },
  {
    id: 'world_continents_2',
    section: 'world',
    title: 'Новый свет',
    description: 'Побывай на 2 континентах мира',
    icon: 'compass',
    xp: 1000,
    condition: (ctx: GameContext) => (ctx.visitedContinents?.size || 0) >= 2,
    progress: (ctx: GameContext) => ({
      current: Math.min(2, ctx.visitedContinents?.size || 0),
      target: 2
    })
  },
  {
    id: 'world_continents_4',
    section: 'world',
    title: 'Межконтинентальный',
    description: 'Побывай на 4 континентах мира',
    icon: 'globe',
    xp: 2500,
    condition: (ctx: GameContext) => (ctx.visitedContinents?.size || 0) >= 4,
    progress: (ctx: GameContext) => ({
      current: Math.min(4, ctx.visitedContinents?.size || 0),
      target: 4
    })
  },
  {
    id: 'world_continents_6',
    section: 'world',
    title: 'Шесть материков',
    description: 'Побывай на 6 континентах мира',
    icon: 'trophy',
    xp: 6000,
    condition: (ctx: GameContext) => (ctx.visitedContinents?.size || 0) >= 6,
    progress: (ctx: GameContext) => ({
      current: Math.min(6, ctx.visitedContinents?.size || 0),
      target: 6
    })
  },
  {
    id: 'world_theme_neighbors',
    section: 'world',
    title: 'Сухопутные соседи',
    description: 'Посети всех 16 сухопутных соседей России (Норвегия, Финляндия, Эстония, Латвия, Литва, Польша, Белоруссия, Украина, Абхазия, Грузия, Южная Осетия, Азербайджан, Казахстан, Монголия, Китай, КНДР)',
    icon: 'users',
    xp: 5000,
    condition: (ctx: GameContext) => countVisitedCodes(RUSSIA_LAND_NEIGHBORS, ctx.visitedCountries || new Set()) >= 16,
    progress: (ctx: GameContext) => ({
      current: countVisitedCodes(RUSSIA_LAND_NEIGHBORS, ctx.visitedCountries || new Set()),
      target: 16
    })
  },
  {
    id: 'world_theme_cis',
    section: 'world',
    title: 'Содружество',
    description: 'Посети все страны-участники СНГ (Россия, Белоруссия, Армения, Азербайджан, Казахстан, Киргизия, Таджикистан, Узбекистан)',
    icon: 'handshake',
    xp: 3000,
    condition: (ctx: GameContext) => countVisitedCodes(CIS_MEMBERS, ctx.visitedCountries || new Set()) >= 8,
    progress: (ctx: GameContext) => ({
      current: countVisitedCodes(CIS_MEMBERS, ctx.visitedCountries || new Set()),
      target: 8
    })
  },
  {
    id: 'world_theme_europe_10',
    section: 'world',
    title: 'Европейский гран-тур',
    description: 'Посети 10 стран Европы',
    icon: 'landmark',
    xp: 2000,
    condition: (ctx: GameContext) => (ctx.visitedEuropeanCountries?.size || 0) >= 10,
    progress: (ctx: GameContext) => ({
      current: Math.min(10, ctx.visitedEuropeanCountries?.size || 0),
      target: 10
    })
  },
  {
    id: 'world_theme_asia_10',
    section: 'world',
    title: 'Азиатский караван',
    description: 'Посети 10 стран Азии',
    icon: 'sun',
    xp: 2000,
    condition: (ctx: GameContext) => (ctx.visitedAsianCountries?.size || 0) >= 10,
    progress: (ctx: GameContext) => ({
      current: Math.min(10, ctx.visitedAsianCountries?.size || 0),
      target: 10
    })
  },
  {
    id: 'world_theme_hemispheres',
    section: 'world',
    title: 'Оба полушария',
    description: 'Побывай в обоих полушариях Земли — Северном и Южном',
    icon: 'globe',
    xp: 2000,
    condition: (ctx: GameContext) => Boolean(ctx.hasNorthernHemisphere && ctx.hasSouthernHemisphere),
    progress: (ctx: GameContext) => {
      let count = 0;
      if (ctx.hasNorthernHemisphere) count++;
      if (ctx.hasSouthernHemisphere) count++;
      return { current: count, target: 2 };
    }
  },
  {
    id: 'world_regions_25',
    section: 'world',
    title: 'Иностранный десант',
    description: 'Посети 25 регионов мира за пределами России',
    icon: 'map',
    xp: 1500,
    condition: (ctx: GameContext) => (ctx.visitedNonRusRegionCount || 0) >= 25,
    progress: (ctx: GameContext) => ({
      current: Math.min(25, ctx.visitedNonRusRegionCount || 0),
      target: 25
    })
  },
  {
    id: 'world_regions_100',
    section: 'world',
    title: 'Глобальный исследователь',
    description: 'Посети 100 регионов мира за пределами России',
    icon: 'trophy',
    xp: 4000,
    condition: (ctx: GameContext) => (ctx.visitedNonRusRegionCount || 0) >= 100,
    progress: (ctx: GameContext) => ({
      current: Math.min(100, ctx.visitedNonRusRegionCount || 0),
      target: 100
    })
  },

  {
    id: 'spec_alt_1500',
    section: 'special',
    title: 'Горный воздух',
    description: 'Сделай фотографию на высоте более 1500 метров',
    icon: 'mountain',
    xp: 600,
    condition: (ctx: GameContext) => ctx.photos.some(p => (p.alt || 0) >= 1500),
    progress: (ctx: GameContext) => {
      let maxAlt = 0;
      for (const p of ctx.photos) {
        if ((p.alt || 0) > maxAlt) maxAlt = p.alt || 0;
      }
      return { current: Math.min(1500, Math.round(maxAlt)), target: 1500 };
    }
  },
  {
    id: 'spec_alt_3000',
    section: 'special',
    title: 'Выше облаков',
    description: 'Сделай фотографию на высоте более 3000 метров',
    icon: 'cloud',
    xp: 1500,
    condition: (ctx: GameContext) => ctx.photos.some(p => (p.alt || 0) >= 3000),
    progress: (ctx: GameContext) => {
      let maxAlt = 0;
      for (const p of ctx.photos) {
        if ((p.alt || 0) > maxAlt) maxAlt = p.alt || 0;
      }
      return { current: Math.min(3000, Math.round(maxAlt)), target: 3000 };
    }
  },
  {
    id: 'spec_alt_5000',
    section: 'special',
    title: 'Пятитысячник',
    description: 'Сделай фотографию на высоте более 5000 метров',
    icon: 'mountain-snow',
    xp: 3500,
    condition: (ctx: GameContext) => ctx.photos.some(p => (p.alt || 0) >= 5000),
    progress: (ctx: GameContext) => {
      let maxAlt = 0;
      for (const p of ctx.photos) {
        if ((p.alt || 0) > maxAlt) maxAlt = p.alt || 0;
      }
      return { current: Math.min(5000, Math.round(maxAlt)), target: 5000 };
    }
  },
  {
    id: 'spec_night',
    section: 'special',
    title: 'Ночной путник',
    description: 'Сделай фотографию глубокой ночью (между 00:00 и 04:00)',
    icon: 'moon',
    xp: 600,
    condition: (ctx: GameContext) => ctx.photos.some(p => isNightTime(p.takenAt)),
    progress: (ctx: GameContext) => {
      const hasNight = ctx.photos.some(p => isNightTime(p.takenAt));
      return { current: hasNight ? 1 : 0, target: 1 };
    }
  },
  {
    id: 'spec_arctic_circle',
    section: 'special',
    title: 'За Полярным кругом',
    description: 'Сделай фотографию за Полярным кругом (широта ≥ 66.56°)',
    icon: 'snowflake',
    xp: 1500,
    condition: (ctx: GameContext) => ctx.photos.some(p => (p.lat || 0) >= 66.56),
    progress: (ctx: GameContext) => {
      const hasArctic = ctx.photos.some(p => (p.lat || 0) >= 66.56);
      return { current: hasArctic ? 1 : 0, target: 1 };
    }
  }
];
