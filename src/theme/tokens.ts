export interface ThemePalette {
  bg: string;
  bg2: string;
  bg3: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accent2: string;
  mapWater: string;
  mapLand: string;
  mapText: string;
  mapRoads: string;
  mapCountryOutline: string;
  mapRegionOutline: string;
  mapVisitedFill: string;
  mapVisitedDistrict: string;
  mapVisitedBronzeRegion: string;
  mapVisitedBronzeDistrict: string;
  mapVisitedCityFill: string;
  mapWishlistOutline: string;
  mapHillshadeShadow: string;
  mapHillshadeHighlight: string;
  mapHillshadeAccent: string;
  mapClusterStroke: string;
  mapClusterText: string;
  mapPhotoPointInner: string;
  badgeGoldBg: string;
  badgeGoldBorder: string;
  badgeGoldText: string;
  badgeSilverBg: string;
  badgeSilverBorder: string;
  badgeSilverText: string;
  badgeBronzeBg: string;
  badgeBronzeBorder: string;
  badgeBronzeText: string;
}

export const DARK_THEME: ThemePalette = {
  bg: '#0E0F12',
  bg2: '#16181D',
  bg3: '#1F2228',
  border: '#2A2D33',
  text: '#F2F3F5',
  muted: '#8A8F99',
  accent: '#E5383B',
  accent2: '#FF6B6E',
  mapWater: '#090A0D',
  mapLand: '#16181D',
  mapText: '#7A7F8A',
  mapRoads: '#22252B',
  mapCountryOutline: '#3A3F4A',
  mapRegionOutline: '#2D313A',
  mapVisitedFill: 'rgba(229, 56, 59, 0.22)',
  mapVisitedDistrict: 'rgba(229, 56, 59, 0.70)',
  mapVisitedBronzeRegion: 'rgba(229, 56, 59, 0.15)',
  mapVisitedBronzeDistrict: 'rgba(229, 56, 59, 0.25)',
  mapVisitedCityFill: 'rgba(229, 56, 59, 0.65)',
  mapWishlistOutline: '#F2F3F5',
  mapHillshadeShadow: '#000000',
  mapHillshadeHighlight: '#484F5E',
  mapHillshadeAccent: '#232731',
  mapClusterStroke: '#F2F3F5',
  mapClusterText: '#F2F3F5',
  mapPhotoPointInner: '#FFFFFF',
  badgeGoldBg: 'rgba(217, 119, 6, 0.15)',
  badgeGoldBorder: 'rgba(217, 119, 6, 0.40)',
  badgeGoldText: '#F59E0B',
  badgeSilverBg: 'rgba(148, 163, 184, 0.15)',
  badgeSilverBorder: 'rgba(148, 163, 184, 0.40)',
  badgeSilverText: '#94A3B8',
  badgeBronzeBg: 'rgba(180, 83, 9, 0.15)',
  badgeBronzeBorder: 'rgba(180, 83, 9, 0.40)',
  badgeBronzeText: '#D97706'
};

export const LIGHT_THEME: ThemePalette = {
  bg: '#F6F7F9',
  bg2: '#FFFFFF',
  bg3: '#EBECEF',
  border: '#D8DCE3',
  text: '#111317',
  muted: '#636872',
  accent: '#E5383B',
  accent2: '#BA181B',
  mapWater: '#E2E5EB',
  mapLand: '#F5F6F8',
  mapText: '#5A606C',
  mapRoads: '#E2E4E8',
  mapCountryOutline: '#C4C9D4',
  mapRegionOutline: '#D8DCE3',
  mapVisitedFill: 'rgba(229, 56, 59, 0.20)',
  mapVisitedDistrict: 'rgba(229, 56, 59, 0.70)',
  mapVisitedBronzeRegion: 'rgba(229, 56, 59, 0.15)',
  mapVisitedBronzeDistrict: 'rgba(229, 56, 59, 0.25)',
  mapVisitedCityFill: 'rgba(229, 56, 59, 0.65)',
  mapWishlistOutline: '#5A606C',
  mapHillshadeShadow: '#757C8A',
  mapHillshadeHighlight: '#FFFFFF',
  mapHillshadeAccent: '#B5BAC5',
  mapClusterStroke: '#FFFFFF',
  mapClusterText: '#FFFFFF',
  mapPhotoPointInner: '#FFFFFF',
  badgeGoldBg: 'rgba(217, 119, 6, 0.15)',
  badgeGoldBorder: 'rgba(217, 119, 6, 0.40)',
  badgeGoldText: '#B45309',
  badgeSilverBg: 'rgba(100, 116, 139, 0.15)',
  badgeSilverBorder: 'rgba(100, 116, 139, 0.40)',
  badgeSilverText: '#64748B',
  badgeBronzeBg: 'rgba(180, 83, 9, 0.15)',
  badgeBronzeBorder: 'rgba(180, 83, 9, 0.40)',
  badgeBronzeText: '#92400E'
};

export const PALETTES = {
  dark: DARK_THEME,
  light: LIGHT_THEME
};

export function applyTheme(theme: 'dark' | 'light'): void {
  const root = document.documentElement;
  const p = PALETTES[theme];
  root.setAttribute('data-theme', theme);

  root.style.setProperty('--bg', p.bg);
  root.style.setProperty('--bg-2', p.bg2);
  root.style.setProperty('--bg-3', p.bg3);
  root.style.setProperty('--border', p.border);
  root.style.setProperty('--text', p.text);
  root.style.setProperty('--muted', p.muted);
  root.style.setProperty('--accent', p.accent);
  root.style.setProperty('--accent-2', p.accent2);
  root.style.setProperty('--radius', '12px');
  root.style.setProperty('--radius-sm', '8px');
  root.style.setProperty('--radius-lg', '16px');

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('travel_map_theme', theme);
  }
}
