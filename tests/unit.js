'use strict';

const { app } = require('electron');

app.whenReady().then(() => {
  const parser = require('../src/vpn/parser');
  const store = require('../src/vpn/store');

  const results = [];
  const check = (name, cond, extra) => {
    results.push({ name, ok: !!cond });
    console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '  -> ' + extra : ''));
  };

  // ---- parser ----
  const sample = [
    'client',
    'dev tun',
    'proto udp',
    'remote vpn.example.com 1194',
    'auth-user-pass login.txt',
    'ca ca.crt',
    'cipher AES-256-GCM',
    'resolv-retry infinite'
  ].join('\n');

  const parsed = parser.parseConfig(sample);
  check('parser: dev tun accepted', !parsed.errors.length, JSON.stringify(parsed.errors));
  check('parser: remote extracted', parsed.remote === 'vpn.example.com', parsed.remote);
  check('parser: port extracted', parsed.port === 1194, parsed.port);
  check('parser: proto extracted', parsed.proto === 'udp', parsed.proto);
  check('parser: needAuth detected', parsed.needAuth === true);
  check(
    'parser: auth-user-pass rewritten to plain',
    /(^|\n)\s*auth-user-pass\s*(\n|$)/.test(parsed.config) && !/^auth-user-pass[ \t]+\S/m.test(parsed.config),
    JSON.stringify(parsed.config)
  );

  const tapParsed = parser.parseConfig('dev tap\nremote x 1');
  check(
    'parser: dev tap rejected',
    tapParsed.errors.length === 1 && /tun/i.test(tapParsed.errors[0]),
    JSON.stringify(tapParsed.errors)
  );

  const noIf = parser.parseConfig('dev tun\nremote a.b 1194 tcp4-client\nauth-user-pass');
  check(
    'parser: adds ifconfig for tun without ifconfig',
    noIf.ifconfigAdded === true && /ifconfig 10\.8\.0\.2 10\.8\.0\.1/.test(noIf.config)
  );

  const withIf = parser.parseConfig('dev tun\nifconfig 10.5.5.2 10.5.5.1\nremote a.b 1194');
  check('parser: keeps existing ifconfig', withIf.ifconfigAdded === false && /ifconfig 10\.5\.5\.2/.test(withIf.config));

  // ---- store ----
  store.resetAll();
  check('store: reset gives defaults', store.getSettings().language === 'en');

  const p1 = store.addProfile({ name: store.uniqueProfileName('Test'), remote: 'a.b', config: 'dev tun' });
  const p2 = store.addProfile({ name: store.uniqueProfileName('Test'), remote: 'c.d', config: 'dev tun' });
  check('store: unique names', p1.name === 'Test' && p2.name === 'Test (2)', p2.name);

  check('store: getProfile', store.getProfile(p1.id).id === p1.id);
  store.updateProfile(p1.id, { username: 'user1' });
  check('store: updateProfile', store.getProfile(p1.id).username === 'user1');

  store.saveUser('alice', 'pw1');
  store.saveUser('bob', 'pw2');
  check('store: users saved', store.getUsers().length === 2);
  store.saveUser('alice', 'pw1');
  check('store: users no dup', store.getUsers().length === 2);

  store.setSettings({ language: 'ru' });
  check('store: settings persist', store.getSettings().language === 'ru');

  store.removeProfile(p1.id);
  check('store: removeProfile', !store.getProfile(p1.id));

  const store2 = require('../src/vpn/store');
  check('store: persisted to disk', store2.getSettings().language === 'ru' && store2.getProfile(p2.id));

  store.resetAll();

  const failed = results.filter((r) => !r.ok);
  console.log(failed.length ? `\n${failed.length} FAILURES` : '\nALL TESTS PASS');
  app.exit(failed.length ? 1 : 0);
});
