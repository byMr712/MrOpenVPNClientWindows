'use strict';

Views['users'] = {
  mount(root, params) {
    const users = App.data.users || [];

    const page = UI.h('div', { class: 'page' });

    const addBtn = UI.h('button', { class: 'btn-outlined', onclick: () => showAddUserDialog() }, i18n.t('add_user'));
    page.appendChild(addBtn);

    const listContainer = UI.h('div', {});
    page.appendChild(listContainer);

    const renderList = () => {
      listContainer.innerHTML = '';
      if (!users.length) {
        return;
      }
      for (const u of users) {
        listContainer.appendChild(
          UI.h('div', { class: 'user-card mt-8' },
            UI.h('div', { class: 'user-text' },
              UI.h('div', { class: 'user-name text-title-small' }, u.login),
              UI.h('div', { class: 'user-sub text-body-small mt-8' },
                u.hasPassword ? '••••••••' : i18n.t('no_data'))
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

function showAddUserDialog(onAdded) {
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
            if (res && res.ok) {
              UI.showToast(res.login);
              if (onAdded) onAdded(res.login);
            }
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
