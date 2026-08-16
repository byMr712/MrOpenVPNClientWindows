'use strict';

// Integration test for the VpnEngine: starts the real openvpn.exe, talks to
// its management interface, sends credentials and disconnects.
// Note: this test runs without administrator rights, so it verifies the
// management protocol, not the actual network adapter setup.

const { app } = require('electron');
const fs = require('fs');
const path = require('path');

app.whenReady().then(async () => {
  const { VpnEngine } = require('../src/vpn/engine');
  const { parseConfig } = require('../src/vpn/parser');
  const engine = new VpnEngine();
  engine._adminCache = true;

  const states = [];
  const logs = [];
  engine.on('state', (s) => {
    states.push(s.level);
  });
  engine.on('log', (e) => {
    logs.push(e.message);
  });

  const desktop = 'C:/Users/' + process.env.USERNAME + '/Desktop/TheHome.ovpn';
  let profile;
  if (fs.existsSync(desktop)) {
    const parsed = parseConfig(fs.readFileSync(desktop, 'utf8'));
    profile = { id: 'engine-test', name: 'TheHome', config: parsed.config };
  } else {
    profile = {
      id: 'engine-test',
      name: 'Synthetic',
      config: [
        'dev tun',
        'remote 10.255.255.1 1194',
        'proto udp',
        'connect-retry 1',
        'connect-retry-max 1',
        'auth-user-pass'
      ].join('\n')
    };
  }

  const ovpnPath = engine.openVpnPath();
  const results = [];
  const check = (n, c, x) => {
    results.push({ n, ok: !!c });
    console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (x !== undefined ? '  -> ' + x : ''));
  };

  if (!ovpnPath) {
    check('openvpn binary found', false);
    console.log('\nENGINE TEST FAIL');
    app.exit(1);
    return;
  }
  check('openvpn binary found', true, ovpnPath);

  engine.spawnOpenVpn(ovpnPath, profile);
  await new Promise((r) => setTimeout(r, 3000));
  check('management asks for password', states.includes('LEVEL_WAITING_FOR_USER_INPUT'), states.join(','));

  engine.sendAuth('dummy', 'dummy');
  await new Promise((r) => setTimeout(r, 6000));
  check('reached connecting state', states.includes('LEVEL_CONNECTING_NO_SERVER_REPLY_YET'), states.join(','));
  check('log lines received', logs.length > 0, logs.length);
  check('no bogus connected state', !states.includes('LEVEL_CONNECTED'));

  engine.disconnect();
  await new Promise((r) => setTimeout(r, 4000));
  check('disconnected state reached', engine.getState().level === 'LEVEL_NOTCONNECTED', engine.getState().level);
  check('temp dir cleaned', !engine.tempDir);

  const failed = results.filter((r) => !r.ok);
  console.log(failed.length ? '\nENGINE TEST FAIL' : '\nENGINE TEST PASS');
  app.exit(failed.length ? 1 : 0);
});
