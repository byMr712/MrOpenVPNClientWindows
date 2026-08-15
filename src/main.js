'use strict';

const { app, BrowserWindow, ipcMain, Tray, Menu, clipboard, Notification, dialog, powerMonitor } = require('electron');
const path = require('path');
const fs = require('fs');

const store = require('./vpn/store');
const { parseConfig } = require('./vpn/parser');
const { VpnEngine } = require('./vpn/engine');
const { LEVEL_CONNECTED, LEVEL_NOTCONNECTED, LEVEL_AUTH_FAILED, LEVEL_VPNPAUSED } = require('./vpn/engine');

const engine = new VpnEngine();

let mainWindow = null;
let tray = null;
let wasConnectedUuid = null;
let quitting = false;

const APP_VERSION = app.getVersion();

// ---- helpers ----

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function toast(payload) {
  send('toast', payload);
}

function profileDto(p) {
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    fileName: p.fileName,
    remote: p.remote,
    proto: p.proto,
    port: p.port,
    needAuth: p.needAuth,
    username: p.username,
    addedAt: p.addedAt
  };
}

function publicState() {
  return {
    settings: store.getSettings(),
    profiles: store.getProfiles().map(profileDto),
    users: store.getUsers().map((u) => ({ login: u.login, hasPassword: !!u.password })),
    vpn: engine.getState(),
    version: APP_VERSION,
    openvpn: engine.openVpnInfo(),
    admin: null
  };
}

