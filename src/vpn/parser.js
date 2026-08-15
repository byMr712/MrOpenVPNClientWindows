'use strict';

// A small parser for OpenVPN client configs (.ovpn / .conf).
// It mirrors the important behavior of the Android app parser:
// - only "tun" mode is allowed, "tap" configs are rejected
// - detects "auth-user-pass" so the app can ask for credentials
// - remembers the remote host / protocol / port

function stripComment(line) {
  // In OpenVPN configs, ";" and "#" at the start of a line (or after
  // whitespace) begin a comment. Inline values (e.g. ca.crt#hash) are rare,
  // so we only cut comments that come after a value is separated.
  const trimmed = line.trim();
  if (trimmed.startsWith('#')) return '';
  if (trimmed.startsWith(';')) return '';
  // Handle trailing inline comments: split on the first ';' or '#'
  // but not inside <tag>...</tag> blocks or quoted strings.
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuote = !inQuote;
    if (!inQuote && (ch === '#' || ch === ';')) {
      const before = line.slice(0, i);
      if (before.trim().length > 0) return before;
      return '';
    }
  }
  return line;
}

function parseConfig(text) {
  const lines = String(text).split(/\r?\n/);
  const out = [];
  let inTag = null;
  let needAuth = false;
  let devType = null;
  let remote = null;
  let proto = null;
  let port = null;

  for (let raw of lines) {
    const line = raw.trimEnd();
    if (inTag) {
      out.push(line);
      if (line === `</${inTag}>`) inTag = null;
      continue;
    }
    const tagMatch = /^<([a-zA-Z0-9_-]+)>/.exec(line.trim());
    if (tagMatch) {
      inTag = tagMatch[1];
      out.push(line);
      continue;
    }
    const cleaned = stripComment(line);
    if (!cleaned.trim()) continue;
    const parts = cleaned.trim().split(/\s+/);
    const key = parts[0].toLowerCase();

    if (key === 'dev') {
      const val = parts[1] || '';
      if (/^tap/i.test(val)) devType = 'tap';
      else if (/^tun/i.test(val)) devType = 'tun';
    } else if (key === 'dev-type') {
      const val = (parts[1] || '').toLowerCase();
      if (val === 'tap') devType = 'tap';
      else if (val === 'tun') devType = 'tun';
    } else if (key === 'auth-user-pass') {
      needAuth = true;
    } else if (key === 'remote') {
      // remote host [port] [proto]
      if (parts[1]) {
        remote = parts[1];
        if (parts[2]) {
          const p = parseInt(parts[2], 10);
          if (!Number.isNaN(p)) port = p;
        }
        if (parts[3]) {
          const pr = parts[3].toLowerCase();
          if (pr === 'udp' || pr === 'tcp' || pr === 'udp4' || pr === 'tcp4' ||
              pr === 'udp6' || pr === 'tcp6') {
            proto = pr.replace(/[46]$/, '');
          }
        }
      }
    } else if (key === 'proto') {
      const pr = (parts[1] || '').toLowerCase();
      if (pr) proto = pr.replace(/[46]$/, '');
    }

    if (key === 'auth-user-pass' && parts.length > 1) {
      // Rewrite "auth-user-pass file" to plain "auth-user-pass" so the
      // management interface asks the app for the credentials instead of
      // reading an external file that may not exist.
      out.push('auth-user-pass');
    } else {
      out.push(line);
    }
  }

  const errors = [];
  if (devType === 'tap') {
    errors.push('Only tun mode configurations are supported');
  }
  if (!remote && !needAuth) {
    // Some configs have no "remote" (unusual), allow it anyway.
  }

  return {
    remote,
    proto: proto || (remote ? 'udp' : null),
    port,
    needAuth,
    devType,
    errors,
    config: out.join('\n')
  };
}

module.exports = { parseConfig };
