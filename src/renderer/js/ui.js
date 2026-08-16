'use strict';

const UI = {
  h(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') {
        node.addEventListener(k.slice(2), v);
      } else if (k === 'value' && node.tagName === 'INPUT') {
        node.value = v;
      } else if (v === true) {
        node.setAttribute(k, '');
      } else if (v !== false && v !== null && v !== undefined) {
        node.setAttribute(k, v);
      }
    }
    for (const child of children.flat(Infinity)) {
      if (child === null || child === undefined) continue;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return node;
  },

  icon(name, size = 24, cls = '') {
    const paths = ICONS[name] || ICONS['info'];
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('fill', 'currentColor');
    if (cls) svg.classList.add(cls);
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', paths);
    svg.appendChild(path);
    return svg;
  },

  showToast(message) {
    const toast = document.getElementById('toast');
    toast.innerHTML = '';
    toast.appendChild(UI.h('div', { class: 'toast-inner' }, message));
    toast.style.display = 'block';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.style.display = 'none';
    }, 2500);
  },

  showDialog({ title, message, buttons, small, body, onClose }) {
    const root = document.getElementById('dialogRoot');
    const scrim = UI.h('div', { class: 'dialog-scrim' });
    const dialog = UI.h(
      'div',
      { class: 'dialog' + (small ? ' dialog-small' : '') },
      title ? UI.h('div', { class: 'dialog-title text-title-medium' }, title) : null,
      message ? UI.h('div', { class: 'dialog-msg text-body-medium mt-8' }, message) : null,
      body || null
    );
    const btnRow = UI.h('div', { class: 'dialog-buttons' });
    dialog.appendChild(btnRow);
    scrim.appendChild(dialog);
    root.appendChild(scrim);

    const close = () => {
      scrim.remove();
      if (onClose) onClose();
    };
    scrim.addEventListener('mousedown', (e) => {
      if (e.target === scrim) close();
    });
    dialog.addEventListener('mousedown', (e) => e.stopPropagation());

    for (const b of buttons || []) {
      const btn = UI.h('button', { class: 'btn-outlined', onclick: () => {
        if (b.onClick) b.onClick();
        close();
      } }, b.label);
      btnRow.appendChild(btn);
    }
    return { el: dialog, close };
  },

  confirm({ title, message, onYes, yesLabel, danger }) {
    this.showDialog({
      title,
      message,
      buttons: [
        { label: i18n.t('no'), onClick: () => {} },
        {
          label: yesLabel || i18n.t('yes'),
          danger,
          onClick: onYes
        }
      ]
    });
  },

  switchEl(on, onChange) {
    const id = 'sw' + Math.random().toString(36).slice(2);
    const input = UI.h('input', { type: 'checkbox', id, checked: on });
    const wrap = UI.h(
      'div',
      { class: 'switch' },
      input,
      UI.h('div', { class: 'track' }),
      UI.h('div', { class: 'thumb' })
    );
    wrap.input = input;
    input.addEventListener('change', () => {
      if (onChange) onChange(input.checked);
    });
    wrap.setState = (v) => {
      input.checked = v;
    };
    return wrap;
  },

  radioEl(checked) {
    const r = UI.h('div', { class: 'radio' + (checked ? ' checked' : '') });
    r.setChecked = (v) => {
      if (v) r.classList.add('checked');
      else r.classList.remove('checked');
    };
    return r;
  },

  settingsRow({ title, summary, trailing, onClick, disabled }) {
    return UI.h(
      'div',
      {
        class: 'settings-row' + (disabled ? ' disabled' : ''),
        onclick: disabled ? null : onClick
      },
      UI.h(
        'div',
        { class: 'row-text' },
        UI.h('div', { class: 'row-title text-title-small' }, title),
        summary ? UI.h('div', { class: 'row-summary text-body-small mt-8' }, summary) : null
      ),
      trailing || null
    );
  }
};

