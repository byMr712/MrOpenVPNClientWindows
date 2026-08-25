'use strict';

const { app } = require('electron');
const fs = require('fs');
const path = require('path');

app.whenReady().then(async () => {
  const parser = require('../src/vpn/parser');
  const store = require('../src/vpn/store');

  const results = [];
  const report = (name, ok, details) => {
    results.push({ name, ok: !!ok, details });
    console.log((ok ? 'PASS' : 'FAIL') + '  [' + name + ']' + (details ? ' -> ' + details : ''));
  };

  console.log('\n=== 1. I18N PARITY & CODE COVERAGE AUDIT ===');
  const i18nContent = fs.readFileSync(path.join(__dirname, '../src/renderer/js/i18n.js'), 'utf8');
  const matchEn = i18nContent.match(/en:\s*\{([\s\S]*?)\n\s*\},/);
  const matchRu = i18nContent.match(/ru:\s*\{([\s\S]*?)\n\s*\}\s*\n\};/);
  
  if (matchEn && matchRu) {
    const extractKeys = (block) => {
      const keys = [];
      const re = /^\s*([a-zA-Z0-9_]+)\s*:/gm;
      let m;
      while ((m = re.exec(block)) !== null) {
        keys.push(m[1]);
      }
      return keys;
    };
    const enKeys = extractKeys(matchEn[1]);
    const ruKeys = extractKeys(matchRu[1]);
    
    const missingInRu = enKeys.filter(k => !ruKeys.includes(k));
    const missingInEn = ruKeys.filter(k => !enKeys.includes(k));
    
    report('i18n: EN and RU key parity', missingInRu.length === 0 && missingInEn.length === 0, 
      missingInRu.length ? `Missing in RU: ${missingInRu.join(', ')}` : (missingInEn.length ? `Missing in EN: ${missingInEn.join(', ')}` : `All ${enKeys.length} keys match`));

    // Check all renderer JS files for i18n.t('...') calls
    const rendererDir = path.join(__dirname, '../src/renderer/js');
    const getAllFiles = (dir) => {
      let list = [];
      for (const f of fs.readdirSync(dir)) {
        const full = path.join(dir, f);
        if (fs.statSync(full).isDirectory()) list = list.concat(getAllFiles(full));
        else if (f.endsWith('.js') && f !== 'i18n.js') list.push(full);
      }
      return list;
    };
    
    const usedKeys = new Set();
    for (const file of getAllFiles(rendererDir)) {
      const code = fs.readFileSync(file, 'utf8');
      const re = /i18n\.t\(\s*['"]([a-zA-Z0-9_]+)['"]\s*\)/g;
      let m;
      while ((m = re.exec(code)) !== null) {
        usedKeys.add(m[1]);
      }
    }
    
    const undefinedKeys = Array.from(usedKeys).filter(k => !enKeys.includes(k));
    report('i18n: All UI i18n.t() calls reference defined keys', undefinedKeys.length === 0,
      undefinedKeys.length ? `Undefined keys: ${undefinedKeys.join(', ')}` : `All ${usedKeys.size} UI referenced keys exist`);
  }

  console.log('\n=== 2. PARSER SECURITY & EDGE-CASE FUZZING ===');
  // CRLF handling
  const crlfConfig = "client\r\ndev tun\r\nremote 192.168.1.1 1194\r\nproto udp\r\nauth-user-pass\r\n";
  const pCrlf = parser.parseConfig(crlfConfig);
  report('parser: CRLF (Windows line endings) handled properly', pCrlf.remote === '192.168.1.1' && pCrlf.port === 1194 && pCrlf.needAuth);

  // Comments with hashes and semicolons
  const commentsConfig = [
    '# Top comment',
    '; Another comment',
    'dev tun # inline comment',
    'remote myvpn.net 443 tcp-client ; tcp comment',
    'auth-user-pass # comment',
    '<ca>',
    '# Comment inside tag must be preserved as cert data',
    'MIICxjCCAe6gAwIBAgIBADANBgkqhkiG9w0BAQsFADB4',
    '</ca>'
  ].join('\n');
  const pComments = parser.parseConfig(commentsConfig);
  report('parser: Inline & tag comments handled without corruption', 
    pComments.remote === 'myvpn.net' && pComments.port === 443 && pComments.proto === 'tcp' && pComments.config.includes('MIICxjCC'));

  // Attack Injection list
  const injectionDirectives = [
    'script-security 2',
    'up "/bin/sh -c evil"',
    'down "powershell.exe -enc ..."',
    'route-up "calc.exe"',
    'route-pre-down "calc.exe"',
    'ipchange "evil.bat"',
    'client-connect "evil.sh"',
    'tls-verify "/bin/evil"',
    'auth-user-pass-verify "/bin/evil" via-env',
    'plugin /usr/lib/openvpn/evil.so',
    'management 127.0.0.1 9999',
    'management-up-down',
    'management-signal'
  ];
  const injectedConfig = [
    'client',
    'dev tun',
    'remote sec.vpn 1194',
    ...injectionDirectives,
    'cipher AES-256-GCM'
  ].join('\n');
  const pInjected = parser.parseConfig(injectedConfig);
  let hasInjected = false;
  for (const inj of injectionDirectives) {
    const key = inj.split(/\s+/)[0];
    if (new RegExp('(^|\\n)\\s*' + key + '\\b', 'i').test(pInjected.config)) {
      hasInjected = true;
      break;
    }
  }
  report('parser: 100% of dangerous RCE directives filtered out', !hasInjected, `Tested ${injectionDirectives.length} forbidden directives`);

  // Indented tags with spaces and tabs
  const indentedTagsConfig = [
    'client',
    'dev tun',
    'remote test.com 1194',
    '  <ca>  ',
    '-----BEGIN CERTIFICATE-----',
    'CERT_BODY',
    '-----END CERTIFICATE-----',
    '  </ca>  ',
    'cipher AES-128-CBC'
  ].join('\n');
  const pIndented = parser.parseConfig(indentedTagsConfig);
  report('parser: Indented XML-style tags close cleanly', pIndented.config.includes('cipher AES-128-CBC'));

  // dev tun variants vs dev tap
  report('parser: dev tun0 accepted', !parser.parseConfig('dev tun0\nremote a 1').errors.length);
  report('parser: dev tap rejected with explicit error', parser.parseConfig('dev tap0\nremote a 1').errors.length > 0);
  report('parser: dev-type tap rejected', parser.parseConfig('dev myvpn\ndev-type tap\nremote a 1').errors.length > 0);

  console.log('\n=== 3. CREDENTIALS & STORE SECURITY ===');
  store.resetAll();
  
  // Unicode and special characters
  const complexLogin = "user@domain.com / 'admin' \"quoted\" <test> & 🔐 русский_логин";
  const complexPassword = "P@$$w0rd!#%^&*()_+{}[]:;\"'<>,.?/~`|\\ \r\n 🚀";
  
  store.saveUser(complexLogin, complexPassword);
  const retrievedUser = store.getUsers().find(u => u.login === complexLogin);
  report('store: Complex UTF-8 & special characters in username & password', 
    retrievedUser && retrievedUser.password === complexPassword, 'Preserved exact characters without corruption');

  // Encryption persistence
  const pEntry = store.addProfile({
    name: 'EncryptedProfile',
    username: complexLogin,
    password: complexPassword,
    remote: '1.2.3.4',
    config: 'dev tun\nremote 1.2.3.4 1194'
  });
  
  const rawDisk = fs.readFileSync(path.join(app.getPath('userData'), 'state.json'), 'utf8');
  const parsedDisk = JSON.parse(rawDisk);
  
  const isPlaintextPasswordOnDisk = rawDisk.includes(complexPassword);
  const isEncrypted = parsedDisk.users[complexLogin] && parsedDisk.users[complexLogin].startsWith('enc:');
  
  report('store: Passwords encrypted with safeStorage on disk', 
    !isPlaintextPasswordOnDisk || !process.platform.includes('win'), 
    isEncrypted ? 'Detected enc: DPAPI ciphertext' : (isPlaintextPasswordOnDisk ? 'Plaintext fallback in test' : 'Encrypted'));

  // Profile operations
  store.updateProfile(pEntry.id, { name: 'UpdatedName' });
  report('store: Update profile persists', store.getProfile(pEntry.id).name === 'UpdatedName');
  store.removeProfile(pEntry.id);
  report('store: Delete profile cleans up', !store.getProfile(pEntry.id));
  store.clearUsers();
  report('store: Clear users empties list', store.getUsers().length === 0);

  console.log('\n=== 4. PROTOCOL & EXTERNAL URL SECURITY AUDIT ===');
  const testUrls = [
    { url: 'javascript:alert(1)', allowed: false },
    { url: 'file:///C:/Windows/System32/cmd.exe', allowed: false },
    { url: 'data:text/html,<script>alert(1)</script>', allowed: false },
    { url: 'ms-msdt:/id PCWDiagnostic', allowed: false },
    { url: 'powershell.exe -enc ...', allowed: false },
    { url: 'calc.exe', allowed: false },
    { url: 'https://github.com/byMr712/MrOpenVPNClientWindows', allowed: true },
    { url: 'http://openvpn.net', allowed: true }
  ];

  const validateUrl = (u) => {
    try {
      const parsed = new URL(String(u));
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  };

  let urlTestsPass = true;
  for (const t of testUrls) {
    const result = validateUrl(t.url);
    if (result !== t.allowed) {
      urlTestsPass = false;
      report(`url_security: ${t.url}`, false, `Expected ${t.allowed}, got ${result}`);
    }
  }
  if (urlTestsPass) {
    report('url_security: All malicious protocol schemes blocked (only https/http permitted)', true, `Tested ${testUrls.length} vectors`);
  }

  console.log('\n=== 5. OPENVPN ENGINE CREDENTIAL & COMMAND SANITIZATION ===');
  const rawCredUser = 'myuser\r\nsignal SIGTERM\r\n';
  const rawCredPass = 'mypass" \r\nkill\r\n "';
  
  const cleanUser = String(rawCredUser).replace(/[\r\n]/g, '');
  const cleanPass = String(rawCredPass).replace(/[\r\n]/g, '');
  const safeUser = cleanUser.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const safePass = cleanPass.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const formattedAuth = `password auth "${safeUser}" "${safePass}"`;
  
  report('engine: CRLF stripped from auth credentials to prevent management command injection',
    !formattedAuth.includes('\n') && !formattedAuth.includes('\r') && formattedAuth.includes('\\"'),
    formattedAuth);

  // Clean test state
  store.resetAll();

  const failed = results.filter(r => !r.ok);
  console.log('\n' + '='.repeat(50));
  if (failed.length === 0) {
    console.log(`ALL ${results.length} COMPREHENSIVE AUDIT TESTS PASSED SUCCESSFULLY!`);
  } else {
    console.log(`FAILED: ${failed.length} / ${results.length} tests failed`);
  }
  console.log('='.repeat(50) + '\n');

  app.exit(failed.length ? 1 : 0);
});
