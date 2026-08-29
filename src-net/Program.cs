using System;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

namespace MrOpenVPNClient;

internal static class Program
{
    [DllImport("shell32.dll", SetLastError = true)]
    private static extern int SetCurrentProcessExplicitAppUserModelID([MarshalAs(UnmanagedType.LPWStr)] string AppID);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern uint RegisterWindowMessage(string lpString);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

    public const int HWND_BROADCAST = 0xffff;
    public static readonly uint WM_SHOW_MROPENVPN = RegisterWindowMessage("WM_SHOW_MROPENVPN_CLIENT_WINDOW");

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
            // Already running - notify the active instance to restore from tray and bring to front
            PostMessage((IntPtr)HWND_BROADCAST, WM_SHOW_MROPENVPN, IntPtr.Zero, IntPtr.Zero);
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
