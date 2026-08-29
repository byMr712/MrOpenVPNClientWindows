using System;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

namespace MrOpenVPNClient;

internal static class Program
{
    [DllImport("shell32.dll", SetLastError = true)]
    private static extern int SetCurrentProcessExplicitAppUserModelID([MarshalAs(UnmanagedType.LPWStr)] string AppID);

    private static Mutex? _singleInstanceMutex;

    [STAThread]
    private static void Main()
    {
        try
        {
            SetCurrentProcessExplicitAppUserModelID("byMr712.MrOpenVPNClient.Windows");
        }
        catch { }

        const string mutexName = "Global\\MrOpenVPNClientWindows_SingleInstance";
        _singleInstanceMutex = new Mutex(true, mutexName, out bool isNewInstance);

        if (!isNewInstance)
        {
            // Already running
            return;
        }

        ApplicationConfiguration.Initialize();
        Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);

        Application.Run(new MainForm());

        GC.KeepAlive(_singleInstanceMutex);
    }
}
