'use strict';

Views['animations'] = {
  mount(root, params) {
    const s = App.data.settings;
    const current = s.statusAnim || '';

    const page = UI.h('div', { class: 'page' });

    const preview = UI.h('div', { class: 'status-card' });

    const options = [
      { key: '', label: i18n.t('none') },
      { key: 'pulse', label: 'Pulse' },
      { key: 'blink', label: 'Blink' },
      { key: 'rainbow', label: 'Rainbow' },
      { key: 'throb', label: 'Throb' }
    ];

    const select = (key) => {
      window.api.setSettings({ statusAnim: key, profileAnim: key });
      Animator.stop(preview);
      startOutlineAnim(preview, key, { accent: themes.accentColor, idle: idleOutline(), width: 2 });
    };

    for (const o of options) {
      const radio = UI.radioEl(o.key === current);
      page.appendChild(
        UI.h('div', { class: 'option-card mt-8', onclick: () => select(o.key) },
          UI.h('div', { class: 'option-text' },
            UI.h('div', { class: 'option-title text-title-small' }, o.label)
          ),
          radio
        )
      );
    }

    page.appendChild(preview);
    startOutlineAnim(preview, current, { accent: themes.accentColor, idle: idleOutline(), width: 2 });

    root.appendChild(
      UI.h('div', { class: 'topbar' },
        UI.h('button', { class: 'icon-btn', onclick: () => App.back() }, UI.icon('back', 24)),
        UI.h('div', { class: 'topbar-title text-headline' }, i18n.t('app_animations'))
      )
    );
    root.appendChild(page);
  }
};
