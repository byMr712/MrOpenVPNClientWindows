using System;
using System.Diagnostics;
using System.IO;
using System.ServiceProcess;
using System.Threading.Tasks;

namespace MrOpenVPNClient;

public class ServiceStatusResult
{
    public bool Exists { get; set; }
    public bool Running { get; set; }
}

public static class ServiceHelper
{
    public static ServiceStatusResult QueryService(string name = "OpenVPNServiceInteractive")
    {
        try
        {
            using var sc = new ServiceController(name);
            var status = sc.Status;
            return new ServiceStatusResult
            {
                Exists = true,
                Running = status == ServiceControllerStatus.Running
            };
        }
        catch
        {
            return new ServiceStatusResult { Exists = false, Running = false };
        }
    }

    public static string GetScriptPath(string scriptName)
    {
        var baseDir = AppDomain.CurrentDomain.BaseDirectory;
        var p = Path.Combine(baseDir, "scripts", scriptName);
        if (File.Exists(p)) return p;
        var up = Path.Combine(baseDir, "..", "..", "..", "..", "scripts", scriptName);
        if (File.Exists(up)) return Path.GetFullPath(up);
        return p;
    }

    public static async Task<bool> RunElevatedScriptAsync(string scriptPath)
    {
        if (!File.Exists(scriptPath)) return false;

        var escaped = scriptPath.Replace("'", "''");
        var psi = new ProcessStartInfo
        {
            FileName = "powershell.exe",
            Arguments = $"-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"{escaped}\"",
            Verb = "runas",
            UseShellExecute = true,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden
        };

        try
        {
            using var proc = Process.Start(psi);
            if (proc != null)
            {
                await proc.WaitForExitAsync();
                return proc.ExitCode == 0;
            }
        }
        catch { }

        return false;
    }

    public static async Task<bool> EnsureInteractiveServiceAsync()
    {
        var status = QueryService();
        if (status.Running) return true;

        var script = GetScriptPath("install-service.ps1");
        if (!File.Exists(script)) return false;

        await RunElevatedScriptAsync(script);
        await Task.Delay(1000);

        return QueryService().Running;
    }
}
