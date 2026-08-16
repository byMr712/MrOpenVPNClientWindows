'use strict';

Views['settings'] = {
  mount(root, params) {
    const s = App.data.settings;

    const autoSw = UI.switchEl(s.autoConnect, (v) => window.api.setSettings({ autoConnect: v }));
    const screenSw = UI.switchEl(s.screenOffPause, (v) => window.api.setSettings({ screenOffPause: v }));
    const tunnelSw = UI.switchEl(s.fullTunnel, (v) => window.api.setSettings({ fullTunnel: v }));
    const notifySw = UI.switchEl(s.notify, (v) => window.api.setSettings({ notify: v }));
    const debugSw = UI.switchEl(s.debugMode, (v) => {
      if (v) confirmDebugMode(debugSw);
      else window.api.setSettings({ debugMode: false });
    });

    const toggleOnClick = (sw, key) => (e) => {
      if (e.target.closest('.switch')) return;
      const v = !sw.input.checked;
      sw.setState(v);
      window.api.setSettings({ [key]: v });
    };

    root.appendChild(
      UI.h('div', { class: 'topbar' },
        UI.h('button', { class: 'icon-btn', onclick: () => App.back() }, UI.icon('back', 24)),
        UI.h('div', { class: 'topbar-title text-headline' }, i18n.t('settings'))
      )
    );

    const page = UI.h('div', { class: 'page' });

    page.appendChild(UI.h('div', { class: 'settings-section text-title-medium' }, i18n.t('settings_connection_section')));
    page.appendChild(
      UI.h('div', { class: 'settings-card' },
        UI.settingsRow({ title: i18n.t('automatic_connection'), summary: i18n.t('automatic_connection_summary'), trailing: autoSw, onClick: toggleOnClick(autoSw, 'autoConnect') }),
        UI.h('div', { class: 'settings-divider' }),
        UI.settingsRow({ title: i18n.t('pause_when_screen_off'), summary: i18n.t('pause_when_screen_off_summary'), trailing: screenSw, onClick: toggleOnClick(screenSw, 'screenOffPause') }),
        UI.h('div', { class: 'settings-divider' }),
        UI.settingsRow({ title: i18n.t('full_tunnel'), summary: i18n.t('full_tunnel_summary'), trailing: tunnelSw, onClick: toggleOnClick(tunnelSw, 'fullTunnel') })
      )
    );

    page.appendChild(UI.h('div', { class: 'settings-section text-title-medium' }, i18n.t('settings_appearance_section')));
    page.appendChild(
      UI.h('div', { class: 'settings-card' },
        UI.settingsRow({
          title: i18n.t('experimental_themes'),
          summary: i18n.t('experimental_themes_summary'),
          trailing: UI.h('div', { class: 'row-chevron' }, '›'),
          onClick: () => App.navigate('themes')
        }),
        UI.h('div', { class: 'settings-divider' }),
        UI.settingsRow({
          title: i18n.t('app_animations'),
          summary: i18n.t('app_animations_summary'),
          trailing: UI.h('div', { class: 'row-chevron' }, '›'),
          onClick: () => App.navigate('animations')
        })
      )
    );

    page.appendChild(UI.h('div', { class: 'settings-section text-title-medium' }, i18n.t('language_section')));
    page.appendChild(
      UI.h('div', { class: 'settings-card' },
        languageRow('en', s.language),
        UI.h('div', { class: 'settings-divider' }),
        languageRow('ru', s.language)
      )
    );

    page.appendChild(UI.h('div', { class: 'settings-section text-title-medium' }, i18n.t('settings_debug_section')));
    page.appendChild(
      UI.h('div', { class: 'settings-card' },
        UI.settingsRow({
          title: i18n.t('debug_mode'),
          summary: i18n.t('debug_mode_summary'),
          trailing: debugSw,
          onClick: (e) => {
            if (e.target.closest('.switch')) return;
            debugSw.input.click();
          }
        }),
        s.debugMode ? [
          UI.h('div', { class: 'settings-divider' }),
          UI.settingsRow({ title: i18n.t('notification'), summary: i18n.t('notification_summary'), trailing: notifySw, onClick: toggleOnClick(notifySw, 'notify') }),
          UI.h('div', { class: 'settings-divider' }),
          UI.h('div', { class: 'settings-row', onclick: () => confirmClearUsers() },
            UI.h('div', { class: 'row-text' }, UI.h('div', { class: 'row-title text-title-small danger' }, i18n.t('clear_users')))
          ),
          UI.h('div', { class: 'settings-divider' }),
          UI.h('div', { class: 'settings-row', onclick: () => confirmDeleteService() },
            UI.h('div', { class: 'row-text' }, UI.h('div', { class: 'row-title text-title-small danger' }, i18n.t('delete_service')))
          ),
          UI.h('div', { class: 'settings-divider' }),
          UI.h('div', { class: 'settings-row', onclick: () => confirmResetData() },
            UI.h('div', { class: 'row-text' }, UI.h('div', { class: 'row-title text-title-small danger' }, i18n.t('reset_data')))
          )
        ] : []
      )
    );

    page.appendChild(
      UI.h('div', { class: 'settings-version text-body-small mt-8' },
        `${i18n.t('settings_version')}: ${App.data.versionDisplay || App.data.version}`
      )
    );

    root.appendChild(page);
  }
};

function languageRow(lang, current) {
  const title = UI.h(
    'div',
    { class: 'row-title text-title-small' + (lang === current ? ' underlined' : '') },
    langLabel(lang)
  );
  const row = UI.h(
    'div',
    { class: 'settings-row' },
    UI.h('div', { class: 'row-text' }, title),
    UI.radioEl(lang === current)
  );
  row.addEventListener('click', () => {
    if (lang !== current) window.api.setSettings({ language: lang });
  });
  return row;
}

function langLabel(lang) {
  return lang === 'en' ? 'English' : 'Русский';
}

function confirmDebugMode(sw) {
  UI.showDialog({
    message: i18n.t('debug_mode_confirm_message'),
    buttons: [
      { label: i18n.t('enable'), onClick: () => window.api.setSettings({ debugMode: true }) },
      { label: i18n.t('cancel'), onClick: () => sw.setState(false) }
    ]
  });
}

function confirmClearUsers() {
  UI.showDialog({
    title: i18n.t('clear_users'),
    message: i18n.t('clear_users_confirm'),
    buttons: [
      { label: i18n.t('delete'), onClick: () => window.api.clearUsers() },
      { label: i18n.t('close'), onClick: () => {} }
    ]
  });
}

function confirmDeleteService() {
  UI.showDialog({
    title: i18n.t('delete_service'),
    message: i18n.t('delete_service_confirm'),
    buttons: [
      {
        label: i18n.t('delete'),
        onClick: () =>
          window.api.uninstallService().then((r) => {
            if (r && r.error) UI.showToast(i18n.t('service_not_running'));
            else UI.showToast(i18n.t('service_deleted'));
          })
      },
      { label: i18n.t('close'), onClick: () => {} }
    ]
  });
}

function confirmResetData() {
  UI.showDialog({
    title: i18n.t('reset_data'),
    message: i18n.t('reset_data_confirm'),
    buttons: [
      { label: i18n.t('delete'), onClick: () => window.api.resetData() },
      { label: i18n.t('close'), onClick: () => {} }
    ]
  });
}
