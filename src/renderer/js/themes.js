'use strict';

const ACCENTS = ['#1E88E5', '#2E7D32', '#EF6C00', '#8E24AA', '#D81B60', '#00897B'];

const EXPERIMENTAL_THEMES = [
  { key: '', name: 'default_black', light: false, order: 0, accent: '#FFFFFF' },
  { key: 'default_white', name: 'default_white', light: true, order: 1, accent: '#000000' },
  { key: 'neon', name: 'neon', light: false, order: 2, accent: '#00E5FF' },
  { key: 'oled', name: 'oled', light: false, order: 3, accent: '#33FF33' },
  { key: 'paper', name: 'paper', light: true, order: 4, accent: '#22355E' },
  { key: 'redline', name: 'redline', light: false, order: 5, accent: '#FF453A' },
  { key: 'mint', name: 'mint', light: true, order: 6, accent: '#00A67D' }
];

const themes = {
  accentColor: '#FFFFFF',
  experimentalTheme: '',
  lightTheme: false,
  customColor: '#FF0000',

  apply() {
    const theme =
      EXPERIMENTAL_THEMES.find((t) => t.key === this.experimentalTheme) || EXPERIMENTAL_THEMES[0];
    const accent = this.accentColor || '#FFFFFF';

    document.documentElement.setAttribute('data-theme', theme.key || 'default_black');
    document.documentElement.style.setProperty('--accent', accent);

    const lum = luminance(accent);
    const darkBg = !this.lightTheme;
    const onAccent = lum > 0.6 ? '#000000' : '#ffffff';
    document.documentElement.style.setProperty('--accent-on', onAccent);
    document.documentElement.style.setProperty('--on-accent', onAccent);
    document.documentElement.style.setProperty('--on-surface', accent);
    document.documentElement.style.setProperty('--on-surface-variant', accent);

    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    if (window.api && window.api.setWindowBg) {
      window.api.setWindowBg(bg || (darkBg ? '#000000' : '#ffffff'));
    }
  },

  fromSettings(s) {
    this.accentColor = s.accentColor;
    this.experimentalTheme = s.experimentalTheme;
    this.lightTheme = s.lightTheme;
    this.customColor = s.customColor || '#FF0000';
    this.apply();
  }
};

function luminance(hex) {
  const m = /^#?([a-f0-9]{6})$/i.exec(hex);
  if (!m) return 0.5;
  const r = parseInt(m[1].slice(0, 2), 16) / 255;
  const g = parseInt(m[1].slice(2, 4), 16) / 255;
  const b = parseInt(m[1].slice(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function parseHex(hex) {
  const m = /^#?([a-f0-9]{6})$/i.exec(hex);
  if (!m) return null;
  return '#' + m[1].toLowerCase();
}
