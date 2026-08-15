'use strict';

Views['about'] = {
  mount(root, params) {
    const page = UI.h('div', { class: 'page', style: 'text-align:center;padding-top:48px' });
    const img = document.createElement('img');
    img.src = '../../assets/icon.png';
    img.style.width = '96px';
    img.style.height = '96px';
    img.style.borderRadius = '20px';

    page.appendChild(img);
    page.appendChild(UI.h('div', { class: 'text-headline mt-8' }, i18n.t('app_name')));
    page.appendChild(UI.h('div', { class: 'text-body-medium mt-8' }, `${i18n.t('version')} ${App.data.version}`));
    page.appendChild(
      UI.h('div', { class: 'small-note' }, 'OpenVPN client for Windows')
    );

    root.appendChild(
      UI.h('div', { class: 'topbar' },
        UI.h('button', { class: 'icon-btn', onclick: () => App.back() }, UI.icon('back', 24)),
        UI.h('div', { class: 'topbar-title text-headline' }, i18n.t('about'))
      )
    );
    root.appendChild(page);
  }
};
