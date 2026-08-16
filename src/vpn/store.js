'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const crypto = require('crypto');

const DEFAULTS = {
  profiles: [],
  users: {},
  profileOrder: [],
  lastProfileUuid: null,
  settings: {
    autoConnect: false,
    screenOffPause: false,
    fullTunnel: false,
    notify: true,
    debugMode: false,
    language: 'en',
    experimentalTheme: '',
    lightTheme: false,
    accentColor: '#FFFFFF',
    customColor: '#FF0000',
    statusAnim: 'pulse',
    profileAnim: 'pulse',
    animSync: true
  }
};

let state = null;
let filePath = null;

function uuid() {
  return crypto.randomUUID();
}

function ensureFile() {
  if (!filePath) {
    filePath = path.join(app.getPath('userData'), 'state.json');
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(DEFAULTS, null, 2), 'utf8');
  }
}

function save() {
  if (!filePath) return;
  try {
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {
    console.error('store save failed:', e);
  }
}

function load() {
  ensureFile();
  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    state = {
      profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
      users: parsed.users && typeof parsed.users === 'object' ? parsed.users : {},
      profileOrder: Array.isArray(parsed.profileOrder) ? parsed.profileOrder : [],
      lastProfileUuid: parsed.lastProfileUuid || null,
      settings: Object.assign({}, DEFAULTS.settings, parsed.settings || {})
    };
  } catch (e) {
    state = JSON.parse(JSON.stringify(DEFAULTS));
    save();
  }
  return state;
}

function get() {
  if (!state) load();
  return state;
}

function getSettings() {
  return get().settings;
}

function setSettings(patch) {
  const s = get().settings;
  Object.assign(s, patch);
  save();
  return s;
}

function getProfiles() {
  const s = get();
  const byId = {};
  for (const p of s.profiles) byId[p.id] = p;
  const ordered = s.profileOrder.filter((id) => byId[id]);
  const missing = s.profiles.filter((p) => !ordered.includes(p.id));
  return ordered.map((id) => byId[id]).concat(missing);
}

function getProfile(id) {
  return get().profiles.find((p) => p.id === id) || null;
}

function addProfile(profile) {
  const s = get();
  const entry = Object.assign(
    {
      id: uuid(),
      name: '',
      fileName: '',
      remote: null,
      proto: null,
      port: null,
      needAuth: false,
      username: '',
      password: '',
      config: '',
      addedAt: Date.now()
    },
    profile
  );
  s.profiles.push(entry);
  if (!s.profileOrder.includes(entry.id)) s.profileOrder.push(entry.id);
  save();
  return entry;
}

function updateProfile(id, patch) {
  const p = get().profiles.find((x) => x.id === id);
  if (!p) return null;
  Object.assign(p, patch);
  save();
  return p;
}

function removeProfile(id) {
  const s = get();
  const idx = s.profiles.findIndex((p) => p.id === id);
  if (idx >= 0) {
    s.profiles.splice(idx, 1);
    s.profileOrder = s.profileOrder.filter((x) => x !== id);
    if (s.lastProfileUuid === id) s.lastProfileUuid = null;
    save();
    return true;
  }
  return false;
}

function uniqueProfileName(base) {
  const names = new Set(get().profiles.map((p) => p.name));
  if (!names.has(base)) return base;
  let i = 2;
  while (names.has(`${base} (${i})`)) i++;
  return `${base} (${i})`;
}

function setProfileOrder(list) {
  get().profileOrder = list;
  save();
}

function getUsers() {
  return Object.entries(get().users)
    .map(([login, password]) => ({ login, password }))
    .sort((a, b) => a.login.localeCompare(b.login));
}

function getUserLogins() {
  return getUsers().map((u) => u.login);
}

function userPassword(login) {
  const u = get().users;
  return Object.prototype.hasOwnProperty.call(u, login) ? u[login] : null;
}

function uniqueUserName(base) {
  const names = new Set(getUserLogins());
  if (!names.has(base)) return base;
  let i = 2;
  while (names.has(`${base} (${i})`)) i++;
  return `${base} (${i})`;
}

function saveUser(login, password) {
  get().users[login] = password;
  save();
}

function deleteUser(login) {
  delete get().users[login];
  for (const p of get().profiles) {
    if (p.username === login) {
      p.username = '';
      p.password = '';
    }
  }
  save();
}

function clearUsers() {
  get().users = {};
  for (const p of get().profiles) {
    p.username = '';
    p.password = '';
  }
  save();
}

function resetAll() {
  state = JSON.parse(JSON.stringify(DEFAULTS));
  save();
  return state;
}

module.exports = {
  get,
  getSettings,
  setSettings,
  getProfiles,
  getProfile,
  addProfile,
  updateProfile,
  removeProfile,
  uniqueProfileName,
  setProfileOrder,
  getUsers,
  getUserLogins,
  userPassword,
  uniqueUserName,
  saveUser,
  deleteUser,
  clearUsers,
  resetAll
};
