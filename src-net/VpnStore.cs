using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace MrOpenVPNClient;

public class VpnStore
{
    private static readonly object _lock = new();
    private StoreState _state = new();
    private readonly string _filePath;

    public VpnStore()
    {
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        var dir = Path.Combine(appData, "mropenvpn-client-windows");
        Directory.CreateDirectory(dir);
        _filePath = Path.Combine(dir, "state.json");
        Load();
    }

    public static string EncryptSecret(string plain)
    {
        if (string.IsNullOrEmpty(plain)) return "";
        try
        {
            var bytes = Encoding.UTF8.GetBytes(plain);
            var encrypted = ProtectedData.Protect(bytes, null, DataProtectionScope.CurrentUser);
            return "enc:" + Convert.ToBase64String(encrypted);
        }
        catch
        {
            return plain;
        }
    }

    public static string DecryptSecret(string cipher)
    {
        if (string.IsNullOrEmpty(cipher)) return "";
        if (cipher.StartsWith("enc:"))
        {
            try
            {
                var bytes = Convert.FromBase64String(cipher[4..]);
                var decrypted = ProtectedData.Unprotect(bytes, null, DataProtectionScope.CurrentUser);
                return Encoding.UTF8.GetString(decrypted);
            }
            catch
            {
                return "";
            }
        }
        return cipher;
    }

    public void Load()
    {
        lock (_lock)
        {
            if (!File.Exists(_filePath))
            {
                _state = new StoreState();
                Save();
                return;
            }

            try
            {
                var json = File.ReadAllText(_filePath, Encoding.UTF8);
                var raw = JsonSerializer.Deserialize<StoreState>(json) ?? new StoreState();

                // Decrypt passwords in memory
                foreach (var p in raw.Profiles)
                {
                    p.Password = DecryptSecret(p.Password);
                }

                var decryptedUsers = new Dictionary<string, string>();
                foreach (var (k, v) in raw.Users)
                {
                    decryptedUsers[k] = DecryptSecret(v);
                }
                raw.Users = decryptedUsers;

                _state = raw;
            }
            catch
            {
                _state = new StoreState();
                Save();
            }
        }
    }

