'use strict';

// Integration test for the VpnEngine.
// Verifies the "prompt for credentials first, then spawn" flow and, when the
// OpenVPN interactive service is running, that openvpn is started through it
// and its management interface is reachable. The test remote is unreachable,
// so the connection never reaches CONNECTED.

const { app } = require('electron');
const fs = require('fs');
const path = require('path');

app.whenReady().then(async () => {
  const { VpnEngine } = require('../src/vpn/engine');
  const { parseConfig } = require('../src/vpn/parser');
  const engine = new VpnEngine();

  const states = [];
  const logs = [];
  engine.on('state', (s) => {
    states.push(s.level);
  });
  engine.on('log', (e) => {
    logs.push(e.message);
  });

  const raw = [
    'dev tun',
    'remote 10.255.255.1 1194',
    'proto udp',
    'connect-retry 1',
    'connect-retry-max 1',
    'auth-user-pass',
    'pull',
    'tls-client',
    'peer-fingerprint 00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00'
  ].join('\n');
  const parsed = parseConfig(raw);
  const profile = { id: 'engine-test', name: 'Synthetic', config: parsed.config };

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

  let needPassword = false;
  engine.once('need-password', () => {
    needPassword = true;
  });

  const connectPromise = engine.connect(profile).catch((err) => err.message);
  await new Promise((r) => setTimeout(r, 500));
  check('need-password emitted', needPassword);
  check('waiting for user input', engine.getState().level === 'LEVEL_WAITING_FOR_USER_INPUT', engine.getState().level);
  check('no process spawned yet', !engine.servicePid && !engine.tempDir);

  engine.setPendingCredentials('engine-test', 'dummy', 'dummy');
  const outcome = await connectPromise;
  await new Promise((r) => setTimeout(r, 3000));

  if (outcome === 'interactive_service_not_running') {
    check('service not running handled cleanly', engine.getState().level === 'LEVEL_NOTCONNECTED', engine.getState().level);
    check('temp dir cleaned', !engine.tempDir);
  } else {
    check('connect() resolved', outcome === undefined, String(outcome));
    check('connecting state reached', states.includes('LEVEL_CONNECTING_NO_SERVER_REPLY_YET'), states.join(','));
    check('log lines received', logs.length > 0, logs.length);
    check('no bogus connected state', !states.includes('LEVEL_CONNECTED'));
  }

  engine.disconnect();
  await new Promise((r) => setTimeout(r, 5000));
  check('disconnected state reached', engine.getState().level === 'LEVEL_NOTCONNECTED', engine.getState().level);
  check('temp dir cleaned', !engine.tempDir);

  const failed = results.filter((r) => !r.ok);
  console.log(failed.length ? '\nENGINE TEST FAIL' : '\nENGINE TEST PASS');
  app.exit(failed.length ? 1 : 0);
});
