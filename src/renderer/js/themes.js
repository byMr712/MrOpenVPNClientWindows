'use strict';

const ACCENTS = [
  { name: 'white', color: '#FFFFFF' },
  { name: 'red', color: '#FF0000' },
  { name: 'deepOrange', color: '#FF5722' },
  { name: 'orange', color: '#FF9800' },
  { name: 'yellow', color: '#FFEB3B' },
  { name: 'lime', color: '#CDDC39' },
  { name: 'green', color: '#4CAF50' },
  { name: 'teal', color: '#009688' },
  { name: 'cyan', color: '#00BCD4' },
  { name: 'blue', color: '#2196F3' },
  { name: 'indigo', color: '#3F51B5' },
  { name: 'deepPurple', color: '#673AB7' },
  { name: 'purple', color: '#9C27B0' },
  { name: 'pink', color: '#E91E63' },
  { name: 'brown', color: '#795548' },
  { name: 'black', color: '#000000' }
];

const EXPERIMENTAL_THEMES = [
  { key: '', name: 'default_black', light: false, order: 0 },
  { key: 'default_white', name: 'default_white', light: true, order: 1 },
  { key: 'neon', name: 'neon', light: false, order: 2 },
  { key: 'oled', name: 'oled', light: false, order: 3 },
  { key: 'paper', name: 'paper', light: true, order: 4 },
  { key: 'redline', name: 'redline', light: false, order: 5 },
  { key: 'mint', name: 'mint', light: true, order: 6 }
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