    public void Save()
    {
        lock (_lock)
        {
            try
            {
                // Clone state with encrypted secrets for disk storage
                var toSave = new StoreState
                {
                    ProfileOrder = new List<string>(_state.ProfileOrder),
                    LastProfileUuid = _state.LastProfileUuid,
                    Settings = _state.Settings,
                    Profiles = _state.Profiles.Select(p => new VpnProfile
                    {
                        Id = p.Id,
                        Name = p.Name,
                        FileName = p.FileName,
                        Remote = p.Remote,
                        Proto = p.Proto,
                        Port = p.Port,
                        NeedAuth = p.NeedAuth,
                        Username = p.Username,
                        Password = EncryptSecret(p.Password),
                        Config = p.Config,
                        AddedAt = p.AddedAt
                    }).ToList(),
                    Users = _state.Users.ToDictionary(kvp => kvp.Key, kvp => EncryptSecret(kvp.Value))
                };

                var json = JsonSerializer.Serialize(toSave, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(_filePath, json, Encoding.UTF8);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Store save error: {ex.Message}");
            }
        }
    }

    public AppSettings GetSettings()
    {
        lock (_lock) return _state.Settings;
    }

    public AppSettings SetSettings(Dictionary<string, JsonElement> patch)
    {
        lock (_lock)
        {
            var s = _state.Settings;
            foreach (var (key, val) in patch)
            {
                switch (key)
                {
                    case "autoConnect": s.AutoConnect = val.GetBoolean(); break;
                    case "screenOffPause": s.ScreenOffPause = val.GetBoolean(); break;
                    case "fullTunnel": s.FullTunnel = val.GetBoolean(); break;
                    case "notify": s.Notify = val.GetBoolean(); break;
                    case "debugMode": s.DebugMode = val.GetBoolean(); break;
                    case "language": s.Language = val.GetString() ?? s.Language; break;
                    case "experimentalTheme": s.ExperimentalTheme = val.GetString() ?? ""; break;
                    case "lightTheme": s.LightTheme = val.GetBoolean(); break;
                    case "accentColor": s.AccentColor = val.GetString() ?? s.AccentColor; break;
                    case "customColor": s.CustomColor = val.GetString() ?? s.CustomColor; break;
                    case "statusAnim": s.StatusAnim = val.GetString() ?? s.StatusAnim; break;
                    case "profileAnim": s.ProfileAnim = val.GetString() ?? s.ProfileAnim; break;
                    case "animSync": s.AnimSync = val.GetBoolean(); break;
                    case "lastProfileUuid": s.LastProfileUuid = val.GetString(); break;
                }
            }
            Save();
            return s;
        }
    }

    public List<VpnProfile> GetProfiles()
    {
        lock (_lock)
        {
            var byId = _state.Profiles.ToDictionary(p => p.Id);
            var ordered = _state.ProfileOrder.Where(id => byId.ContainsKey(id)).Select(id => byId[id]).ToList();
            var missing = _state.Profiles.Where(p => !_state.ProfileOrder.Contains(p.Id)).ToList();
            return ordered.Concat(missing).ToList();
        }
    }

    public VpnProfile? GetProfile(string id)
    {
        lock (_lock)
        {
            return _state.Profiles.FirstOrDefault(p => p.Id == id);
        }
    }

    public VpnProfile AddProfile(VpnProfile profile)
    {
        lock (_lock)
        {
            if (string.IsNullOrEmpty(profile.Id)) profile.Id = Guid.NewGuid().ToString();
            _state.Profiles.Add(profile);
            if (!_state.ProfileOrder.Contains(profile.Id))
                _state.ProfileOrder.Add(profile.Id);
            Save();
            return profile;
        }
    }

    public VpnProfile? UpdateProfile(string id, Dictionary<string, JsonElement> patch)
    {
        lock (_lock)
        {
            var p = _state.Profiles.FirstOrDefault(x => x.Id == id);
            if (p == null) return null;

            foreach (var (key, val) in patch)
            {
                switch (key)
                {
                    case "name": p.Name = val.GetString() ?? p.Name; break;
                    case "username": p.Username = val.GetString() ?? ""; break;
                    case "password": p.Password = val.GetString() ?? ""; break;
                    case "remote": p.Remote = val.GetString(); break;
                    case "proto": p.Proto = val.GetString(); break;
                    case "port": p.Port = val.ValueKind == JsonValueKind.Number ? val.GetInt32() : null; break;
                }
            }
            Save();
            return p;
        }
    }

    public bool RemoveProfile(string id)
    {
        lock (_lock)
        {
            var p = _state.Profiles.FirstOrDefault(x => x.Id == id);
            if (p != null)
            {
                _state.Profiles.Remove(p);
                _state.ProfileOrder.Remove(id);
                if (_state.LastProfileUuid == id) _state.LastProfileUuid = null;
                Save();
                return true;
            }
            return false;
        }
    }

    public string UniqueProfileName(string baseName)
    {
        lock (_lock)
        {
            var names = new HashSet<string>(_state.Profiles.Select(p => p.Name));
            if (!names.Contains(baseName)) return baseName;
            int i = 2;
            while (names.Contains($"{baseName} ({i})")) i++;
            return $"{baseName} ({i})";
        }
    }

    public List<UserCredentials> GetUsers()
    {
        lock (_lock)
        {
            return _state.Users
                .Select(kvp => new UserCredentials { Login = kvp.Key, Password = kvp.Value })
                .OrderBy(u => u.Login, StringComparer.Ordinal)
                .ToList();
        }
    }

    public string? UserPassword(string login)
    {
        lock (_lock)
        {
            return _state.Users.TryGetValue(login, out var pwd) ? pwd : null;
        }
    }

    public string UniqueUserName(string baseName)
    {
        lock (_lock)
        {
            var names = new HashSet<string>(_state.Users.Keys);
            if (!names.Contains(baseName)) return baseName;
            int i = 2;
            while (names.Contains($"{baseName} ({i})")) i++;
            return $"{baseName} ({i})";
        }
    }

    public void SaveUser(string login, string password)
    {
        lock (_lock)
        {
            _state.Users[login] = password;
            Save();
        }
    }

    public void DeleteUser(string login)
    {
        lock (_lock)
        {
            _state.Users.Remove(login);
            foreach (var p in _state.Profiles)
            {
                if (p.Username == login)
                {
                    p.Username = "";
                    p.Password = "";
                }
            }
            Save();
        }
    }

    public void ClearUsers()
    {
        lock (_lock)
        {
            _state.Users.Clear();
            foreach (var p in _state.Profiles)
            {
                p.Username = "";
                p.Password = "";
            }
            Save();
        }
    }

    public void ResetAll()
    {
        lock (_lock)
        {
            _state = new StoreState();
            Save();
        }
    }
}
