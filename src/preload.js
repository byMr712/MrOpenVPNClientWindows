'use strict';

const { contextBridge, ipcRenderer } = require('electron');

function on(channel, cb) {
  const listener = (_e, payload) => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('api', {
  init: () => ipcRenderer.invoke('app:init'),

  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  setWindowBg: (color) => ipcRenderer.invoke('window:setBg', color),

  importProfile: () => ipcRenderer.invoke('profiles:import'),
  updateProfile: (id, patch) => ipcRenderer.invoke('profiles:update', id, patch),
  deleteProfile: (id) => ipcRenderer.invoke('profiles:delete', id),

  addUser: (login, password) => ipcRenderer.invoke('users:add', login, password),
  listUsersPlain: () => ipcRenderer.invoke('users:listPlain'),
  deleteUser: (login) => ipcRenderer.invoke('users:delete', login),
  clearUsers: () => ipcRenderer.invoke('users:clear'),
  resetData: () => ipcRenderer.invoke('app:reset'),

  notifyOnline: (isOnline) => ipcRenderer.invoke('app:online', isOnline),

  vpnConnect: (id) => ipcRenderer.invoke('vpn:connect', id),
  vpnDisconnect: () => ipcRenderer.invoke('vpn:disconnect'),
  vpnResume: () => ipcRenderer.invoke('vpn:resume'),
  vpnSendCredentials: (profileId, username, password, remember) =>
    ipcRenderer.invoke('vpn:sendCredentials', profileId, username, password, remember),
  vpnGetLog: () => ipcRenderer.invoke('vpn:getLog'),
  vpnGetState: () => ipcRenderer.invoke('vpn:getState'),

  copyText: (text) => ipcRenderer.invoke('clipboard:copy', text),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  onState: (cb) => on('state:changed', cb),
  onLog: (cb) => on('log:changed', cb),
  onNeedPassword: (cb) => on('vpn:need-password', cb),
  onToast: (cb) => on('toast', cb),
  onProfilesChanged: (cb) => on('profiles:changed', cb),
  onUsersChanged: (cb) => on('users:changed', cb),
  onSettingsChanged: (cb) => on('settings:changed', cb)
});
