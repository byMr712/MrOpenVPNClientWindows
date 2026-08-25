using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace MrOpenVPNClient;

public class ParsedConfigResult
{
    public string? Remote { get; set; }
    public string? Proto { get; set; }
    public int? Port { get; set; }
    public bool NeedAuth { get; set; }
    public string? DevType { get; set; }
    public List<string> Errors { get; set; } = [];
    public bool IfconfigAdded { get; set; }
    public string Config { get; set; } = "";
}

public static class ConfigParser
{
    private static readonly HashSet<string> ForbiddenDirectives = new(StringComparer.OrdinalIgnoreCase)
    {
        "up",
        "down",
        "route-up",
        "route-pre-down",
        "ipchange",
        "client-connect",
        "tls-verify",
        "auth-user-pass-verify",
        "plugin",
        "script-security",
        "management",
        "management-hold",
        "management-signal",
        "management-log-cache",
        "management-up-down"
    };

    private static string StripComment(string line)
    {
        var trimmed = line.Trim();
        if (trimmed.StartsWith('#') || trimmed.StartsWith(';')) return "";

        bool inQuote = false;
        for (int i = 0; i < line.Length; i++)
        {
            char ch = line[i];
            if (ch == '"') inQuote = !inQuote;
            if (!inQuote && (ch == '#' || ch == ';'))
            {
                var before = line[..i];
                return before.Trim().Length > 0 ? before : "";
            }
        }
        return line;
    }

    private static string? NormProto(string val)
    {
        var m = Regex.Match(val.ToLowerInvariant().Trim(), @"^(udp|tcp)[46]?(?:-(?:client|server))?$");
        return m.Success ? m.Groups[1].Value : null;
    }

    public static ParsedConfigResult ParseConfig(string text)
    {
        var lines = (text ?? "").Replace("\r\n", "\n").Replace('\r', '\n').Split('\n');
        var outLines = new List<string>();
        string? inTag = null;
        bool needAuth = false;
        string? devType = null;
        string? remote = null;
        string? proto = null;
        int? port = null;
        bool hasIfconfig = false;

        foreach (var raw in lines)
        {
            var line = raw.TrimEnd();
            if (inTag != null)
            {
                outLines.Add(line);
                if (line.Trim().Equals($"</{inTag}>", StringComparison.OrdinalIgnoreCase))
                {
                    inTag = null;
                }
                continue;
            }

            var tagMatch = Regex.Match(line.Trim(), @"^<([a-zA-Z0-9_-]+)>");
            if (tagMatch.Success)
            {
                inTag = tagMatch.Groups[1].Value;
                outLines.Add(line);
                continue;
            }

            var cleaned = StripComment(line);
            if (string.IsNullOrWhiteSpace(cleaned)) continue;

            var parts = cleaned.Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length == 0) continue;

            var key = parts[0].ToLowerInvariant();

            // Security: ignore directives that can execute arbitrary scripts/binaries
            if (ForbiddenDirectives.Contains(key))
            {
                continue;
            }

            if (key == "dev")
            {
                var val = parts.Length > 1 ? parts[1] : "";
                if (val.StartsWith("tap", StringComparison.OrdinalIgnoreCase)) devType = "tap";
                else if (val.StartsWith("tun", StringComparison.OrdinalIgnoreCase)) devType = "tun";
            }
            else if (key == "dev-type")
            {
                var val = parts.Length > 1 ? parts[1] : "";
                if (val.Equals("tap", StringComparison.OrdinalIgnoreCase)) devType = "tap";
                else if (val.Equals("tun", StringComparison.OrdinalIgnoreCase)) devType = "tun";
            }
            else if (key == "ifconfig")
            {
                hasIfconfig = true;
            }
            else if (key == "auth-user-pass")
            {
                needAuth = true;
            }
            else if (key == "remote")
            {
                if (parts.Length > 1)
                {
                    remote = parts[1];
                    if (parts.Length > 2 && int.TryParse(parts[2], out int p)) port = p;
                    if (parts.Length > 3)
                    {
                        var pr = NormProto(parts[3]);
                        if (pr != null) proto = pr;
                    }
                }
            }
            else if (key == "proto")
            {
                if (parts.Length > 1)
                {
                    var pr = NormProto(parts[1]);
                    if (pr != null) proto = pr;
                }
            }

            if (key == "auth-user-pass" && parts.Length > 1)
            {
                outLines.Add("auth-user-pass");
            }
            else
            {
                outLines.Add(line);
            }
        }

        var errors = new List<string>();
        if (devType == "tap")
        {
            errors.Add("Only tun mode configurations are supported");
        }

        bool ifconfigAdded = false;
        if (devType == "tun" && !hasIfconfig && OperatingSystem.IsWindows())
        {
            outLines.Add("ifconfig 10.8.0.2 10.8.0.1");
            ifconfigAdded = true;
        }

        return new ParsedConfigResult
        {
            Remote = remote,
            Proto = proto ?? (remote != null ? "udp" : null),
            Port = port,
            NeedAuth = needAuth,
            DevType = devType,
            Errors = errors,
            IfconfigAdded = ifconfigAdded,
            Config = string.Join("\n", outLines)
        };
    }
}