const ICONS = {
  menu: 'M3,18h18v-2H3V18z M3,13h18v-2H3V13z M3,6v2h18V6H3z',
  home: 'M10,20v-6h4v6h5v-8h3L12,3L2,12h3v8z',
  back: 'M20,11H7.83l5.59,-5.59L12,4l-8,8 8,8 1.41,-1.41L7.83,13H20v-2z',
  settings:
    'M19.14,12.94c0.04,-0.3 0.06,-0.61 0.06,-0.94c0,-0.32 -0.02,-0.64 -0.07,-0.94l2.03,-1.58c0.18,-0.14 0.23,-0.41 0.12,-0.61l-1.92,-3.32c-0.12,-0.22 -0.37,-0.29 -0.59,-0.22l-2.39,0.96c-0.5,-0.38 -1.03,-0.7 -1.62,-0.94L14.4,2.81c-0.04,-0.24 -0.24,-0.41 -0.48,-0.41h-3.84c-0.24,0 -0.43,0.17 -0.47,0.41L9.25,5.35C8.66,5.59 8.12,5.92 7.63,6.29L5.24,5.33c-0.22,-0.08 -0.47,0 -0.59,0.22L2.74,8.87C2.62,9.08 2.66,9.34 2.86,9.48l2.03,1.58C4.84,11.36 4.8,11.69 4.8,12s0.02,0.64 0.07,0.94l-2.03,1.58c-0.18,0.14 -0.23,0.41 -0.12,0.61l1.92,3.32c0.12,0.22 0.37,0.29 0.59,0.22l2.39,-0.96c0.5,0.38 1.03,0.7 1.62,0.94l0.36,2.54c0.05,0.24 0.24,0.41 0.48,0.41h3.84c0.24,0 0.44,-0.17 0.47,-0.41l0.36,-2.54c0.59,-0.24 1.13,-0.56 1.62,-0.94l2.39,0.96c0.22,0.08 0.47,0 0.59,-0.22l1.92,-3.32c0.12,-0.22 0.07,-0.47 -0.12,-0.61L19.14,12.94zM12,15.6c-1.98,0 -3.6,-1.62 -3.6,-3.6s1.62,-3.6 3.6,-3.6s3.6,1.62 3.6,3.6S13.98,15.6 12,15.6z',
  group:
    'M16,11c1.66,0 2.99,-1.34 2.99,-3S17.66,5 16,5c-1.66,0 -3,1.34 -3,3S14.34,11 16,11zM8,11c1.66,0 2.99,-1.34 2.99,-3S9.66,5 8,5C6.34,5 5,6.34 5,8S6.34,11 8,11zM8,13c-2.33,0 -7,1.17 -7,3.5V19h14v-2.5C15,14.17 10.33,13 8,13zM16,13c-0.29,0 -0.62,0.02 -0.97,0.05C16.37,13.78 17,15 17,16.5V19h6v-2.5C23,14.17 18.33,13 16,13z',
  palette:
    'M12,3c-4.97,0 -9,4.03 -9,9s4.03,9 9,9c0.83,0 1.5,-0.67 1.5,-1.5c0,-0.39 -0.15,-0.74 -0.39,-1.01c-0.23,-0.26 -0.38,-0.61 -0.38,-0.99c0,-0.83 0.67,-1.5 1.5,-1.5H16c2.76,0 5,-2.24 5,-5C21,7.79 17.01,3 12,3zM6.5,12c-0.83,0 -1.5,-0.67 -1.5,-1.5S5.67,9 6.5,9S8,9.67 8,10.5S7.33,12 6.5,12zM9.5,8C8.67,8 8,7.33 8,6.5S8.67,5 9.5,5S11,5.67 11,6.5S10.33,8 9.5,8zM14.5,8c-0.83,0 -1.5,-0.67 -1.5,-1.5S13.67,5 14.5,5S16,5.67 16,6.5S15.33,8 14.5,8zM17.5,12c-0.83,0 -1.5,-0.67 -1.5,-1.5S16.67,9 17.5,9S19,9.67 19,10.5S18.33,12 17.5,12z',
  bolt:
    'M11,21h-1l1,-7H7.5c-0.58,0 -0.57,-0.32 -0.38,-0.66c0.19,-0.34 0.05,-0.08 0.07,-0.12C8.48,10.94 10.42,7.54 13,3h1l-1,7h3.5c0.49,0 0.56,0.33 0.47,0.51l-0.07,0.15C12.96,17.55 11,21 11,21z',
  info:
    'M12,2C6.48,2 2,6.48 2,12s4.48,10 10,10s10,-4.48 10,-10S17.52,2 12,2zM13,17h-2v-6h2V17zM13,9h-2V7h2V9z',
  delete:
    'M6,19c0,1.1 0.9,2 2,2h8c1.1,0 2,-0.9 2,-2V7H6V19zM19,4h-3.5l-1,-1h-5l-1,1H5v2h14V4z',
  add: 'M19,13h-6v6h-2v-6H5v-2h6V5h2v6h6V13z',
  edit: 'M3,17.25V21h3.75L17.81,9.94l-3.75,-3.75L3,17.25zM20.71,7.04c0.39,-0.39 0.39,-1.02 0,-1.41l-2.34,-2.34c-0.39,-0.39 -1.02,-0.39 -1.41,0l-1.83,1.83 3.75,3.75 1.83,-1.83z',
  lock: 'M18,8h-1V6c0,-2.76 -2.24,-5 -5,-5S7,3.24 7,6v2H6c-1.1,0 -2,0.9 -2,2v10c0,1.1 0.9,2 2,2h12c1.1,0 2,-0.9 2,-2V10c0,-1.1 -0.9,-2 -2,-2zM12,17c-1.1,0 -2,-0.9 -2,-2s0.9,-2 2,-2s2,0.9 2,2S13.1,17 12,17zM9,8V6c0,-1.66 1.34,-3 3,-3s3,1.34 3,3v2H9z'
};
