using System;
using System.Threading;
using System.Windows.Forms;

namespace MrOpenVPNClient;

internal static class Program
{
    private static Mutex? _singleInstanceMutex;

    [STAThread]
    private static void Main()
    {
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
