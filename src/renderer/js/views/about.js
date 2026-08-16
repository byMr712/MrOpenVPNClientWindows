'use strict';

function showAboutDialog() {
  const ghBtn = UI.h(
    'button',
    {
      class: 'about-source',
      onclick: () => window.api.openExternal('https://github.com/byMr712/MrOpenVPNClientWindows')
    },
    i18n.t('source_code')
  );

  const anim = (App.data.settings && App.data.settings.statusAnim) || '';
  if (anim) {
    startOutlineAnim(ghBtn, anim, { accent: themes.accentColor, idle: idleOutline(), width: 2 });
  }

  UI.showDialog({
    title: 'MrOpenVPN Client For Windows',
    small: true,
    body: UI.h(
      'div',
      { class: 'about-body' },
      UI.h('div', { class: 'text-body-medium' }, i18n.t('about_developer')),
      UI.h('div', { class: 'text-body-medium mt-8' }, `${i18n.t('version')}: ${App.data.versionDisplay || App.data.version}`),
      UI.h('div', { class: 'mt-8' }, ghBtn)
    ),
    buttons: [{ label: i18n.t('close'), onClick: () => {} }]
  });
}
