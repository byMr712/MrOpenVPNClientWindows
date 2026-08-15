'use strict';

Views['themes'] = {
  mount(root, params) {
    const s = App.data.settings;

    const page = UI.h('div', { class: 'page' });

    // ---- accent color ----
    const accentSection = UI.h('div', { class: 'settings-section text-title-medium' }, i18n.t('accent_color'));
    page.appendChild(accentSection);

    const swatchRow = UI.h('div', { class: 'mt-8', style: 'display:flex;flex-wrap:wrap;align-items:center;padding:8px 0' });
    for (const a of ACCENTS) {
      const selected = a.color.toLowerCase() === (themes.accentColor || '').toLowerCase();
      const swatch = UI.h('button', {
        class: 'swatch',
        style: `background:${a.color}`,
        onclick: () => {
          if (a.color.toLowerCase() === '#000000') {
            // black accent needs a visible check
          }
          window.api.setSettings({ accentColor: a.color.toUpperCase() });
        }
      }, selected ? '✓' : '');
      swatchRow.appendChild(swatch);
    }

    const customInput = UI.h('input', {
      class: 'input',
      placeholder: `${i18n.t('custom')} (#RRGGBB)`,
      value: themes.customColor || '',
      spellcheck: 'false',
      autocomplete: 'off'
    });
    customInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') applyCustom(customInput.value);
    });
    customInput.addEventListener('change', () => applyCustom(customInput.value));

    page.appendChild(swatchRow);
    page.appendChild(customInput);

    const applyCustom = (val) => {
      const hex = parseHex(val.trim());
      if (!hex) {
        UI.showToast(i18n.t('custom'));
        return;
      }
      window.api.setSettings({ accentColor: hex.toUpperCase(), customColor: hex.toUpperCase() });
    };

    // ---- experimental themes ----
    const expSection = UI.h('div', { class: 'settings-section text-title-medium mt-8' }, i18n.t('experimental_themes'));
    page.appendChild(expSection);

    for (const t of EXPERIMENTAL_THEMES) {
      const selected = (s.experimentalTheme || '') === t.key;
      const radio = UI.radioEl(selected);
      const card = UI.h(
        'div',
        { class: 'option-card mt-8', onclick: () => {
          window.api.setSettings({ experimentalTheme: t.key, lightTheme: t.light });
        } },
        UI.h('div', { class: 'option-text' },
          UI.h('div', { class: 'option-title text-title-small' }, t.name),
          UI.h('div', { class: 'option-desc text-body-small mt-8' }, t.light ? 'light' : 'dark')
        ),
        radio
      );
      page.appendChild(card);
    }

    root.appendChild(
      UI.h('div', { class: 'topbar' },
        UI.h('button', { class: 'icon-btn', onclick: () => App.back() }, UI.icon('back', 24)),
        UI.h('div', { class: 'topbar-title text-headline' }, i18n.t('app_theme'))
      )
    );
    root.appendChild(page);
  }
};
