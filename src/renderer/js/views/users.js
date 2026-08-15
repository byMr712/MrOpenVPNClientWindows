'use strict';

Views['users'] = {
  mount(root, params) {
    const users = App.data.users || [];
    this._plain = null;

    const page = UI.h('div', { class: 'page' });

    const addBtn = UI.h('button', { class: 'btn-outlined', onclick: () => showAddUserDialog() }, i18n.t('add_user'));
    page.appendChild(addBtn);

    const showPassSw = UI.switchEl(false, () => {});
    const showRow = UI.h(
      'div',
      { class: 'settings-card mt-8' },
      UI.h(
        'div',
        {
          class: 'settings-row',
          onclick: (e) => {
            if (e.target.closest('.switch')) return;
            const next = !showPassSw.input.checked;
            showPassSw.setState(next);
            if (next) {
              window.api.listUsersPlain().then((plain) => {
                this._plain = plain;
                renderList();
              });
            } else {
              this._plain = null;
              renderList();
            }
          }
        },
        UI.h('div', { class: 'row-text' }, UI.h('div', { class: 'row-title text-title-small' }, i18n.t('passwords'))),
        showPassSw
      )
    );
    page.appendChild(showRow);

    const listContainer = UI.h('div', {});
    page.appendChild(listContainer);

    const renderList = () => {
      listContainer.innerHTML = '';
      if (!users.length) {
        listContainer.appendChild(
          UI.h('div', { class: 'card card-stroke mt-8', style: 'padding:24px;text-align:center' },
            UI.h('div', { class: 'text-title-medium' }, i18n.t('no_data')))
        );
        return;
      }
      for (const u of users) {
        const plain = this._plain ? this._plain.find((p) => p.login === u.login) : null;
        listContainer.appendChild(
          UI.h('div', { class: 'user-card mt-8' },
            UI.h('div', { class: 'user-text' },
              UI.h('div', { class: 'user-name text-title-small' }, u.login),
              UI.h('div', { class: 'user-sub text-body-small mt-8' },
                plain ? plain.password : u.hasPassword ? '••••••••' : i18n.t('no_data'))
            ),
            UI.h('button', {
              class: 'icon-btn',
              onclick: () => window.api.deleteUser(u.login)
            }, UI.icon('delete', 24))
          )
        );
      }
    };

    renderList();

    root.appendChild(
      UI.h('div', { class: 'topbar' },
        UI.h('button', { class: 'icon-btn', onclick: () => App.back() }, UI.icon('back', 24)),
        UI.h('div', { class: 'topbar-title text-headline' }, i18n.t('users'))
      )
    );
    root.appendChild(page);
  }
};

function showAddUserDialog() {
  const login = UI.h('input', { class: 'input', placeholder: i18n.t('username'), autocomplete: 'off' });
  const pass = UI.h('input', { class: 'input', placeholder: i18n.t('password'), type: 'password', autocomplete: 'off' });

  const dlg = UI.showDialog({
    title: i18n.t('add_user'),
    buttons: [
      { label: i18n.t('cancel'), onClick: () => {} },
      {
        label: i18n.t('ok'),
        onClick: () => {
          if (!login.value.trim()) {
            UI.showToast(i18n.t('username'));
            return;
          }
          window.api.addUser(login.value.trim(), pass.value).then((res) => {
            if (res && res.ok) UI.showToast(res.login);
          });
        }
      }
    ]
  });
  const body = dlg.el.querySelector('.dialog-msg');
  if (body) body.remove();
  dlg.el.insertBefore(UI.h('div', { class: 'mt-8' }, login), dlg.el.querySelector('.dialog-buttons'));
  dlg.el.insertBefore(UI.h('div', { class: 'mt-8' }, pass), dlg.el.querySelector('.dialog-buttons'));
  setTimeout(() => login.focus(), 100);
}