// ---- window ----

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 740,
    minWidth: 360,
    minHeight: 560,
    useContentSize: true,
    resizable: true,
    maximizable: true,
    backgroundColor: '#000000',
    title: 'MrOpenVPN Client',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (e) => {
    // Closing the window keeps the app running in the tray, unless quitting.
    if (!quitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ---- tray ----

function refreshTrayMenu() {
  if (!tray) return;
  const s = engine.getState();
  const level = s.level;
  const active = engine.isActive();
  const menu = Menu.buildFromTemplate([
    {
      label: 'MrOpenVPN Client',
      enabled: false
    },
    { type: 'separator' },
    {
      label: active ? 'Disconnect' : 'Connect',
      enabled: store.getProfiles().length > 0,
      click: () => {
        if (active) {
          engine.disconnect();
        } else {
          const last = store.getProfile(store.getSettings().lastProfileUuid) || store.getProfiles()[0];
          if (last) connectProfile(last);
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Show',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Quit',
      click: () => {
        quitting = true;
        engine.forceStop();
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(menu);
  tray.setToolTip(`MrOpenVPN Client - ${level.replace('LEVEL_', '').toLowerCase()}`);
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
  tray = new Tray(iconPath);
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) mainWindow.hide();
      else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
  refreshTrayMenu();
}

// ---- notification ----

function showStatusNotification(state) {
  if (!store.getSettings().notify) return;
  if (Notification.isSupported()) {
    const n = new Notification({
      title: 'MrOpenVPN Client',
      body: state,
      icon: path.join(__dirname, '..', 'assets', 'icon.png')
    });
    n.on('click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
    n.show();
  }
}

// ---- engine wiring ----

function connectProfile(profile) {
  return engine.connect(profile).then((res) => {
    if (res && res.relaunched) {
      toast({ kind: 'relaunching' });
      setTimeout(() => {
        quitting = true;
        app.quit();
      }, 800);
      return { relaunched: true };
    }
    store.setSettings({ lastProfileUuid: profile.id });
    refreshTrayMenu();
    return { ok: true };
  });
}

engine.on('state', (s) => {
  if (s.level === LEVEL_CONNECTED) {
    wasConnectedUuid = s.profileUuid;
    showStatusNotification('Connected');
  } else if (s.level === LEVEL_NOTCONNECTED || s.level === LEVEL_AUTH_FAILED) {
    showStatusNotification('Disconnected');
  }
  send('state:changed', s);
  refreshTrayMenu();
});

engine.on('log', (entry) => {
  send('log:changed', entry);
});

engine.on('need-password', (payload) => {
  send('vpn:need-password', payload);
});

// ---- reconnect on network change ----
// The renderer reports navigator.onLine changes via app:online.

ipcMain.handle('app:online', (e, isOnline) => {
  if (!isOnline) {
    if (engine.isActive()) {
      wasConnectedUuid = engine.profileUuid || wasConnectedUuid;
    }
  } else {
    if (!wasConnectedUuid) return true;
    if (engine.level === LEVEL_CONNECTED) return true;
    if (engine.level === LEVEL_VPNPAUSED) {
      engine.resume();
      return true;
    }
    const profile = store.getProfile(wasConnectedUuid);
    if (profile) {
      setTimeout(() => connectProfile(profile).catch(() => {}), 1000);
    }
  }
  return true;
});

// ---- pause when the screen is locked (screen "off") ----

powerMonitor.on('lock-screen', () => {
  if (store.getSettings().screenOffPause && engine.isActive()) {
    engine.pause();
  }
});

powerMonitor.on('unlock-screen', () => {
  if (store.getSettings().screenOffPause && engine.level === LEVEL_VPNPAUSED) {
    engine.resume();
  }
});

// ---- auto connect ----

function autoConnect() {
  const s = store.getSettings();
  if (!s.autoConnect) return;
  const lastId = store.getSettings().lastProfileUuid || (store.getProfiles()[0] && store.getProfiles()[0].id);
  const profile = store.getProfile(lastId);
  if (profile) {
    connectProfile(profile).catch(() => {});
  }
}

// ---- IPC ----

function registerIpc() {
  ipcMain.handle('app:init', () => publicState());

  ipcMain.handle('window:setBg', (e, color) => {
    if (mainWindow && /^#[0-9a-fA-F]{6}$/.test(color)) {
      mainWindow.setBackgroundColor(color);
    }
    return true;
  });

  ipcMain.handle('settings:set', (e, patch) => {
    const s = store.setSettings(patch);
    send('settings:changed', s);
    refreshTrayMenu();
    return s;
  });

  ipcMain.handle('profiles:import', async () => {
    const win = BrowserWindow.fromWebContents(e.sender) || mainWindow;
    const result = await dialog.showOpenDialog(win, {
      title: 'Import .ovpn profile',
      properties: ['openFile'],
      filters: [
        { name: 'OpenVPN profiles', extensions: ['ovpn', 'conf'] },
        { name: 'All files', extensions: ['*'] }
      ]
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { canceled: true };
    }
    const filePath = result.filePaths[0];
    let text;
    try {
      text = fs.readFileSync(filePath, 'utf8');
    } catch (err) {
      return { error: { message: err.message } };
    }
    let parsed;
    try {
      parsed = parseConfig(text);
    } catch (err) {
      return { error: { message: err.message } };
    }
    if (parsed.errors && parsed.errors.length) {
      return { error: { message: parsed.errors[0] } };
    }
    const baseName = path.basename(filePath).replace(/\.(ovpn|conf)$/i, '');
    const name = store.uniqueProfileName(baseName || 'Imported profile');
    const profile = store.addProfile({
      name,
      fileName: path.basename(filePath),
      remote: parsed.remote,
      proto: parsed.proto,
      port: parsed.port,
      needAuth: parsed.needAuth,
      config: parsed.config
    });
    send('profiles:changed', store.getProfiles().map(profileDto));
    return { ok: true, profile: profileDto(profile) };
  });

  ipcMain.handle('profiles:update', (e, id, patch) => {
    const p = store.updateProfile(id, patch);
    send('profiles:changed', store.getProfiles().map(profileDto));
    return p ? profileDto(p) : null;
  });

  ipcMain.handle('profiles:delete', (e, id) => {
    if (engine.profileUuid === id) {
      engine.disconnect();
    }
    store.removeProfile(id);
    send('profiles:changed', store.getProfiles().map(profileDto));
    refreshTrayMenu();
    return true;
  });

  ipcMain.handle('users:add', (e, login, password) => {
    const finalName = store.uniqueUserName(login);
    store.saveUser(finalName, password);
    send('users:changed', store.getUsers().map((u) => ({ login: u.login, hasPassword: !!u.password })));
    return { ok: true, login: finalName };
  });

  ipcMain.handle('users:listPlain', () => {
    return store.getUsers().map((u) => ({ login: u.login, password: u.password }));
  });

  ipcMain.handle('users:delete', (e, login) => {
    store.deleteUser(login);
    send('users:changed', store.getUsers().map((u) => ({ login: u.login, hasPassword: !!u.password })));
    send('profiles:changed', store.getProfiles().map(profileDto));
    return true;
  });

  ipcMain.handle('users:clear', () => {
    store.clearUsers();
    send('users:changed', []);
    send('profiles:changed', store.getProfiles().map(profileDto));
    return true;
  });

  ipcMain.handle('app:reset', () => {
    engine.forceStop();
    store.resetAll();
    send('settings:changed', store.getSettings());
    send('profiles:changed', []);
    send('users:changed', []);
    return true;
  });

  ipcMain.handle('vpn:connect', async (e, id) => {
    const profile = store.getProfile(id);
    if (!profile) return { error: 'profile_not_found' };
    try {
      return await connectProfile(profile);
    } catch (err) {
      return { error: err.message || 'vpn_start_error' };
    }
  });

  ipcMain.handle('vpn:disconnect', () => {
    engine.disconnect();
    return true;
  });

  ipcMain.handle('vpn:resume', () => {
    engine.resume();
    return true;
  });

  ipcMain.handle('vpn:sendCredentials', (e, profileId, username, password, remember) => {
    const profile = store.getProfile(profileId);
    if (profile) {
      store.updateProfile(profileId, { username, password });
      if (remember) {
        store.saveUser(username, password);
        send('users:changed', store.getUsers().map((u) => ({ login: u.login, hasPassword: !!u.password })));
      }
    }
    engine.setPendingCredentials(profileId, username, password);
    engine.sendAuth(username, password);
    send('profiles:changed', store.getProfiles().map(profileDto));
    return true;
  });

  ipcMain.handle('vpn:getLog', () => engine.getLog());

  ipcMain.handle('vpn:getState', () => engine.getState());

  ipcMain.handle('clipboard:copy', (e, text) => {
    clipboard.writeText(String(text));
    return true;
  });

  ipcMain.handle('shell:openExternal', (e, url) => {
    const { shell } = require('electron');
    shell.openExternal(String(url));
    return true;
  });

  ipcMain.handle('app:quit', () => {
    quitting = true;
    engine.forceStop();
    app.quit();
    return true;
  });
}

// ---- app lifecycle ----

app.on('window-all-closed', () => {
  // keep running in the tray
});

app.on('before-quit', () => {
  quitting = true;
  engine.forceStop();
});

app.whenReady().then(() => {
  registerIpc();
  createWindow();
  createTray();

  const args = process.argv;
  const connectIdx = args.indexOf('--connect');
  const pendingConnect = connectIdx >= 0 ? args[connectIdx + 1] : null;

  mainWindow.webContents.once('did-finish-load', () => {
    if (pendingConnect) {
      const profile = store.getProfile(pendingConnect);
      if (profile) {
        setTimeout(() => connectProfile(profile).catch(() => {}), 400);
      }
    } else {
      autoConnect();
    }
  });
});
