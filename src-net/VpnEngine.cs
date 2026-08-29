using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;

namespace MrOpenVPNClient;

public class VpnEngine
{
    public const string LEVEL_NOTCONNECTED = "LEVEL_NOTCONNECTED";
    public const string LEVEL_START = "LEVEL_START";
    public const string LEVEL_CONNECTING_NO_SERVER_REPLY_YET = "LEVEL_CONNECTING_NO_SERVER_REPLY_YET";
    public const string LEVEL_CONNECTING_SERVER_REPLIED = "LEVEL_CONNECTING_SERVER_REPLIED";
    public const string LEVEL_WAITING_FOR_USER_INPUT = "LEVEL_WAITING_FOR_USER_INPUT";
    public const string LEVEL_CONNECTED = "LEVEL_CONNECTED";
    public const string LEVEL_VPNPAUSED = "LEVEL_VPNPAUSED";
    public const string LEVEL_AUTH_FAILED = "LEVEL_AUTH_FAILED";
    public const string LEVEL_NONETWORK = "LEVEL_NONETWORK";
    public const string LEVEL_UNKNOWN = "LEVEL_UNKNOWN";

    public string Level { get; private set; } = LEVEL_NOTCONNECTED;
    public string? ProfileUuid { get; private set; }
    public VpnProfile? CurrentProfile { get; private set; }

    private readonly List<LogEntry> _logBuffer = [];
    private readonly object _logLock = new();

    private TcpClient? _mgmtClient;
    private NetworkStream? _mgmtStream;
    private CancellationTokenSource? _mgmtCts;
    private int? _servicePid;
    private string? _tempDir;
    private string? _lastLog;
    private string? _lastActiveLevel;
    private TaskCompletionSource<bool>? _pendingConnectTcs;
    private UserCredentials? _pendingCreds;

    public event Action<VpnState>? StateChanged;
    public event Action<LogEntry>? LogReceived;
    public event Action<string, string>? NeedPassword; // profileId, kind

    private readonly VpnStore _store;

    public VpnEngine(VpnStore store)
    {
        _store = store;
    }

    public string BinDir()
    {
        var baseDir = AppDomain.CurrentDomain.BaseDirectory;
        var p = Path.Combine(baseDir, "bin");
        if (Directory.Exists(p)) return p;
        var up = Path.Combine(baseDir, "..", "..", "..", "..", "bin");
        if (Directory.Exists(up)) return Path.GetFullPath(up);
        return p;
    }

    public string? OpenVpnPath()
    {
        var p = Path.Combine(BinDir(), "openvpn.exe");
        return File.Exists(p) ? p : null;
    }

    public OpenVpnInfo OpenVpnInfo()
    {
        var p = OpenVpnPath();
        return new OpenVpnInfo { Found = p != null, Path = p };
    }

    public void CleanupTemp()
    {
        if (_tempDir != null && Directory.Exists(_tempDir))
        {
            try
            {
                Directory.Delete(_tempDir, true);
            }
            catch { }
        }
        _tempDir = null;
    }

    public bool IsActive()
    {
        return Level is LEVEL_CONNECTED or
            LEVEL_CONNECTING_NO_SERVER_REPLY_YET or
            LEVEL_CONNECTING_SERVER_REPLIED or
            LEVEL_START or
            LEVEL_WAITING_FOR_USER_INPUT or
            LEVEL_VPNPAUSED or
            LEVEL_AUTH_FAILED;
    }

    public async Task<bool> ConnectAsync(VpnProfile profile)
    {
        var openvpn = OpenVpnPath();
        if (openvpn == null)
        {
            throw new InvalidOperationException("openvpn_not_found");
        }

        if (IsActive())
        {
            if (ProfileUuid == profile.Id && Level is LEVEL_CONNECTED or LEVEL_START or LEVEL_CONNECTING_NO_SERVER_REPLY_YET or LEVEL_CONNECTING_SERVER_REPLIED)
            {
                return true;
            }
            ForceStop();
        }

        CurrentProfile = profile;
        ProfileUuid = profile.Id;

        bool hasCreds = !string.IsNullOrEmpty(profile.Username) && !string.IsNullOrEmpty(profile.Password);
        if (hasCreds)
        {
            await SpawnOpenVpnAsync(profile);
            return true;
        }

        SetLevel(LEVEL_WAITING_FOR_USER_INPUT, profile.Id);
        NeedPassword?.Invoke(profile.Id, "auth");

        _pendingConnectTcs = new TaskCompletionSource<bool>();
        return await _pendingConnectTcs.Task;
    }

