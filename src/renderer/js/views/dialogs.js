'use strict';

const Dialogs = {
  credentialsOpen: false,

  showCredentials(payload) {
    if (this.credentialsOpen) return;
    const profile = App.data.profiles.find((p) => p.id === payload.profileId);
    const title = profile ? profile.name : i18n.t('enter_credentials');
    const lastUser =
      (profile && profile.username) || (App.data.users[0] && App.data.users[0].login) || '';

    let usernameInput, passwordInput, submitted = false;
    const username = UI.h('input', { class: 'input', placeholder: i18n.t('username'), value: lastUser, autocomplete: 'off' });
    const password = UI.h('input', { class: 'input', placeholder: i18n.t('password'), type: 'password', autocomplete: 'off' });
    usernameInput = username;
    passwordInput = password;
    if (lastUser) {
      window.api.getUserCredentials(lastUser).then((u) => {
        if (u && u.password && !password.value) password.value = u.password;
      });
    }

    const toggle = () => {
      password.type = password.type === 'password' ? 'text' : 'password';
    };
    const eyeBtn = UI.h('button', { class: 'icon-btn', onclick: toggle }, UI.h('span', { style: 'font-size:20px' }, password.type === 'password' ? '👁' : '🙈'));
    const passWrap = UI.h('div', { class: 'mt-8', style: 'position:relative' }, password, eyeBtn);
    eyeBtn.style.position = 'absolute';
    eyeBtn.style.right = '0';
    eyeBtn.style.top = '0';

    const dlg = UI.showDialog({
      title,
      buttons: [
        {
          label: i18n.t('connect'),
          onClick: () => {
            submitted = true;
            this.credentialsOpen = false;
            window.api.vpnSendCredentials(payload.profileId, usernameInput.value, passwordInput.value);
          }
        },
        {
          label: i18n.t('cancel'),
          onClick: () => {
            this.credentialsOpen = false;
          }
        }
      ],
      onClose: () => {
        this.credentialsOpen = false;
        if (!submitted) {
          window.api.vpnDisconnect();
        }
      }
    });

    const body = dlg.el.querySelector('.dialog-msg');
    if (body) body.remove();
    dlg.el.insertBefore(UI.h('div', { class: 'mt-8' }, username), dlg.el.querySelector('.dialog-buttons'));
    dlg.el.insertBefore(passWrap, dlg.el.querySelector('.dialog-buttons'));

    this.credentialsOpen = true;
    setTimeout(() => {
      username.focus();
      if (lastUser) password.focus();
    }, 100);
  },

  editProfile(profile) {
    const nameInput = UI.h('input', { class: 'input', value: profile.name, placeholder: i18n.t('profile_name'), autocomplete: 'off' });

    const accountSelect = document.createElement('select');
    accountSelect.className = 'input';
    const refreshOptions = (selected) => {
      const list = App.data.users || [];
      const present = !!selected && list.some((u) => u.login === selected);
      accountSelect.innerHTML = '';
      const none = document.createElement('option');
      none.value = '';
      none.textContent = i18n.t('no_account');
      accountSelect.appendChild(none);
      let idx = 0;
      list.forEach((u, i) => {
        const opt = document.createElement('option');
        opt.value = u.login;
        opt.textContent = u.login;
        accountSelect.appendChild(opt);
        if (u.login === selected) idx = i + 1;
      });
      if (selected && !present) {
        const opt = document.createElement('option');
        opt.value = selected;
        opt.textContent = selected;
        accountSelect.appendChild(opt);
        idx = accountSelect.options.length - 1;
      }
      accountSelect.selectedIndex = idx;
    };
    refreshOptions(profile.username || '');

    const save = () => {
      const newName = nameInput.value.trim();
      const login = accountSelect.value;
      if (!newName) {
        UI.showToast(i18n.t('profile_name'));
        return;
      }
      const patch = { name: newName };
      if (login) {
        window.api.getUserCredentials(login).then((u) => {
          patch.username = login;
          patch.password = u ? u.password : '';
          window.api.updateProfile(profile.id, patch);
        });
      } else {
        patch.username = '';
        patch.password = '';
        window.api.updateProfile(profile.id, patch);
      }
    };

    const confirmDelete = () => {
      UI.showDialog({
        title: i18n.t('delete_profile'),
        message: i18n.t('are_you_sure_delete_profile'),
        buttons: [
          { label: i18n.t('delete'), onClick: () => window.api.deleteProfile(profile.id) },
          { label: i18n.t('close'), onClick: () => {} }
        ]
      });
    };

    const dlg = UI.showDialog({
      title: i18n.t('edit_profile'),
      buttons: [],
      body: UI.h(
        'div',
        { class: 'mt-8 dialog-edit' },
        UI.h('div', { class: 'text-title-small' }, i18n.t('user_select_label')),
        UI.h('div', { class: 'mt-8' }, accountSelect),
        UI.h(
          'button',
          { class: 'btn-outlined', style: 'width:100%;margin-top:20px', onclick: () => showAddUserDialog((login) => refreshOptions(login)) },
          i18n.t('add_user')
        ),
        UI.h('div', { class: 'text-title-small mt-16' }, i18n.t('profile_name')),
        UI.h('div', { class: 'mt-8' }, nameInput),
        UI.h(
          'button',
          { class: 'btn-outlined', style: 'width:100%;margin-top:20px', onclick: () => { dlg.close(); save(); } },
          i18n.t('save')
        ),
        UI.h(
          'div',
          { class: 'row-buttons mt-16' },
          UI.h('button', { class: 'btn-outlined', onclick: () => { dlg.close(); confirmDelete(); } }, i18n.t('delete_profile')),
          UI.h('button', { class: 'btn-outlined', onclick: () => dlg.close() }, i18n.t('close'))
        )
      )
    });

    setTimeout(() => nameInput.focus(), 100);
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
