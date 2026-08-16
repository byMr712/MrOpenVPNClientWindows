'use strict';

Views['main'] = {
  mount(root, params) {
    const s = App.data.vpn || {};
    const level = s.level || 'LEVEL_NOTCONNECTED';
    const settings = App.data.settings;
    const profiles = App.data.profiles || [];

    const statusText = mainStatusText(level);

    const activeProfile = profiles.find((p) => p.id === s.profileUuid);
    const isActive = !!activeProfile && level !== 'LEVEL_NOTCONNECTED' && level !== 'LEVEL_AUTH_FAILED';

    const statusCard = UI.h(
      'div',
      { class: 'status-card' },
      UI.h('div', { class: 'text-display' }, statusText)
    );

    const copyBtn = settings.debugMode
      ? UI.h('button', { class: 'btn-outlined mt-8', onclick: () => copyLog() }, i18n.t('copy_log'))
      : null;

    const addBtn = UI.h('button', { class: 'btn-outlined mt-8', onclick: () => importProfile() }, i18n.t('add_profile'));

    const list = UI.h('div', {});
    for (const p of profiles) {
      const isThisActive = isActive && activeProfile.id === p.id;
      const card = UI.h(
        'div',
        {
          class: 'profile-card',
          onclick: () => doConnect(p)
        },
        UI.h(
          'div',
          { class: 'profile-text' },
          UI.h('div', { class: 'profile-name text-title-small' }, p.name),
          UI.h('div', { class: 'profile-user text-body-small mt-8' }, profileSubtitle(p))
        ),
        UI.h('button', { class: 'btn-filled', onclick: (e) => { e.stopPropagation(); doConnect(p); } }, i18n.t('connect'))
      );
      list.appendChild(card);
      if (isThisActive) {
        startOutlineAnim(card, settings.profileAnim, { accent: themes.accentColor, idle: idleOutline(), width: 2 });
      }
    }

    // status outline animation
    if (isActive || level === 'LEVEL_CONNECTING_NO_SERVER_REPLY_YET' || level === 'LEVEL_CONNECTING_SERVER_REPLIED' || level === 'LEVEL_START' || level === 'LEVEL_WAITING_FOR_USER_INPUT') {
      startOutlineAnim(statusCard, settings.statusAnim, { accent: themes.accentColor, idle: idleOutline(), width: 2 });
    }

    root.appendChild(
      UI.h('div', { class: 'topbar' },
        UI.h('button', { class: 'icon-btn', onclick: () => App.openDrawer() }, UI.icon('menu', 24)),
        UI.h('div', { class: 'topbar-title text-title-medium' }, i18n.t('app_name'))
      )
    );
    const page = UI.h('div', { class: 'page' }, statusCard, copyBtn, addBtn, list);
    root.appendChild(page);
  }
};

function mainStatusText(level) {
  switch (level) {
    case 'LEVEL_CONNECTED':
      return i18n.t('connected');
    case 'LEVEL_CONNECTING_NO_SERVER_REPLY_YET':
    case 'LEVEL_CONNECTING_SERVER_REPLIED':
    case 'LEVEL_START':
      return i18n.t('connecting');
    case 'LEVEL_WAITING_FOR_USER_INPUT':
      return i18n.t('waiting');
    case 'LEVEL_VPNPAUSED':
      return i18n.t('paused');
    case 'LEVEL_AUTH_FAILED':
      return i18n.t('auth_failed');
    case 'LEVEL_NONETWORK':
      return i18n.t('no_network');
    default:
      return i18n.t('not_connected');
  }
}

function profileSubtitle(p) {
  if (p.remote) return `${p.proto || 'udp'} ${p.remote}:${p.port || ''}`.trim();
  return p.proto || '';
}

function idleOutline() {
  return getComputedStyle(document.documentElement).getPropertyValue('--outline-variant').trim() || '#333333';
}

function startOutlineAnim(el, kind, opts) {
  if (!kind) return;
  Animator.start(kind, el, opts);
}

async function doConnect(profile) {
  const res = await window.api.vpnConnect(profile.id);
  if (res && res.error) {
    if (res.error === 'admin_launch_failed') UI.showToast(i18n.t('admin_required'));
    else if (res.error === 'openvpn_not_found') UI.showToast(i18n.t('openvpn_not_found'));
    else UI.showToast(i18n.t('vpn_start_error'));
  }
}

async function importProfile() {
  const res = await window.api.importProfile();
  if (res && res.error) {
    UI.showToast(res.error.message || i18n.t('wrong_format'));
  }
}

async function copyLog() {
  const log = await window.api.vpnGetLog();
  await window.api.copyText(log ? log.join('\n') : '');
  UI.showToast(i18n.t('copied_log'));
}
