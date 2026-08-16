'use strict';

const Dialogs = {
  credentialsOpen: false,

  showCredentials(payload) {
    if (this.credentialsOpen) return;
    const profile = App.data.profiles.find((p) => p.id === payload.profileUuid);
    const title = profile ? profile.name : i18n.t('enter_credentials');
    const lastUser =
      (profile && profile.username) || (App.data.users[0] && App.data.users[0].login) || '';

    let usernameInput, passwordInput, rememberBox;
    const username = UI.h('input', { class: 'input', placeholder: i18n.t('username'), value: lastUser, autocomplete: 'off' });
    const password = UI.h('input', { class: 'input', placeholder: i18n.t('password'), type: 'password', autocomplete: 'off' });
    usernameInput = username;
    passwordInput = password;

    const toggle = () => {
      password.type = password.type === 'password' ? 'text' : 'password';
    };
    const eyeBtn = UI.h('button', { class: 'icon-btn', onclick: toggle }, UI.h('span', { style: 'font-size:20px' }, password.type === 'password' ? '👁' : '🙈'));
    const passWrap = UI.h('div', { class: 'mt-8', style: 'position:relative' }, password, eyeBtn);
    eyeBtn.style.position = 'absolute';
    eyeBtn.style.right = '0';
    eyeBtn.style.top = '0';

    const rememberCheck = UI.h('div', { class: 'checkbox' });
    const rememberRow = UI.h(
      'div',
      { class: 'settings-row', onclick: () => {
        rememberCheck.classList.toggle('checked');
        rememberBox = rememberCheck.classList.contains('checked');
      } },
      UI.h('div', { class: 'row-text' }, UI.h('div', { class: 'row-title text-title-small' }, i18n.t('remember_user'))),
      rememberCheck
    );

    const dlg = UI.showDialog({
      title,
      buttons: [
        {
          label: i18n.t('connect'),
          onClick: () => {
            this.credentialsOpen = false;
            window.api.vpnSendCredentials(
              payload.profileUuid,
              usernameInput.value,
              passwordInput.value,
              !!rememberBox
            );
          }
        },
        {
          label: i18n.t('cancel'),
          onClick: () => {
            this.credentialsOpen = false;
          }
        }
      ]
    });

    const body = dlg.el.querySelector('.dialog-msg');
    if (body) body.remove();
    dlg.el.insertBefore(UI.h('div', { class: 'mt-8' }, username), dlg.el.querySelector('.dialog-buttons'));
    dlg.el.insertBefore(passWrap, dlg.el.querySelector('.dialog-buttons'));
    dlg.el.insertBefore(rememberRow, dlg.el.querySelector('.dialog-buttons'));

    this.credentialsOpen = true;
    setTimeout(() => {
      username.focus();
      if (lastUser) password.focus();
    }, 100);
  },

  showLog() {
    window.api.vpnGetLog().then((log) => {
      const content = UI.h(
        'div',
        {
          class: 'text-body-small',
          style: 'white-space:pre-wrap;word-break:break-word;max-height:320px;overflow-y:auto;margin-top:12px;text-align:left;font-family:Consolas,monospace'
        },
        log && log.length ? log.map((e) => e.message).join('\n') : i18n.t('no_data')
      );
      const dlg = UI.showDialog({
        title: i18n.t('log'),
        buttons: [
          {
            label: i18n.t('copy_log'),
            onClick: () => {
              window.api.copyText(log && log.length ? log.map((e) => e.message).join('\n') : '');
              UI.showToast(i18n.t('copied_log'));
            }
          },
          { label: i18n.t('close'), onClick: () => {} }
        ]
      });
      const body = dlg.el.querySelector('.dialog-msg');
      if (body) body.remove();
      dlg.el.insertBefore(content, dlg.el.querySelector('.dialog-buttons'));
    });
  }
};
