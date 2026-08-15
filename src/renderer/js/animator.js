'use strict';

/* StatusOutlineAnimator, translated from the Android app (StatusOutlineAnimator.java) */

const Animator = {
  els: new Map(),
  raf: null,
  lastT: 0,

  start(kind, el, opts = {}) {
    const accent = opts.accent || '#FFFFFF';
    const idle = opts.idle || '#333333';
    const width = opts.width || 2;
    this.els.set(el, { kind, accent, idle, width });
    if (!this.raf) {
      this.lastT = performance.now();
      this.raf = requestAnimationFrame(this.tick.bind(this));
    }
  },

  stop(el) {
    this.els.delete(el);
    el.style.borderColor = '';
    el.style.borderWidth = '';
  },

  tick(now) {
    const dt = now - this.lastT;
    this.lastT = now;
    for (const [el, cfg] of this.els) {
      if (!document.contains(el)) {
        this.els.delete(el);
        continue;
      }
      const t = now / 1000;
      switch (cfg.kind) {
        case 'pulse': {
          const s = (Math.sin((t * 2 * Math.PI) / 1.2) + 1) / 2;
          el.style.borderColor = lerpColor(cfg.idle, cfg.accent, s);
          el.style.borderWidth = cfg.width + 'px';
          break;
        }
        case 'blink': {
          const period = 0.3 + 0.2;
          const phase = (t % period) / period;
          el.style.borderColor = phase < 0.3 ? cfg.accent : cfg.idle;
          el.style.borderWidth = cfg.width + 'px';
          break;
        }
        case 'rainbow': {
          const hue = ((t * 360) / 3) % 360;
          el.style.borderColor = hslToHex(hue, 100, 50);
          el.style.borderWidth = cfg.width + 'px';
          break;
        }
        case 'throb': {
          const s = Math.sin((t * 2 * Math.PI) / 1.0);
          el.style.borderColor = cfg.accent;
          el.style.borderWidth = Math.max(1, cfg.width + s) + 'px';
          break;
        }
        default:
          break;
      }
    }
    if (this.els.size > 0) {
      this.raf = requestAnimationFrame(this.tick.bind(this));
    } else {
      this.raf = null;
    }
  }
};

function lerpColor(a, b, t) {
  const ca = parseHexColor(a);
  const cb = parseHexColor(b);
  if (!ca || !cb) return a;
  const r = Math.round(ca.r + (cb.r - ca.r) * t);
  const g = Math.round(ca.g + (cb.g - ca.g) * t);
  const bl = Math.round(ca.b + (cb.b - ca.b) * t);
  return rgbToHex(r, g, bl);
}

function parseHexColor(hex) {
  const m = /^#?([a-f0-9]{6})$/i.exec(hex);
  if (!m) return null;
  return {
    r: parseInt(m[1].slice(0, 2), 16),
    g: parseInt(m[1].slice(2, 4), 16),
    b: parseInt(m[1].slice(4, 6), 16)
  };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function hslToHex(h, s, l) {
  h /= 360;
  s /= 100;
  l /= 100;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return rgbToHex(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255));
}
