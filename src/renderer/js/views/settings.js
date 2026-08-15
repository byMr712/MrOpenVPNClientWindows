'use strict';

Views['settings'] = {
  mount(root, params) {
    const s = App.data.settings;

    const autoSw = UI.switchEl(s.autoConnect, (v) => window.api.setSettings({ autoConnect: v }));
    const screenSw = UI.switchEl(s.screenOffPause, (v) => window.api.setSettings({ screenOffPause: v }));
    const notifySw = UI.switchEl(s.notify, (v) => window.api.setSettings({ notify: v }));
    const debugSw = UI.switchEl(s.debugMode, (v) => window.api.setSettings({ debugMode: v }));

    const toggleOnClick = (sw, key) => (e) => {
      if (e.target.closest('.switch')) return;
      const v = !sw.input.checked;
      sw.setState(v);
      window.api.setSettings({ [key]: v });
    };

    const themeName = s.experimentalTheme || 'default_black';
    const langRow = languageRow(s.language);

    const resetRow = UI.h(
      'div',
      { class: 'settings-row', onclick: () => resetApp() },
      UI.h('div', { class: 'row-text' }, UI.h('div', { class: 'row-title text-title-small danger' }, i18n.t('reset_app')))
    );

    root.appendChild(
      UI.h('div', { class: 'topbar' },
        UI.h('button', { class: 'icon-btn', onclick: () => App.back() }, UI.icon('back', 24)),
        UI.h('div', { class: 'topbar-title text-headline' }, i18n.t('settings'))
      )
    );

    const page = UI.h('div', { class: 'page' });

    const genSection = UI.h('div', { class: 'settings-section text-title-medium' }, i18n.t('settings'));
    const genCard = UI.h('div', { class: 'settings-card' },
      UI.settingsRow({ title: i18n.t('automatic_connection'), summary: i18n.t('automatic_connection_summary'), trailing: autoSw, onClick: toggleOnClick(autoSw, 'autoConnect') }),
      UI.h('div', { class: 'settings-divider' }),
      UI.settingsRow({ title: i18n.t('pause_when_screen_off'), summary: i18n.t('pause_when_screen_off_summary'), trailing: screenSw, onClick: toggleOnClick(screenSw, 'screenOffPause') }),
      UI.h('div', { class: 'settings-divider' }),
      UI.settingsRow({ title: i18n.t('notification'), summary: i18n.t('notification_summary'), trailing: notifySw, onClick: toggleOnClick(notifySw, 'notify') }),
      UI.h('div', { class: 'settings-divider' }),
      UI.settingsRow({ title: i18n.t('debug_mode'), summary: i18n.t('debug_mode_summary'), trailing: debugSw, onClick: toggleOnClick(debugSw, 'debugMode') })
    );
    page.appendChild(genSection);
    page.appendChild(genCard);

    const langSection = UI.h('div', { class: 'settings-section text-title-medium' }, i18n.t('language'));
    page.appendChild(langSection);
    page.appendChild(
      UI.h('div', { class: 'settings-card' },
        UI.h('div', { class: 'settings-row', style: 'padding:12px 16px' }, langRow)
      )
    );

    const lookSection = UI.h('div', { class: 'settings-section text-title-medium' }, i18n.t('app_theme'));
    page.appendChild(lookSection);
    page.appendChild(
      UI.h('div', { class: 'settings-card' },
        UI.settingsRow({
          title: i18n.t('app_theme'),
          summary: `${themeName}  ·  ${themes.accentColor}`,
          trailing: UI.h('div', { class: 'row-chevron' }, '›'),
          onClick: () => App.navigate('themes')
        }),
        UI.h('div', { class: 'settings-divider' }),
        UI.settingsRow({
          title: i18n.t('app_animations'),
          summary: `${i18n.t('status_animation')}: ${s.statusAnim || i18n.t('none')}  ·  ${i18n.t('profile_animation')}: ${s.profileAnim || i18n.t('none')}`,
          trailing: UI.h('div', { class: 'row-chevron' }, '›'),
          onClick: () => App.navigate('animations')
        })
      )
    );

    page.appendChild(resetRow);
    root.appendChild(page);
  }
};

function languageRow(current) {
  const box = UI.h(
    'div',
    { class: 'spinner' },
    UI.h('div', { class: 'spinner-value text-body-medium' },
      UI.h('span', {}, langLabel(current)),
      UI.h('span', { class: 'spinner-arrow' }, '▾')
    )
  );
  box.addEventListener('click', () => {
    const rect = box.getBoundingClientRect();
    const dd = UI.h('div', { class: 'dropdown' });
    dd.style.left = rect.left + 'px';
    dd.style.top = rect.bottom + 'px';
    dd.style.width = Math.max(rect.width, 120) + 'px';
    for (const lang of ['en', 'ru']) {
      const item = UI.h('div', { class: 'dropdown-item' + (lang === current ? ' selected' : ''), onclick: () => {
        dd.remove();
        window.api.setSettings({ language: lang });
      } }, langLabel(lang));
      dd.appendChild(item);
    }
    document.body.appendChild(dd);
    setTimeout(() => {
      const close = (e) => {
        if (!dd.contains(e.target) && e.target !== box) {
          dd.remove();
          document.removeEventListener('mousedown', close);
        }
      };
      document.addEventListener('mousedown', close);
    }, 0);
  });
  return box;
}

function langLabel(lang) {
  return lang === 'en' ? 'English' : 'Русский';
}

function resetApp() {
  UI.confirm({
    title: i18n.t('reset_app'),
    message: i18n.t('reset_app_confirm'),
    danger: true,
    onYes: () => {
      window.api.resetData();
    }
  });
}