    public async Task SpawnOpenVpnAsync(VpnProfile profile)
    {
        Log("MrOpenVPN Windows Client starting");
        SetLevel(LEVEL_START, profile.Id);

        var creds = (_pendingCreds != null && ProfileUuid == profile.Id)
            ? _pendingCreds
            : new UserCredentials { Login = profile.Username, Password = profile.Password };

        if (string.IsNullOrEmpty(creds.Login) || string.IsNullOrEmpty(creds.Password))
        {
            HandleProcessExit();
            throw new InvalidOperationException("missing_credentials");
        }

        try
        {
            int port = GetFreePort();
            _tempDir = Path.Combine(Path.GetTempPath(), "mropenvpn-" + Guid.NewGuid().ToString("N")[..8]);
            Directory.CreateDirectory(_tempDir);

            var cfgPath = Path.Combine(_tempDir, "client.ovpn");
            var authPath = Path.Combine(_tempDir, "auth.txt");
            var logPath = Path.Combine(_tempDir, "openvpn.log");

            var cleanLogin = (creds.Login ?? "").Trim('\r', '\n');
            var cleanPassword = (creds.Password ?? "").Trim('\r', '\n');
            File.WriteAllText(authPath, $"{cleanLogin}\n{cleanPassword}\n", new UTF8Encoding(false));

            var authFile = authPath.Replace('\\', '/');
            var logFile = logPath.Replace('\\', '/');

            var settings = _store.GetSettings();
            var configLines = (profile.Config ?? "").Replace("\r\n", "\n").Split('\n');
            var sb = new StringBuilder();
            foreach (var l in configLines)
            {
                if (!Regex.IsMatch(l, @"^\s*(redirect-gateway|block-outside-dns)\b", RegexOptions.IgnoreCase))
                {
                    sb.AppendLine(l);
                }
            }

            if (settings.FullTunnel)
            {
                sb.AppendLine("redirect-gateway def1");
                sb.AppendLine("block-outside-dns");
            }

            if (!Regex.IsMatch(profile.Config ?? "", @"^\s*windows-driver\b", RegexOptions.Multiline | RegexOptions.IgnoreCase))
            {
                sb.AppendLine("windows-driver wintun");
            }

            sb.AppendLine($"auth-user-pass \"{authFile}\"");
            sb.AppendLine($"log \"{logFile}\"");
            sb.AppendLine("script-security 0");
            sb.AppendLine("verb 3");

            File.WriteAllText(cfgPath, sb.ToString(), Encoding.UTF8);

            var options = $"--config \"{cfgPath}\" --management 127.0.0.1 {port} --management-log-cache 2000";

            var openvpn = OpenVpnPath();
            Log($"OpenVPN: {Path.GetFileName(openvpn ?? "openvpn.exe")}");
            var userData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "mropenvpn-client-windows");
            int pid = await StartViaServiceAsync(userData, options);
            _servicePid = pid;
            Log($"OpenVPN started via interactive service (pid {pid})");

            _ = ConnectManagementAsync(port);
        }
        catch (Exception ex)
        {
            Log($"OpenVPN start error: {ex.Message}");
            HandleProcessExit();
            throw;
        }
    }

    private static int GetFreePort()
    {
        var l = new TcpListener(IPAddress.Loopback, 0);
        l.Start();
        int port = ((IPEndPoint)l.LocalEndpoint).Port;
        l.Stop();
        return port;
    }

    private static bool TryParseHex(string? s, out int result)
    {
        result = 0;
        if (string.IsNullOrWhiteSpace(s)) return false;
        var trimmed = s.Trim();
        if (trimmed.StartsWith("0x", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed[2..];
        }
        return int.TryParse(trimmed, System.Globalization.NumberStyles.HexNumber, null, out result);
    }

    private static async Task<int> StartViaServiceAsync(string directory, string options)
    {
        const string pipeName = "openvpn\\service";
        using var pipe = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut, PipeOptions.Asynchronous);

        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(15));
        await pipe.ConnectAsync(cts.Token);

        var payload = $"{directory}\0{options}\0\0";
        var bytes = Encoding.Unicode.GetBytes(payload);
        await pipe.WriteAsync(bytes, cts.Token);
        await pipe.FlushAsync(cts.Token);

        var buffer = new byte[4096];
        var ms = new MemoryStream();
        while (!cts.IsCancellationRequested)
        {
            int read = await pipe.ReadAsync(buffer, cts.Token);
            if (read == 0) break;
            ms.Write(buffer, 0, read);
            var text = Encoding.Unicode.GetString(ms.ToArray());
            var lines = text.Replace("\r\n", "\n").Split('\n');
            if (lines.Length >= 2 && TryParseHex(lines[0], out int errCode) && TryParseHex(lines[1], out int pid))
            {
                if (errCode != 0 || pid <= 0)
                {
                    var msg = lines.Length > 2 && !string.IsNullOrWhiteSpace(lines[2]) ? lines[2].Trim() : lines[1].Trim();
                    throw new InvalidOperationException($"interactive_service_error: {msg}");
                }
                return pid;
            }
        }

        if (ms.Length > 0)
        {
            var text = Encoding.Unicode.GetString(ms.ToArray());
            var lines = text.Replace("\r\n", "\n").Split('\n');
            if (lines.Length >= 2 && TryParseHex(lines[0], out int errCode) && TryParseHex(lines[1], out int pid))
            {
                if (errCode == 0 && pid > 0)
                {
                    return pid;
                }
                var msg = lines.Length > 2 && !string.IsNullOrWhiteSpace(lines[2]) ? lines[2].Trim() : lines[1].Trim();
                throw new InvalidOperationException($"interactive_service_error: {msg}");
            }
        }

        throw new InvalidOperationException("interactive_service_closed");
    }

    private async Task ConnectManagementAsync(int port)
    {
        for (int attempt = 0; attempt < 40; attempt++)
        {
            try
            {
                var client = new TcpClient();
                await client.ConnectAsync(IPAddress.Loopback, port);
                client.NoDelay = true;
                AttachManagement(client);
                return;
            }
            catch
            {
                await Task.Delay(250);
            }
        }

        Log("Could not connect to the OpenVPN management interface");
        ReadOpenVpnLogTail();
        HandleProcessExit();
    }

    private void AttachManagement(TcpClient client)
    {
        _mgmtClient = client;
        _mgmtStream = client.GetStream();
        _mgmtCts = new CancellationTokenSource();

        _ = Task.Run(async () =>
        {
            var reader = new StreamReader(_mgmtStream, Encoding.UTF8);
            try
            {
                while (!_mgmtCts.Token.IsCancellationRequested)
                {
                    var line = await reader.ReadLineAsync(_mgmtCts.Token);
                    if (line == null) break;
                    HandleManagementLine(line.TrimEnd('\r'));
                }
            }
            catch { }
            finally
            {
                if (_mgmtClient == client)
                {
                    _mgmtClient = null;
                    HandleProcessExit();
                }
            }
        });

        SendMgmt("state on");
        SendMgmt("log on all");
        SendMgmt("log history 1000");
        SendMgmt("bytecount 1");
    }

    public void SendMgmt(string line)
    {
        if (_mgmtStream != null && _mgmtClient != null && _mgmtClient.Connected)
        {
            try
            {
                var bytes = Encoding.UTF8.GetBytes(line + "\n");
                _mgmtStream.Write(bytes, 0, bytes.Length);
                _mgmtStream.Flush();
            }
            catch { }
        }
    }

    private void ReadOpenVpnLogTail()
    {
        if (_tempDir == null) return;
        var logPath = Path.Combine(_tempDir, "openvpn.log");
        if (!File.Exists(logPath)) return;
        try
        {
            var lines = File.ReadAllLines(logPath);
            foreach (var line in lines.TakeLast(40))
            {
                Log(line);
            }
        }
        catch { }
    }

    private void HandleManagementLine(string line)
    {
        if (line.StartsWith(">STATE:"))
        {
            var parts = line.Split(',');
            var state = (parts.Length > 1 ? parts[1] : "").Trim();
            HandleState(state);
            return;
        }
        if (line.StartsWith(">LOG:"))
        {
            var rest = line[(line.IndexOf(':') + 1)..];
            var commaIdx = rest.IndexOf(',');
            var after = commaIdx >= 0 ? rest[(commaIdx + 1)..] : rest;
            var secondComma = after.IndexOf(',');
            var msg = secondComma >= 0 ? after[(secondComma + 1)..] : after;
            var level = (secondComma >= 0 ? after[..secondComma] : "D").Trim();
            HandleLog(level, msg);
            return;
        }
        if (line.StartsWith(">PASSWORD:Need "))
        {
            HandlePasswordNeed(line);
            return;
        }
        if (line.StartsWith(">PASSWORD:Verification Failed"))
        {
            Log("AUTH_FAILED: OpenVPN reported verification failed");
            SetLevel(LEVEL_AUTH_FAILED, ProfileUuid);
            return;
        }
        if (line.StartsWith("SUCCESS:"))
        {
            if (line.Contains("pause", StringComparison.OrdinalIgnoreCase))
            {
                SetLevel(LEVEL_VPNPAUSED, ProfileUuid);
            }
            else if (line.Contains("resume", StringComparison.OrdinalIgnoreCase))
            {
                if (_lastActiveLevel != null && _lastActiveLevel != LEVEL_VPNPAUSED)
                {
                    SetLevel(_lastActiveLevel, ProfileUuid);
                }
            }
        }
    }

    private void HandleState(string state)
    {
        switch (state)
        {
            case "CONNECTING":
            case "RESOLVE":
            case "TCP_CONNECT":
            case "WAIT":
            case "AUTH":
            case "RECONNECTING":
                SetLevel(LEVEL_CONNECTING_NO_SERVER_REPLY_YET, ProfileUuid);
                break;
            case "GET_CONFIG":
            case "ASSIGN_IP":
            case "ADD_ROUTES":
                SetLevel(LEVEL_CONNECTING_SERVER_REPLIED, ProfileUuid);
                break;
            case "CONNECTED":
                SetLevel(LEVEL_CONNECTED, ProfileUuid);
                break;
            case "EXITING":
                SetLevel(LEVEL_NOTCONNECTED, ProfileUuid);
                break;
        }
    }

    private void HandlePasswordNeed(string line)
    {
        string kind = line.Contains("'Auth'") ? "auth" : "private-key";
        var creds = _pendingCreds;
        if (kind == "auth" && creds != null && !string.IsNullOrEmpty(creds.Login) && !string.IsNullOrEmpty(creds.Password))
        {
            SendAuth(creds.Login, creds.Password);
            _pendingCreds = null;
            return;
        }
        SetLevel(LEVEL_WAITING_FOR_USER_INPUT, ProfileUuid);
        if (ProfileUuid != null)
        {
            NeedPassword?.Invoke(ProfileUuid, kind);
        }
    }

    private void HandleLog(string level, string msg)
    {
        var text = (msg ?? "").TrimStart(',');
        if (_lastLog == text) return;
        _lastLog = text;
        Log(text);

        if (Regex.IsMatch(text, "AUTH_FAILED", RegexOptions.IgnoreCase))
        {
            SetLevel(LEVEL_AUTH_FAILED, ProfileUuid);
            return;
        }
        if (Regex.IsMatch(text, @"Cannot open TUN/TAP|All TAP-Windows adapters", RegexOptions.IgnoreCase))
        {
            SetLevel(LEVEL_UNKNOWN, ProfileUuid);
            return;
        }
    }

    public void SetPendingCredentials(string profileId, string username, string password)
    {
        _pendingCreds = new UserCredentials { Login = username, Password = password };
        if (_pendingConnectTcs != null && CurrentProfile?.Id == profileId)
        {
            var tcs = _pendingConnectTcs;
            _pendingConnectTcs = null;
            _ = Task.Run(async () =>
            {
                try
                {
                    await SpawnOpenVpnAsync(CurrentProfile);
                    tcs.TrySetResult(true);
                }
                catch (Exception ex)
                {
                    tcs.TrySetException(ex);
                }
            });
        }
        else if (_pendingConnectTcs != null)
        {
            _pendingConnectTcs.TrySetCanceled();
            _pendingConnectTcs = null;
            SetLevel(LEVEL_NOTCONNECTED, profileId);
        }
    }

    public void SendAuth(string username, string password)
    {
        var cleanUser = (username ?? "").Replace("\r", "").Replace("\n", "");
        var cleanPass = (password ?? "").Replace("\r", "").Replace("\n", "");
        var safeUser = cleanUser.Replace("\\", "\\\\").Replace("\"", "\\\"");
        var safePass = cleanPass.Replace("\\", "\\\\").Replace("\"", "\\\"");
        SendMgmt($"password auth \"{safeUser}\" \"{safePass}\"");
        if (Level == LEVEL_WAITING_FOR_USER_INPUT)
        {
            SetLevel(LEVEL_CONNECTING_NO_SERVER_REPLY_YET, ProfileUuid);
        }
        Log("Sending credentials to the OpenVPN server");
    }

    public void Disconnect()
    {
        if (_pendingConnectTcs != null)
        {
            _pendingConnectTcs.TrySetCanceled();
            _pendingConnectTcs = null;
            if (ProfileUuid != null) SetLevel(LEVEL_NOTCONNECTED, ProfileUuid);
            return;
        }

        if (_mgmtClient == null && _servicePid == null)
        {
            if (ProfileUuid != null) SetLevel(LEVEL_NOTCONNECTED, ProfileUuid);
            return;
        }

        if (ProfileUuid != null) Log("Disconnecting…");
        SendMgmt("signal SIGTERM");

        Task.Delay(3000).ContinueWith(_ =>
        {
            if (ProfileUuid != null && Level != LEVEL_NOTCONNECTED)
            {
                StopViaTaskkill();
                SetLevel(LEVEL_NOTCONNECTED, ProfileUuid);
            }
        });
    }

    public void ForceStop()
    {
        if (_pendingConnectTcs != null)
        {
            _pendingConnectTcs.TrySetCanceled();
            _pendingConnectTcs = null;
        }
        SendMgmt("signal SIGTERM");
        StopViaTaskkill();
    }

    private void StopViaTaskkill()
    {
        if (!_servicePid.HasValue) return;
        try
        {
            var psi = new ProcessStartInfo("taskkill.exe", $"/PID {_servicePid.Value} /T /F")
            {
                CreateNoWindow = true,
                UseShellExecute = false
            };
            Process.Start(psi);
        }
        catch { }
    }

    public void Pause()
    {
        if (Level == LEVEL_CONNECTED)
        {
            _lastActiveLevel = Level;
            SendMgmt("pause");
        }
    }

    public void Resume()
    {
        SendMgmt("resume");
    }

    public void HandleProcessExit()
    {
        _mgmtCts?.Cancel();
        _mgmtClient?.Dispose();
        _mgmtClient = null;
        _mgmtStream = null;
        _servicePid = null;
        if (ProfileUuid != null)
        {
            SetLevel(LEVEL_NOTCONNECTED, ProfileUuid);
        }
        CleanupTemp();
    }

    public void SetLevel(string level, string? profileUuid)
    {
        Level = level;
        if (profileUuid != null) ProfileUuid = profileUuid;
        StateChanged?.Invoke(GetState());
    }

    public VpnState GetState() => new()
    {
        Level = Level,
        ProfileUuid = ProfileUuid,
        ConnectedProfileUuid = Level == LEVEL_CONNECTED ? ProfileUuid : null,
        Info = OpenVpnInfo()
    };

    public void Log(string message)
    {
        var entry = new LogEntry
        {
            Time = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            Level = "D",
            Message = message
        };
        lock (_logLock)
        {
            _logBuffer.Add(entry);
            if (_logBuffer.Count > 4000) _logBuffer.RemoveAt(0);
        }
        LogReceived?.Invoke(entry);
    }

    public List<LogEntry> GetLog()
    {
        lock (_logLock)
        {
            return new List<LogEntry>(_logBuffer);
        }
    }
}
