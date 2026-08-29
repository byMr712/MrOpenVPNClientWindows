using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace MrOpenVPNClient;

public class AppSettings
{
    [JsonPropertyName("autoConnect")]
    public bool AutoConnect { get; set; } = false;

    [JsonPropertyName("screenOffPause")]
    public bool ScreenOffPause { get; set; } = false;

    [JsonPropertyName("fullTunnel")]
    public bool FullTunnel { get; set; } = false;

    [JsonPropertyName("notify")]
    public bool Notify { get; set; } = true;

    [JsonPropertyName("debugMode")]
    public bool DebugMode { get; set; } = false;

    [JsonPropertyName("language")]
    public string Language { get; set; } = "en";

    [JsonPropertyName("experimentalTheme")]
    public string ExperimentalTheme { get; set; } = "";

    [JsonPropertyName("lightTheme")]
    public bool LightTheme { get; set; } = false;

    [JsonPropertyName("accentColor")]
    public string AccentColor { get; set; } = "#FFFFFF";

    [JsonPropertyName("customColor")]
    public string CustomColor { get; set; } = "#FF0000";

    [JsonPropertyName("statusAnim")]
    public string StatusAnim { get; set; } = "pulse";

    [JsonPropertyName("profileAnim")]
    public string ProfileAnim { get; set; } = "pulse";

    [JsonPropertyName("animSync")]
    public bool AnimSync { get; set; } = true;

    [JsonPropertyName("lastProfileUuid")]
    public string? LastProfileUuid { get; set; }
}

public class VpnProfile
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("fileName")]
    public string FileName { get; set; } = "";

    [JsonPropertyName("remote")]
    public string? Remote { get; set; }

    [JsonPropertyName("proto")]
    public string? Proto { get; set; }

    [JsonPropertyName("port")]
    public int? Port { get; set; }

    [JsonPropertyName("needAuth")]
    public bool NeedAuth { get; set; } = false;

    [JsonPropertyName("username")]
    public string Username { get; set; } = "";

    [JsonPropertyName("password")]
    public string Password { get; set; } = "";

    [JsonPropertyName("config")]
    public string Config { get; set; } = "";

    [JsonPropertyName("addedAt")]
    public long AddedAt { get; set; } = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
}

public class ProfileDto
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = "";

    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("fileName")]
    public string FileName { get; set; } = "";

    [JsonPropertyName("remote")]
    public string? Remote { get; set; }

    [JsonPropertyName("proto")]
    public string? Proto { get; set; }

    [JsonPropertyName("port")]
    public int? Port { get; set; }

    [JsonPropertyName("needAuth")]
    public bool NeedAuth { get; set; }

    [JsonPropertyName("username")]
    public string Username { get; set; } = "";

    [JsonPropertyName("addedAt")]
    public long AddedAt { get; set; }

    public static ProfileDto From(VpnProfile p) => new()
    {
        Id = p.Id,
        Name = p.Name,
        FileName = p.FileName,
        Remote = p.Remote,
        Proto = p.Proto,
        Port = p.Port,
        NeedAuth = p.NeedAuth,
        Username = p.Username,
        AddedAt = p.AddedAt
    };
}

public class UserDto
{
    [JsonPropertyName("login")]
    public string Login { get; set; } = "";

    [JsonPropertyName("hasPassword")]
    public bool HasPassword { get; set; }
}

public class UserCredentials
{
    [JsonPropertyName("login")]
    public string Login { get; set; } = "";

    [JsonPropertyName("password")]
    public string Password { get; set; } = "";
}

public class OpenVpnInfo
{
    [JsonPropertyName("found")]
    public bool Found { get; set; }

    [JsonPropertyName("path")]
    public string? Path { get; set; }
}

public class VpnState
{
    [JsonPropertyName("level")]
    public string Level { get; set; } = "LEVEL_NOTCONNECTED";

    [JsonPropertyName("profileUuid")]
    public string? ProfileUuid { get; set; }

    [JsonPropertyName("connectedProfileUuid")]
    public string? ConnectedProfileUuid { get; set; }

    [JsonPropertyName("info")]
    public OpenVpnInfo? Info { get; set; }
}

public class PublicState
{
    [JsonPropertyName("settings")]
    public AppSettings Settings { get; set; } = new();

    [JsonPropertyName("profiles")]
    public List<ProfileDto> Profiles { get; set; } = [];

    [JsonPropertyName("users")]
    public List<UserDto> Users { get; set; } = [];

    [JsonPropertyName("vpn")]
    public VpnState Vpn { get; set; } = new();

    [JsonPropertyName("version")]
    public string Version { get; set; } = "1.2.0";

    [JsonPropertyName("versionDisplay")]
    public string VersionDisplay { get; set; } = "1.2 (2)";

    [JsonPropertyName("openvpn")]
    public OpenVpnInfo OpenVpn { get; set; } = new();
}

public class LogEntry
{
    [JsonPropertyName("time")]
    public long Time { get; set; } = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

    [JsonPropertyName("level")]
    public string Level { get; set; } = "D";

    [JsonPropertyName("message")]
    public string Message { get; set; } = "";
}

public class StoreState
{
    [JsonPropertyName("profiles")]
    public List<VpnProfile> Profiles { get; set; } = [];

    [JsonPropertyName("users")]
    public Dictionary<string, string> Users { get; set; } = [];

    [JsonPropertyName("profileOrder")]
    public List<string> ProfileOrder { get; set; } = [];

    [JsonPropertyName("lastProfileUuid")]
    public string? LastProfileUuid { get; set; }

    [JsonPropertyName("settings")]
    public AppSettings Settings { get; set; } = new();
}
