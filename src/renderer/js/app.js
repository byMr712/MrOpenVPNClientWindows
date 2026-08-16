'use strict';

const App = {
  data: null,
  current: 'main',
  params: null,
  stack: [],

  async init() {
    this.data = await window.api.init();
    i18n.setLang(this.data.settings.language);
    themes.fromSettings(this.data.settings);
    this.bindEvents();
    this.renderDrawer();
    this.render();
    window.api.notifyOnline(navigator.onLine);
  },

  bindEvents() {
    window.addEventListener('online', () => window.api.notifyOnline(true));
    window.addEventListener('offline', () => window.api.notifyOnline(false));
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.drawerOpen) this.closeDrawer();
        else if (this.stack.length) this.back();
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth >= 720) this.closeDrawer();
    });

    window.api.onState((s) => {
      this.data.vpn = s;
      if (this.current === 'main') this.render();
    });

    window.api.onSettingsChanged((s) => {
      this.data.settings = s;
      i18n.setLang(s.language);
      themes.fromSettings(s);
      this.render();
      this.renderDrawer();
    });

    window.api.onProfilesChanged((p) => {
      this.data.profiles = p;
      if (this.current === 'main') this.render();
    });

    window.api.onUsersChanged((u) => {
      this.data.users = u;
      if (this.current === 'users') this.render();
    });

    window.api.onNeedPassword((p) => {
      Dialogs.showCredentials(p);
    });

    document.getElementById('drawerScrim').addEventListener('click', () => this.closeDrawer());
  },

  render() {
    const root = document.getElementById('view');
    root.scrollTop = 0;
    root.innerHTML = '';
    const view = Views[this.current] || Views['main'];
    view.mount(root, this.params || {});
  },

  navigate(name, params) {
    this.stack.push({ name: this.current, params: this.params });
    this.current = name;
    this.params = params || null;
    this.render();
  },

  back() {
    const prev = this.stack.pop();
    if (prev) {
      this.current = prev.name;
      this.params = prev.params;
      this.render();
    }
  },

  goHome() {
    this.stack = [];
    this.current = 'main';
    this.params = null;
    this.render();
  },

  // ---- drawer ----

  get drawerOpen() {
    const d = document.getElementById('drawer');
    return d ? d.classList.contains('open') : false;
  },

  openDrawer() {
    const d = document.getElementById('drawer');
    const s = document.getElementById('drawerScrim');
    if (d) d.classList.add('open');
    if (s) s.classList.add('open');
  },

  closeDrawer() {
    const d = document.getElementById('drawer');
    const s = document.getElementById('drawerScrim');
    if (d) d.classList.remove('open');
    if (s) s.classList.remove('open');
  },

  renderDrawer() {
    const drawer = document.getElementById('drawer');
    drawer.innerHTML = '';

    const navItem = (key, label, icon) =>
      UI.h(
        'div',
        {
          class: 'drawer-nav-item text-title-medium',
          onclick: () => {
            this.closeDrawer();
            this.navigate(key);
          }
        },
        UI.icon(icon, 24),
        UI.h('span', {}, label)
      );

    const top = UI.h('div', {});
    top.appendChild(navItem('main', i18n.t('home'), 'home'));
    top.appendChild(navItem('users', i18n.t('users'), 'group'));
    top.appendChild(UI.h('div', { class: 'drawer-divider' }));
    drawer.appendChild(top);

    const bottom = UI.h('div', { class: 'drawer-bottom' });
    bottom.appendChild(UI.h('div', { class: 'drawer-divider' }));
    const settings = UI.h(
      'div',
      {
        class: 'drawer-nav-item text-title-medium',
        onclick: () => {
          this.closeDrawer();
          this.navigate('settings');
        }
      },
      UI.icon('settings', 24),
      UI.h('span', {}, i18n.t('settings'))
    );
    const about = UI.h(
      'div',
      {
        class: 'drawer-nav-item text-title-medium',
        onclick: () => {
          this.closeDrawer();
          showAboutDialog();
        }
      },
      UI.icon('info', 24),
      UI.h('span', {}, i18n.t('about'))
    );
    bottom.appendChild(settings);
    bottom.appendChild(about);
    drawer.appendChild(bottom);
  }
};

const Views = {};

window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
