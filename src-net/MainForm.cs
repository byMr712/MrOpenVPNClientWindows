using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using Microsoft.Win32;

namespace MrOpenVPNClient;

public class MainForm : Form
{
    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
    private const int SW_RESTORE = 9;

    private readonly WebView2 _webView;
    private readonly VpnStore _store;
    private readonly VpnEngine _engine;
    private readonly NotifyIcon _trayIcon;
    private readonly ContextMenuStrip _trayMenu;
    private bool _quitting = false;
    private string? _wasConnectedUuid;

    public MainForm()
    {
        _store = new VpnStore();
        _engine = new VpnEngine(_store);

        Text = "MrOpenVPN Client For Windows";
        Size = new Size(400, 740);
        MinimumSize = new Size(360, 560);
        BackColor = Color.Black;
        ShowIcon = true;

        Icon? appIcon = null;
        try
        {
            var iconPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "assets", "icon.ico");
            if (!File.Exists(iconPath))
            {
                iconPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "..", "assets", "icon.ico");
            }
            if (File.Exists(iconPath))
            {
                appIcon = new Icon(iconPath);
            }
        }
        catch { }

        if (appIcon == null)
        {
            try
            {
                var exePath = Environment.ProcessPath ?? Application.ExecutablePath;
                if (!string.IsNullOrEmpty(exePath) && File.Exists(exePath))
                {
                    appIcon = Icon.ExtractAssociatedIcon(exePath);
                }
            }
            catch { }
        }

        if (appIcon != null)
        {
            Icon = appIcon;
        }

        // Enable Windows dark title bar
        if (OperatingSystem.IsWindowsVersionAtLeast(10, 0, 17763))
        {
            int darkMode = 1;
            DwmSetWindowAttribute(Handle, 20, ref darkMode, sizeof(int));
        }

        // Initialize WebView2
        _webView = new WebView2
        {
            Dock = DockStyle.Fill,
            DefaultBackgroundColor = Color.Black
        };
        Controls.Add(_webView);

        // Tray Setup
        _trayMenu = new ContextMenuStrip();
        _trayIcon = new NotifyIcon
        {
            Icon = Icon ?? SystemIcons.Application,
            Text = "MrOpenVPN Client",
            Visible = true,
            ContextMenuStrip = _trayMenu
        };

        _trayIcon.Click += (s, e) =>
        {
            if (e is MouseEventArgs me && me.Button == MouseButtons.Right) return;
            ToggleShowWindow();
        };

        RefreshTrayMenu();

        // Wire Engine Events
        _engine.StateChanged += state =>
        {
            if (state.Level == VpnEngine.LEVEL_CONNECTED)
            {
                _wasConnectedUuid = state.ProfileUuid;
                ShowNotification("Connected");
            }
            else if (state.Level is VpnEngine.LEVEL_NOTCONNECTED or VpnEngine.LEVEL_AUTH_FAILED)
            {
                ShowNotification("Disconnected");
            }
            SendIpcEvent("state:changed", state);
            Invoke(RefreshTrayMenu);
        };

        _engine.LogReceived += entry =>
        {
            SendIpcEvent("log:changed", entry);
        };

        _engine.NeedPassword += (profileId, kind) =>
        {
            SendIpcEvent("vpn:need-password", new { profileId, kind });
        };

        // System Events
        SystemEvents.SessionSwitch += (s, e) =>
        {
            if (_store.GetSettings().ScreenOffPause)
            {
                if (e.Reason == SessionSwitchReason.SessionLock && _engine.IsActive())
                {
                    _engine.Pause();
                }
                else if (e.Reason == SessionSwitchReason.SessionUnlock && _engine.Level == VpnEngine.LEVEL_VPNPAUSED)
                {
                    _engine.Resume();
                }
            }
        };

        SystemEvents.PowerModeChanged += (s, e) =>
        {
            if (_store.GetSettings().ScreenOffPause)
            {
                if (e.Mode == PowerModes.Suspend && _engine.IsActive())
                {
                    _engine.Pause();
                }
                else if (e.Mode == PowerModes.Resume && _engine.Level == VpnEngine.LEVEL_VPNPAUSED)
                {
                    _engine.Resume();
                }
            }
        };

        _ = InitWebViewAsync();
    }

    private async Task InitWebViewAsync()
    {
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        var userDataDir = Path.Combine(appData, "mropenvpn-client-windows", "webview2");

        var env = await CoreWebView2Environment.CreateAsync(null, userDataDir);
        await _webView.EnsureCoreWebView2Async(env);

        // Security settings
        _webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
        _webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
        _webView.CoreWebView2.Settings.AreDevToolsEnabled = _store.GetSettings().DebugMode;

        // Block unwanted external navigation
        _webView.CoreWebView2.NavigationStarting += (s, e) =>
        {
            if (!e.Uri.StartsWith("https://app.local/", StringComparison.OrdinalIgnoreCase))
            {
                e.Cancel = true;
            }
        };

        _webView.CoreWebView2.NewWindowRequested += (s, e) =>
        {
            e.Handled = true;
        };

        // Map web directory to virtual host https://app.local/
        var webDir = FindWebDirectory();
        _webView.CoreWebView2.SetVirtualHostNameToFolderMapping("app.local", webDir, CoreWebView2HostResourceAccessKind.Allow);

        // Inject window.api Bridge script
        var bridgeScript = GetBridgeScript();
        await _webView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(bridgeScript);

        _webView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;

        _webView.CoreWebView2.DOMContentLoaded += (s, e) =>
        {
            if (_store.GetSettings().AutoConnect)
            {
                AutoConnect();
            }
        };

        _webView.CoreWebView2.Navigate("https://app.local/index.html");
    }

    private static string FindWebDirectory()
    {
        var baseDir = AppDomain.CurrentDomain.BaseDirectory;
        var p = Path.Combine(baseDir, "renderer");
        if (Directory.Exists(p)) return p;
        var up = Path.Combine(baseDir, "..", "..", "..", "..", "src", "renderer");
        if (Directory.Exists(up)) return Path.GetFullPath(up);
        return baseDir;
    }

    public void RestoreAndShowWindow()
    {
        if (InvokeRequired)
        {
            BeginInvoke(RestoreAndShowWindow);
            return;
        }

        Show();
        if (WindowState == FormWindowState.Minimized)
        {
            WindowState = FormWindowState.Normal;
        }
        ShowWindowAsync(Handle, SW_RESTORE);
        ShowInTaskbar = true;
        BringToFront();
        Activate();
        SetForegroundWindow(Handle);
    }

    private void ToggleShowWindow()
    {
        if (Visible && WindowState != FormWindowState.Minimized)
        {
            Hide();
        }
        else
        {
            RestoreAndShowWindow();
        }
    }

    protected override void WndProc(ref Message m)
    {
        if (m.Msg == (int)Program.WM_SHOW_MROPENVPN)
        {
            RestoreAndShowWindow();
            return;
        }
        base.WndProc(ref m);
    }

    private void RefreshTrayMenu()
    {
        _trayMenu.Items.Clear();

        var titleItem = new ToolStripMenuItem("MrOpenVPN Client") { Enabled = false };
        _trayMenu.Items.Add(titleItem);
        _trayMenu.Items.Add(new ToolStripSeparator());

        bool active = _engine.IsActive();
        var profiles = _store.GetProfiles();
        var connectItem = new ToolStripMenuItem(active ? "Disconnect" : "Connect")
        {
            Enabled = profiles.Count > 0
        };
        connectItem.Click += (s, e) =>
        {
            if (active)
            {
                _wasConnectedUuid = null;
                _engine.Disconnect();
            }
            else
            {
                var target = _store.GetProfile(_store.GetSettings().LastProfileUuid ?? "") ?? profiles.FirstOrDefault();
                if (target != null) _ = ConnectProfileAsync(target);
            }
        };
        _trayMenu.Items.Add(connectItem);
        _trayMenu.Items.Add(new ToolStripSeparator());

        var showItem = new ToolStripMenuItem("Show");
        showItem.Click += (s, e) => ToggleShowWindow();
        _trayMenu.Items.Add(showItem);

        var quitItem = new ToolStripMenuItem("Quit");
        quitItem.Click += (s, e) =>
        {
            _quitting = true;
            _engine.ForceStop();
            _trayIcon.Visible = false;
            Application.Exit();
        };
        _trayMenu.Items.Add(quitItem);

        var levelText = _engine.Level.Replace("LEVEL_", "").ToLowerInvariant();
        _trayIcon.Text = $"MrOpenVPN Client - {levelText}";
    }

    private void ShowNotification(string message)
    {
        if (!_store.GetSettings().Notify) return;
        _trayIcon.ShowBalloonTip(3000, "MrOpenVPN Client", message, ToolTipIcon.Info);
    }

    private async Task<bool> ConnectProfileAsync(VpnProfile profile)
    {
        bool serviceOk = await ServiceHelper.EnsureInteractiveServiceAsync();
        if (!serviceOk)
        {
            throw new InvalidOperationException("interactive_service_not_running");
        }

        bool result = await _engine.ConnectAsync(profile);
        if (result)
        {
            _store.SetSettings(new Dictionary<string, JsonElement>
            {
                ["lastProfileUuid"] = JsonDocument.Parse($"\"{profile.Id}\"").RootElement
            });
            RefreshTrayMenu();
        }
        return result;
    }

    private void AutoConnect()
    {
        var settings = _store.GetSettings();
        if (!settings.AutoConnect) return;

        var lastId = settings.LastProfileUuid ?? _store.GetProfiles().FirstOrDefault()?.Id;
        if (lastId != null)
        {
            var p = _store.GetProfile(lastId);
            if (p != null) _ = ConnectProfileAsync(p);
        }
    }

    private async void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        try
        {
            var json = e.WebMessageAsJson;
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            if (!root.TryGetProperty("id", out var idProp) || !root.TryGetProperty("action", out var actionProp))
                return;

            int id = idProp.GetInt32();
            string action = actionProp.GetString() ?? "";
            var args = root.TryGetProperty("args", out var argsProp) ? argsProp : default;

            object? result = null;
            string? error = null;

            try
            {
                result = await HandleIpcAsync(action, args);
            }
            catch (Exception ex)
            {
                error = ex.Message;
            }

            SendIpcResponse(id, result, error);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"IPC error: {ex.Message}");
        }
    }

    private async Task<object?> HandleIpcAsync(string action, JsonElement args)
    {
        switch (action)
        {
            case "app:init":
                return GetPublicState();

            case "window:setBg":
                if (args.ValueKind == JsonValueKind.Array && args.GetArrayLength() > 0)
                {
                    var colorStr = args[0].GetString();
                    if (!string.IsNullOrEmpty(colorStr) && colorStr.StartsWith('#') && colorStr.Length == 7)
                    {
                        Invoke(() =>
                        {
                            try { BackColor = ColorTranslator.FromHtml(colorStr); } catch { }
                        });
                    }
                }
                return true;

            case "settings:set":
                if (args.ValueKind == JsonValueKind.Array && args.GetArrayLength() > 0)
                {
                    var dict = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(args[0].GetRawText()) ?? [];
                    var s = _store.SetSettings(dict);
                    SendIpcEvent("settings:changed", s);
                    Invoke(RefreshTrayMenu);
                    return s;
                }
                return _store.GetSettings();

            case "profiles:import":
                return await Task.Run(() =>
                {
                    string? chosenFile = null;
                    Invoke(() =>
                    {
                        using var ofd = new OpenFileDialog
                        {
                            Title = "Import .ovpn profile",
                            Filter = "OpenVPN profiles (*.ovpn;*.conf)|*.ovpn;*.conf|All files (*.*)|*.*"
                        };
                        if (ofd.ShowDialog(this) == DialogResult.OK)
                        {
                            chosenFile = ofd.FileName;
                        }
                    });

                    if (chosenFile == null) return (object)new { canceled = true };

                    string text = File.ReadAllText(chosenFile, Encoding.UTF8);
                    var parsed = ConfigParser.ParseConfig(text);
                    if (parsed.Errors.Count > 0)
                    {
                        return new { error = new { message = parsed.Errors[0] } };
                    }

                    var baseName = Path.GetFileNameWithoutExtension(chosenFile);
                    var name = _store.UniqueProfileName(string.IsNullOrEmpty(baseName) ? "Imported profile" : baseName);
                    var profile = _store.AddProfile(new VpnProfile
                    {
                        Name = name,
                        FileName = Path.GetFileName(chosenFile),
                        Remote = parsed.Remote,
                        Proto = parsed.Proto,
                        Port = parsed.Port,
                        NeedAuth = parsed.NeedAuth,
                        Config = parsed.Config
                    });

                    SendIpcEvent("profiles:changed", _store.GetProfiles().Select(ProfileDto.From).ToList());
                    return new { ok = true, profile = ProfileDto.From(profile) };
                });

            case "profiles:update":
                if (args.ValueKind == JsonValueKind.Array && args.GetArrayLength() >= 2)
                {
                    var id = args[0].GetString() ?? "";
                    var patch = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(args[1].GetRawText()) ?? [];
                    var p = _store.UpdateProfile(id, patch);
                    SendIpcEvent("profiles:changed", _store.GetProfiles().Select(ProfileDto.From).ToList());
                    return p != null ? ProfileDto.From(p) : null;
                }
                return null;

            case "profiles:delete":
                if (args.ValueKind == JsonValueKind.Array && args.GetArrayLength() > 0)
                {
                    var id = args[0].GetString() ?? "";
                    if (_engine.ProfileUuid == id)
                    {
                        _wasConnectedUuid = null;
                        _engine.Disconnect();
                    }
                    _store.RemoveProfile(id);
                    SendIpcEvent("profiles:changed", _store.GetProfiles().Select(ProfileDto.From).ToList());
                    Invoke(RefreshTrayMenu);
                    return true;
                }
                return false;

            case "users:add":
                if (args.ValueKind == JsonValueKind.Array && args.GetArrayLength() >= 2)
                {
                    var login = args[0].GetString() ?? "";
                    var password = args[1].GetString() ?? "";
                    var unique = _store.UniqueUserName(login);
                    _store.SaveUser(unique, password);
                    SendIpcEvent("users:changed", _store.GetUsers().Select(u => new UserDto { Login = u.Login, HasPassword = !string.IsNullOrEmpty(u.Password) }).ToList());
                    return new { ok = true, login = unique };
                }
                return null;

            case "users:getCredentials":
                if (args.ValueKind == JsonValueKind.Array && args.GetArrayLength() > 0)
                {
                    var login = args[0].GetString() ?? "";
                    var u = _store.GetUsers().FirstOrDefault(x => x.Login == login);
                    return u;
                }
                return null;

            case "users:delete":
                if (args.ValueKind == JsonValueKind.Array && args.GetArrayLength() > 0)
                {
                    var login = args[0].GetString() ?? "";
                    _store.DeleteUser(login);
                    SendIpcEvent("users:changed", _store.GetUsers().Select(u => new UserDto { Login = u.Login, HasPassword = !string.IsNullOrEmpty(u.Password) }).ToList());
                    SendIpcEvent("profiles:changed", _store.GetProfiles().Select(ProfileDto.From).ToList());
                    return true;
                }
                return false;

            case "users:clear":
                _store.ClearUsers();
                SendIpcEvent("users:changed", new List<UserDto>());
                SendIpcEvent("profiles:changed", _store.GetProfiles().Select(ProfileDto.From).ToList());
                return true;

            case "app:reset":
                _engine.ForceStop();
                _store.ResetAll();
                SendIpcEvent("settings:changed", _store.GetSettings());
                SendIpcEvent("profiles:changed", new List<ProfileDto>());
                SendIpcEvent("users:changed", new List<UserDto>());
                return true;

            case "app:online":
                if (args.ValueKind == JsonValueKind.Array && args.GetArrayLength() > 0)
                {
                    bool isOnline = args[0].GetBoolean();
                    if (!isOnline)
                    {
                        if (_engine.IsActive()) _wasConnectedUuid = _engine.ProfileUuid ?? _wasConnectedUuid;
                    }
                    else
                    {
                        if (_wasConnectedUuid != null)
                        {
                            if (_engine.Level == VpnEngine.LEVEL_VPNPAUSED)
                            {
                                _engine.Resume();
                            }
                            else if (!_engine.IsActive())
                            {
                                var p = _store.GetProfile(_wasConnectedUuid);
                                if (p != null) _ = Task.Run(async () => { await Task.Delay(1000); await ConnectProfileAsync(p); });
                            }
                        }
                    }
                }
                return true;

            case "vpn:connect":
                if (args.ValueKind == JsonValueKind.Array && args.GetArrayLength() > 0)
                {
                    var id = args[0].GetString() ?? "";
                    var p = _store.GetProfile(id);
                    if (p == null) return new { error = "profile_not_found" };
                    try
                    {
                        await ConnectProfileAsync(p);
                        return new { ok = true };
                    }
                    catch (Exception ex)
                    {
                        return new { error = ex.Message };
                    }
                }
                return new { error = "invalid_arguments" };

            case "service:status":
                return ServiceHelper.QueryService();

            case "service:uninstall":
                var script = ServiceHelper.GetScriptPath("uninstall-service.ps1");
                bool ok = await ServiceHelper.RunElevatedScriptAsync(script);
                return ok ? (object)new { ok = true } : new { error = "service_uninstall_failed" };

            case "vpn:disconnect":
                _wasConnectedUuid = null;
                _engine.Disconnect();
                return true;

            case "vpn:resume":
                _engine.Resume();
                return true;

            case "vpn:sendCredentials":
                if (args.ValueKind == JsonValueKind.Array && args.GetArrayLength() >= 3)
                {
                    var profId = args[0].GetString() ?? "";
                    var user = args[1].GetString() ?? "";
                    var pass = args[2].GetString() ?? "";

                    var p = _store.GetProfile(profId);
                    if (p != null)
                    {
                        _store.UpdateProfile(profId, new Dictionary<string, JsonElement>
                        {
                            ["username"] = JsonDocument.Parse($"\"{user}\"").RootElement,
                            ["password"] = JsonDocument.Parse($"\"{pass}\"").RootElement
                        });
                    }

                    if (!string.IsNullOrEmpty(user) && !string.IsNullOrEmpty(pass))
                    {
                        _store.SaveUser(user, pass);
                        SendIpcEvent("users:changed", _store.GetUsers().Select(u => new UserDto { Login = u.Login, HasPassword = !string.IsNullOrEmpty(u.Password) }).ToList());
                    }

                    _engine.SetPendingCredentials(profId, user, pass);
                    SendIpcEvent("profiles:changed", _store.GetProfiles().Select(ProfileDto.From).ToList());
                    return true;
                }
                return false;

            case "vpn:getLog":
                return _engine.GetLog();

            case "vpn:getState":
                return _engine.GetState();

            case "clipboard:copy":
                if (args.ValueKind == JsonValueKind.Array && args.GetArrayLength() > 0)
                {
                    var text = args[0].GetString() ?? "";
                    Invoke(() => { try { Clipboard.SetText(text); } catch { } });
                }
                return true;

            case "shell:openExternal":
                if (args.ValueKind == JsonValueKind.Array && args.GetArrayLength() > 0)
                {
                    var url = args[0].GetString() ?? "";
                    if (Uri.TryCreate(url, UriKind.Absolute, out var uri) && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps))
                    {
                        Process.Start(new ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true });
                        return true;
                    }
                }
                return false;

            case "app:quit":
                _quitting = true;
                _engine.ForceStop();
                Invoke(() =>
                {
                    _trayIcon.Visible = false;
                    Application.Exit();
                });
                return true;
        }

        return null;
    }

    private PublicState GetPublicState() => new()
    {
        Settings = _store.GetSettings(),
        Profiles = _store.GetProfiles().Select(ProfileDto.From).ToList(),
        Users = _store.GetUsers().Select(u => new UserDto { Login = u.Login, HasPassword = !string.IsNullOrEmpty(u.Password) }).ToList(),
        Vpn = _engine.GetState(),
        Version = "1.3.0",
        VersionDisplay = "1.3 (1)",
        OpenVpn = _engine.OpenVpnInfo()
    };

    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    private void SendIpcResponse(int id, object? result, string? error)
    {
        var msg = JsonSerializer.Serialize(new { type = "response", id, result, error }, _jsonOptions);
        Invoke(() =>
        {
            if (!_webView.IsDisposed && _webView.CoreWebView2 != null)
            {
                _webView.CoreWebView2.PostWebMessageAsJson(msg);
            }
        });
    }

    public void SendIpcEvent(string channel, object? payload)
    {
        var msg = JsonSerializer.Serialize(new { type = "event", channel, payload }, _jsonOptions);
        try
        {
            Invoke(() =>
            {
                if (!_webView.IsDisposed && _webView.CoreWebView2 != null)
                {
                    _webView.CoreWebView2.PostWebMessageAsJson(msg);
                }
            });
        }
        catch { }
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        if (!_quitting && e.CloseReason == CloseReason.UserClosing)
        {
            e.Cancel = true;
            Hide();
        }
        else
        {
            _quitting = true;
            _engine.ForceStop();
            _trayIcon.Visible = false;
            base.OnFormClosing(e);
        }
    }

    private static string GetBridgeScript() => """
    (function() {
      const callbacks = new Map();
      let reqId = 1;
      const listeners = new Map();

      window.chrome.webview.addEventListener('message', (e) => {
        const msg = e.data;
        if (!msg) return;
        if (msg.type === 'response') {
          const cb = callbacks.get(msg.id);
          if (cb) {
            callbacks.delete(msg.id);
            if (msg.error) cb.reject(new Error(msg.error));
            else cb.resolve(msg.result);
          }
        } else if (msg.type === 'event') {
          const cbs = listeners.get(msg.channel) || [];
          for (const listener of cbs) {
            try { listener(msg.payload); } catch (err) { console.error(err); }
          }
        }
      });

      function invoke(action, ...args) {
        return new Promise((resolve, reject) => {
          const id = reqId++;
          callbacks.set(id, { resolve, reject });
          window.chrome.webview.postMessage({ id, action, args });
        });
      }

      function on(channel, cb) {
        if (!listeners.has(channel)) listeners.set(channel, []);
        listeners.get(channel).push(cb);
        return () => {
          const list = listeners.get(channel) || [];
          const idx = list.indexOf(cb);
          if (idx >= 0) list.splice(idx, 1);
        };
      }

      window.api = {
        init: () => invoke('app:init'),
        setSettings: (patch) => invoke('settings:set', patch),
        setWindowBg: (color) => invoke('window:setBg', color),
        importProfile: () => invoke('profiles:import'),
        updateProfile: (id, patch) => invoke('profiles:update', id, patch),
        deleteProfile: (id) => invoke('profiles:delete', id),
        addUser: (login, password) => invoke('users:add', login, password),
        getUserCredentials: (login) => invoke('users:getCredentials', login),
        deleteUser: (login) => invoke('users:delete', login),
        clearUsers: () => invoke('users:clear'),
        resetData: () => invoke('app:reset'),
        notifyOnline: (isOnline) => invoke('app:online', isOnline),
        vpnConnect: (id) => invoke('vpn:connect', id),
        getServiceStatus: () => invoke('service:status'),
        uninstallService: () => invoke('service:uninstall'),
        vpnDisconnect: () => invoke('vpn:disconnect'),
        vpnResume: () => invoke('vpn:resume'),
        vpnSendCredentials: (profileId, username, password) => invoke('vpn:sendCredentials', profileId, username, password),
        vpnGetLog: () => invoke('vpn:getLog'),
        vpnGetState: () => invoke('vpn:getState'),
        copyText: (text) => invoke('clipboard:copy', text),
        openExternal: (url) => invoke('shell:openExternal', url),
        onState: (cb) => on('state:changed', cb),
        onLog: (cb) => on('log:changed', cb),
        onNeedPassword: (cb) => on('vpn:need-password', cb),
        onProfilesChanged: (cb) => on('profiles:changed', cb),
        onUsersChanged: (cb) => on('users:changed', cb),
        onSettingsChanged: (cb) => on('settings:changed', cb)
      };
    })();
    """;
}
