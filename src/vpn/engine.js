'use strict';

const { app, net } = require('electron');
const { EventEmitter } = require('events');
const fs = require('fs');
const os = require('os');
const path = require('path');
const netMod = require('net');
const store = require('./store');

// Connection levels, mirroring Android's ConnectionStatus enum.
const LEVEL_NOTCONNECTED = 'LEVEL_NOTCONNECTED';
const LEVEL_START = 'LEVEL_START';
const LEVEL_CONNECTING_NO_SERVER_REPLY_YET = 'LEVEL_CONNECTING_NO_SERVER_REPLY_YET';
const LEVEL_CONNECTING_SERVER_REPLIED = 'LEVEL_CONNECTING_SERVER_REPLIED';
const LEVEL_WAITING_FOR_USER_INPUT = 'LEVEL_WAITING_FOR_USER_INPUT';
const LEVEL_CONNECTED = 'LEVEL_CONNECTED';
const LEVEL_VPNPAUSED = 'LEVEL_VPNPAUSED';
const LEVEL_AUTH_FAILED = 'LEVEL_AUTH_FAILED';
const LEVEL_NONETWORK = 'LEVEL_NONETWORK';
const LEVEL_UNKNOWN = 'LEVEL_UNKNOWN';

class VpnEngine extends EventEmitter {
  constructor() {
    super();
    this.level = LEVEL_NOTCONNECTED;
    this.profileUuid = null;
    this.currentProfile = null;
    this.logBuffer = [];
    this.socket = null;
    this.servicePid = null;
    this._pendingConnect = null;
    this.tempDir = null;
    this.tempConfig = null;
    this.pendingCreds = null;
    this._pausedByUs = false;
  }

  // ---- openvpn discovery ----

