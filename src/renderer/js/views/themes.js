'use strict';

Views['themes'] = {
  mount(root, params) {
    const s = App.data.settings;

    const page = UI.h('div', { class: 'page' });

    const current = s.experimentalTheme || (s.lightTheme ? 'default_white' : 'default_black');

    const options = [
      { key: '', name: i18n.t('theme_default_black'), desc: i18n.t('theme_default_black_desc'), light: false, accent: '#FFFFFF' }
    ];
    for (const t of EXPERIMENTAL_THEMES) {
      if (!t.key) continue;
      options.push({
        key: t.key,
        name: i18n.t('theme_' + t.key + '_name'),
        desc: i18n.t('theme_' + t.key + '_desc'),
        light: t.light,
        accent: t.accent
      });
    }

    for (const opt of options) {
      const card = UI.h(
        'div',
        {
          class: 'option-card mt-8',
          onclick: () => {
            window.api.setSettings({ experimentalTheme: opt.key, lightTheme: opt.light, accentColor: opt.accent });
            App.goHome();
          }
        },
        UI.h('div', { class: 'option-text' },
          UI.h('div', { class: 'option-title text-title-small' }, opt.name),
          UI.h('div', { class: 'option-desc text-body-small mt-8' }, opt.desc)
        ),
        UI.radioEl(opt.key === current)
      );
      page.appendChild(card);
    }

    page.appendChild(UI.h('div', { class: 'settings-section text-title-medium mt-8' }, i18n.t('accent_title')));
    page.appendChild(UI.h('div', { class: 'text-body-small accent-hint' }, i18n.t('accent_hint')));

    const swatchRow = UI.h('div', { class: 'swatch-row' });
    const selectedAccent = (themes.accentColor || '').toLowerCase();
    for (const hex of ACCENTS) {
      const selected = hex.toLowerCase() === selectedAccent;
      const swatch = UI.h(
        'button',
        {
          class: 'swatch',
          onclick: () => window.api.setSettings({ accentColor: hex })
        },
        selected ? '✓' : ''
      );
      swatch.style.backgroundColor = hex;
      swatch.style.color = contrastColor(hex);
      swatchRow.appendChild(swatch);
    }
    page.appendChild(swatchRow);

    const customInput = UI.h('input', {
      class: 'input',
      placeholder: i18n.t('accent_custom_hint'),
      value: s.accentColor || '',
      spellcheck: 'false',
      autocomplete: 'off'
    });
    customInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') applyCustom(customInput.value);
    });
    customInput.addEventListener('change', () => applyCustom(customInput.value));
    page.appendChild(customInput);

    root.appendChild(
      UI.h('div', { class: 'topbar' },
        UI.h('button', { class: 'icon-btn', onclick: () => App.back() }, UI.icon('back', 24)),
        UI.h('div', { class: 'topbar-title text-headline' }, i18n.t('app_theme'))
      )
    );
    root.appendChild(page);
  }
};

function applyCustom(val) {
  const hex = parseHex(val.trim());
  if (!hex) {
    UI.showToast(i18n.t('custom'));
    return;
  }
  window.api.setSettings({ accentColor: hex.toUpperCase(), customColor: hex.toUpperCase() });
}

function contrastColor(hex) {
  return luminance(hex) > 0.6 ? '#000000' : '#ffffff';
}
