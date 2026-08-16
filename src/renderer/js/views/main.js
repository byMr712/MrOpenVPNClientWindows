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
    const isConnecting = level === 'LEVEL_CONNECTING_NO_SERVER_REPLY_YET' ||
      level === 'LEVEL_CONNECTING_SERVER_REPLIED' ||
      level === 'LEVEL_START' ||
      level === 'LEVEL_WAITING_FOR_USER_INPUT';

    const statusCard = UI.h(
      'div',
      {
        class: 'status-card',
        style: 'cursor:pointer',
        onclick: () => {
          if (isActive) {
            window.api.vpnDisconnect();
            return;
          }
          const active = profiles.find((p) => p.id === (s.profileUuid || settings.lastProfileUuid));
          const target = active || profiles[0];
          if (target) doConnect(target);
          else UI.showToast(i18n.t('no_profiles'));
        }
      },
      UI.h('div', { class: 'text-display' }, statusText)
    );

    const copyBtn = settings.debugMode
      ? UI.h('button', { class: 'btn-outlined mt-8', onclick: () => copyLog() }, i18n.t('copy_log'))
      : null;

    const addBtn = UI.h('button', { class: 'btn-outlined mt-8', onclick: () => importProfile() }, i18n.t('add_profile'));

    const profilesTitle = UI.h('div', { class: 'text-title-medium profiles-title' }, i18n.t('profiles'));

    const list = UI.h('div', {});
    for (const p of profiles) {
      const isThisActive = isActive && activeProfile.id === p.id;
      const card = UI.h(
        'div',
        {
          class: 'profile-card',
          onclick: () => Dialogs.editProfile(p)
        },
        UI.h(
          'div',
          { class: 'profile-text' },
          UI.h('div', { class: 'profile-name text-title-small' }, i18n.t('profile_prefix') + p.name),
          p.username
            ? UI.h('div', { class: 'profile-user text-title-small' }, i18n.t('user_prefix') + p.username)
            : null
        ),
        isThisActive
          ? UI.h('button', { class: 'btn-filled', onclick: (e) => { e.stopPropagation(); window.api.vpnDisconnect(); } }, i18n.t('disconnect'))
          : UI.h('button', { class: 'btn-filled', onclick: (e) => { e.stopPropagation(); doConnect(p); } }, i18n.t('connect'))
      );
      list.appendChild(card);
      if (isConnecting && activeProfile && activeProfile.id === p.id) {
        startOutlineAnim(card, settings.profileAnim, { accent: themes.accentColor, idle: idleOutline(), width: 2 });
      }
    }

    // status outline animation (only while connecting)
    if (isConnecting) {
      startOutlineAnim(statusCard, settings.statusAnim, { accent: themes.accentColor, idle: idleOutline(), width: 2 });
    }

    root.appendChild(
      UI.h('div', { class: 'topbar' },
        UI.h('button', { class: 'icon-btn menu-btn', onclick: () => App.openDrawer() }, UI.icon('menu', 24))
      )
    );
    const page = UI.h('div', { class: 'page' }, statusCard, copyBtn, profilesTitle, addBtn, list);
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

function idleOutline() {
  return getComputedStyle(document.documentElement).getPropertyValue('--outline-variant').trim() || '#333333';
}

function startOutlineAnim(el, kind, opts) {
  if (!kind) return;
  Animator.start(kind, el, opts);
}

async function doConnect(profile) {
  const st = await window.api.getServiceStatus();
  if (st && !st.running) {
    const agreed = await new Promise((resolve) => {
      UI.showDialog({
        title: i18n.t('service_confirm_title'),
        message: i18n.t('service_confirm_message'),
        buttons: [
          { label: i18n.t('service_confirm_cancel'), onClick: () => resolve(false) },
          { label: i18n.t('service_confirm_agree'), onClick: () => resolve(true) }
        ]
      });
    });
    if (!agreed) return;
  }
  const res = await window.api.vpnConnect(profile.id);
  if (res && res.error) {
    if (res.error === 'openvpn_not_found') UI.showToast(i18n.t('openvpn_not_found'));
    else if (res.error === 'interactive_service_not_running' || res.error === 'service_install_failed') UI.showToast(i18n.t('service_not_running'));
    else if (res.error === 'cancelled') return;
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
  await window.api.copyText(log && log.length ? log.map((e) => e.message).join('\n') : '');
  UI.showToast(i18n.t('copied_log'));
}