  binDir() {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'bin');
    }
    return path.join(__dirname, '..', '..', 'bin');
  }

  openVpnPath() {
    const p = path.join(this.binDir(), 'openvpn.exe');
    return fs.existsSync(p) ? p : null;
  }

  openVpnInfo() {
    const p = this.openVpnPath();
    return { found: !!p, path: p };
  }

  // ---- lifecycle ----

  cleanupTemp() {
    if (this.tempDir && fs.existsSync(this.tempDir)) {
      try {
        fs.rmSync(this.tempDir, { recursive: true, force: true });
      } catch (e) {
        // ignore
      }
    }
    this.tempDir = null;
    this.tempConfig = null;
  }

  connect(profile) {
    const openvpn = this.openVpnPath();
    if (!openvpn) {
      return Promise.reject(new Error('openvpn_not_found'));
    }
    if (this.isActive()) {
      this.forceStop();
    }
    this.currentProfile = profile;
    this.profileUuid = profile.id;
    const hasCreds = !!(profile.username && profile.password);
    if (hasCreds) {
      return this.spawnOpenVpn(profile);
    }
    this.setLevel(LEVEL_WAITING_FOR_USER_INPUT, profile.id);
    this.emit('need-password', { profileId: profile.id, kind: 'auth' });
    return new Promise((resolve, reject) => {
      this._pendingConnect = { profile, resolve, reject };
    });
  }

  async spawnOpenVpn(profile) {
    this.log('MrOpenVPN Windows Client starting');
    this.setLevel(LEVEL_START, profile.id);

    const creds =
      this.pendingCreds && this.pendingCreds.profileId === profile.id
        ? this.pendingCreds
        : { profileId: profile.id, username: profile.username, password: profile.password };
    if (!creds || !creds.username || !creds.password) {
      this.handleProcessExit();
      throw new Error('missing_credentials');
    }

    try {
      const port = await this.freePort();
      this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mropenvpn-'));
      const cfgPath = path.join(this.tempDir, 'client.ovpn');
      const authPath = path.join(this.tempDir, 'auth.txt');
      const logPath = path.join(this.tempDir, 'openvpn.log');
      fs.writeFileSync(authPath, `${creds.username}\n${creds.password}\n`, 'utf8');

      const authFile = authPath.replace(/\\/g, '/');
      const logFile = logPath.replace(/\\/g, '/');
      // Full-tunnel toggle: strip any redirect-gateway directive from the
      // imported config, then re-add it only when "fullTunnel" is enabled.
      const settings = store.getSettings();
      let configText = (profile.config || '')
        .split(/\r?\n/)
        .filter((l) => !/^\s*(redirect-gateway|block-outside-dns)\b/i.test(l))
        .join('\n');
      configText += '\n';
      if (settings.fullTunnel) {
        configText += 'redirect-gateway def1\n';
        configText += 'block-outside-dns\n';
      }
      if (!/^\s*windows-driver\b/im.test(profile.config || '')) {
        configText += 'windows-driver wintun\n';
      }
      configText += `auth-user-pass "${authFile}"\n`;
      configText += `log "${logFile}"\n`;
      configText += 'script-security 0\n';
      configText += 'verb 3\n';
      fs.writeFileSync(cfgPath, configText, 'utf8');
      this.tempConfig = cfgPath;

      const options = `--config "${cfgPath}" --management 127.0.0.1 ${port} --management-log-cache 2000`;

      this.log(`OpenVPN: ${path.basename(this.openVpnPath())}`);
      const pid = await this.startViaService(app.getPath('userData'), options);
      this.servicePid = pid;
      this.log(`OpenVPN started via interactive service (pid ${pid})`);
      this.connectManagement(port);
    } catch (err) {
      this.log(`OpenVPN start error: ${err.message}`);
      this.handleProcessExit();
      throw err;
    }
  }

  startViaService(directory, options) {
    const pipePath = '\\\\.\\pipe\\openvpn\\service';
    return new Promise((resolve, reject) => {
      let settled = false;
      let timer;
      const fail = (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        conn.destroy();
        reject(err);
      };

      const conn = netMod.createConnection({ path: pipePath });
      let buf = Buffer.alloc(0);

      timer = setTimeout(() => {
        fail(new Error('interactive_service_timeout'));
      }, 15000);

      conn.on('connect', () => {
        const payload = `${directory}\0${options}\0\0`;
        conn.write(Buffer.from(payload, 'utf16le'));
      });
      conn.on('data', (chunk) => {
        buf = Buffer.concat([buf, chunk]);
        const text = buf.toString('utf16le');
        const lines = text.split('\n');
        if (lines.length < 3 || !lines[2]) return;
        const errorCode = parseInt(lines[0], 16);
        const pid = parseInt(lines[1], 16);
        if (!Number.isFinite(pid) || pid <= 0) {
          fail(new Error(`interactive_service_error: ${lines[2] || lines[1] || 'unexpected response'}`));
          return;
        }
        if (errorCode !== 0) {
          fail(new Error(`interactive_service_error: ${lines[2] || lines[1] || 'startup failed'}`));
          return;
        }
        settled = true;
        clearTimeout(timer);
        conn.destroy();
        resolve(pid);
      });
      conn.on('error', (err) => {
        const code = err && (err.code || err.message);
        fail(new Error(code === 'ECONNREFUSED' || code === 'ENOENT' ? 'interactive_service_not_running' : `interactive_service_error: ${code}`));
      });
      conn.on('close', () => {
        if (!settled) {
          fail(new Error('interactive_service_closed'));
        }
      });
    });
  }

  handleProcessExit() {
    if (this.socket) {
      try {
        this.socket.destroy();
      } catch (e) {
        // ignore
      }
      this.socket = null;
    }
    this.servicePid = null;
    if (this.profileUuid) {
      this.setLevel(LEVEL_NOTCONNECTED, this.profileUuid);
    }
    this.cleanupTemp();
  }

  freePort() {
    return new Promise((resolve) => {
      const srv = netMod.createServer();
      srv.listen(0, '127.0.0.1', () => {
        const port = srv.address().port;
        srv.close(() => resolve(port));
      });
    });
  }

  connectManagement(port) {
    // openvpn needs a moment to start listening.
    const tryConnect = (attempt) => {
      const sock = netMod.connect({ port, host: '127.0.0.1' });
      sock.setNoDelay(true);
      const onError = (err) => {
        sock.removeAllListeners();
        sock.destroy();
        if (attempt < 40) {
          setTimeout(() => tryConnect(attempt + 1), 250);
        } else {
          this.log('Could not connect to the OpenVPN management interface');
          this.readOpenVpnLogTail();
          this.handleProcessExit();
        }
      };
      sock.once('error', onError);
      sock.once('connect', () => {
        sock.removeListener('error', onError);
        this.attachManagement(sock);
      });
    };
    tryConnect(0);
  }

  attachManagement(sock) {
    this.socket = sock;
    let buffer = '';
    sock.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      let idx;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).replace(/\r$/, '');
        buffer = buffer.slice(idx + 1);
        this.handleManagementLine(line);
      }
    });
    sock.on('close', () => {
      if (this.socket === sock) {
        this.socket = null;
        this.handleProcessExit();
      }
    });
    sock.on('error', () => {
      // socket error -> treat as closed
    });

    // Subscribe to state changes and log lines.
    this.send('state on');
    this.send('log on all');
    this.send('log history 1000');
    this.send('bytecount 1');
  }

  send(line) {
    if (this.socket && !this.socket.destroyed) {
      try {
        this.socket.write(line + '\n');
      } catch (e) {
        // ignore
      }
    }
  }

  readOpenVpnLogTail() {
    if (!this.tempDir) return;
    const logPath = path.join(this.tempDir, 'openvpn.log');
    if (!fs.existsSync(logPath)) return;
    try {
      const text = fs.readFileSync(logPath, 'utf8');
      const lines = text.split(/\r?\n/).filter(Boolean);
      for (const line of lines.slice(-40)) {
        this.log(line);
      }
    } catch (e) {
      // ignore
    }
  }

  handleManagementLine(line) {
    if (line.startsWith('>STATE:')) {
      const parts = line.split(',');
      const state = (parts[1] || '').trim();
      this.handleState(state);
      return;
    }
    if (line.startsWith('>LOG:')) {
      const parts = line.split(',');
      const rest = line.slice(line.indexOf(':') + 1);
      const commaIdx = rest.indexOf(',');
      const after = commaIdx >= 0 ? rest.slice(commaIdx + 1) : rest;
      const secondComma = after.indexOf(',');
      const msg = secondComma >= 0 ? after.slice(secondComma + 1) : after;
      const level = (secondComma >= 0 ? after.slice(0, secondComma) : 'D').trim();
      this.handleLog(level, msg);
      return;
    }
    if (line.startsWith('>PASSWORD:Need ')) {
      this.handlePasswordNeed(line);
      return;
    }
    if (line.startsWith('>PASSWORD:Verification Failed')) {
      this.log('AUTH_FAILED: OpenVPN reported verification failed');
      this.setLevel(LEVEL_AUTH_FAILED, this.profileUuid);
      return;
    }
    if (line.startsWith('>BYTECOUNT:')) {
      // byte statistics, not needed for the UI
      return;
    }
    if (line.startsWith('SUCCESS:')) {
      if (/pause/i.test(line)) {
        this._pausedByUs = true;
        this.setLevel(LEVEL_VPNPAUSED, this.profileUuid);
      } else if (/resume/i.test(line)) {
        this._pausedByUs = false;
        if (this.lastActiveLevel && this.lastActiveLevel !== LEVEL_VPNPAUSED) {
          this.setLevel(this.lastActiveLevel, this.profileUuid);
        }
      }
      return;
    }
  }

  handleState(state) {
    switch (state) {
      case 'CONNECTING':
      case 'RESOLVE':
      case 'TCP_CONNECT':
      case 'WAIT':
        this.setLevel(LEVEL_CONNECTING_NO_SERVER_REPLY_YET, this.profileUuid);
        break;
      case 'AUTH':
        this.setLevel(LEVEL_CONNECTING_NO_SERVER_REPLY_YET, this.profileUuid);
        break;
      case 'GET_CONFIG':
      case 'ASSIGN_IP':
      case 'ADD_ROUTES':
        this.setLevel(LEVEL_CONNECTING_SERVER_REPLIED, this.profileUuid);
        break;
      case 'CONNECTED':
        this.setLevel(LEVEL_CONNECTED, this.profileUuid);
        break;
      case 'RECONNECTING':
        this.setLevel(LEVEL_CONNECTING_NO_SERVER_REPLY_YET, this.profileUuid);
        break;
      case 'EXITING':
        this.setLevel(LEVEL_NOTCONNECTED, this.profileUuid);
        break;
      default:
        break;
    }
  }

  handlePasswordNeed(line) {
    const kind = line.includes("'Auth'") ? 'auth' : 'private-key';
    const creds = this.pendingCreds;
    if (kind === 'auth' && creds && creds.username && creds.password) {
      this.sendAuth(creds.username, creds.password);
      this.pendingCreds = null;
      return;
    }
    this.setLevel(LEVEL_WAITING_FOR_USER_INPUT, this.profileUuid);
    this.emit('need-password', { profileId: this.profileUuid, kind });
  }

  handleLog(level, msg) {
    const text = (msg || '').replace(/^,/, '');
    if (this._lastLog === text) return;
    this._lastLog = text;
    this.log(text);

    if (/AUTH_FAILED/i.test(text)) {
      this.setLevel(LEVEL_AUTH_FAILED, this.profileUuid);
      return;
    }
    if (/Cannot open TUN\/TAP/i.test(text) || /All TAP-Windows adapters/i.test(text)) {
      this.setLevel(LEVEL_UNKNOWN, this.profileUuid);
      return;
    }
    if (/socket: connect failed/i.test(text) || /Network is unreachable/i.test(text)) {
      if (net.isOnline && !net.isOnline()) {
        this.setLevel(LEVEL_NONETWORK, this.profileUuid);
      }
      return;
    }
    if (/SIGTERM[^\n]*received/i.test(text)) {
      // normal disconnect
    }
  }

  // ---- commands ----

  setPendingCredentials(profileId, username, password) {
    this.pendingCreds = { profileId, username, password };
    const pending = this._pendingConnect;
    if (pending && pending.profile.id === profileId) {
      this._pendingConnect = null;
      this.spawnOpenVpn(pending.profile).then(pending.resolve, pending.reject);
    } else if (pending) {
      this._pendingConnect = null;
      pending.reject(new Error('cancelled'));
      if (profileId) {
        this.setLevel(LEVEL_NOTCONNECTED, profileId);
      }
    }
  }

  sendAuth(username, password) {
    const cleanUser = String(username).replace(/[\r\n]/g, '');
    const cleanPass = String(password).replace(/[\r\n]/g, '');
    const safeUser = cleanUser.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const safePass = cleanPass.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    this.send(`password auth "${safeUser}" "${safePass}"`);
    if (this.level === LEVEL_WAITING_FOR_USER_INPUT) {
      this.setLevel(LEVEL_CONNECTING_NO_SERVER_REPLY_YET, this.profileUuid);
    }
    this.log('Sending credentials to the OpenVPN server');
  }

  disconnect() {
    if (this._pendingConnect) {
      const pending = this._pendingConnect;
      this._pendingConnect = null;
      pending.reject(new Error('cancelled'));
      if (this.profileUuid) {
        this.setLevel(LEVEL_NOTCONNECTED, this.profileUuid);
      }
      return;
    }
    if (!this.socket && !this.servicePid && !this.tempConfig) {
      if (this.profileUuid) {
        this.setLevel(LEVEL_NOTCONNECTED, this.profileUuid);
      }
      return;
    }
    if (this.profileUuid) {
      this.log('Disconnecting…');
    }
    this.send('signal SIGTERM');
    // Fallback: also try to stop the process shortly after.
    setTimeout(() => {
      if (this.profileUuid && this.level !== LEVEL_NOTCONNECTED) {
        this.stopViaTaskkill();
        this.setLevel(LEVEL_NOTCONNECTED, this.profileUuid);
      }
    }, 3000);
  }

  forceStop() {
    if (this._pendingConnect) {
      const pending = this._pendingConnect;
      this._pendingConnect = null;
      pending.reject(new Error('cancelled'));
    }
    this.send('signal SIGTERM');
    this.stopViaTaskkill();
  }

  stopViaTaskkill() {
    if (!this.servicePid) return;
    try {
      const { execFile } = require('child_process');
      execFile('taskkill.exe', ['/PID', String(this.servicePid), '/T', '/F'], () => {});
    } catch (e) {
      // ignore
    }
  }

  pause() {
    if (this.level === LEVEL_CONNECTED) {
      this.lastActiveLevel = this.level;
      this.send('pause');
    }
  }

  resume() {
    this.send('resume');
  }

  // ---- state ----

  setLevel(level, profileUuid) {
    this.level = level;
    this.profileUuid = profileUuid || this.profileUuid;
    this.emit('state', {
      level,
      profileUuid: this.profileUuid,
      connectedProfileUuid: level === LEVEL_CONNECTED ? this.profileUuid : null
    });
  }

  getState() {
    return {
      level: this.level,
      profileUuid: this.profileUuid,
      connectedProfileUuid: this.level === LEVEL_CONNECTED ? this.profileUuid : null,
      info: this.openVpnInfo()
    };
  }

  log(message) {
    const entry = {
      time: Date.now(),
      level: 'D',
      message: String(message)
    };
    this.logBuffer.push(entry);
    if (this.logBuffer.length > 4000) this.logBuffer.shift();
    this.emit('log', entry);
  }

  getLog() {
    return this.logBuffer;
  }

  isActive() {
    return (
      this.level === LEVEL_CONNECTED ||
      this.level === LEVEL_CONNECTING_NO_SERVER_REPLY_YET ||
      this.level === LEVEL_CONNECTING_SERVER_REPLIED ||
      this.level === LEVEL_START ||
      this.level === LEVEL_WAITING_FOR_USER_INPUT ||
      this.level === LEVEL_VPNPAUSED ||
      this.level === LEVEL_AUTH_FAILED
    );
  }
}

module.exports = {
  VpnEngine,
  LEVEL_NOTCONNECTED,
  LEVEL_START,
  LEVEL_CONNECTING_NO_SERVER_REPLY_YET,
  LEVEL_CONNECTING_SERVER_REPLIED,
  LEVEL_WAITING_FOR_USER_INPUT,
  LEVEL_CONNECTED,
  LEVEL_VPNPAUSED,
  LEVEL_AUTH_FAILED,
  LEVEL_NONETWORK,
  LEVEL_UNKNOWN
};
