'use strict';

const { app, net } = require('electron');
const { EventEmitter } = require('events');
const fs = require('fs');
const os = require('os');
const path = require('path');
const netMod = require('net');

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
    this.openvpnProcess = null;
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
    this.currentProfile = profile;
    this.profileUuid = profile.id;
    return this.spawnOpenVpn(openvpn, profile);
  }

  async spawnOpenVpn(openvpn, profile) {
    this.log('MrOpenVPN Windows Client starting');
    this.setLevel(LEVEL_START, profile.id);

    const port = await this.freePort();
    this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mropenvpn-'));
    const cfgPath = path.join(this.tempDir, 'client.ovpn');
    let configText = profile.config || '';
    configText += '\n';
    configText += 'auth-nocache\n';
    // Allow legacy ciphers used by old OpenVPN 2.x servers.
    configText += 'data-ciphers-fallback BF-CBC\n';
    configText += 'script-security 2\n';
    configText += 'verb 3\n';
    fs.writeFileSync(cfgPath, configText, 'utf8');
    this.tempConfig = cfgPath;

    const args = [
      '--config', cfgPath,
      '--management', '127.0.0.1', String(port),
      '--management-query-passwords',
      '--management-log-cache', '2000',
      '--auth-nocache'
    ];

    this.log(`OpenVPN: ${path.basename(openvpn)}`);

    const { spawn } = require('child_process');
    this.openvpnProcess = spawn(openvpn, args, {
      cwd: path.dirname(openvpn),
      windowsHide: true,
      stdio: 'ignore'
    });
    this.openvpnProcess.on('error', (err) => {
      this.log(`OpenVPN spawn error: ${err.message}`);
      this.handleProcessExit();
    });
    this.openvpnProcess.on('exit', (code) => {
      this.log(`OpenVPN process exited (code ${code})`);
      this.handleProcessExit();
    });

    this.connectManagement(port);
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
          this.setLevel(LEVEL_UNKNOWN, this.profileUuid);
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
  }

  sendAuth(username, password) {
    const safeUser = String(username).replace(/"/g, '\\"');
    const safePass = String(password).replace(/"/g, '\\"');
    this.send(`password auth "${safeUser}" "${safePass}"`);
    if (this.level === LEVEL_WAITING_FOR_USER_INPUT) {
      this.setLevel(LEVEL_CONNECTING_NO_SERVER_REPLY_YET, this.profileUuid);
    }
    this.log('Sending credentials to the OpenVPN server');
  }

  disconnect() {
    if (this.profileUuid) {
      this.log('Disconnecting…');
    }
    this.send('signal SIGTERM');
    // Fallback: also try to stop the process shortly after.
    setTimeout(() => {
      if (this.profileUuid && this.level !== LEVEL_NOTCONNECTED) {
        if (this.openvpnProcess && !this.openvpnProcess.killed) {
          this.openvpnProcess.kill();
        }
        this.setLevel(LEVEL_NOTCONNECTED, this.profileUuid);
      }
    }, 3000);
  }

  forceStop() {
    if (this.openvpnProcess && !this.openvpnProcess.killed) {
      try {
        this.openvpnProcess.kill();
      } catch (e) {
        // ignore
      }
    }
    this.send('signal SIGTERM');
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
